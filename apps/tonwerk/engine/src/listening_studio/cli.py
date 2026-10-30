"""`atlas-listening`: the studio's command line.

`serve` starts the API Tonwerk talks to; `scene …` is every operation on a scene project (convert,
validate, store, render, QA, publish — `scene/cli.py`); `voices …` is the consented voice store;
`sources …` imports reviewed Freesound originals; `models …` lists and fetches the pinned weights;
`generate-character-demos` makes the roster's audition takes; `doctor` checks the toolchain.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import webbrowser
from pathlib import Path
from typing import cast

import typer
import uvicorn
from huggingface_hub import snapshot_download

from .catalogs import load_character_catalog
from .dsp.audio import conform
from .generative.fake import FakeSpeech
from .generative.gateway import CloningSpeechGenerator, SpeechRequest, SpeechGenerator
from .generative.locks import model_lock, set_models_root
from .generative.qwen import QwenSpeech
from .generative.registry import CLONING_ENGINES, engine_for
from .graph.assets import sha256_file
from .qa import transcribe
from .scene.cli import app as scene_app, emit_text, json_verb
from .sources import import_source, list_sources
from .storage import Store
from .web import TONWERK_DIST, app as web_app

app = typer.Typer(no_args_is_help=True)
models = typer.Typer()
sources = typer.Typer()
#: Consented voice references. Every verb mirrors a route of `/api/voices`, and that parity is the
#: point rather than a convenience: an agent working this repository has a shell and not a browser,
#: and a capability reachable only through the workbench is a capability half the operators of this
#: studio cannot use.
voices = typer.Typer()
app.add_typer(models, name="models")
app.add_typer(sources, name="sources")
app.add_typer(voices, name="voices")
# Defined in `scene/cli.py` rather than here so the verbs stay reachable without the render stack
# this module imports at the top.
app.add_typer(scene_app, name="scene")
PACKAGE_ROOT = Path(__file__).resolve().parents[2]


def repo_root(repo: Path) -> Path:
    """Resolve `--repo` once, and make it the root `.models/` is looked for under.

    Every command that can reach a model takes the repository as an option already. Stating it
    here is what keeps the weights lookup from depending on where this package happens to sit.
    """

    resolved = repo.resolve()
    set_models_root(resolved)
    return resolved


@app.command()
def serve(repo: Path = typer.Option(Path.cwd()), port: int = 8765, no_open: bool = False) -> None:
    store = Store()
    api = web_app(store, repo_root(repo))
    token = api.state.session_token
    url = f"http://127.0.0.1:{port}/"
    typer.echo(f"Tonwerk: {url}")
    # The one place the secret exists. It is generated per run and never written to disk, so this
    # line is the only copy: Tonwerk's token screen is typed into from it, and so is any agent or
    # CLI. The URL no longer carries it — `?token=` was the legacy HTML pages' way in and went
    # with them, and a token in an address bar is a token in the shell history of whoever pastes it.
    typer.echo(f"API bearer token: {token}")
    typer.echo(f'  curl -H "Authorization: Bearer {token}" http://127.0.0.1:{port}/api/registry')
    if not TONWERK_DIST.is_dir():
        typer.echo("Tonwerk is not built; / answers a hint. Build it with: bun run tonwerk:build")
    if not no_open:
        webbrowser.open(url)
    uvicorn.run(api, host="127.0.0.1", port=port)


@app.command("generate-character-demos")
def generate_character_demos(
    repo: Path = typer.Option(Path.cwd()), test_adapter: bool = False
) -> None:
    """Generate three local audition takes per roster character; never approve them.

    What `GET /api/characters/{id}/demos/{n}` serves to the Figuren view. The take is the
    character's catalog voice, seed, style and pace on each of its comparison phrases, conformed
    to the 16 kHz mono format every audition is stored in.
    """

    store = Store()
    engine: SpeechGenerator = FakeSpeech() if test_adapter else QwenSpeech()
    catalog = load_character_catalog(repo_root(repo))
    for character in catalog.characters:
        target = store.root / "characters" / character.id
        target.mkdir(parents=True, exist_ok=True)
        hashes: list[str] = []
        profile = character.voice_profile
        for index, phrase in enumerate(character.demo_phrases, 1):
            path = target / f"demo-{index}.wav"
            raw = path.with_name(path.name + ".model.wav")
            try:
                engine.generate(
                    SpeechRequest(
                        text=phrase,
                        voice=profile.voice,
                        language="German",
                        style=profile.style,
                        seed=profile.seed,
                    ),
                    raw,
                )
                conform(raw, path, profile.pace)
            finally:
                raw.unlink(missing_ok=True)
            hashes.append(sha256_file(path))
        (target / "manifest.json").write_text(
            json.dumps(
                {
                    "character_id": character.id,
                    "character_version": character.version,
                    "adapter_revision": engine.revision,
                    "phrases": character.demo_phrases,
                    "wav_sha256": hashes,
                    "status": "pending-human-review",
                },
                ensure_ascii=False,
                indent=2,
                sort_keys=True,
            )
            + "\n"
        )
        typer.echo(f"{character.id}: {len(hashes)} draft demos")


@voices.command("create")
@json_verb
def create_voice(
    voice_id: str,
    reference: Path = typer.Option(..., exists=True, help="The consented recording (WAV)."),
    consent: Path = typer.Option(..., exists=True, help="The consent document (JSON)."),
    ref_text: str | None = typer.Option(None, help="What is said in the reference recording."),
    x_vector_only: bool = typer.Option(False, help="Condition on the speaker embedding alone."),
    engine: str = typer.Option("qwen_tts_base"),
    repo: Path = typer.Option(Path.cwd()),
    json_output: bool = typer.Option(False, "--json"),
) -> None:
    """Register one consented voice reference. The recording is copied into app-data, never here.

    The same order the API uses, and for the same reason: consent is checked before a byte is
    written, the recording is bound to it by digest before an engine exists, and a row appears only
    once an engine has said it can speak in this voice. A refusal names the rule it failed.
    """

    from .api.voices import INSTALL_HINT
    from .generative.voices import (
        ConsentViolation,
        parse_consent,
        reference_path,
        store_reference,
        voice_row,
    )

    root = repo_root(repo)
    store = Store()
    if store.get_voice(voice_id) is not None:
        raise typer.BadParameter(f"voice reference {voice_id} already exists")
    if engine not in CLONING_ENGINES:
        raise typer.BadParameter(
            f"{engine} has no cloning capability; "
            f"engines that do: {', '.join(sorted(CLONING_ENGINES))}"
        )
    try:
        document = parse_consent(consent.read_text())
        reference_sha256, consent_sha256 = store_reference(
            store.root, reference.read_bytes(), document
        )
    except ConsentViolation as error:
        raise typer.BadParameter(str(error)) from error

    transcript = (ref_text or "").strip() or None
    if transcript is None and not x_vector_only:
        try:
            transcript = transcribe(reference_path(store.root, reference_sha256)).strip() or None
        except Exception:
            # Best effort. A missing local ASR is not a reason to refuse a consented recording;
            # the engine refuses to synthesize until a transcript arrives, and the editor can type
            # what was said, because they are the one who recorded it.
            transcript = None

    clone = cast(CloningSpeechGenerator, engine_for(engine))
    try:
        bound = clone.make_voice(
            voice_id=voice_id,
            reference=reference_path(store.root, reference_sha256),
            reference_sha256=reference_sha256,
            ref_text=transcript,
            consent_sha256=consent_sha256,
            x_vector_only=x_vector_only,
        )
    except RuntimeError as error:
        raise typer.BadParameter(f"{INSTALL_HINT} ({error})") from error

    row = store.create_voice(
        voice_id=voice_id,
        reference_sha256=reference_sha256,
        reference_text=transcript,
        subject_display_name=document.subject.display_name,
        scope=document.scope,
        consent_sha256=consent_sha256,
        guardian_consent=document.guardian_consent is not None
        and document.guardian_consent.confirmed,
        child_assent=document.child_assent is not None and document.child_assent.confirmed,
        retention=document.retention.policy,
        engine=bound.engine,
        model_revision=bound.model_revision,
        x_vector_only=x_vector_only,
    )
    record = voice_row(store.root, row)
    if json_output:
        emit_text(
            json.dumps(
                {"task": "voices.create", "voice": record},
                ensure_ascii=False,
                indent=2,
                sort_keys=True,
            )
        )
        return
    typer.echo(
        f"{voice_id}: {record['subject_display_name']} · {record['scope']} · "
        f"reference {reference_sha256[:12]} · consent {consent_sha256[:12]}"
    )
    if transcript is None and not x_vector_only:
        typer.echo(
            "No reference transcript. Synthesis is refused until one is set — "
            "the clone conditions on what is said in the recording."
        )
    del root


@voices.command("list")
@json_verb
def list_voices(json_output: bool = typer.Option(False, "--json")) -> None:
    """Every stored voice reference, revoked ones included."""

    from .api.voices import voices_json
    from .generative.voices import voice_row

    store = Store()
    if json_output:
        emit_text(voices_json(store, store.root))
        return
    rows = store.voice_references()
    if not rows:
        typer.echo("No voice references. `atlas-listening voices create` registers one.")
        return
    for row in rows:
        record = voice_row(store.root, row)
        state = f"revoked {row.revoked_at[:10]}" if row.revoked_at else str(record["scope"])
        typer.echo(
            f"{row.id}\t{row.subject_display_name}\t{state}\t"
            f"reference {'present' if record['reference_present'] else 'absent'}"
        )


@voices.command("demo")
@json_verb
def demo_voice(
    voice_id: str,
    repo: Path = typer.Option(Path.cwd()),
    json_output: bool = typer.Option(False, "--json"),
) -> None:
    """Synthesize the three roster audition phrases through one stored voice."""

    from .api.voices import demo_phrases
    from .generative.voices import clonable_of, demo_dir, reference_path

    root = repo_root(repo)
    store = Store()
    row = store.get_voice(voice_id)
    if row is None:
        raise typer.BadParameter(f"no voice reference {voice_id}")
    if row.revoked_at is not None:
        raise typer.BadParameter(
            f"voice reference {voice_id} was revoked on {row.revoked_at[:10]}; "
            "no further synthesis is made through it"
        )
    if not reference_path(store.root, row.reference_sha256).exists():
        raise typer.BadParameter(
            f"voice reference {voice_id} has no reference recording on this machine"
        )
    target = demo_dir(store.root, voice_id)
    target.mkdir(parents=True, exist_ok=True)
    phrases = demo_phrases(root)
    written: list[str] = []
    engine = engine_for(row.engine, {voice_id: clonable_of(store.root, row)})
    for index, phrase in enumerate(phrases, 1):
        path = target / f"demo-{index}.wav"
        engine.generate(
            SpeechRequest(
                text=phrase,
                voice=row.subject_display_name,
                language="German",
                seed=100,
                voice_ref=voice_id,
            ),
            path,
        )
        written.append(sha256_file(path))
    if json_output:
        emit_text(
            json.dumps(
                {
                    "task": "voices.demo",
                    "id": voice_id,
                    "phrases": phrases,
                    "wav_sha256": written,
                    "status": "pending-human-review",
                },
                ensure_ascii=False,
                indent=2,
                sort_keys=True,
            )
        )
        return
    typer.echo(f"{voice_id}: {len(written)} draft demos under {target}")


@voices.command("revoke")
@json_verb
def revoke_voice(voice_id: str, json_output: bool = typer.Option(False, "--json")) -> None:
    """Withdraw consent: refuse future synthesis, delete the recording and the demos.

    Renders already produced keep their provenance — it is the record of what actually made those
    bytes. Retiring published artifacts is a scene republish or a removal, and it is a separate,
    deliberate act; see `docs/authoring/product-protection.md`.
    """

    from .generative.voices import revoke as revoke_reference

    store = Store()
    try:
        record = revoke_reference(store, store.root, voice_id)
    except KeyError as error:
        raise typer.BadParameter(f"no voice reference {voice_id}") from error
    if json_output:
        emit_text(
            json.dumps(
                {"task": "voices.revoke"} | record, ensure_ascii=False, indent=2, sort_keys=True
            )
        )
        return
    typer.echo(
        f"{voice_id}: revoked {str(record['revoked_at'])[:10]} · "
        f"reference deleted: {record['reference_deleted']} · demos deleted: {record['demos_deleted']}"
    )
    typer.echo(str(record["note"]))


@app.command()
def doctor() -> None:
    checks = {
        "ffmpeg": shutil.which("ffmpeg"),
        "ffprobe": shutil.which("ffprobe"),
        "git": shutil.which("git"),
        "python": subprocess.check_output(["python", "--version"], text=True).strip(),
    }
    typer.echo(json.dumps(checks, indent=2))
    raise typer.Exit(0 if all(checks.values()) else 1)


@models.command("list")
def list_models() -> None:
    typer.echo(json.dumps(model_lock(PACKAGE_ROOT / "models.lock.json"), indent=2))


@models.command("fetch")
def fetch_models(name: str) -> None:
    locked = model_lock(PACKAGE_ROOT / "models.lock.json")["models"]
    if not isinstance(locked, dict) or name not in locked:
        raise typer.BadParameter(f"unknown model {name}")
    spec = locked[name]
    if not isinstance(spec, dict):
        raise typer.BadParameter(f"invalid lock entry {name}")
    patterns = spec.get("files")
    target = snapshot_download(
        repo_id=str(spec["id"]),
        revision=str(spec["revision"]),
        allow_patterns=[str(value) for value in patterns] if isinstance(patterns, list) else None,
    )
    typer.echo(f"Downloaded immutable {name}: {target}")


@sources.command("import")
def import_freesound(file: Path, metadata: Path = typer.Option(..., exists=True)) -> None:
    """Import one manually downloaded Freesound original; this never calls its API."""

    store = Store()
    source = import_source(file.resolve(), metadata.resolve(), store.root)
    typer.echo(
        f"Imported Freesound {source.sound_id}: {source.original_sha256} "
        f"({source.license}, {source.duration_seconds:.2f}s)"
    )


@sources.command("list")
def show_sources() -> None:
    store = Store()
    typer.echo(
        json.dumps(
            [source.model_dump(mode="json") for source in list_sources(store.root)],
            ensure_ascii=False,
            indent=2,
        )
    )
