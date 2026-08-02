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
from .export import publish as publish_files, sha256, write_bundle
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

    # The approval covers specific bytes. Verify them before bundling, or a WAV regenerated,
    # replaced or truncated between approval and export is published carrying an approval
    # nobody gave it — and the downstream gate cannot see it, because scripts/validate.ts
    # compares the manifest to the file, never the approval to the manifest.
    approval = json.loads(revision.approval_json)
    approved_final = approval.get("audio_sha256")
    approved_dry = approval.get("dry_audio_sha256")
    if approved_final and sha256(wav) != approved_final:
        raise typer.BadParameter(
            "final.wav has changed since approval — re-approve this exact audio before exporting"
        )
    if approved_dry and dry_wav.exists() and sha256(dry_wav) != approved_dry:
        raise typer.BadParameter(
            "dry.wav has changed since approval — re-approve this exact audio before exporting"
        )

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
