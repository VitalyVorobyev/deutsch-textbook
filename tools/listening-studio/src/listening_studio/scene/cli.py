"""The `scene` verbs — headless, and every one of them `--json`-able.

Separate from `cli.py` on purpose. The main CLI module imports the whole render stack
(huggingface-hub, uvicorn, the adapters) to define its commands; the scene verbs read files,
validate a model and write rows, and none of that should cost a model download to reach. It is
registered as `app.add_typer(scene_app, name="scene")` there, so `atlas-listening scene …` is
one command surface however the modules are split.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

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
def validate_scene(file: Path, json_output: bool = typer.Option(False, "--json")) -> None:
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
    if json_output:
        _emit({"ok": True, "slug": scene.slug, "sha256": scene.sha256(), "errors": []})
    else:
        typer.echo(f"{scene.slug}: {len(scene.script)} utterances, {scene.sha256()}")


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


@app.command("schema")
def schema(
    repo: Path = typer.Option(Path.cwd()),
    check: bool = typer.Option(False, "--check"),
) -> None:
    """Write the published Scene v1 JSON Schema, or verify the committed copy is current."""

    root = repo.resolve()
    if check:
        target = root / SCHEMA_PATH
        current = target.read_text() if target.exists() else ""
        if current == scene_schema_json():
            typer.echo(f"{SCHEMA_PATH} is current")
            return
        typer.echo(
            f"{SCHEMA_PATH} does not match the model — run `atlas-listening scene schema`",
            err=True,
        )
        raise typer.Exit(1)
    typer.echo(f"Wrote {write_scene_schema(root)}")
