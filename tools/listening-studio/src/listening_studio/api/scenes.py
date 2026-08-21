"""Scene documents over HTTP: list, read, create, revise, validate.

The same four operations `atlas-listening scene` offers, with the same semantics, because the
desktop app and the CLI must not be able to disagree about what a scene project is. Everything
that *produces bytes* — render, QA, approval — lives in `workflow.py` next door; the split is
between editing the document and acting on it, which is also the split between a request that
returns in milliseconds and one that runs a model.

Two rules are inherited from `Store` and restated here because a caller has to know them:

* **A revision is immutable and a new one returns the project to `draft`.** New scene bytes mean
  the QA report and the approval attached to the previous revision describe audio nobody has any
  more, so they do not follow it forward.
* **A scene revision cannot change its slug.** The slug is the project's identity; renaming means
  a new project, and `PUT /api/scenes/{slug}` refuses a body that disagrees with its path.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..catalogs import load_character_catalog, load_narration_catalog
from ..domain import Stage
from ..reading_audio import default_profile_id, load_reading_sources
from ..scene.checks import catalog_warnings
from ..scene.convert import reading_scene
from ..scene.exercise import ExerciseAttachment
from ..scene.model import Scene
from ..storage import Store


class SceneDocument(BaseModel):
    """What `POST /api/scenes` and `PUT /api/scenes/{slug}` carry.

    The exercise is a sibling of the scene rather than a field inside it, exactly as the store
    holds it: a question edit must not change `scene_sha256`, because an approval vouches for
    audio and audio does not change when a distractor is rewritten.
    """

    scene: Scene
    exercise: ExerciseAttachment | None = None


class FromReadingRequest(BaseModel):
    """Which Lesetext to narrate, and optionally in whose voice.

    `profile` absent means *the profile this Lesetext is meant to have* — `default_profile_id`
    picks it from the reading's id, level and kind, exactly as `scene from-reading` does with no
    `--profile`. That is deliberately the server's answer and not the client's default: a picker
    holding its own copy of the rule keeps offering an old one the day the rule changes, and
    Tonwerk writes down no id the engine can derive.
    """

    reading_id: str
    profile: str | None = None


def render_availability(store: Store, scene: Scene) -> list[dict[str, Any]]:
    """Which of this scene's declared variants have a render of *these exact bytes*.

    Keyed by `scene.sha256()`, which is how `render_scene` lays the directory out — so a scene
    revised after rendering reports every variant unrendered rather than pointing the reviewer at
    audio of the previous text. That is the whole reason the render path carries the sha.

    `timing`, `timeline` and `artifacts` are read straight out of the manifest this function
    already opens. They are the render's **own measurement** of where everything landed — the
    only account of the mix that is not a plan — and without them a client can say a variant is
    rendered and nothing about what it sounds like. Absent before a render, and never invented:
    the authored `at_ms` is a request, not a time.
    """

    found: list[dict[str, Any]] = []
    for variant in scene.variants:
        directory = store.root / "renders" / scene.sha256() / variant.id
        manifest_path = directory / "render.json"
        row: dict[str, Any] = {
            "variant": variant.id,
            "preset": variant.preset,
            "rendered": manifest_path.exists(),
            "duration_ms": None,
            "created_at": None,
            "master_sha256": None,
            "has_master": (directory / "master.wav").exists(),
            "timing": [],
            "timeline": [],
            "artifacts": [],
        }
        if manifest_path.exists():
            manifest = json.loads(manifest_path.read_text())
            master = next(
                (
                    artifact
                    for artifact in manifest.get("artifacts", [])
                    if artifact.get("kind") == "master"
                ),
                None,
            )
            row.update(
                duration_ms=manifest.get("duration_ms"),
                created_at=manifest.get("created_at"),
                master_sha256=master["sha256"] if master else None,
                timing=manifest.get("timing", []),
                timeline=manifest.get("timeline", []),
                artifacts=manifest.get("artifacts", []),
            )
        found.append(row)
    return found


def scene_row(project: Any, revision: Any, scene: Scene, exercise: Any) -> dict[str, Any]:
    """One row of `GET /api/scenes`.

    A function rather than an inline dict because `POST /api/scenes/from-reading` answers the
    same shape: a client that has just created a scene should be able to put the answer straight
    into the list it is looking at, without a second request and without two shapes to keep equal.

    `qa_passed` is here because `automatically_checked` is the one stage that splits, and a list
    that cannot split it cannot be a review queue: "the machine measured this" is the same stage
    whether the verdict was yes or no, and the difference is between a take waiting for a human
    and a take waiting for a rewrite. `api/registry._project_status` makes the same split from the
    same field; this is the scene list's own copy of the answer, not a second rule.
    """

    return {
        "project_id": project.id,
        "slug": project.slug,
        "kind": project.kind,
        "stage": project.stage,
        "revision": revision.number,
        "scene_sha256": revision.scene_sha256,
        "has_exercise": exercise is not None,
        "qa_passed": (
            json.loads(revision.qa_json).get("passed") if revision.qa_json else None
        ),
        # The head revision's timestamp, not the project's: "when was this last edited" is a
        # property of the newest bytes, and `created_at` on the project answers a question nobody
        # in a list view is asking.
        "updated": revision.created_at,
        "title": scene.title.model_dump(mode="json"),
        "level": scene.brief.level if scene.brief else None,
    }


def router(store: Store, repo: Path) -> APIRouter:
    api = APIRouter(prefix="/api", tags=["scenes"])

    @api.get("/scenes")
    def scenes() -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        for project in store.scene_projects():
            _, revision, scene, exercise = store.get_scene(project.id)
            rows.append(scene_row(project, revision, scene, exercise))
        return rows

    @api.get("/scenes/{slug}")
    def scene_detail(slug: str) -> dict[str, Any]:
        found = store.get_scene_by_slug(slug)
        if found is None:
            raise HTTPException(404, f"no scene project {slug}")
        project, revision, scene, exercise = found
        return {
            "project_id": project.id,
            "slug": project.slug,
            "kind": project.kind,
            "stage": project.stage,
            "revision": revision.number,
            "scene_sha256": revision.scene_sha256,
            "scene": scene.model_dump(mode="json"),
            "exercise": exercise.model_dump(mode="json") if exercise else None,
            "qa": json.loads(revision.qa_json) if revision.qa_json else None,
            "approval": json.loads(revision.approval_json) if revision.approval_json else None,
            "renders": render_availability(store, scene),
            "history": store.scene_history(project.id),
        }

    @api.post("/scenes", status_code=201)
    def create_scene(document: SceneDocument) -> dict[str, Any]:
        try:
            project = store.create_scene(document.scene, document.exercise)
        except ValueError as error:
            # The one thing `create_scene` refuses: a slug that is already a project. That is a
            # conflict with existing state, not a malformed request.
            raise HTTPException(409, str(error)) from error
        return {
            "project_id": project.id,
            "slug": document.scene.slug,
            "kind": document.scene.kind,
            "stage": str(Stage.DRAFT),
            "revision": 1,
            "scene_sha256": document.scene.sha256(),
            "has_exercise": document.exercise is not None,
        }

    @api.post("/scenes/from-reading", status_code=201)
    def create_from_reading(request: FromReadingRequest) -> dict[str, Any]:
        """One Lesetext, converted and imported as a narration scene project.

        The same conversion `atlas-listening scene from-reading --import` runs, over HTTP, because
        the 85-text narration wave is a queue somebody works through in a browser and not 85 shell
        invocations. Nothing is written to `content/`: a conversion is a *reading* of published
        bytes, and what it produces is a draft in the studio database.

        Three refusals, and they are different things. A reading id this repository does not
        contain is **404** — nothing here can be made. A profile that does not exist, or one this
        reading's `kind` is not allowed to use, is **409**: the request names a real Lesetext and
        an impossible pairing. A slug that is already a scene project is **409** too, and it is the
        one that happens in practice — the queue's own row is stale, and the answer is to reload
        rather than to create a second project for one text.
        """

        source = next(
            (row for row in load_reading_sources(repo) if row.id == request.reading_id), None
        )
        if source is None:
            raise HTTPException(404, f"this repository holds no Lesetext {request.reading_id}")
        try:
            scene = reading_scene(
                source,
                load_narration_catalog(repo).profiles,
                load_character_catalog(repo).characters,
                request.profile or default_profile_id(source),
            )
        except KeyError as error:
            # `reading_scene` raises KeyError for an unknown profile or an unknown character, and
            # ValueError when the profile is real but forbidden for this reading's kind.
            raise HTTPException(409, str(error.args[0])) from error
        except ValueError as error:
            raise HTTPException(409, str(error)) from error
        try:
            project = store.create_scene(scene, None)
        except ValueError as error:
            raise HTTPException(409, str(error)) from error
        _, revision, stored, exercise = store.get_scene(project.id)
        return scene_row(project, revision, stored, exercise)

    @api.put("/scenes/{slug}")
    def revise_scene(slug: str, document: SceneDocument) -> dict[str, Any]:
        found = store.get_scene_by_slug(slug)
        if found is None:
            raise HTTPException(404, f"no scene project {slug}")
        project, _, _, _ = found
        if document.scene.slug != slug:
            raise HTTPException(
                409,
                f"this scene is {slug}; a revision cannot rename it to {document.scene.slug}",
            )
        revision = store.revise_scene(project.id, document.scene, document.exercise)
        return {
            "project_id": project.id,
            "slug": slug,
            "revision": revision.number,
            "scene_sha256": revision.scene_sha256,
            "has_exercise": document.exercise is not None,
            # Stated rather than implied: a caller that just revised an approved scene needs to
            # see that the approval and the QA report did not come with it.
            "stage": str(Stage.DRAFT),
        }

    @api.post("/scenes/{slug}/validate")
    def validate_scene(slug: str) -> dict[str, Any]:
        """Re-validate the stored bytes, and warn about acoustic ids this repo does not define.

        `errors` is normally empty — the bytes were validated on the way in — and becomes
        non-empty when the model has moved on under a scene stored by an older build, which is
        exactly the case a caller cannot otherwise discover. `warnings` is the useful half: a
        room, device or preset id that will refuse at render time is visible here in
        milliseconds instead of twenty minutes into a synthesis run.
        """

        found = store.get_scene_by_slug(slug)
        if found is None:
            raise HTTPException(404, f"no scene project {slug}")
        _, revision, _, _ = found
        try:
            scene = Scene.model_validate_json(revision.scene_json)
        except ValueError as error:
            return {
                "ok": False,
                "slug": slug,
                "sha256": revision.scene_sha256,
                "errors": str(error).splitlines(),
                "warnings": [],
            }
        return {
            "ok": True,
            "slug": scene.slug,
            "sha256": scene.sha256(),
            "errors": [],
            "warnings": catalog_warnings(scene, repo),
        }

    return api
