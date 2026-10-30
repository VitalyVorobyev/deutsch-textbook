"""`GET /api/registry` — one row per planned audio artifact, joined across four sources.

This is `scripts/listening-inventory.ts` ported into the studio and then given the two things a
file-only derivation cannot have: the local studio database, and the exercise items that point
at each recording.

**Why port rather than call.** The TypeScript script reads the repository directly and must keep
working with no studio installed, no Python, and no server running — it is what CI and the
authoring loop use. So it stays exactly as it is and this is a second implementation of the same
`deriveStatus` vocabulary, with `tests/test_api_registry.py` holding the status names equal to
the ones that file exports.

**The four sources, and what each one alone cannot tell you.**

* `data/listening-plan.yaml` — what was commissioned. Alone: nothing about whether it exists.
* `content/listening/**` + `data/audio-provenance/**` — what is published. Alone: nothing about
  work in progress, and nothing about whether the published bytes are still current.
* the studio database — what is being worked on: the scene projects. Alone: nothing about what
  was planned or what shipped.
* `content/exercises/**` — what actually *uses* a recording. Alone: nothing about audio at all.

That last join is why `stale`, `recordings_without_exercises` and `exercises_without_recordings`
exist here and nowhere else: each of them is a disagreement *between* two of the four, and no
single source can see it.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Literal

import yaml
from fastapi import APIRouter

from ..scene.convert import reading_slug
from ..scene.publish import PUBLISHED_VARIANT
from ..scene.reading_source import load_reading_sources
from ..storage import SceneProject, SceneRevision, Store

#: The status vocabulary, and the one addition to it.
#:
#: The first six are `deriveStatus()`'s in `scripts/listening-inventory.ts`, name for name. The
#: seventh is what only this endpoint can see: audio is published, and the studio's current
#: revision is not the revision it was published from. A file-only derivation reads that as
#: `published`, because both files are there and both are internally consistent — the
#: disagreement is with a database it cannot open.
Status = Literal[
    "planned", "drafted", "qa_failed", "awaiting_approval", "approved", "published", "stale"
]


def _project_status(stage: str, qa_passed: bool | None) -> Status:
    """The live studio state, in the published vocabulary.

    `automatically_checked` is the one stage that splits: it means "the machine has measured
    this", and whether that measurement passed is the difference between a take waiting for a
    human and a take waiting for a rewrite.
    """

    if stage == "human_approved":
        return "approved"
    if stage == "exported":
        return "published"
    if stage == "automatically_checked":
        if qa_passed is True:
            return "awaiting_approval"
        if qa_passed is False:
            return "qa_failed"
    return "drafted"


def _manifest_status(manifest: dict[str, Any] | None, brief: bool) -> Status:
    """`deriveStatus()` for a row with no studio project: files only.

    Deliberately identical in structure to the TypeScript, including the order of the tests, so
    the two can be read side by side.
    """

    approval = manifest.get("approval") if manifest else None
    if isinstance(approval, dict) and approval.get("status") == "complete":
        return "approved"
    qa = manifest.get("qa") if manifest else None
    passed = qa.get("passed") if isinstance(qa, dict) else None
    if passed is True:
        return "awaiting_approval"
    if passed is False:
        return "qa_failed"
    if brief or manifest:
        return "drafted"
    return "planned"


def _status(
    *,
    published: bool,
    manifest: dict[str, Any] | None,
    brief: bool,
    project_stage: str | None,
    project_qa_passed: bool | None,
    published_revision: str | None,
    current_revision: str | None,
) -> Status:
    """The one place the four sources are reconciled into a single word.

    Read top to bottom, each branch answering a question the one below it cannot:

    1. Published *and* the studio has moved on → `stale`. Only comparable when both shas exist
       and describe the same kind of document; see `_published_revision`.
    2. Published → `published`. The files agree with each other and with the studio.
    3. A studio project → its live stage, which is newer than any file.
    4. Otherwise the published files, exactly as `listening-inventory.ts` reads them.
    """

    if published:
        if (
            published_revision is not None
            and current_revision is not None
            and published_revision != current_revision
        ):
            return "stale"
        return "published"
    if project_stage is not None:
        return _project_status(project_stage, project_qa_passed)
    return _manifest_status(manifest, brief)


def _published_revision(manifest: dict[str, Any] | None) -> str | None:
    """The scene sha the published provenance was written from, when it names one.

    Only a version-2 manifest — one the scene publisher wrote — carries `scene_sha256`. A
    pre-scene manifest hashes a different document, and comparing it against a scene project
    would report every converted artifact `stale` on the day it was converted: a hundred percent
    false-positive rate for a signal whose only value is that it is rare. So it is not compared.
    """

    if manifest is None:
        return None
    scene_sha = manifest.get("scene_sha256")
    return str(scene_sha) if isinstance(scene_sha, str) else None


def _scene_project(
    project: SceneProject, revision: SceneRevision, verdicts: dict[int, bool | None]
) -> dict[str, Any]:
    """A scene project as a registry row's `project`, with the published variant's QA verdict."""

    return {
        "kind": "scene",
        "id": project.id,
        "stage": project.stage,
        "revision": revision.number,
        "revision_sha256": revision.scene_sha256,
        "qa_passed": verdicts.get(revision.id),
        "has_exercise": revision.exercise_json is not None,
        "updated": revision.created_at,
    }


def _read_json(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    try:
        loaded = json.loads(path.read_text())
    except ValueError:
        # A provenance file that does not parse is a defect, but it is not this endpoint's to
        # raise: the registry is a read-only overview and must render the other 120 rows.
        return None
    return loaded if isinstance(loaded, dict) else None


def audio_exercise_items(repo: Path) -> list[dict[str, Any]]:
    """Every `audio-comprehension` item in the corpus, with the recording it names or None.

    One pass, returning the items rather than a summary, because two of the three questions this
    endpoint answers are about *which item* — a count alone tells an author that something is
    unlinked and not what to open.
    """

    found: list[dict[str, Any]] = []
    root = repo / "content" / "exercises"
    for path in sorted(root.glob("*/*.yaml")):
        try:
            document = yaml.safe_load(path.read_text())
        except yaml.YAMLError:
            # A set that does not parse is a defect the content validator owns, not this
            # read-only overview: skipping it keeps the other 437 rows renderable.
            continue
        if not isinstance(document, dict):
            continue
        for item in document.get("items", []) or []:
            if not isinstance(item, dict) or item.get("type") != "audio-comprehension":
                continue
            recording = item.get("recording")
            found.append(
                {
                    "set": path.stem,
                    "level": path.parent.name.upper(),
                    "item": str(item.get("id", "")),
                    "recording": (
                        recording if isinstance(recording, str) and recording else None
                    ),
                }
            )
    return found


def listening_rows(
    repo: Path,
    exercise_counts: dict[str, int],
    scenes: dict[str, tuple[SceneProject, SceneRevision]],
    verdicts: dict[int, bool | None],
) -> list[dict[str, Any]]:
    plan = yaml.safe_load((repo / "data" / "listening-plan.yaml").read_text())
    prompts_dir = repo / "data" / "prompts"
    prompts = [path.name for path in prompts_dir.iterdir()] if prompts_dir.is_dir() else []

    rows: list[dict[str, Any]] = []
    for unit in plan["units"]:
        level = str(unit["level"])
        for artifact in unit["artifacts"]:
            slug = str(artifact["id"])
            manifest = _read_json(
                repo / "data" / "audio-provenance" / level.lower() / f"{slug}.json"
            )
            record = (repo / "content" / "listening" / level.lower() / f"{slug}.yaml").exists()
            audio = (repo / "content" / "listening" / level.lower() / f"{slug}.mp3").exists()
            approved_manifest = isinstance(manifest, dict) and isinstance(
                manifest.get("approval"), dict
            ) and manifest["approval"].get("status") == "complete"

            project = _scene_project(*scenes[slug], verdicts) if slug in scenes else None
            rows.append(
                {
                    "kind": "listening",
                    "id": slug,
                    "level": level,
                    "unit": unit["unit"],
                    "wave": artifact.get("wave"),
                    "scenario": artifact.get("scenario"),
                    "status": _status(
                        published=approved_manifest and record and audio,
                        manifest=manifest,
                        brief=any(name.endswith(f"-{slug}-listening.md") for name in prompts),
                        project_stage=project["stage"] if project else None,
                        project_qa_passed=project["qa_passed"] if project else None,
                        published_revision=_published_revision(manifest) if project else None,
                        current_revision=project["revision_sha256"] if project else None,
                    ),
                    "artifact": record,
                    "audio": audio,
                    "has_provenance": manifest is not None,
                    "project": project,
                    "exercise_items": exercise_counts.get(slug, 0),
                }
            )
    return rows


def _narrated_paragraphs(revision: SceneRevision) -> list[str]:
    """The display text of a stored narration scene, utterance by utterance, unvalidated."""

    document = json.loads(revision.scene_json)
    return [
        str(utterance.get("display_text", ""))
        for utterance in document.get("script") or []
        if isinstance(utterance, dict)
    ]


def reading_rows(
    repo: Path,
    scenes: dict[str, tuple[SceneProject, SceneRevision]],
    verdicts: dict[int, bool | None],
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for source in load_reading_sources(repo):
        level = source.level.lower()
        name = Path(source.id).name
        manifest = _read_json(
            repo / "data" / "audio-provenance" / "readings" / level / f"{name}.json"
        )
        record = (repo / "content" / "reading-audio" / level / f"{name}.yaml").exists()
        audio = (repo / "content" / "reading-audio" / level / f"{name}.mp3").exists()
        approved_manifest = isinstance(manifest, dict) and isinstance(
            manifest.get("approval"), dict
        ) and manifest["approval"].get("status") == "complete"

        # The narration scene for this Lesetext is `reading_slug(source.id)` — the id with the
        # slash flattened, level and all — and **not** `Path(id).name`, which is what the
        # published file is named after. Getting that wrong is silent: the lookup simply never
        # matches, and every narration keeps reporting as unstarted.
        slug = reading_slug(source.id)
        project: dict[str, Any] | None = None
        source_drift = False
        if slug in scenes:
            scene_project, revision = scenes[slug]
            project = _scene_project(scene_project, revision, verdicts)
            # The narration scene says different words from the Lesetext the repository now
            # holds: the text was edited after the scene was created from it.
            source_drift = _narrated_paragraphs(revision) != source.paragraphs

        rows.append(
            {
                "kind": "reading",
                "id": source.id,
                "level": source.level,
                "topic": source.topic,
                "title": source.title_de,
                "reading_kind": source.kind,
                "word_count": source.word_count,
                "status": _status(
                    published=approved_manifest and record and audio,
                    manifest=manifest,
                    # A Lesetext is its own brief: the text exists, so nothing corresponds to the
                    # generation prompt a dialogue is drafted from.
                    brief=False,
                    project_stage=project["stage"] if project else None,
                    project_qa_passed=project["qa_passed"] if project else None,
                    published_revision=_published_revision(manifest) if project else None,
                    current_revision=project["revision_sha256"] if project else None,
                ),
                "artifact": record,
                "audio": audio,
                "has_provenance": manifest is not None,
                # A different disagreement from `stale`, and deliberately a separate field: this
                # says the *scene* narrates other words than the repository's Lesetext now holds,
                # whether or not anything was ever published.
                "source_drift": source_drift,
                "source_sha256": source.source_sha256,
                "project": project,
            }
        )
    return rows


def registry(store: Store, repo: Path) -> dict[str, Any]:
    """The whole join, as one document."""

    items = audio_exercise_items(repo)
    counts: dict[str, int] = {}
    for item in items:
        if item["recording"] is not None:
            counts[item["recording"]] = counts.get(item["recording"], 0) + 1
    # One query for the projects and one for the verdicts, shared by both halves.
    scenes = {project.slug: (project, revision) for project, revision in store.scene_rows()}
    verdicts = store.scene_qa_verdicts(PUBLISHED_VARIANT)
    listening = listening_rows(repo, counts, scenes, verdicts)
    readings = reading_rows(repo, scenes, verdicts)
    planned = {row["id"] for row in listening}
    rows = listening + readings
    return {
        "rows": rows,
        # A planned recording nothing asks a question about. Not a defect by itself — several
        # artifacts are `purpose: model-input` and exist to be listened to rather than tested on
        # — but it is the list an author needs when deciding what the next exercise wave is for.
        "recordings_without_exercises": [
            row["id"] for row in listening if row["exercise_items"] == 0
        ],
        # The other direction, and two failures under one name because the fix is the same: an
        # item that names no recording plays browser TTS, and an item that names one the plan
        # does not contain plays browser TTS *while looking linked*. `reason` keeps them apart.
        "exercises_without_recordings": [
            item | {"reason": "no-recording"}
            for item in items
            if item["recording"] is None
        ]
        + [
            item | {"reason": "unknown-recording"}
            for item in items
            if item["recording"] is not None and item["recording"] not in planned
        ],
        "summary": {
            "listening": len(listening),
            "readings": len(readings),
            "by_status": {
                status: sum(1 for row in rows if row["status"] == status)
                for status in sorted({str(row["status"]) for row in rows})
            },
            "audio_comprehension_items": len(items),
        },
    }


def router(store: Store, repo: Path) -> APIRouter:
    api = APIRouter(prefix="/api", tags=["registry"])

    @api.get("/registry")
    def read_registry() -> dict[str, Any]:
        return registry(store, repo)

    return api
