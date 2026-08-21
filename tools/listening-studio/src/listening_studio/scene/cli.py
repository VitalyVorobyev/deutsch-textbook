"""The `scene` verbs — headless, and every one of them `--json`-able.

Separate from `cli.py` on purpose. The main CLI module imports the whole render stack
(huggingface-hub, uvicorn, the adapters) to define its commands; the scene verbs read files,
validate a model and write rows, and none of that should cost a model download to reach. It is
registered as `app.add_typer(scene_app, name="scene")` there, so `atlas-listening scene …` is
one command surface however the modules are split.
"""

from __future__ import annotations

import json
import sys
from contextlib import contextmanager, redirect_stdout
from pathlib import Path
from typing import Any, Iterator

import typer

from ..catalogs import load_character_catalog, load_narration_catalog
from ..domain import Stage
from ..reading_audio import default_profile_id, load_reading_sources
from ..storage import Store
from .convert import dialogue_scene, reading_scene
from .exercise import ExerciseAttachment
from .model import Scene
from .schema_export import SCHEMA_PATH, scene_schema_json, write_scene_schema

app = typer.Typer(no_args_is_help=True, help="Scene v1: convert, validate, store, publish schema")


def _emit(payload: dict[str, Any]) -> None:
    typer.echo(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True))


@contextmanager
def _only_json_on_stdout(active: bool) -> Iterator[None]:
    """Keep the `--json` envelope the only thing a caller has to parse.

    Measured, not anticipated: the pinned Qwen adapter prints a flash-attn banner to **stdout**
    when it is imported, so the first real `scene render --json` produced four lines of text and
    then a JSON document, and `json.loads` on the result fails. It lands there only when a real
    engine runs, which is exactly where no test on `FakeSpeech` could ever see it. Library output
    goes to stderr for the duration; it is diagnostics, and stderr is where diagnostics belong.
    """

    if not active:
        yield
        return
    with redirect_stdout(sys.stderr):
        yield


def _import(scene: Scene, exercise: ExerciseAttachment | None, slug: str | None) -> dict[str, Any]:
    """Create the project, and say the same four things however the scene was obtained."""

    if slug and slug != scene.slug:
        # Renaming on import would make the stored slug and the scene's own identity disagree,
        # and `revise_scene` refuses that combination for good reason. Rename the scene instead.
        raise typer.BadParameter(f"--slug {slug} does not match the scene's slug {scene.slug}")
    store = Store()
    project = store.create_scene(scene, exercise)
    return {
        "task": "scene.create",
        "slug": scene.slug,
        "revision": 1,
        "payload_sha256": scene.sha256(),
        "stage": str(Stage.DRAFT),
        "project_id": project.id,
        "has_exercise": exercise is not None,
    }


def _catalog_warnings(scene: Scene, repo: Path) -> list[str]:
    """Acoustic ids this scene names that the repository's catalogs do not define.

    **Warnings, never failures.** A scene document is valid standalone — that is what makes it
    publishable and readable by another implementation — so holding it against a catalog it does
    not ship with would mean a scene becomes invalid on a machine whose `data/` is a week older.
    What the check is genuinely for is the other direction: an id that will refuse at render time
    should be visible while the file is being edited, not twenty minutes into a synthesis run.
    """

    from ..dsp.profiles import (
        DELTA_KEYS,
        DIFFICULTY_PATH,
        PROFILES_PATH,
        load_acoustic_profiles,
        load_difficulty_presets,
    )
    from .model import SfxEntry, SpeechEntry

    found: list[str] = []
    try:
        profiles = load_acoustic_profiles(repo)
    except (OSError, ValueError) as error:
        found.append(f"cannot read {PROFILES_PATH}: {error}")
    else:
        if scene.acoustics.room is not None and scene.acoustics.room not in profiles.rooms:
            found.append(
                f"room {scene.acoustics.room!r} is not in {PROFILES_PATH} "
                f"(it defines: {', '.join(sorted(profiles.rooms))})"
            )
        named = sorted(
            {
                entry.placement.device
                for entry in scene.timeline
                if isinstance(entry, (SpeechEntry, SfxEntry))
                and entry.placement is not None
                and entry.placement.device is not None
            }
        )
        for device in named:
            if device not in profiles.devices:
                found.append(
                    f"device {device!r} is not in {PROFILES_PATH} "
                    f"(it defines: {', '.join(sorted(profiles.devices))})"
                )
    try:
        presets = load_difficulty_presets(repo)
    except (OSError, ValueError) as error:
        found.append(f"cannot read {DIFFICULTY_PATH}: {error}")
        return found
    for variant in scene.variants:
        if variant.preset is not None and variant.preset not in presets.presets:
            found.append(
                f"variant {variant.id}: preset {variant.preset!r} is not in {DIFFICULTY_PATH} "
                f"(it defines: {', '.join(sorted(presets.presets))})"
            )
        unknown = sorted(set(variant.overrides) - set(DELTA_KEYS))
        if unknown:
            found.append(
                f"variant {variant.id}: unknown override key(s) {', '.join(unknown)}; "
                f"the vocabulary is {', '.join(DELTA_KEYS)}"
            )
    return found


@app.command("validate")
def validate_scene(
    file: Path,
    repo: Path | None = typer.Option(
        None, "--repo", help="also warn about acoustic ids this repository does not define"
    ),
    json_output: bool = typer.Option(False, "--json"),
) -> None:
    """Load one scene document and run every model validator over it."""

    try:
        scene = Scene.model_validate_json(file.read_text())
    except Exception as error:
        if not json_output:
            typer.echo(f"invalid: {error}", err=True)
            raise typer.Exit(1)
        # One line per pydantic error rather than the whole rendered block: a caller asking for
        # JSON is a program, and a program cannot do anything with an indented traceback.
        _emit({"ok": False, "slug": None, "sha256": None, "errors": str(error).splitlines()})
        raise typer.Exit(1)
    warnings = _catalog_warnings(scene, repo.resolve()) if repo is not None else []
    if json_output:
        _emit(
            {
                "ok": True,
                "slug": scene.slug,
                "sha256": scene.sha256(),
                "errors": [],
                "warnings": warnings,
            }
        )
        return
    typer.echo(f"{scene.slug}: {len(scene.script)} utterances, {scene.sha256()}")
    for warning in warnings:
        typer.echo(f"  warning: {warning}", err=True)


@app.command("create")
def create_scene(
    from_file: Path = typer.Option(..., "--from", exists=True, dir_okay=False),
    exercise: Path | None = typer.Option(None, "--exercise", exists=True, dir_okay=False),
    slug: str | None = typer.Option(None, "--slug"),
    json_output: bool = typer.Option(False, "--json"),
) -> None:
    """Import a scene document into the local store as a draft."""

    scene = Scene.model_validate_json(from_file.read_text())
    attachment = (
        ExerciseAttachment.model_validate_json(exercise.read_text()) if exercise else None
    )
    result = _import(scene, attachment, slug)
    if json_output:
        _emit(result)
    else:
        typer.echo(f"Created scene project {result['project_id']}: {scene.slug}")


def _write_or_import(
    scene: Scene,
    exercise: ExerciseAttachment | None,
    out: Path | None,
    do_import: bool,
    json_output: bool,
) -> None:
    if do_import:
        result = _import(scene, exercise, None)
    else:
        target = out or Path(f"{scene.slug}.json")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(scene.canonical_json() + "\n")
        written = [str(target)]
        if exercise is not None:
            attachment_path = target.with_name(target.stem + ".exercise.json")
            attachment_path.write_text(exercise.canonical_json() + "\n")
            written.append(str(attachment_path))
        result = {
            "task": "scene.convert",
            "slug": scene.slug,
            "payload_sha256": scene.sha256(),
            "files": written,
        }
    if json_output:
        _emit(result)
    elif do_import:
        typer.echo(f"Created scene project {result['project_id']}: {scene.slug}")
    else:
        typer.echo(f"{scene.slug}: " + ", ".join(str(path) for path in result["files"]))


@app.command("from-dialogue")
def from_dialogue(
    artifact: str,
    repo: Path = typer.Option(Path.cwd()),
    out: Path | None = typer.Option(None, "--out"),
    do_import: bool = typer.Option(False, "--import"),
    json_output: bool = typer.Option(False, "--json"),
) -> None:
    """Convert one published listening artifact (`<level>/<id>`) into a scene."""

    scene, exercise = dialogue_scene(repo.resolve(), artifact)
    _write_or_import(scene, exercise, out, do_import, json_output)


@app.command("from-reading")
def from_reading(
    reading: str,
    repo: Path = typer.Option(Path.cwd()),
    profile: str | None = typer.Option(None, "--profile"),
    out: Path | None = typer.Option(None, "--out"),
    do_import: bool = typer.Option(False, "--import"),
    json_output: bool = typer.Option(False, "--json"),
) -> None:
    """Convert one Lesetext (`<level>/<id>`) into a narration scene."""

    root = repo.resolve()
    source = next((row for row in load_reading_sources(root) if row.id == reading), None)
    if source is None:
        raise typer.BadParameter(f"unknown reading {reading}")
    scene = reading_scene(
        source,
        load_narration_catalog(root).profiles,
        load_character_catalog(root).characters,
        profile or default_profile_id(source),
    )
    _write_or_import(scene, None, out, do_import, json_output)


@app.command("show")
def show_scene(slug: str, json_output: bool = typer.Option(False, "--json")) -> None:
    """Print the current revision of one stored scene."""

    found = Store().get_scene_by_slug(slug)
    if found is None:
        raise typer.BadParameter(f"no scene project {slug}")
    project, revision, scene, exercise = found
    if json_output:
        _emit(
            {
                "task": "scene.show",
                "slug": project.slug,
                "kind": project.kind,
                "stage": project.stage,
                "revision": revision.number,
                "payload_sha256": revision.scene_sha256,
                "scene": scene.model_dump(mode="json"),
                "exercise": exercise.model_dump(mode="json") if exercise else None,
            }
        )
        return
    typer.echo(f"{project.slug} · {project.kind} · {project.stage} · rev {revision.number}")
    for utterance in scene.script:
        typer.echo(f"  {utterance.role}: {utterance.display_text}")


def _stored(slug: str) -> tuple[Any, Any, Scene]:
    found = Store().get_scene_by_slug(slug)
    if found is None:
        raise typer.BadParameter(f"no scene project {slug}")
    project, revision, scene, _exercise = found
    return project, revision, scene


@app.command("render")
def render_command(
    slug: str,
    variant: str = typer.Option("natural", "--variant"),
    engine: str | None = typer.Option(None, "--engine", help="qwen_tts or fake; overrides the cast"),
    repo: Path = typer.Option(Path.cwd()),
    test_adapter: bool = typer.Option(False, "--test-adapter"),
    json_output: bool = typer.Option(False, "--json"),
) -> None:
    """Render the current revision of one stored scene through the node graph."""

    # Imported here, not at module scope: these pull the whole render stack (huggingface-hub, the
    # adapters, soundfile), and the point of this module is that `scene validate` costs none of it.
    from ..adapters import ENGINES, engine_for
    from ..generative.fake import FakeSound
    from ..generative.gateway import SoundGenerator, SpeechGenerator
    from ..generative.locks import set_models_root
    from ..graph.render import render_scene

    if engine is not None and engine not in ENGINES:
        raise typer.BadParameter(f"unknown engine {engine}; known: {', '.join(sorted(ENGINES))}")
    # The gate the dialogue and reading verbs already use: the fake engines exist for workflow
    # tests and generate no approvable audio, so reaching one is always an explicit request.
    if engine == "fake" and not test_adapter:
        raise typer.BadParameter("the fake engine needs --test-adapter; it renders no real audio")
    set_models_root(repo.resolve())
    store = Store()
    project, revision, scene = _stored(slug)

    names = sorted({member.voice.engine for member in scene.cast})
    if engine is not None:
        forced: SpeechGenerator = ENGINES[engine]()
        speech_engines: dict[str, SpeechGenerator] = {name: forced for name in names}
    else:
        if "fake" in names and not test_adapter:
            raise typer.BadParameter("this scene is cast on the fake engine; add --test-adapter")
        speech_engines = {name: engine_for(name) for name in names}
    # No `--sound-engine`. Production renders have no sound generator at all until the Stable
    # Audio PR, and the fake one rides the same `--test-adapter` gate as the fake voice rather
    # than a second flag that would only ever be passed beside it. A `SoundSpec` reached without
    # one is refused by the renderer, not silently dropped.
    sound_engine: SoundGenerator | None = FakeSound() if test_adapter else None

    with _only_json_on_stdout(json_output):
        result = render_scene(
            scene,
            store.root,
            variant=variant,
            speech_engines=speech_engines,
            sound_engine=sound_engine,
            repo=repo.resolve(),
        )

    stage = Stage(project.stage)
    if stage == Stage.DRAFT:
        store.transition_scene(project.id, Stage.DRAFT, Stage.VALIDATED)
        stage = Stage.VALIDATED
    if stage == Stage.VALIDATED:
        store.transition_scene(project.id, Stage.VALIDATED, Stage.AUDIO_GENERATED)
        stage = Stage.AUDIO_GENERATED
    # Anything later is left alone. A re-render of unchanged bytes is a cache walk, and dropping
    # a QA report or an approval because someone re-ran it would be a workflow regression, not a
    # safety measure — the scene sha is in the render path, so a *changed* scene is a new render.

    payload = {
        "task": "scene.render",
        "slug": scene.slug,
        "revision": revision.number,
        "payload_sha256": revision.scene_sha256,
        "stage": str(stage),
        "variant": result.variant,
        "duration_ms": result.duration_ms,
        "nodes_evaluated": result.nodes_evaluated,
        "nodes_cached": result.nodes_cached,
        "artifacts": [
            {"path": str(row.path), "sha256": row.sha256, "kind": row.kind}
            for row in result.artifacts
        ],
    }
    if json_output:
        _emit(payload)
        return
    typer.echo(
        f"{scene.slug} · {result.variant} · {result.duration_ms / 1000:.1f} s · "
        f"{result.nodes_evaluated} evaluated, {result.nodes_cached} cached"
    )
    typer.echo(f"  {result.directory}")


@app.command("qa")
def qa_command(
    slug: str,
    variant: str = typer.Option("natural", "--variant"),
    repo: Path = typer.Option(Path.cwd()),
    json_output: bool = typer.Option(False, "--json"),
) -> None:
    """Transcript, speaker and soundscape QA over one rendered scene."""

    from ..adapters import transcribe
    from ..generative.locks import set_models_root
    from ..graph.scene_qa import scene_qa

    set_models_root(repo.resolve())
    store = Store()
    project, revision, scene = _stored(slug)
    directory = store.root / "renders" / scene.sha256() / variant
    if not (directory / "render.json").exists():
        raise typer.BadParameter(
            f"{scene.slug} has no {variant} render of these bytes; run `scene render` first"
        )
    if Stage(project.stage) != Stage.AUDIO_GENERATED:
        raise typer.BadParameter(
            f"this scene is at {project.stage}; QA runs on {Stage.AUDIO_GENERATED}"
        )
    try:
        with _only_json_on_stdout(json_output):
            report = scene_qa(scene, directory, transcribe_fn=transcribe)
    except RuntimeError as error:
        # Whisper here is MLX and macOS-local. Say so once, clearly, rather than letting an
        # ImportError traceback out of a verb an agent is calling.
        typer.echo(f"scene qa needs the local ASR runtime: {error}", err=True)
        raise typer.Exit(1) from error
    store.transition_scene(
        project.id, Stage.AUDIO_GENERATED, Stage.AUTOMATICALLY_CHECKED, qa=report
    )
    manifest = json.loads((directory / "render.json").read_text())
    payload = {
        "task": "scene.qa",
        "slug": scene.slug,
        "revision": revision.number,
        "payload_sha256": revision.scene_sha256,
        "stage": str(Stage.AUTOMATICALLY_CHECKED),
        "variant": variant,
        "passed": report["passed"],
        "qa": report,
        "artifacts": [
            {"path": str(directory / row["path"]), "sha256": row["sha256"], "kind": row["kind"]}
            for row in manifest.get("artifacts", [])
        ],
    }
    if json_output:
        _emit(payload)
        return
    verdict = "passed" if report["passed"] else "needs review"
    typer.echo(
        f"{scene.slug} · {variant} · QA {verdict} · "
        f"full WER {report['transcripts']['full_wer']:.1%} · "
        f"speaker {report['speaker_qa'] if isinstance(report['speaker_qa'], str) else 'measured'}"
    )


@app.command("schema")
def schema(
    repo: Path = typer.Option(Path.cwd()),
    check: bool = typer.Option(False, "--check"),
) -> None:
    """Write the published Scene v1 JSON Schema, or verify the committed copy is current."""

    root = repo.resolve()
    if check:
        target = root / SCHEMA_PATH
        if not target.exists():
            # `repo` defaults to the CWD, and the natural place to run this tool is its own
            # directory — where the schema path resolves to nothing and "does not match" would
            # send someone regenerating a file that was never stale.
            typer.echo(f"no {SCHEMA_PATH} under {root} — pass --repo <course repo>", err=True)
            raise typer.Exit(1)
        if target.read_text() == scene_schema_json():
            typer.echo(f"{SCHEMA_PATH} is current")
            return
        typer.echo(
            f"{SCHEMA_PATH} does not match the model — run `atlas-listening scene schema`",
            err=True,
        )
        raise typer.Exit(1)
    typer.echo(f"Wrote {write_scene_schema(root)}")
