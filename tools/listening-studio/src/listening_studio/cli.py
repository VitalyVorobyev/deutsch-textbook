from __future__ import annotations

import json
import hashlib
import shutil
import subprocess
import webbrowser
from pathlib import Path
from typing import Any

import typer
import uvicorn
import yaml
from huggingface_hub import snapshot_download

from .adapters import draft_prompt, generate_drafts, model_lock
from .domain import (
    Bilingual,
    Brief,
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
)
from .export import publish as publish_files, write_bundle
from .storage import Store
from .sources import import_source, list_sources
from .web import app as web_app

app = typer.Typer(no_args_is_help=True)
models = typer.Typer()
sources = typer.Typer()
app.add_typer(models, name="models")
app.add_typer(sources, name="sources")
PACKAGE_ROOT = Path(__file__).resolve().parents[2]


@app.command()
def serve(repo: Path = typer.Option(Path.cwd()), port: int = 8765, no_open: bool = False) -> None:
    store = Store()
    api = web_app(store, repo.resolve())
    token = api.state.session_token
    url = f"http://127.0.0.1:{port}/?token={token}"
    typer.echo(f"Listening Studio: {url}")
    if not no_open:
        webbrowser.open(url)
    uvicorn.run(api, host="127.0.0.1", port=port)


@app.command("import-project")
def import_project(file: Path, slug: str) -> None:
    project = Store().create(slug, RevisionPayload.model_validate_json(file.read_text()))
    typer.echo(f"Created project {project.id}: {slug}")


def planned_response(kind: str, line_id: str) -> object:
    if kind == "multi-select":
        return MultiSelect(kind="multi-select", prompt="Was hören Sie?", options=["A", "B"], correct=[0])
    if kind == "true-false":
        return TrueFalse(kind="true-false", statement="Die Aussage stimmt.", correct=True)
    if kind == "ordering":
        return Ordering(kind="ordering", prompt="Bringen Sie die Informationen in die richtige Reihenfolge.", units=["A", "B"])
    if kind == "short-answer":
        return ShortAnswer(kind="short-answer", prompt="Was ist die wichtigste Information?", answers=["redaktionell ergänzen"])
    if kind == "dictation":
        return Dictation(kind="dictation", line_id=line_id)
    return SingleChoice(kind="single-choice", prompt="Was ist richtig?", options=["A", "B"], correct=0)


def payload_from_plan(
    unit: dict[str, Any], artifact: dict[str, Any], topic: str | None = None
) -> RevisionPayload:
    speaker_count = int(artifact["speakers"]["min"])
    speakers = [f"Sprecher {index + 1}" for index in range(speaker_count)]
    voices = ["Nicole", "Christopher", "Megan", "Michelle"]
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
            response=planned_response(kind, line.id),  # type: ignore[arg-type]
            explain=Bilingual(
                en="Replace with explanatory feedback during editing.",
                ru="Во время редактирования замените это объясняющей обратной связью.",
            ),
        )
        for index, kind in enumerate(artifact["question_kinds"])
    ]
    return RevisionPayload(
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
        tts_adapter="parler_tts",
    )


@app.command("seed-wave")
def seed_wave(
    wave: int = typer.Option(1, min=1, max=2),
    repo: Path = typer.Option(Path.cwd()),
) -> None:
    """Create local editor projects from the reviewed plan; no curriculum files are written."""

    plan = yaml.safe_load((repo.resolve() / "data" / "listening-plan.yaml").read_text())
    atlas = yaml.safe_load((repo.resolve() / "content" / "atlas.yaml").read_text())
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

    plan = yaml.safe_load((repo.resolve() / "data" / "listening-plan.yaml").read_text())
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

    generate_drafts([payload for _, _, payload in selected], on_draft=save_draft)


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


def bundle_project(project_id: int) -> tuple[Path, RevisionPayload]:
    store = Store()
    project, revision, payload = store.get(project_id)
    if Stage(project.stage) != Stage.HUMAN_APPROVED:
        raise typer.BadParameter("project must be human_approved")
    assert revision.qa_json and revision.approval_json
    wav = store.root / "projects" / str(project_id) / "final.wav"
    dry_wav = store.root / "projects" / str(project_id) / "dry.wav"
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
    written = publish_files(repo.resolve(), project.slug, payload, out)
    store.transition(project_id, Stage.HUMAN_APPROVED, Stage.EXPORTED)
    typer.echo("Published:\n" + "\n".join(str(path) for path in written))


@app.command()
def benchmark() -> None:
    report = PACKAGE_ROOT / "examples" / "a2-zwei-sprecher" / "benchmark.json"
    if not report.exists():
        raise typer.BadParameter("no measured benchmark exists; run the fixed A2 fixture first")
    typer.echo(report.read_text())
