from __future__ import annotations

import json
import hashlib
import shutil
import subprocess
import webbrowser
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Literal, cast

import typer
import uvicorn
import yaml
from huggingface_hub import snapshot_download

from .adapters import (
    CLONING_ENGINES,
    assemble,
    draft_prompt,
    engine_for,
    generate_drafts,
    generate_lines,
    mix_context,
    model_lock,
    render_line,
    transcribe,
)
from .generative.fake import FakeSpeech
from .generative.gateway import CloningSpeechGenerator
from .generative.locks import set_models_root
from .generative.qwen import QwenSpeech
from .domain import (
    VOICE_SETS,
    Bilingual,
    Brief,
    ContextSound,
    CastAssignment,
    Dictation,
    Line,
    MultiSelect,
    Ordering,
    Question,
    RevisionPayload,
    ShortAnswer,
    SingleChoice,
    Stage,
    TrueFalse,
    lock_voice_profiles,
    reassign_voice_profiles,
)
from .export import publish as publish_files, sha256, write_bundle
from .human_voice_experiment import run_human_voice_experiment
from .qa import check_transcripts
from .storage import Store
from .speaker_qa import (
    SpeakerConsistencyReport,
    WavLMSpeakerEmbedder,
    check_speaker_consistency,
    derive_calibration,
)
from .soundscape import soundscape_report
from .sources import import_source, list_sources
from .catalogs import CharacterDefinition, load_character_catalog, load_narration_catalog
from .reading_audio import ReadingParagraph, ReadingRevisionPayload, default_profile_id, load_reading_sources
from .reading_pipeline import generate_reading, reading_qa
from .reading_export import publish_reading
from .scene.cli import _only_json_on_stdout, app as scene_app
from .web import TONWERK_DIST, app as web_app
from .voice_benchmark import BENCHMARK_SLUGS, run_benchmark

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
# Scene v1. Defined in `scene/cli.py` rather than here so the verbs stay reachable without the
# render stack this module imports at the top.
app.add_typer(scene_app, name="scene")
PACKAGE_ROOT = Path(__file__).resolve().parents[2]

# The synthesis model a newly seeded project starts on, and the only one that generates
# approvable audio; `fake` exists for workflow tests.
ENGINE: Literal["qwen_tts", "fake"] = "qwen_tts"


def repo_root(repo: Path) -> Path:
    """Resolve `--repo` once, and make it the root `.models/` is looked for under.

    Every command that can reach a model takes the repository as an option already. Stating it
    here is what keeps the weights lookup from depending on where this package happens to sit.
    """

    resolved = repo.resolve()
    set_models_root(resolved)
    return resolved


def reading_payload(repo: Path, reading_id: str, profile_id: str | None = None) -> ReadingRevisionPayload:
    source = next((row for row in load_reading_sources(repo) if row.id == reading_id), None)
    if source is None:
        raise typer.BadParameter(f"unknown reading {reading_id}")
    profiles = load_narration_catalog(repo)
    selected = profile_id or default_profile_id(source)
    profile = next((row for row in profiles.profiles if row.id == selected), None)
    if profile is None or source.kind not in profile.allowed_kinds:
        raise typer.BadParameter(f"profile {selected} is not valid for {source.kind}")
    character = next(
        row for row in load_character_catalog(repo).characters if row.id == profile.character_id
    )
    return ReadingRevisionPayload(
        reading_id=source.id,
        level=source.level,
        title_de=source.title_de,
        kind=source.kind,
        source_sha256=source.source_sha256,
        narration_profile_id=profile.id,
        narration_profile_version=profile.version,
        character_id=character.id,
        character_version=character.version,
        voice=character.voice_profile.voice,
        seed=character.voice_profile.seed,
        style=f"{character.voice_profile.style} {profile.instruction}",
        pace=profile.pace_by_level[source.level],
        paragraph_pause_ms=profile.paragraph_pause_ms,
        paragraphs=[
            ReadingParagraph(index=index, display_text=text)
            for index, text in enumerate(source.paragraphs)
        ],
    )


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


@app.command("import-project")
def import_project(file: Path, slug: str) -> None:
    project = Store().create(slug, RevisionPayload.model_validate_json(file.read_text()))
    typer.echo(f"Created project {project.id}: {slug}")


@app.command("seed-reading-corpus")
def seed_reading_corpus(
    repo: Path = typer.Option(Path.cwd()), yes: bool = False
) -> None:
    """Create one local draft for every Lesetext; never synthesize or approve implicitly."""

    if not yes:
        raise typer.BadParameter("this creates 59 local SQLite projects; use --yes")
    repo = repo_root(repo)
    store = Store()
    created = 0
    for source in load_reading_sources(repo):
        if store.get_reading_by_source(source.id):
            continue
        project = store.create_reading(reading_payload(repo, source.id))
        created += 1
        typer.echo(f"{source.id}: project {project.id} · {default_profile_id(source)}")
    typer.echo(f"Created {created} reading draft(s); {len(store.reading_projects())} total")


@app.command("recast-corpus")
def recast_corpus(
    repo: Path = typer.Option(Path.cwd()), dry_run: bool = False, yes: bool = False
) -> None:
    """Assign every planned dialogue to the stable catalog without rewriting history."""

    if not dry_run and not yes:
        raise typer.BadParameter("this invalidates current QA/approvals; use --yes or --dry-run")
    repo = repo_root(repo)
    planned = {
        artifact["id"]
        for unit in yaml.safe_load((repo / "data" / "listening-plan.yaml").read_text())["units"]
        for artifact in unit["artifacts"]
    }
    characters = load_character_catalog(repo).characters
    usage = {character.id: 0 for character in characters}
    store = Store()
    if not dry_run:
        stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
        backup = store.backup_database(store.root / "backups" / f"before-roster-recast-{stamp}.sqlite3")
        typer.echo(f"Database backup: {backup}")
    selected_projects = [project for project in reversed(store.projects()) if project.slug in planned]
    for project in selected_projects:
        _, _, payload = store.get(project.id)
        locked = lock_voice_profiles(payload)
        assert locked.voice_profiles is not None
        chosen: list[CharacterDefinition] = []
        for profile in locked.voice_profiles:
            chosen_ids = {row.id for row in chosen}
            child_role = any(
                token in profile.speaker.casefold()
                for token in ("kind", "schüler", "schülerin", "junge", "mädchen")
            )
            candidates = [
                row for row in characters
                if row.status != "retired"
                and row.id not in chosen_ids
                and not chosen_ids.intersection(row.incompatible_with)
                and (row.age_band == "child") == child_role
            ]
            # Balance recurring identities across the corpus. The old preset is only the tie
            # breaker: a full recast is allowed to change timbre, while assigning one familiar
            # voice to every role would defeat the stable-roster goal.
            character = min(
                candidates,
                key=lambda row: (
                    usage[row.id],
                    row.voice_profile.voice != profile.voice,
                    row.id,
                ),
            )
            chosen.append(character)
            usage[character.id] += 1
        cast = [
            CastAssignment(
                speaker=speaker,
                character_id=character.id,
                character_version=character.version,
            )
            for speaker, character in zip(locked.speakers, chosen, strict=True)
        ]
        profiles = [
            {
                "version": character.version,
                "speaker": speaker,
                "voice": character.voice_profile.voice,
                "seed": character.voice_profile.seed,
                "style": character.voice_profile.style,
            }
            for speaker, character in zip(locked.speakers, chosen, strict=True)
        ]
        typer.echo(
            f"{project.slug}: "
            + ", ".join(
                f"{assignment.speaker} → {assignment.character_id}"
                for assignment in cast
            )
        )
        if not dry_run:
            revised = RevisionPayload.model_validate(
                locked.model_dump(mode="json")
                | {
                    "cast": [row.model_dump(mode="json") for row in cast],
                    "voice_profiles": profiles,
                }
            )
            store.revise(project.id, revised)
    verb = "Would recast" if dry_run else "Recast"
    typer.echo(f"{verb} {len(selected_projects)} dialogues; usage: {usage}")


@app.command("generate-character-demos")
def generate_character_demos(
    repo: Path = typer.Option(Path.cwd()), test_adapter: bool = False
) -> None:
    """Generate three local comparison takes per roster character; never approve them."""

    store = Store()
    engine = FakeSpeech() if test_adapter else QwenSpeech()
    catalog = load_character_catalog(repo_root(repo))
    for character in catalog.characters:
        target = store.root / "characters" / character.id
        target.mkdir(parents=True, exist_ok=True)
        hashes: list[str] = []
        for index, phrase in enumerate(character.demo_phrases, 1):
            path = target / f"demo-{index}.wav"
            line = Line(
                id=f"{character.id}-demo-{index}",
                speaker=character.display_name,
                display_text=phrase,
                voice=character.voice_profile.voice,
                seed=character.voice_profile.seed,
                style=character.voice_profile.style,
                pace=character.voice_profile.pace,
            )
            render_line(engine, line, path)
            hashes.append(sha256(path))
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
        typer.echo(f"{character.id}: 3 draft demos")


@voices.command("create")
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
            with _only_json_on_stdout(json_output):
                transcript = (
                    transcribe(reference_path(store.root, reference_sha256)).strip() or None
                )
        except Exception:
            # Best effort. A missing local ASR is not a reason to refuse a consented recording;
            # the engine refuses to synthesize until a transcript arrives, and the editor can type
            # what was said, because they are the one who recorded it.
            transcript = None

    with _only_json_on_stdout(json_output):
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
        typer.echo(json.dumps({"task": "voices.create", "voice": record}, ensure_ascii=False, indent=2, sort_keys=True))
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
def list_voices(json_output: bool = typer.Option(False, "--json")) -> None:
    """Every stored voice reference, revoked ones included."""

    from .api.voices import voices_json
    from .generative.voices import voice_row

    store = Store()
    if json_output:
        typer.echo(voices_json(store, store.root))
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
def demo_voice(
    voice_id: str,
    repo: Path = typer.Option(Path.cwd()),
    json_output: bool = typer.Option(False, "--json"),
) -> None:
    """Synthesize the three roster audition phrases through one stored voice."""

    from .api.voices import demo_phrases
    from .generative.gateway import SpeechRequest
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
    # The guard `scene render --json` already needed, for the reason recorded there: the pinned Qwen
    # adapter prints a flash-attn banner to **stdout** on import, so a verb that both generates in
    # process and promises `--json` emits four lines of text and then a JSON document. It only
    # happens under a real engine, which is exactly where no `FakeClone` test could see it.
    with _only_json_on_stdout(json_output):
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
            written.append(sha256(path))
    if json_output:
        typer.echo(
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
def revoke_voice(voice_id: str, json_output: bool = typer.Option(False, "--json")) -> None:
    """Withdraw consent: refuse future synthesis, delete the recording and the demos.

    Renders already produced keep their provenance — it is the record of what actually made those
    bytes. Retiring published artifacts is the republish/retirement path, and it is a separate,
    deliberate act; see `docs/authoring/product-protection.md`.
    """

    from .generative.voices import revoke as revoke_reference

    store = Store()
    try:
        record = revoke_reference(store, store.root, voice_id)
    except KeyError as error:
        raise typer.BadParameter(f"no voice reference {voice_id}") from error
    if json_output:
        typer.echo(json.dumps({"task": "voices.revoke"} | record, ensure_ascii=False, indent=2, sort_keys=True))
        return
    typer.echo(
        f"{voice_id}: revoked {str(record['revoked_at'])[:10]} · "
        f"reference deleted: {record['reference_deleted']} · demos deleted: {record['demos_deleted']}"
    )
    typer.echo(str(record["note"]))


@app.command("generate-reading")
def generate_reading_command(
    project_id: int,
    test_adapter: bool = False,
) -> None:
    """Validate and synthesize one reading project paragraph by paragraph."""

    store = Store()
    project, _, payload = store.get_reading(project_id)
    if Stage(project.stage) != Stage.DRAFT:
        raise typer.BadParameter(f"reading is at {project.stage}, expected draft")
    store.transition_reading(project_id, Stage.DRAFT, Stage.VALIDATED)
    engine = FakeSpeech() if test_adapter else QwenSpeech()
    try:
        _, updated = generate_reading(
            payload, store.root / "readings" / str(project_id), engine
        )
        store.transition_reading(
            project_id, Stage.VALIDATED, Stage.AUDIO_GENERATED, payload=updated
        )
    except Exception:
        raise
    typer.echo(f"Generated {payload.reading_id}; automatic QA is still required")


@app.command("qa-reading")
def qa_reading_command(project_id: int, test_adapter: bool = False) -> None:
    """Run transcript, pace, cue and narrator-consistency QA for one Lesetext."""

    store = Store()
    project, _, payload = store.get_reading(project_id)
    if Stage(project.stage) != Stage.AUDIO_GENERATED:
        raise typer.BadParameter(f"reading is at {project.stage}, expected audio_generated")
    revision = FakeSpeech.revision if test_adapter else QwenSpeech.revision
    report = reading_qa(
        payload,
        store.root / "readings" / str(project_id),
        revision,
        fake=test_adapter,
    )
    store.transition_reading(
        project_id, Stage.AUDIO_GENERATED, Stage.AUTOMATICALLY_CHECKED, qa=report
    )
    typer.echo(
        f"QA {'passed' if report['passed'] else 'needs review'} for {payload.reading_id}; human approval remains pending"
    )


@app.command("publish-reading")
def publish_reading_command(
    project_id: int, repo: Path = typer.Option(Path.cwd())
) -> None:
    """Publish only a QA-passed narration whose approval names these exact bytes."""

    store = Store()
    project, revision, payload = store.get_reading(project_id)
    if Stage(project.stage) != Stage.HUMAN_APPROVED:
        raise typer.BadParameter("reading must be human-approved before publication")
    if not revision.qa_json or not revision.approval_json:
        raise typer.BadParameter("reading is missing QA or approval provenance")
    paths = publish_reading(
        repo_root(repo),
        store.root,
        payload,
        store.root / "readings" / str(project_id) / "final.wav",
        json.loads(revision.qa_json),
        json.loads(revision.approval_json),
    )
    store.transition_reading(project_id, Stage.HUMAN_APPROVED, Stage.EXPORTED)
    typer.echo("Published " + ", ".join(str(path) for path in paths))


READING_PILOT = (
    "a1/erste-schritte",
    "a1/praesens-wortstellung",
    "a2/arbeit-beruf",
    "a2/gesundheit-arzttermin",
    "a1/lena-1-der-erste-tag",
    "a2/lena-6-die-blaue-tasche",
    "a2/aemter-dienstleistungen",
    "b1/arbeit-bewerbung",
)


@app.command("process-reading-corpus")
def process_reading_corpus(
    repo: Path = typer.Option(Path.cwd()),
    pilot: bool = False,
    level: str | None = None,
    test_adapter: bool = False,
    yes: bool = False,
) -> None:
    """Resume synthesis and automatic QA for a pilot, level wave, or all readings."""

    if not yes:
        raise typer.BadParameter("this can synthesize many hours of audio; repeat with --yes")
    if pilot and level:
        raise typer.BadParameter("choose either --pilot or --level")
    if level not in {None, "A1", "A2", "B1"}:
        raise typer.BadParameter("level must be A1, A2 or B1")
    repo = repo_root(repo)
    store = Store()
    engine = FakeSpeech() if test_adapter else QwenSpeech()
    embedding_backend = None if test_adapter else WavLMSpeakerEmbedder()
    selected = []
    for project in store.reading_projects():
        _, _, payload = store.get_reading(project.id)
        if pilot and payload.reading_id not in READING_PILOT:
            continue
        if level and payload.level != level:
            continue
        selected.append(project)
    failures: list[str] = []
    for index, project in enumerate(selected, 1):
        current, _, payload = store.get_reading(project.id)
        typer.echo(f"[{index}/{len(selected)}] {payload.reading_id} · {current.stage}")
        try:
            stage = Stage(current.stage)
            if stage == Stage.DRAFT:
                store.transition_reading(project.id, Stage.DRAFT, Stage.VALIDATED)
                stage = Stage.VALIDATED
            if stage == Stage.VALIDATED:
                _, generated = generate_reading(
                    payload, store.root / "readings" / str(project.id), engine
                )
                store.transition_reading(
                    project.id,
                    Stage.VALIDATED,
                    Stage.AUDIO_GENERATED,
                    payload=generated,
                )
                payload = generated
                stage = Stage.AUDIO_GENERATED
            if stage == Stage.AUDIO_GENERATED:
                report = reading_qa(
                    payload,
                    store.root / "readings" / str(project.id),
                    engine.revision,
                    fake=test_adapter,
                    embedding_backend=embedding_backend,
                )
                store.transition_reading(
                    project.id,
                    Stage.AUDIO_GENERATED,
                    Stage.AUTOMATICALLY_CHECKED,
                    qa=report,
                )
            elif stage in {Stage.AUTOMATICALLY_CHECKED, Stage.HUMAN_APPROVED, Stage.EXPORTED}:
                typer.echo("  already processed; left unchanged")
        except Exception as exc:
            failures.append(f"{payload.reading_id}: {exc}")
            typer.echo(f"  failed: {exc}", err=True)
    if failures:
        typer.echo("Reading failures:\n" + "\n".join(failures), err=True)
        raise typer.Exit(1)
    typer.echo(f"Processed {len(selected)} readings; no human approval was inferred")


@app.command("reaudit-reading-corpus")
def reaudit_reading_corpus(
    level: str | None = None, test_adapter: bool = False, yes: bool = False
) -> None:
    """Recompute reading QA against unchanged current bytes and invalidate failed approval."""

    if not yes:
        raise typer.BadParameter("this replaces current QA diagnostics; repeat with --yes")
    if level not in {None, "A1", "A2", "B1"}:
        raise typer.BadParameter("level must be A1, A2 or B1")
    store = Store()
    revision = FakeSpeech.revision if test_adapter else QwenSpeech.revision
    embedding_backend = None if test_adapter else WavLMSpeakerEmbedder()
    failures: list[str] = []
    processed = 0
    for project in store.reading_projects():
        current, _, payload = store.get_reading(project.id)
        if level and payload.level != level:
            continue
        if Stage(current.stage) not in {Stage.AUTOMATICALLY_CHECKED, Stage.HUMAN_APPROVED}:
            continue
        report = reading_qa(
            payload,
            store.root / "readings" / str(project.id),
            revision,
            fake=test_adapter,
            embedding_backend=embedding_backend,
        )
        store.update_reading_qa(project.id, report)
        processed += 1
        if report["passed"] is not True:
            failures.append(payload.reading_id)
    typer.echo(f"Re-audited {processed} reading(s); QA review queue: {len(failures)}")
    for reading_id in failures:
        typer.echo(f"  {reading_id}")


def payload_from_plan(
    unit: dict[str, Any], artifact: dict[str, Any], topic: str | None = None
) -> RevisionPayload:
    speaker_count = int(artifact["speakers"]["min"])
    speakers = [f"Sprecher {index + 1}" for index in range(speaker_count)]
    voices = VOICE_SETS[ENGINE]
    line = Line(
        id="line-1",
        speaker=speakers[0],
        display_text="Diesen redaktionellen Platzhalter vollständig ersetzen.",
        voice=voices[0],
    )
    questions = [
        Question(
            id=f"q{index + 1}",
            instruction=Bilingual(en="Listen and answer.", ru="Прослушайте и ответьте."),
            response=SingleChoice(
                kind="single-choice",
                prompt="Was ist richtig?",
                options=["A", "B"],
                correct=0,
            ),
            explain=Bilingual(
                en="Replace with explanatory feedback during editing.",
                ru="Во время редактирования замените это объясняющей обратной связью.",
            ),
        )
        # `questions` is how many independently scored questions the artifact should carry;
        # the plan's `item_types` says which item type will carry them.
        for index in range(int(artifact.get("questions", 3)))
    ]
    return lock_voice_profiles(RevisionPayload(
        title=Bilingual(
            en=f"Listening — {unit['unit']}",
            ru=f"Аудирование — {unit['unit']}",
        ),
        brief=Brief(
            level=unit["level"],
            vocabulary=artifact.get("required_vocabulary", []),
            grammar_target=artifact.get("grammar_target", ""),
            scenario=artifact["scenario"],
            duration_seconds=(int(artifact["duration_seconds"]["min"]) + int(artifact["duration_seconds"]["max"])) // 2,
            speaker_count=speaker_count,
            topic=topic or unit["unit"],
            outcomes=artifact["outcomes"],
        ),
        speakers=speakers,
        lines=[line],
        questions=questions,
        tts_adapter=ENGINE,
    ))


@app.command("seed-wave")
def seed_wave(
    wave: int = typer.Option(1, min=1, max=2),
    repo: Path = typer.Option(Path.cwd()),
) -> None:
    """Create local editor projects from the reviewed plan; no curriculum files are written."""

    plan = yaml.safe_load((repo_root(repo) / "data" / "listening-plan.yaml").read_text())
    atlas = yaml.safe_load((repo_root(repo) / "content" / "atlas.yaml").read_text())
    topic_by_unit = {unit["id"]: unit["topics"][0] for unit in atlas["units"]}
    store = Store()
    existing = {project.slug: project for project in store.projects()}
    created: list[str] = []
    refreshed: list[str] = []
    for unit in plan["units"]:
        for artifact in unit["artifacts"]:
            if artifact["wave"] != wave:
                continue
            planned = payload_from_plan(unit, artifact, topic_by_unit[unit["unit"]])
            current = existing.get(artifact["id"])
            if current:
                _, _, payload = store.get(current.id)
                if payload.lines[0].display_text.startswith("Diesen redaktionellen Platzhalter"):
                    store.revise(current.id, planned)
                    refreshed.append(artifact["id"])
                continue
            store.create(artifact["id"], planned)
            created.append(artifact["id"])
    typer.echo(
        f"Created {len(created)} and refreshed {len(refreshed)} local Wave {wave} projects"
    )
    for slug in created:
        typer.echo(f"- {slug}")


@app.command("draft-wave")
def draft_wave(
    wave: int = typer.Option(1, min=1, max=2),
    repo: Path = typer.Option(Path.cwd()),
) -> None:
    """Generate structured local drafts for seeded projects with one MLX model load."""

    plan = yaml.safe_load((repo_root(repo) / "data" / "listening-plan.yaml").read_text())
    planned_ids = {
        artifact["id"]
        for unit in plan["units"]
        for artifact in unit["artifacts"]
        if artifact["wave"] == wave
    }
    store = Store()
    selected: list[tuple[int, int, RevisionPayload]] = []
    for project in store.projects():
        if project.slug not in planned_ids or Stage(project.stage) != Stage.DRAFT:
            continue
        _, revision, payload = store.get(project.id)
        if not any("redaktionellen Platzhalter" in line.display_text for line in payload.lines):
            continue
        selected.append((project.id, revision.number, payload))
    level_order = {"A1": 0, "A2": 1, "B1": 2, "B2": 3}
    selected.sort(
        key=lambda item: (level_order[item[2].brief.level], item[2].brief.duration_seconds)
    )
    if not selected:
        typer.echo(f"No draft Wave {wave} projects need generation")
        return
    def save_draft(index: int, draft: RevisionPayload) -> None:
        project_id, revision_number, original = selected[index]
        if any("redaktionellen Platzhalter" in line.display_text for line in draft.lines):
            raise typer.BadParameter(f"generator retained a placeholder for project {project_id}")
        work = store.root / "projects" / str(project_id)
        work.mkdir(parents=True, exist_ok=True)
        (work / f"generation-prompt-rev-{revision_number}.md").write_text(draft_prompt(original))
        store.revise(project_id, draft)
        typer.echo(f"Drafted project {project_id}: {draft.brief.scenario}")

    failures: list[int] = []

    def record_failure(index: int, error: Exception) -> None:
        project_id = selected[index][0]
        failures.append(project_id)
        typer.echo(f"Project {project_id} remains draft: {error}", err=True)

    generate_drafts(
        [payload for _, _, payload in selected],
        on_draft=save_draft,
        on_error=record_failure,
    )
    if failures:
        typer.echo(
            "Generation completed with rejected structured output for projects: "
            + ", ".join(str(project_id) for project_id in failures),
            err=True,
        )


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


@models.command("fetch-benchmark")
def fetch_benchmark_model(name: str) -> None:
    """Fetch an immutable research model that is absent from production provenance."""

    locked = model_lock(PACKAGE_ROOT / "benchmark-models.lock.json")["models"]
    if not isinstance(locked, dict) or name not in locked:
        raise typer.BadParameter(f"unknown benchmark model {name}")
    spec = locked[name]
    if not isinstance(spec, dict):
        raise typer.BadParameter(f"invalid benchmark lock entry {name}")
    target = snapshot_download(repo_id=str(spec["id"]), revision=str(spec["revision"]))
    typer.echo(f"Downloaded immutable research-only {name}: {target}")


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


def verify_approval(approval: dict[str, object], wav: Path, dry_wav: Path) -> None:
    """Refuse to bundle audio the recorded approval does not describe.

    A missing digest is not a pass. Approvals recorded before the studio stored hashes carry
    neither, so a truthiness guard would skip both comparisons and export whatever bytes are on
    disk under an approval that never covered them — and `scripts/validate.ts` cannot catch it,
    because it compares the manifest to the file and never the approval to the manifest.
    """

    approved_final = approval.get("audio_sha256")
    approved_dry = approval.get("dry_audio_sha256")
    if not approved_final:
        raise typer.BadParameter(
            "this approval predates audio hashing and vouches for no bytes — "
            "re-approve the project before exporting"
        )
    if sha256(wav) != approved_final:
        raise typer.BadParameter(
            "final.wav has changed since approval — re-approve this exact audio before exporting"
        )
    if dry_wav.exists() and (not approved_dry or sha256(dry_wav) != approved_dry):
        raise typer.BadParameter(
            "dry.wav has changed since approval — re-approve this exact audio before exporting"
        )


def bundle_project(project_id: int) -> tuple[Path, RevisionPayload]:
    store = Store()
    project, revision, payload = store.get(project_id)
    if Stage(project.stage) != Stage.HUMAN_APPROVED:
        raise typer.BadParameter("project must be human_approved")
    assert revision.qa_json and revision.approval_json
    wav = store.root / "projects" / str(project_id) / "final.wav"
    dry_wav = store.root / "projects" / str(project_id) / "dry.wav"

    # The approval covers specific bytes. Verify them before bundling, or a WAV regenerated,
    # replaced or truncated between approval and export is published carrying an approval
    # nobody gave it — and the downstream gate cannot see it, because scripts/validate.ts
    # compares the manifest to the file, never the approval to the manifest.
    verify_approval(json.loads(revision.approval_json), wav, dry_wav)

    out = store.root / "exports" / project.slug
    lock_path = PACKAGE_ROOT / "models.lock.json"
    locks = model_lock(lock_path)
    locks["model_lock_sha256"] = hashlib.sha256(lock_path.read_bytes()).hexdigest()
    dependency_lock = PACKAGE_ROOT / "uv.lock"
    locks["dependency_lock_sha256"] = hashlib.sha256(dependency_lock.read_bytes()).hexdigest()
    write_bundle(
        out,
        project.slug,
        payload,
        wav,
        json.loads(revision.qa_json),
        json.loads(revision.approval_json),
        locks,
        dry_wav=dry_wav,
        source_root=store.root,
    )
    return out, payload


@app.command()
def bundle(project_id: int, format: str = "html,pdf,zip") -> None:
    out, _ = bundle_project(project_id)
    typer.echo(f"Bundle: {out} ({format})")


@app.command()
def publish(project_id: int, repo: Path = typer.Option(Path.cwd()), yes: bool = False) -> None:
    if not yes:
        raise typer.BadParameter("review the diff, then repeat with --yes")
    store = Store()
    project, _, _ = store.get(project_id)
    out, payload = bundle_project(project_id)
    written = publish_files(repo_root(repo), project.slug, payload, out)
    store.transition(project_id, Stage.HUMAN_APPROVED, Stage.EXPORTED)
    typer.echo("Published:\n" + "\n".join(str(path) for path in written))


@app.command()
def republish(project_id: int, repo: Path = typer.Option(Path.cwd()), yes: bool = False) -> None:
    """Replace one already-published artifact after new QA and human approval."""

    if not yes:
        raise typer.BadParameter("review the replacement bundle, then repeat with --yes")
    store = Store()
    project, _, _ = store.get(project_id)
    out, payload = bundle_project(project_id)
    stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    backup = store.root / "replaced" / project.slug / stamp
    written = publish_files(
        repo_root(repo),
        project.slug,
        payload,
        out,
        replace_existing=True,
        backup_root=backup,
    )
    store.transition(project_id, Stage.HUMAN_APPROVED, Stage.EXPORTED)
    typer.echo(
        "Replaced:\n"
        + "\n".join(str(path) for path in written)
        + f"\nPrevious files retained at {backup}"
    )


@app.command()
def benchmark() -> None:
    report = PACKAGE_ROOT / "examples" / "a2-zwei-sprecher" / "benchmark.json"
    if not report.exists():
        raise typer.BadParameter("no measured benchmark exists; run the fixed A2 fixture first")
    typer.echo(report.read_text())


@app.command("benchmark-voice-consistency")
def benchmark_voice_consistency(yes: bool = False) -> None:
    """Run the six-dialogue CustomVoice/VoiceDesign-clone research comparison locally."""

    if not yes:
        raise typer.BadParameter(
            "this generates substantial local audio; fetch both benchmark models, then use --yes"
        )
    store = Store()
    by_slug = {project.slug: project for project in store.projects()}
    missing = [slug for slug in BENCHMARK_SLUGS if slug not in by_slug]
    if missing:
        raise typer.BadParameter("missing benchmark projects: " + ", ".join(missing))
    selected = [
        (slug, store.get(by_slug[slug].id)[2])
        for slug in BENCHMARK_SLUGS
    ]
    stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    out = store.root / "benchmarks" / "voice-consistency" / stamp
    typer.echo(f"Research-only workspace: {out}")
    run_benchmark(selected, out)
    typer.echo(f"Benchmark complete: {out / 'benchmark.json'}")


@app.command("experiment-human-voice-clone")
def experiment_human_voice_clone(
    reference: Path = typer.Option(..., exists=True, dir_okay=False),
    consent: Path = typer.Option(..., exists=True, dir_okay=False),
    output: Path = typer.Option(...),
    yes: bool = False,
) -> None:
    """Run consent-gated human-reference cloning only inside the gitignored private workspace."""

    if not yes:
        raise typer.BadParameter(
            "confirm the consent record and private output path, then repeat with --yes"
        )
    result = run_human_voice_experiment(reference, consent, output)
    typer.echo(f"Private experiment complete: {result / 'experiment.json'}")


TODO_OPTION = "(Distraktor redaktionell ergänzen)"


def as_single_choice(question: Question) -> Question | None:
    """Rewrite one legacy question as a single-choice draft, or None if it already is one.

    Every conversion keeps the authored German and puts the correct answer first, because the
    point is to lose nothing: these questions were drafted by a model and reviewed by nobody
    yet, and throwing them away to satisfy a schema change would cost real editorial work. What
    it cannot invent is a plausible distractor, so it says so in the option list rather than
    fabricating one — a converted question is a draft, not a finished item.
    """

    response = question.response
    if isinstance(response, SingleChoice):
        return None
    if isinstance(response, TrueFalse):
        converted = SingleChoice(
            kind="single-choice",
            prompt=response.statement,
            options=["Richtig", "Falsch"],
            correct=0 if response.correct else 1,
        )
    elif isinstance(response, MultiSelect):
        # Only the first correct option survives; a single-choice item has exactly one answer.
        converted = SingleChoice(
            kind="single-choice",
            prompt=response.prompt,
            options=response.options,
            correct=response.correct[0],
        )
    elif isinstance(response, Ordering):
        converted = SingleChoice(
            kind="single-choice",
            prompt=f"{response.prompt} — Was kommt zuerst?",
            options=response.units,
            correct=0,
        )
    elif isinstance(response, ShortAnswer):
        converted = SingleChoice(
            kind="single-choice",
            prompt=response.prompt,
            options=[response.answers[0], TODO_OPTION],
            correct=0,
        )
    elif isinstance(response, Dictation):
        converted = SingleChoice(
            kind="single-choice",
            prompt=f"Was hören Sie in {response.line_id}?",
            options=[(response.accept or ["(Wortlaut ergänzen)"])[0], TODO_OPTION],
            correct=0,
        )
    else:  # pragma: no cover - the union is closed
        raise TypeError(response)
    return question.model_copy(update={"response": converted})


@app.command("switch-adapter")
def switch_adapter(adapter: str, dry_run: bool = False) -> None:
    """Move every project to one synthesis model, reassigning voices per speaker.

    A voice-quality pass starts by switching engines, and doing it twelve times through the form
    is twelve chances to leave one behind. Each project is revalidated before it is stored, so a
    payload the store would later refuse to load cannot be written here either.
    """

    if adapter not in VOICE_SETS and adapter != "fake":
        allowed = ", ".join(sorted({*VOICE_SETS, "fake"}))
        raise typer.BadParameter(f"unknown adapter {adapter}; try {allowed}")
    store = Store()
    touched = 0
    for project in store.projects():
        _, _, payload = store.get(project.id)
        if payload.tts_adapter == adapter:
            continue
        locked = lock_voice_profiles(payload)
        assert locked.voice_profiles is not None
        profiles = reassign_voice_profiles(locked.voice_profiles, adapter)
        updated = RevisionPayload.model_validate(
            locked.model_dump(mode="json")
            | {
                "tts_adapter": adapter,
                "voice_profiles": [profile.model_dump(mode="json") for profile in profiles],
            }
        )
        voices = ", ".join(profile.voice for profile in profiles)
        typer.echo(f"{project.slug}: {payload.tts_adapter} -> {adapter} ({voices})")
        touched += 1
        if not dry_run:
            store.revise(project.id, updated)
    verb = "would move" if dry_run else "moved"
    typer.echo(
        f"{verb} {touched} project(s) to {adapter}. The voice assignment only keeps speakers "
        "apart — adjust it per character in the editor, then regenerate."
    )


@app.command("lock-voice-profiles")
def lock_all_voice_profiles(
    repo: Path = typer.Option(Path.cwd()), dry_run: bool = False, yes: bool = False
) -> None:
    """Create profile revisions for the planned listening corpus only.

    Historical revisions are untouched. The new revision returns the project to draft and clears
    QA/approval because its next generated bytes will use one seed per character.
    """

    if not dry_run and not yes:
        raise typer.BadParameter("review with --dry-run, then repeat with --yes")
    plan_path = repo_root(repo) / "data" / "listening-plan.yaml"
    if not plan_path.exists():
        raise typer.BadParameter(f"listening plan not found: {plan_path}")
    plan = yaml.safe_load(plan_path.read_text())
    planned_ids = {
        artifact["id"] for unit in plan["units"] for artifact in unit["artifacts"]
    }
    store = Store()
    if not dry_run:
        stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
        backup = store.backup_database(store.root / "backups" / f"before-voice-profiles-{stamp}.sqlite3")
        typer.echo(f"Database backup: {backup}")
    touched = 0
    for project in reversed(store.projects()):
        if project.slug not in planned_ids:
            continue
        _, _, payload = store.get(project.id)
        if payload.voice_profiles is not None:
            continue
        updated = lock_voice_profiles(payload)
        assert updated.voice_profiles is not None
        shown = ", ".join(
            f"{profile.speaker}={profile.voice}/{profile.seed}"
            for profile in updated.voice_profiles
        )
        typer.echo(f"{project.slug}: {shown}")
        touched += 1
        if not dry_run:
            store.revise(project.id, updated)
    typer.echo(
        f"{'Would lock' if dry_run else 'Locked'} {touched} of {len(planned_ids)} "
        "planned project(s)"
    )


EVENT_SOUND_IDS = {178819, 343388, 369880, 547253, 805574}
MISSING_AMBIENCE: dict[str, tuple[int, int, str]] = {
    "ls-erste-schritte-01": (135097, 4_000, "quiet service-office air behind the opening ring"),
    "ls-alltag-zeit-01": (565536, 2_000, "quiet home room behind the answering-machine message"),
    "ls-praesens-wortstellung-01": (146435, 5_000, "neutral course-room air without competing speech"),
    "ls-modalverben-01": (565536, 2_000, "shared-flat room tone for the household discussion"),
    "ls-perfekt-haben-sein-01": (579571, 4_000, "quiet domestic air for friends recounting a trip"),
    "ls-adjektive-deklination-01": (637807, 8_000, "neutral interior air while two options are compared"),
    "ls-verben-mit-praepositionen-01": (579571, 4_000, "quiet room tone for a personal conversation"),
    "ls-nebensaetze-plaene-01": (579571, 4_000, "quiet room tone for friends changing plans"),
    "ls-infinitiv-mit-zu-01": (146435, 5_000, "neutral planning-room air without intelligible bystanders"),
    "ls-biografie-erfahrungen-01": (135097, 4_000, "quiet interview-room air"),
    "ls-erfahrungen-erzaehlen-01": (135097, 4_000, "quiet interview-room air"),
    "ls-leben-veraendern-01": (565536, 2_000, "domestic room tone for a housing discussion"),
    "ls-gesundheit-wohlbefinden-01": (135097, 4_000, "quiet consultation-room air"),
    "ls-meinung-medien-01": (146435, 5_000, "neutral studio-like room tone behind report and reactions"),
}


@app.command("complete-soundscapes")
def complete_soundscapes(
    repo: Path = typer.Option(Path.cwd()), dry_run: bool = False, yes: bool = False
) -> None:
    """Give every planned dialogue a continuous, provenance-labelled environment bed."""

    if not dry_run and not yes:
        raise typer.BadParameter("review with --dry-run, then repeat with --yes")
    plan = yaml.safe_load((repo_root(repo) / "data" / "listening-plan.yaml").read_text())
    artifact_rows = {
        artifact["id"]: (unit["level"], artifact["scenario"])
        for unit in plan["units"]
        for artifact in unit["artifacts"]
    }
    store = Store()
    sources_by_id = {source.sound_id: source for source in list_sources(store.root)}
    if not dry_run:
        stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
        backup = store.backup_database(
            store.root / "backups" / f"before-soundscapes-{stamp}.sqlite3"
        )
        typer.echo(f"Database backup: {backup}")
    touched = 0
    for project in reversed(store.projects()):
        if project.slug not in artifact_rows:
            continue
        level, scenario = artifact_rows[project.slug]
        _, _, payload = store.get(project.id)
        bed_gain = {"A1": -24.0, "A2": -23.0, "B1": -22.0, "B2": -22.0}[level]
        contexts = []
        for sound in payload.context_sounds:
            role = "event" if sound.sound_id in EVENT_SOUND_IDS else "bed"
            gain = sound.gain_db
            if role == "bed":
                gain = -24.0 if sound.sound_id == 765127 else bed_gain
            contexts.append(
                sound.model_copy(
                    update={
                        "role": role,
                        "gain_db": gain,
                        "placement_authoring": "ai-assisted",
                        "editorial_reason": (
                            f"Existing reviewed source retained as a continuous {role} for: {scenario}"
                        ),
                    }
                )
            )
        if not any(sound.role == "bed" for sound in contexts):
            sound_id, start_ms, reason = MISSING_AMBIENCE[project.slug]
            source = sources_by_id.get(sound_id)
            if source is None:
                raise typer.BadParameter(f"required imported ambience source {sound_id} is missing")
            contexts.append(
                ContextSound(
                    source_sha256=source.original_sha256,
                    sound_id=sound_id,
                    start_ms=start_ms,
                    duration_ms=min(120_000, round(source.duration_seconds * 1000) - start_ms),
                    gain_db=bed_gain,
                    role="bed",
                    editorial_reason=reason,
                    placement_authoring="ai-assisted",
                )
            )
        lead_in = payload.lead_in_ms
        if project.slug == "ls-alltag-zeit-01" and not any(
            sound.sound_id == 369880 for sound in contexts
        ):
            beep = sources_by_id[369880]
            contexts.append(
                ContextSound(
                    source_sha256=beep.original_sha256,
                    sound_id=369880,
                    start_ms=0,
                    duration_ms=900,
                    gain_db=-20,
                    role="event",
                    editorial_reason="one answering-machine beep before speech",
                    placement_authoring="ai-assisted",
                )
            )
            lead_in = 1_200
        updated = payload.model_copy(update={"context_sounds": contexts, "lead_in_ms": lead_in})
        shown = ", ".join(f"{sound.sound_id}:{sound.role}@{sound.gain_db:g}dB" for sound in contexts)
        typer.echo(f"{project.slug}: {shown}")
        if updated.canonical_json() != payload.canonical_json():
            touched += 1
            if not dry_run:
                store.revise(project.id, updated)
    typer.echo(f"{'Would update' if dry_run else 'Updated'} {touched} soundscapes")


@app.command("calibrate-speaker-qa")
def calibrate_speaker_qa(repo: Path = typer.Option(Path.cwd()), yes: bool = False) -> None:
    """Derive warning bounds only after all planned recordings have identity approval."""

    if not yes:
        raise typer.BadParameter("inspect the reviewed corpus, then repeat with --yes")
    plan = yaml.safe_load((repo_root(repo) / "data" / "listening-plan.yaml").read_text())
    planned_ids = {
        artifact["id"] for unit in plan["units"] for artifact in unit["artifacts"]
    }
    store = Store()
    reports: list[SpeakerConsistencyReport] = []
    seen: set[str] = set()
    for project in store.projects():
        if project.slug not in planned_ids:
            continue
        seen.add(project.slug)
        _, revision, _ = store.get(project.id)
        if Stage(project.stage) not in {Stage.HUMAN_APPROVED, Stage.EXPORTED}:
            raise typer.BadParameter(f"{project.slug} has not received new human approval")
        approval = json.loads(revision.approval_json or "{}")
        if "identity" not in approval.get("checklist", []):
            raise typer.BadParameter(f"{project.slug} lacks the character-identity review")
        qa = json.loads(revision.qa_json or "{}")
        raw = qa.get("speaker_consistency")
        if not isinstance(raw, dict):
            raise typer.BadParameter(f"{project.slug} lacks speaker-consistency QA")
        reports.append(SpeakerConsistencyReport.model_validate(raw))
    missing = sorted(planned_ids - seen)
    if missing:
        raise typer.BadParameter("missing planned projects: " + ", ".join(missing))
    calibration = derive_calibration(reports)
    target = store.root / "speaker-qa-calibration.json"
    target.write_text(calibration.model_dump_json(indent=2))
    typer.echo(f"Wrote reviewed-corpus warning bounds from {len(reports)} projects: {target}")


@app.command("regenerate-voice-profile-corpus")
def regenerate_voice_profile_corpus(
    repo: Path = typer.Option(Path.cwd()),
    slug: list[str] | None = typer.Option(None, "--slug"),
    yes: bool = False,
) -> None:
    """Regenerate all planned draft projects through one loaded CustomVoice adapter."""

    if not yes:
        raise typer.BadParameter(
            "this replaces every local working WAV and can take hours; repeat with --yes"
        )
    plan = yaml.safe_load((repo_root(repo) / "data" / "listening-plan.yaml").read_text())
    planned_ids = {
        artifact["id"] for unit in plan["units"] for artifact in unit["artifacts"]
    }
    requested = set(slug or planned_ids)
    if unknown := requested - planned_ids:
        raise typer.BadParameter("not planned listening projects: " + ", ".join(sorted(unknown)))
    store = Store()
    engine = QwenSpeech()
    failures: list[str] = []
    selected = [project for project in reversed(store.projects()) if project.slug in requested]
    for index, project in enumerate(selected, 1):
        current, _, payload = store.get(project.id)
        if payload.voice_profiles is None:
            failures.append(f"{project.slug}: no locked voice profiles")
            continue
        if Stage(current.stage) != Stage.DRAFT:
            # Safe resume after an interrupted corpus run. Profile migration revisions carry no
            # approval, and reset clears any QA that could describe the incomplete old take.
            if Stage(current.stage) in {
                Stage.VALIDATED,
                Stage.AUDIO_GENERATED,
                Stage.AUTOMATICALLY_CHECKED,
            }:
                store.reset_to(project.id, Stage.DRAFT)
            else:
                failures.append(f"{project.slug}: cannot replace approved stage {current.stage}")
                continue
        work = store.root / "projects" / str(project.id)
        typer.echo(f"[{index}/{len(selected)}] {project.slug}")
        try:
            store.transition(project.id, Stage.DRAFT, Stage.VALIDATED)
            paths = generate_lines(payload, work, engine)
            assemble(payload, paths, work / "dry.wav")
            mix_context(payload, store.root, work / "dry.wav", work / "final.wav")
            store.transition(project.id, Stage.VALIDATED, Stage.AUDIO_GENERATED)
        except Exception as exc:
            current, _, _ = store.get(project.id)
            if Stage(current.stage) == Stage.VALIDATED:
                store.reset_to(project.id, Stage.DRAFT)
            failures.append(f"{project.slug}: {exc}")
            typer.echo(f"  failed: {exc}", err=True)
    if failures:
        typer.echo("Regeneration failures:\n" + "\n".join(failures), err=True)
        raise typer.Exit(1)
    typer.echo(f"Regenerated {len(selected)} planned recordings; all now require QA and review")


@app.command("qa-voice-profile-corpus")
def qa_voice_profile_corpus(
    repo: Path = typer.Option(Path.cwd()),
    slug: list[str] | None = typer.Option(None, "--slug"),
    yes: bool = False,
) -> None:
    """Run Whisper and one shared pinned WavLM instance over regenerated corpus audio."""

    if not yes:
        raise typer.BadParameter("this runs local ASR and speaker QA for every take; use --yes")
    plan = yaml.safe_load((repo_root(repo) / "data" / "listening-plan.yaml").read_text())
    planned_ids = {
        artifact["id"] for unit in plan["units"] for artifact in unit["artifacts"]
    }
    requested = set(slug or planned_ids)
    if unknown := requested - planned_ids:
        raise typer.BadParameter("not planned listening projects: " + ", ".join(sorted(unknown)))
    store = Store()
    embedder = WavLMSpeakerEmbedder()
    failures: list[str] = []
    selected = [project for project in reversed(store.projects()) if project.slug in requested]
    for index, project in enumerate(selected, 1):
        current, _, payload = store.get(project.id)
        if Stage(current.stage) != Stage.AUDIO_GENERATED:
            failures.append(f"{project.slug}: expected audio_generated, found {current.stage}")
            continue
        typer.echo(f"[{index}/{len(selected)}] {project.slug}")
        work = store.root / "projects" / str(project.id)
        line_paths = {
            line.id: work / "cache" / f"{payload.cache_key(line, QwenSpeech.revision)}.wav"
            for line in payload.lines
        }
        try:
            transcripts = {line.id: transcribe(line_paths[line.id]) for line in payload.lines}
            dry_report = check_transcripts(payload, transcripts, transcribe(work / "dry.wav"))
            final_report = check_transcripts(payload, transcripts, transcribe(work / "final.wav"))
            speaker = check_speaker_consistency(payload, line_paths, backend=embedder)
            report = {
                "passed": dry_report.passed and final_report.passed,
                "dry": dry_report.model_dump(mode="json"),
                "final": final_report.model_dump(mode="json"),
                "speaker_consistency": speaker.model_dump(mode="json"),
                "context_sound_count": len(payload.context_sounds),
                "soundscape": soundscape_report(
                    payload, work / "dry.wav", work / "final.wav"
                ).model_dump(mode="json"),
            }
            store.transition(
                project.id,
                Stage.AUDIO_GENERATED,
                Stage.AUTOMATICALLY_CHECKED,
                qa=report,
            )
            if not report["passed"]:
                failures.append(f"{project.slug}: Whisper/protected-token QA failed")
        except Exception as exc:
            failures.append(f"{project.slug}: {exc}")
            typer.echo(f"  failed: {exc}", err=True)
    if failures:
        typer.echo("QA review required:\n" + "\n".join(failures), err=True)
        raise typer.Exit(1)
    typer.echo(f"Checked {len(selected)} planned recordings; all await blind-first human review")


@app.command("normalize-questions")
def normalize_questions(dry_run: bool = False) -> None:
    """Rewrite legacy question shapes as single-choice drafts, keeping the authored text."""

    store = Store()
    touched = 0
    for project in store.projects():
        _, _, payload = store.get(project.id)
        converted = [as_single_choice(q) for q in payload.questions]
        if not any(converted):
            continue
        questions = [new or old for new, old in zip(converted, payload.questions, strict=True)]
        changed = [q.id for q, new in zip(payload.questions, converted, strict=True) if new]
        typer.echo(f"{project.slug}: {', '.join(changed)}")
        touched += len(changed)
        if not dry_run:
            store.revise(project.id, payload.model_copy(update={"questions": questions}))
    verb = "would convert" if dry_run else "converted"
    typer.echo(
        f"{verb} {touched} question(s). Saving a revision returns each project to draft; "
        f"finish every {TODO_OPTION} in the editor before regenerating audio."
    )
