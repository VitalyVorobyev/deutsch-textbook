"""The character roster and the narration profiles cast from it.

`GET /api/characters` is the roster with how many scenes cast each character, its audition demos,
its portrait and further images, and the cast member a voice speaks when that is someone else;
`GET /api/narration-profiles` is the catalog the Lesetexte queue picks a narration profile from.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import yaml
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from ..catalogs import CharacterDefinition, load_character_catalog, load_narration_catalog
from ..storage import Store


_IMAGE_NAME = re.compile(r"^[a-z0-9-]+$")


def _images(repo: Path, folder_id: str) -> dict[str, Any]:
    """The portrait and further images of one person, as `bun run characters:import` wrote them.

    They live in the repository, `public/characters/<id>/<id>.webp` and `<id>-<n>.webp`, because
    the learner app serves the same files; the studio only reads them. Scenes come in number order.
    """
    folder = repo / "public" / "characters" / folder_id
    if not folder.is_dir():
        return {"portrait_url": None, "scene_urls": []}
    numbered = sorted(
        (int(path.stem[len(folder_id) + 1 :]), path.stem)
        for path in folder.glob(f"{folder_id}-*.webp")
        if path.stem[len(folder_id) + 1 :].isdigit()
    )
    base = f"/api/characters/{folder_id}/images"
    return {
        "portrait_url": f"{base}/{folder_id}" if (folder / f"{folder_id}.webp").exists() else None,
        "scene_urls": [f"{base}/{stem}" for _, stem in numbered],
    }


def _cast_by_voice(repo: Path) -> dict[str, dict[str, Any]]:
    """The cast member each roster voice speaks, where it is someone else's name (Timo for `jonas`).

    Read off the records rather than validated: the learner app's validator owns their shape, and a
    record this build cannot read must not hide the roster.
    """
    people: dict[str, dict[str, Any]] = {}
    for path in sorted((repo / "content" / "characters").glob("*.yaml")):
        record = yaml.safe_load(path.read_text()) or {}
        voice, person, name = record.get("voice"), record.get("id"), record.get("name")
        if isinstance(voice, str) and isinstance(person, str) and isinstance(name, str):
            if person != voice:
                people[voice] = {"id": person, "name": name}
    return people


def router(store: Store, repo: Path) -> APIRouter:
    api = APIRouter(prefix="/api", tags=["characters"])

    @api.get("/narration-profiles")
    def narration_profiles() -> dict[str, Any]:
        return load_narration_catalog(repo).model_dump(mode="json")

    @api.get("/characters")
    def characters() -> dict[str, Any]:
        catalog = load_character_catalog(repo)
        usage: dict[str, int] = {row.id: 0 for row in catalog.characters}
        # Read off the stored documents rather than validated: a usage count needs one field per
        # cast member, and one document a newer build wrote must not fail the whole roster.
        for _, revision in store.scene_rows():
            document = json.loads(revision.scene_json)
            cast = {
                member["character"]["id"]
                for member in document.get("cast") or []
                if isinstance(member, dict) and isinstance(member.get("character"), dict)
            }
            for character_id in cast & usage.keys():
                usage[character_id] += 1
        voiced = _cast_by_voice(repo)

        def row_of(row: CharacterDefinition) -> dict[str, Any]:
            person = voiced.get(row.id)
            return (
                # `exclude_none`: a designed profile has no style, and an absent key is what
                # Tonwerk's character contract reads as "none"; a JSON null there would fail it.
                row.model_dump(mode="json", exclude_none=True)
                | {
                    "usage_count": usage[row.id],
                    "demo_urls": [
                        f"/api/characters/{row.id}/demos/{index}"
                        for index in range(3)
                        if (store.root / "characters" / row.id / f"demo-{index + 1}.wav").exists()
                    ],
                }
                | _images(repo, row.id)
                | ({"cast": person | _images(repo, person["id"])} if person else {})
            )

        return {
            "version": catalog.version,
            "characters": [row_of(row) for row in catalog.characters],
        }

    @api.get("/characters/{folder_id}/images/{name}")
    def character_image(folder_id: str, name: str) -> FileResponse:
        if not _IMAGE_NAME.match(folder_id) or not _IMAGE_NAME.match(name):
            raise HTTPException(404, "image does not exist")
        target = repo / "public" / "characters" / folder_id / f"{name}.webp"
        if not target.is_file():
            raise HTTPException(404, "image does not exist")
        return FileResponse(target, media_type="image/webp")

    @api.get("/characters/{character_id}/demos/{demo_index}")
    def character_demo(character_id: str, demo_index: int) -> FileResponse:
        if demo_index not in range(3):
            raise HTTPException(404, "demo does not exist")
        catalog = load_character_catalog(repo)
        if character_id not in {row.id for row in catalog.characters}:
            raise HTTPException(404, "character does not exist")
        target = store.root / "characters" / character_id / f"demo-{demo_index + 1}.wav"
        if not target.exists():
            raise HTTPException(404, "demo has not been generated")
        return FileResponse(target, media_type="audio/wav")

    return api
