"""Lesetext narration projects: seeding, profile choice, previews and audio.

Unchanged from `studio_api.py`, **including the order the routes are declared in**. The seed
route is `/api/readings/{reading_id:path}/seed` because a reading id is `a1/lena-erster-tag`,
with a slash in it; a `:path` converter matches greedily, so every fixed-shape reading route has
to be registered before it or `/api/readings/3/audio` would be read as a reading called `3`.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from ..catalogs import load_character_catalog, load_narration_catalog
from ..reading_audio import (
    ReadingParagraph,
    ReadingRevisionPayload,
    default_profile_id,
    load_reading_sources,
)
from ..storage import Store
from .rows import reading_rows


def router(store: Store, repo: Path) -> APIRouter:
    api = APIRouter(prefix="/api", tags=["readings"])

    @api.get("/narration-profiles")
    def narration_profiles() -> dict[str, Any]:
        return load_narration_catalog(repo).model_dump(mode="json")

    @api.get("/readings")
    def readings() -> list[dict[str, Any]]:
        return reading_rows(store, repo)

    @api.put("/readings/{project_id}/profile")
    def update_reading_profile(
        project_id: int, profile_id: str, revision_number: int
    ) -> dict[str, Any]:
        try:
            _, current_revision, payload = store.get_reading(project_id)
        except KeyError:
            raise HTTPException(404) from None
        if current_revision.number != revision_number:
            raise HTTPException(409, "reading revision changed; reload before selecting a profile")
        profile = next(
            (row for row in load_narration_catalog(repo).profiles if row.id == profile_id),
            None,
        )
        if profile is None or payload.kind not in profile.allowed_kinds:
            raise HTTPException(409, "profile is not valid for this reading kind")
        character = next(
            row
            for row in load_character_catalog(repo).characters
            if row.id == profile.character_id
        )
        updated = ReadingRevisionPayload.model_validate(
            payload.model_dump(mode="json")
            | {
                "narration_profile_id": profile.id,
                "narration_profile_version": profile.version,
                "character_id": character.id,
                "character_version": character.version,
                "voice": character.voice_profile.voice,
                "seed": character.voice_profile.seed,
                "style": f"{character.voice_profile.style} {profile.instruction}",
                "pace": profile.pace_by_level[payload.level],
                "paragraph_pause_ms": profile.paragraph_pause_ms,
                "cues": [],
            }
        )
        revision = store.revise_reading(project_id, updated)
        return {"project_id": project_id, "revision": revision.number, "stage": "draft"}

    @api.get("/readings/{project_id}/audio")
    def reading_audio(project_id: int) -> FileResponse:
        try:
            store.get_reading(project_id)
        except KeyError:
            raise HTTPException(404) from None
        target = store.root / "readings" / str(project_id) / "final.wav"
        if not target.exists():
            raise HTTPException(404, "reading audio has not been generated")
        return FileResponse(target, media_type="audio/wav")

    @api.post("/readings/{project_id}/previews")
    def generate_reading_previews(project_id: int, revision_number: int) -> dict[str, str]:
        try:
            _, current_revision, current = store.get_reading(project_id)
        except KeyError:
            raise HTTPException(404) from None
        if current_revision.number != revision_number:
            raise HTTPException(409, "reading revision changed; reload before generating previews")
        from ..adapters import render_line
        from ..generative.qwen import QwenSpeech
        from ..reading_pipeline import paragraph_line

        profiles = load_narration_catalog(repo)
        characters = {row.id: row for row in load_character_catalog(repo).characters}
        source = next(row for row in load_reading_sources(repo) if row.id == current.reading_id)
        # The paragraph closest to median length is stable, substantial and not simply the lead.
        ordered = sorted(source.paragraphs, key=len)
        representative = source.paragraphs.index(ordered[len(ordered) // 2])
        engine = QwenSpeech()
        target = store.root / "readings" / str(project_id) / "previews"
        target.mkdir(parents=True, exist_ok=True)
        result: dict[str, str] = {}
        for profile in profiles.profiles:
            character = characters[profile.character_id]
            preview = ReadingRevisionPayload.model_validate(
                current.model_dump(mode="json")
                | {
                    "narration_profile_id": profile.id,
                    "narration_profile_version": profile.version,
                    "character_id": character.id,
                    "character_version": character.version,
                    "voice": character.voice_profile.voice,
                    "seed": character.voice_profile.seed,
                    "style": f"{character.voice_profile.style} {profile.instruction}",
                    "pace": profile.pace_by_level[source.level],
                    "paragraph_pause_ms": profile.paragraph_pause_ms,
                    "cues": [],
                }
            )
            path = target / f"{profile.id}.wav"
            render_line(engine, paragraph_line(preview, representative), path)
            result[profile.id] = f"/api/readings/{project_id}/previews/{profile.id}/audio"
        return result

    @api.get("/readings/{project_id}/previews/{profile_id}/audio")
    def reading_preview_audio(project_id: int, profile_id: str) -> FileResponse:
        target = store.root / "readings" / str(project_id) / "previews" / f"{profile_id}.wav"
        if not target.exists():
            raise HTTPException(404, "profile preview has not been generated")
        return FileResponse(target, media_type="audio/wav")

    @api.get("/readings/{project_id}/paragraphs/{paragraph_index}/audio")
    def reading_paragraph_audio(project_id: int, paragraph_index: int) -> FileResponse:
        try:
            _, _, payload = store.get_reading(project_id)
        except KeyError:
            raise HTTPException(404) from None
        if paragraph_index < 0 or paragraph_index >= len(payload.paragraphs):
            raise HTTPException(404, "paragraph does not exist")
        from ..generative.qwen import QwenSpeech

        paragraph = payload.paragraphs[paragraph_index]
        target = store.root / "readings" / str(project_id) / "cache" / f"{payload.paragraph_cache_key(paragraph, QwenSpeech.revision)}.wav"
        if not target.exists():
            raise HTTPException(404, "paragraph audio has not been generated")
        return FileResponse(target, media_type="audio/wav")

    @api.post("/readings/{reading_id:path}/seed")
    def seed_reading(reading_id: str, profile_id: str | None = None) -> dict[str, Any]:
        source = next((row for row in load_reading_sources(repo) if row.id == reading_id), None)
        if source is None:
            raise HTTPException(404, "reading does not exist")
        if store.get_reading_by_source(reading_id):
            raise HTTPException(409, "reading project already exists")
        profiles = load_narration_catalog(repo)
        selected_id = profile_id or default_profile_id(source)
        profile = next((row for row in profiles.profiles if row.id == selected_id), None)
        if profile is None or source.kind not in profile.allowed_kinds:
            raise HTTPException(409, "narration profile is not valid for this reading")
        characters = load_character_catalog(repo)
        character = next(row for row in characters.characters if row.id == profile.character_id)
        payload = ReadingRevisionPayload(
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
        project = store.create_reading(payload)
        return {"project_id": project.id, "reading_id": reading_id, "stage": project.stage}

    return api
