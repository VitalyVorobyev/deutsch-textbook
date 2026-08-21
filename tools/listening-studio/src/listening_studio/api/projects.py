"""The legacy dialogue/reading project endpoints, unchanged.

These serve the React dashboard and are frozen in shape until it is retired: every path, every
query parameter and every response key is exactly what `studio_api.py` published before the
split. Nothing new is built on them — a scene is edited through `api/scenes.py`.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from ..catalogs import (
    load_character_catalog,
    load_narration_catalog,
    load_source_editorial,
    suggested_source_editorial,
)
from ..domain import CastAssignment, ContextSound, RevisionPayload, VoiceProfile
from ..sources import load_source
from ..storage import Store
from .rows import dialogue_rows, reading_rows


def router(store: Store, repo: Path) -> APIRouter:
    api = APIRouter(prefix="/api", tags=["projects"])

    @api.get("/projects")
    def projects() -> list[dict[str, Any]]:
        return dialogue_rows(store, repo) + reading_rows(store, repo)

    @api.get("/projects/{project_id}")
    def project(project_id: int, kind: str = "dialogue") -> dict[str, Any]:
        try:
            if kind == "reading":
                state = store.reading_state(project_id)
                previews = store.root / "readings" / str(project_id) / "previews"
                return state.model_dump(mode="json") | {
                    "kind": "reading",
                    "history": store.reading_history(project_id),
                    "narration_profiles": [
                        profile.model_dump(mode="json")
                        for profile in load_narration_catalog(repo).profiles
                    ],
                    "preview_urls": {
                        profile.id: f"/api/readings/{project_id}/previews/{profile.id}/audio"
                        for profile in load_narration_catalog(repo).profiles
                        if (previews / f"{profile.id}.wav").exists()
                    },
                }
            current, revision, payload = store.get(project_id)
        except KeyError:
            raise HTTPException(404) from None
        return {
            "kind": "dialogue",
            "id": current.id,
            "slug": current.slug,
            "stage": current.stage,
            "revision": revision.number,
            "payload": payload.model_dump(mode="json"),
            "qa": json.loads(revision.qa_json) if revision.qa_json else None,
            "approval": json.loads(revision.approval_json) if revision.approval_json else None,
            "history": store.revision_history(project_id),
        }

    @api.put("/projects/{project_id}/cast")
    def update_cast(
        project_id: int, assignments: list[CastAssignment], revision_number: int
    ) -> dict[str, Any]:
        try:
            _, current_revision, payload = store.get(project_id)
        except KeyError:
            raise HTTPException(404) from None
        if current_revision.number != revision_number:
            raise HTTPException(409, "project revision changed; reload before editing cast")
        if [row.speaker for row in assignments] != payload.speakers:
            raise HTTPException(409, "cast must cover every speaker in order")
        catalog = load_character_catalog(repo)
        by_id = {row.id: row for row in catalog.characters}
        try:
            selected = [by_id[row.character_id] for row in assignments]
        except KeyError as error:
            raise HTTPException(409, f"unknown character {error.args[0]}") from error
        for assignment, character in zip(assignments, selected, strict=True):
            if assignment.character_version != character.version or character.status == "retired":
                raise HTTPException(409, f"character {character.id} version is unavailable")
        ids = {row.id for row in selected}
        for character in selected:
            if ids.intersection(character.incompatible_with):
                raise HTTPException(409, f"character {character.id} has an incompatible co-cast")
        profiles = [
            VoiceProfile(
                speaker=assignment.speaker,
                voice=character.voice_profile.voice,
                seed=character.voice_profile.seed,
                style=character.voice_profile.style,
            )
            for assignment, character in zip(assignments, selected, strict=True)
        ]
        updated = RevisionPayload.model_validate(
            payload.model_dump(mode="json")
            | {
                "cast": [row.model_dump(mode="json") for row in assignments],
                "voice_profiles": [row.model_dump(mode="json") for row in profiles],
            }
        )
        revision = store.revise(project_id, updated)
        return {"project_id": project_id, "revision": revision.number, "stage": "draft"}

    @api.put("/projects/{project_id}/soundscape")
    def update_soundscape(
        project_id: int, sounds: list[ContextSound], revision_number: int
    ) -> dict[str, Any]:
        try:
            _, current_revision, payload = store.get(project_id)
        except KeyError:
            raise HTTPException(404) from None
        if current_revision.number != revision_number:
            raise HTTPException(409, "project revision changed; reload before editing soundscape")
        for sound in sounds:
            try:
                source, _ = load_source(store.root, sound.source_sha256)
            except ValueError as error:
                raise HTTPException(409, str(error)) from error
            if source.sound_id != sound.sound_id:
                raise HTTPException(409, "sound id does not match the imported source hash")
            editorial_file = store.root / "sources" / sound.source_sha256 / "editorial.json"
            editorial = (
                load_source_editorial(store.root, sound.source_sha256)
                if editorial_file.exists()
                else suggested_source_editorial(source.title, source.description)
            )
            if sound.role not in editorial.allowed_roles:
                raise HTTPException(409, f"{sound.role} is not allowed for {source.title}")
        updated = RevisionPayload.model_validate(
            payload.model_dump(mode="json")
            | {"context_sounds": [row.model_dump(mode="json") for row in sounds]}
        )
        revision = store.revise(project_id, updated)
        return {"project_id": project_id, "revision": revision.number, "stage": "draft"}

    @api.get("/projects/{project_id}/lines/{line_id}/audio")
    def line_audio(project_id: int, line_id: str) -> FileResponse:
        try:
            _, _, payload = store.get(project_id)
        except KeyError:
            raise HTTPException(404) from None
        line = next((row for row in payload.lines if row.id == line_id), None)
        if line is None:
            raise HTTPException(404, "line does not exist")
        cache = store.root / "projects" / str(project_id) / "cache"
        # Cache names are content hashes. Resolve the current line exactly when possible and
        # otherwise refuse rather than serve a different character's take.
        from ..adapters import engine_revision

        revision = engine_revision(payload.tts_adapter)
        expected = cache / f"{payload.cache_key(line, revision)}.wav"
        if not expected.exists():
            raise HTTPException(404, "line audio has not been generated for this revision")
        return FileResponse(expected, media_type="audio/wav")

    return api
