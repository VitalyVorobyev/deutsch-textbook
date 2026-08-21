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
import tempfile
import time
from contextlib import contextmanager, redirect_stdout
from pathlib import Path
from typing import Any, Iterator

import typer

from ..catalogs import load_character_catalog, load_narration_catalog
from ..domain import Stage
from ..reading_audio import default_profile_id, load_reading_sources
from ..storage import Store
from .checks import catalog_warnings
from .convert import dialogue_scene, reading_scene
from .exercise import ExerciseAttachment
from .model import Scene
from .publish import (
    PUBLISHED_VARIANT,
    PublishPlan,
    PublishRefusal,
    default_backup_root,
    deletion_refusal,
    plan_publish,
    published_slugs,
    stage_publish,
    write_publish,
)
from .schema_export import SCHEMA_PATH, scene_schema_json, write_scene_schema
from .wave import DEFAULT_VARIANT, run_wave, wave_summary, wave_targets

app = typer.Typer(
    no_args_is_help=True,
    help="Scene v1: convert, validate, store, render, QA, publish — and the corpus-wide wave",
)


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
    warnings = catalog_warnings(scene, repo.resolve()) if repo is not None else []
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
    sound_engine_name: str | None = typer.Option(
        None,
        "--sound-engine",
        help="stable_audio_sfx or fake; without it a SoundSpec is refused, not silently dropped",
    ),
    repo: Path = typer.Option(Path.cwd()),
    test_adapter: bool = typer.Option(False, "--test-adapter"),
    json_output: bool = typer.Option(False, "--json"),
) -> None:
    """Render the current revision of one stored scene through the node graph."""

    # Imported here, not at module scope: these pull the whole render stack (huggingface-hub, the
    # adapters, soundfile), and the point of this module is that `scene validate` costs none of it.
    from ..adapters import ENGINES, SOUND_ENGINES, engine_for, sound_engine_for
    from ..generative.fake import FakeSound
    from ..generative.gateway import SoundGenerator, SpeechGenerator
    from ..generative.locks import set_models_root
    from ..generative.voices import resolve_voices
    from ..graph.render import render_scene

    if engine is not None and engine not in ENGINES:
        raise typer.BadParameter(f"unknown engine {engine}; known: {', '.join(sorted(ENGINES))}")
    if sound_engine_name is not None and sound_engine_name not in SOUND_ENGINES:
        raise typer.BadParameter(
            f"unknown sound engine {sound_engine_name}; "
            f"known: {', '.join(sorted(SOUND_ENGINES))}"
        )
    # The gate the dialogue and reading verbs already use: the fake engines exist for workflow
    # tests and generate no approvable audio, so reaching one is always an explicit request.
    if engine is not None and engine.startswith("fake") and not test_adapter:
        raise typer.BadParameter("the fake engine needs --test-adapter; it renders no real audio")
    if sound_engine_name == "fake" and not test_adapter:
        raise typer.BadParameter(
            "the fake sound engine needs --test-adapter; it renders a tone, not a sound"
        )
    set_models_root(repo.resolve())
    store = Store()
    project, revision, scene = _stored(slug)

    names = sorted({member.voice.engine for member in scene.cast})
    # Every consented voice this cast names, resolved before an engine exists. A `--engine` override
    # does not skip it: forcing a render onto another engine is a smoke test of the *pipeline*, and
    # a smoke test that could speak in a withdrawn voice is not a smoke test.
    try:
        resolved = resolve_voices(
            store,
            store.root,
            [member.voice.voice_ref for member in scene.cast if member.voice.voice_ref],
        )
    except ValueError as error:
        raise typer.BadParameter(str(error)) from error
    if engine is not None:
        forced: SpeechGenerator = engine_for(engine, resolved.clonable)
        speech_engines: dict[str, SpeechGenerator] = {name: forced for name in names}
    else:
        cast_fake = sorted(name for name in names if name.startswith("fake"))
        if cast_fake and not test_adapter:
            raise typer.BadParameter(
                f"this scene is cast on the {', '.join(cast_fake)} engine(s); add --test-adapter"
            )
        speech_engines = {name: engine_for(name, resolved.clonable) for name in names}
    # `--sound-engine` names the generator a `SoundSpec` resolves through; with none named a
    # `SoundSpec` is refused by the renderer, not silently dropped. `--test-adapter` alone keeps
    # dealing the fake one, which is what every workflow test written before the flag existed
    # expects, and is not a way past the gate: `--sound-engine fake` needs it too.
    sound_engine: SoundGenerator | None
    if sound_engine_name is not None:
        sound_engine = sound_engine_for(sound_engine_name)
    else:
        sound_engine = FakeSound() if test_adapter else None

    with _only_json_on_stdout(json_output):
        result = render_scene(
            scene,
            store.root,
            variant=variant,
            speech_engines=speech_engines,
            sound_engine=sound_engine,
            repo=repo.resolve(),
            voices=resolved.refs,
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


# ---------------------------------------------------------------------------
# The regeneration wave
# ---------------------------------------------------------------------------


@app.command("regenerate-corpus")
def regenerate_corpus(
    repo: Path = typer.Option(Path.cwd()),
    level: str | None = typer.Option(None, "--level", help="A1, A2 or B1; default all three"),
    only: list[str] = typer.Option(
        [], "--only", help="one artifact id, repeatable — the whole wave restricted to it"
    ),
    variant: str = typer.Option(DEFAULT_VARIANT, "--variant"),
    engine: str | None = typer.Option(
        None, "--engine", help="qwen_tts or fake; overrides the cast (fake needs --test-adapter)"
    ),
    test_adapter: bool = typer.Option(False, "--test-adapter"),
    speaker_qa: bool = typer.Option(
        True, "--speaker-qa/--no-speaker-qa", help="WavLM identity check when the weights are here"
    ),
    dry_run: bool = typer.Option(False, "--dry-run"),
    yes: bool = typer.Option(False, "--yes"),
    json_output: bool = typer.Option(False, "--json"),
) -> None:
    """Convert, render and QA the published dialogue corpus **in one process**.

    The reasoning — why one process, why it stops before the human, why a failure is a row — is in
    `scene.wave`, which is also where a test drives it with a fake transcriber. This verb is the
    flags, the progress lines and the final table.
    """

    from ..adapters import ENGINES
    from ..generative.locks import set_models_root

    if engine is not None and engine not in ENGINES:
        raise typer.BadParameter(f"unknown engine {engine}; known: {', '.join(sorted(ENGINES))}")
    if engine is not None and engine.startswith("fake") and not test_adapter:
        raise typer.BadParameter("the fake engine needs --test-adapter; it renders no real audio")
    if not dry_run and not yes:
        raise typer.BadParameter("review the plan with --dry-run, then repeat with --yes")

    root = repo.resolve()
    set_models_root(root)
    store = Store()
    targets = wave_targets(root, level, list(only))
    if not targets:
        raise typer.BadParameter(
            f"no published listening artifact matches {level or 'any level'}"
            + (f" and --only {', '.join(only)}" if only else "")
        )
    started = time.monotonic()
    # Progress goes to **stderr** even without `--json`: it is a running commentary on a job that
    # takes half an hour, and a table printed at the end is what a caller parses.
    with _only_json_on_stdout(json_output):
        rows = run_wave(
            store,
            root,
            targets,
            variant=variant,
            engine=engine,
            test_adapter=test_adapter,
            speaker_qa=speaker_qa,
            dry_run=dry_run,
            progress=lambda line: typer.echo(line, err=True),
        )

    outcomes = wave_summary(rows)
    payload = {
        "task": "scene.regenerate-corpus",
        "level": level.upper() if level else None,
        "variant": variant,
        "dry_run": dry_run,
        "planned": len(targets),
        "elapsed_seconds": round(time.monotonic() - started, 1),
        "rows": rows,
        "summary": outcomes,
        "failures": [row for row in rows if row.get("outcome") == "failed"],
    }
    if json_output:
        _emit(payload)
        if outcomes.get("failed"):
            raise typer.Exit(1)
        return
    typer.echo("")
    typer.echo(f"{'n':>3}  {'artifact':<32} {'outcome':<12} {'s':>6}  {'eval/cache':>10}  WER")
    for row in rows:
        wer = row.get("full_wer")
        nodes = f"{row.get('nodes_evaluated', '-')}/{row.get('nodes_cached', '-')}"
        typer.echo(
            f"{row['n']:>3}  {row['slug']:<32} {str(row.get('outcome')):<12} "
            f"{row.get('seconds', '-'):>6}  {nodes:>10}  "
            f"{f'{wer:.1%}' if isinstance(wer, float) else '-'}"
        )
    typer.echo(
        f"{len(targets)} artifact(s) · "
        + " · ".join(f"{count} {name}" for name, count in sorted(outcomes.items()))
        + f" · {payload['elapsed_seconds']} s"
    )
    if outcomes.get("failed"):
        raise typer.Exit(1)


# ---------------------------------------------------------------------------
# Publishing
# ---------------------------------------------------------------------------


def _refusal(error: PublishRefusal) -> typer.BadParameter:
    """A gate id in front of its sentence, so a log line is greppable by gate."""

    return typer.BadParameter(f"{error.gate}: {error.detail}")


def _plan_payload(plan: PublishPlan, *, dry_run: bool) -> dict[str, Any]:
    return {
        "task": "scene.publish",
        "slug": plan.slug,
        "level": plan.level,
        "variant": plan.variant,
        "scene_sha256": plan.scene_sha256,
        "dry_run": dry_run,
        "files": plan.files(),
        "replaces": [path.as_posix() for path in plan.replaces],
        "claims": plan.manifest["claims"],
        "duration_seconds": plan.artifact["duration_seconds"],
    }


def _print_plan(plan: PublishPlan, *, dry_run: bool) -> None:
    verb = "Would write" if dry_run else "Wrote"
    typer.echo(
        f"{plan.slug} · {plan.level} · {plan.variant} · "
        f"{plan.artifact['duration_seconds']} s · scene {plan.scene_sha256[:12]}"
    )
    for target, kind in plan.files().items():
        mark = " (replaces)" if Path(target) in plan.replaces else ""
        typer.echo(f"  {verb} {target}  [{kind}]{mark}")


@app.command("publish")
def publish_command(
    slug: str,
    repo: Path = typer.Option(Path.cwd()),
    level: str | None = typer.Option(
        None, "--level", help="A1/A2/B1/B2, for a scene whose brief cannot supply one"
    ),
    variant: str = typer.Option(
        PUBLISHED_VARIANT,
        "--variant",
        help=f"only {PUBLISHED_VARIANT} is published; anything else is refused by name",
    ),
    dry_run: bool = typer.Option(
        False, "--dry-run", help="stage every byte, report where it would land, write nothing"
    ),
    yes: bool = typer.Option(False, "--yes"),
    json_output: bool = typer.Option(False, "--json"),
) -> None:
    """Publish one human-approved scene into the course repository.

    `--dry-run` runs **every** gate and stages **every** byte, stopping before the rename. It is
    not a lighter check that might disagree with the real one: the plan it prints is the object a
    real publish then writes.
    """

    if not dry_run and not yes:
        raise typer.BadParameter("review the plan with --dry-run, then repeat with --yes")
    store = Store()
    root = repo.resolve()
    try:
        plan = plan_publish(store, root, slug, level=level, variant=variant)
    except PublishRefusal as error:
        raise _refusal(error) from error
    if dry_run:
        with tempfile.TemporaryDirectory(prefix="scene-publish-dry-") as staging:
            staged = [target.as_posix() for _, target in stage_publish(plan, Path(staging))]
        payload = _plan_payload(plan, dry_run=True) | {"staged": staged}
        if json_output:
            _emit(payload)
        else:
            _print_plan(plan, dry_run=True)
        return
    backup = default_backup_root(store.root, plan.slug) if plan.replaces else None
    try:
        written = write_publish(plan, root, backup_root=backup)
    except PublishRefusal as error:
        raise _refusal(error) from error
    project, _, _ = _stored(slug)
    store.transition_scene(project.id, Stage.HUMAN_APPROVED, Stage.EXPORTED)
    payload = _plan_payload(plan, dry_run=False) | {
        "written": [str(path) for path in written],
        "stage": str(Stage.EXPORTED),
        "backup": str(backup) if backup else None,
    }
    if json_output:
        _emit(payload)
        return
    _print_plan(plan, dry_run=False)
    if backup is not None:
        typer.echo(f"  Previous files retained at {backup}")


@app.command("publish-approved")
def publish_approved_command(
    repo: Path = typer.Option(Path.cwd()),
    level: str | None = typer.Option(None, "--level", help="A1, A2 or B1; default every level"),
    dry_run: bool = typer.Option(False, "--dry-run"),
    yes: bool = typer.Option(False, "--yes"),
    json_output: bool = typer.Option(False, "--json"),
) -> None:
    """Publish every `human_approved` scene in one pass — the content PR, after the review.

    **A refused scene does not stop the pass.** Forty artifacts reviewed over several sittings will
    contain one whose approval no longer covers its render or whose cast voice was withdrawn, and
    a run that aborted on the first would make the operator publish the other thirty-nine one at a
    time. Every refusal is recorded with its gate and printed at the end — the failure-JSON
    discipline the wave runner uses, applied to the step after it.

    The level filter reads the level the publisher **resolved**, not the slug: `--level A1` and a
    scene whose brief says A2 is not a match however the slug is spelled.
    """

    if not dry_run and not yes:
        raise typer.BadParameter("review the plan with --dry-run, then repeat with --yes")
    store = Store()
    root = repo.resolve()
    wanted = level.upper() if level else None
    published: list[dict[str, Any]] = []
    refused: list[dict[str, Any]] = []
    for project, _revision in store.scene_rows():
        if Stage(project.stage) != Stage.HUMAN_APPROVED:
            continue
        try:
            plan = plan_publish(store, root, project.slug)
        except PublishRefusal as error:
            refused.append({"slug": project.slug, "gate": error.gate, "detail": error.detail})
            continue
        if wanted is not None and plan.level != wanted:
            continue
        if dry_run:
            published.append(_plan_payload(plan, dry_run=True))
            continue
        backup = default_backup_root(store.root, plan.slug) if plan.replaces else None
        try:
            written = write_publish(plan, root, backup_root=backup)
        except PublishRefusal as error:
            refused.append({"slug": project.slug, "gate": error.gate, "detail": error.detail})
            continue
        store.transition_scene(project.id, Stage.HUMAN_APPROVED, Stage.EXPORTED)
        published.append(
            _plan_payload(plan, dry_run=False) | {"written": [str(path) for path in written]}
        )
    payload = {
        "task": "scene.publish-approved",
        "level": wanted,
        "dry_run": dry_run,
        "published": published,
        "refused": refused,
        "summary": {"published": len(published), "refused": len(refused)},
    }
    if json_output:
        _emit(payload)
        return
    for row in published:
        typer.echo(
            f"{'would publish' if dry_run else 'published'} {row['slug']} · {row['level']} · "
            f"{len(row['files'])} files"
        )
    for row in refused:
        typer.echo(f"refused {row['slug']} · {row['gate']}: {row['detail']}", err=True)
    typer.echo(f"{len(published)} published, {len(refused)} refused")
    if refused:
        raise typer.Exit(1)


@app.command("delete")
def delete_command(
    slug: str,
    repo: Path = typer.Option(Path.cwd()),
    yes: bool = typer.Option(False, "--yes"),
    json_output: bool = typer.Option(False, "--json"),
) -> None:
    """Delete a mis-created scene project: draft, revision 1, never published (backlog P28-6).

    The undo an 85-row narration queue needs and did not have. It is the narrowest deletion that
    makes creating from a queue safe, and the three refusals are three different losses — see
    `scene.publish.deletion_refusal` and the published check below.
    """

    if not yes:
        raise typer.BadParameter("deleting a scene project is not undoable; repeat with --yes")
    store = Store()
    found = store.get_scene_by_slug(slug)
    if found is None:
        raise typer.BadParameter(f"no scene project {slug}")
    project, revision, _, _ = found
    refusal = deletion_refusal(project, revision)
    if refusal is not None:
        raise typer.BadParameter(refusal)
    if slug in published_slugs(repo.resolve()):
        raise typer.BadParameter(
            f"{slug} is published: a provenance manifest in this repository names it, and deleting "
            "the project would leave that manifest pointing at a document nobody has"
        )
    store.delete_scene(project.id)
    if json_output:
        _emit({"task": "scene.delete", "slug": slug, "project_id": project.id, "deleted": True})
        return
    typer.echo(f"Deleted scene project {project.id}: {slug}")


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
