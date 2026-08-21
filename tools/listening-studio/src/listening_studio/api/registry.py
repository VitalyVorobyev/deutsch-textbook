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
* the studio database — what is being worked on, dialogue projects and scene projects alike.
  Alone: nothing about what was planned or what shipped.
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

from ..reading_audio import load_reading_sources
from ..scene.convert import reading_slug
from ..storage import Store

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


def _published_revision(manifest: dict[str, Any] | None, project_kind: str | None) -> str | None:
    """The revision sha the published provenance was written from, when it is comparable.

    Comparable is the whole point of this function. A dialogue project's revision sha is
    `RevisionPayload.sha256()` and a scene project's is `Scene.sha256()`; they are hashes of
    different documents and will never be equal, so comparing a scene's sha against a manifest
    written by the dialogue publisher would report every converted artifact `stale` on the day it
    was converted — a hundred percent false-positive rate for a signal whose only value is that
    it is rare. So: a `scene_sha256` in the manifest (which the regeneration PR will write) is
    compared against a scene project, `revision_sha256` against a dialogue project, and a scene
    project beside a pre-scene manifest is not compared at all.
    """

    if manifest is None:
        return None
    if project_kind == "scene":
        scene_sha = manifest.get("scene_sha256")
        return str(scene_sha) if isinstance(scene_sha, str) else None
    revision = manifest.get("revision_sha256")
    return str(revision) if isinstance(revision, str) else None


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


def listening_rows(store: Store, repo: Path, exercise_counts: dict[str, int]) -> list[dict[str, Any]]:
    plan = yaml.safe_load((repo / "data" / "listening-plan.yaml").read_text())
    dialogues = {project.slug: project for project in store.projects()}
    scenes = {project.slug: project for project in store.scene_projects()}
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

            # A scene project with the same slug supersedes the legacy dialogue project: the
            # scene is the artifact model everything is converging on, and while both exist the
            # scene is the one being edited. The dialogue project is still reported, so nothing
            # disappears from view the moment it is converted.
            project: dict[str, Any] | None = None
            if slug in scenes:
                scene_project = scenes[slug]
                _, revision, _, exercise = store.get_scene(scene_project.id)
                project = {
                    "kind": "scene",
                    "id": scene_project.id,
                    "stage": scene_project.stage,
                    "revision": revision.number,
                    "revision_sha256": revision.scene_sha256,
                    "qa_passed": (
                        json.loads(revision.qa_json).get("passed") if revision.qa_json else None
                    ),
                    "has_exercise": exercise is not None,
                    "updated": revision.created_at,
                }
            elif slug in dialogues:
                dialogue = dialogues[slug]
                _, dialogue_revision, _ = store.get(dialogue.id)
                project = {
                    "kind": "dialogue",
                    "id": dialogue.id,
                    "stage": dialogue.stage,
                    "revision": dialogue_revision.number,
                    "revision_sha256": dialogue_revision.payload_sha256,
                    "qa_passed": (
                        json.loads(dialogue_revision.qa_json).get("passed")
                        if dialogue_revision.qa_json
                        else None
                    ),
                    "updated": dialogue_revision.created_at,
                }

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
                        published_revision=_published_revision(
                            manifest, project["kind"] if project else None
                        ),
                        current_revision=project["revision_sha256"] if project else None,
                    ),
                    "artifact": record,
                    "audio": audio,
                    "has_provenance": manifest is not None,
                    "superseded_by_scene": slug in scenes and slug in dialogues,
                    "project": project,
                    "exercise_items": exercise_counts.get(slug, 0),
                }
            )
    return rows


def reading_rows(store: Store, repo: Path) -> list[dict[str, Any]]:
    projects = {project.reading_id: project for project in store.reading_projects()}
    scenes = {project.slug: project for project in store.scene_projects()}
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

        project: dict[str, Any] | None = None
        source_drift = False
        current_revision: str | None = None
        published_revision: str | None = None
        # A narration scene converted from this Lesetext supersedes the reading project for the
        # same reason a dialogue scene does. Its slug is `reading_slug(source.id)` — the id with
        # the slash flattened, level and all — and **not** `Path(id).name`, which is what the
        # published file is named after. Getting that wrong is silent: the lookup simply never
        # matches, and every converted narration keeps reporting as an unconverted reading.
        slug = reading_slug(source.id)
        if slug in scenes:
            scene_project = scenes[slug]
            _, revision, _, _ = store.get_scene(scene_project.id)
            project = {
                "kind": "scene",
                "id": scene_project.id,
                "stage": scene_project.stage,
                "revision": revision.number,
                "revision_sha256": revision.scene_sha256,
                "qa_passed": (
                    json.loads(revision.qa_json).get("passed") if revision.qa_json else None
                ),
                "updated": revision.created_at,
            }
            published_revision = _published_revision(manifest, "scene")
            current_revision = revision.scene_sha256
        elif source.id in projects:
            reading_project = projects[source.id]
            _, reading_revision, payload = store.get_reading(reading_project.id)
            project = {
                "kind": "reading",
                "id": reading_project.id,
                "stage": reading_project.stage,
                "revision": reading_revision.number,
                "revision_sha256": reading_revision.payload_sha256,
                "qa_passed": (
                    json.loads(reading_revision.qa_json).get("passed")
                    if reading_revision.qa_json
                    else None
                ),
                "updated": reading_revision.created_at,
            }
            source_drift = payload.source_sha256 != source.source_sha256
            # A reading's published provenance records the *Lesetext* it narrated rather than a
            # payload hash, so that is what "the revision this was published from" means here.
            published_revision = (
                str(manifest.get("source_sha256"))
                if manifest and isinstance(manifest.get("source_sha256"), str)
                else None
            )
            current_revision = payload.source_sha256

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
                    published_revision=published_revision,
                    current_revision=current_revision,
                ),
                "artifact": record,
                "audio": audio,
                "has_provenance": manifest is not None,
                # A different disagreement from `stale`, and deliberately a separate field: this
                # says the *project* narrates an older Lesetext than the repository now holds,
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
    listening = listening_rows(store, repo, counts)
    readings = reading_rows(store, repo)
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
