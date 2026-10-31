"""The character roster and the narration profiles cast from it.

`GET /api/characters` is the roster with how many scenes cast each character, its audition demos
and its portrait; `GET /api/narration-profiles` is the catalog the Lesetexte queue picks a
narration profile from.
"""

from __future__ import annotations

import hashlib
import json
from io import BytesIO
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, Response
from PIL import Image
from pydantic import BaseModel, Field

from ..catalogs import load_character_catalog, load_narration_catalog
from ..storage import Store


class PortraitSelectionRequest(BaseModel):
    candidate_id: str = Field(pattern=r"^[A-Z]$")
    editor: str = Field(min_length=1)
    reason: str = Field(min_length=8)


def _portrait_crop(source: Path, index: int) -> bytes:
    with Image.open(source) as sheet:
        cell_width = sheet.width // 4
        cell_height = sheet.height // 3
        column, row = index % 4, index // 4
        crop = sheet.crop(
            (
                column * cell_width,
                row * cell_height,
                (column + 1) * cell_width,
                (row + 1) * cell_height,
            )
        )
        output = BytesIO()
        crop.save(output, format="PNG")
    return output.getvalue()


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
        candidate_manifest = store.root / "characters" / "portrait-candidates.json"
        candidate_ids = [
            str(item["id"])
            for item in json.loads(candidate_manifest.read_text()).get("candidates", [])
        ] if candidate_manifest.exists() else []
        # `exclude_none`: a designed profile has no style, and an absent key is what Tonwerk's
        # character contract reads as "none"; a JSON null there would fail its parse.
        return {"version": catalog.version, "characters": [row.model_dump(mode="json", exclude_none=True) | {"usage_count": usage[row.id], "demo_urls": [f"/api/characters/{row.id}/demos/{index}" for index in range(3) if (store.root / "characters" / row.id / f"demo-{index + 1}.wav").exists()], "portrait_candidate_urls": [f"/api/characters/{row.id}/portrait-candidates/{candidate_id}" for candidate_id in candidate_ids], "selected_portrait_url": f"/api/characters/{row.id}/portrait" if (store.root / "characters" / row.id / "portrait.png").exists() else None} for row in catalog.characters]}

    @api.get("/characters/{character_id}/portrait")
    def selected_character_portrait(character_id: str) -> FileResponse:
        target = store.root / "characters" / character_id / "portrait.png"
        if not target.exists():
            raise HTTPException(404, "no portrait has been selected")
        return FileResponse(target, media_type="image/png")

    @api.get("/characters/{character_id}/portrait-candidates/{candidate_id}")
    def character_portrait_candidate(character_id: str, candidate_id: str) -> Response:
        catalog = load_character_catalog(repo)
        ids = [row.id for row in catalog.characters]
        if character_id not in ids:
            raise HTTPException(404, "character does not exist")
        manifest_path = store.root / "characters" / "portrait-candidates.json"
        if not manifest_path.exists():
            raise HTTPException(404, "portrait candidates have not been generated")
        manifest = json.loads(manifest_path.read_text())
        candidate = next(
            (row for row in manifest.get("candidates", []) if row.get("id") == candidate_id),
            None,
        )
        if candidate is None:
            raise HTTPException(404, "portrait candidate does not exist")
        source = Path(str(candidate["path"]))
        if not source.exists():
            raise HTTPException(404, "portrait candidate file is missing")
        return Response(_portrait_crop(source, ids.index(character_id)), media_type="image/png")

    @api.put("/characters/{character_id}/portrait-selection")
    def select_character_portrait(
        character_id: str, selection: PortraitSelectionRequest
    ) -> dict[str, Any]:
        catalog = load_character_catalog(repo)
        ids = [row.id for row in catalog.characters]
        if character_id not in ids:
            raise HTTPException(404, "character does not exist")
        manifest_path = store.root / "characters" / "portrait-candidates.json"
        if not manifest_path.exists():
            raise HTTPException(409, "portrait candidates have not been generated")
        manifest = json.loads(manifest_path.read_text())
        candidate = next(
            (
                row
                for row in manifest.get("candidates", [])
                if row.get("id") == selection.candidate_id
            ),
            None,
        )
        if candidate is None:
            raise HTTPException(409, "unknown portrait candidate")
        source = Path(str(candidate["path"]))
        if not source.exists():
            raise HTTPException(409, "portrait candidate file is missing")
        if hashlib.sha256(source.read_bytes()).hexdigest() != candidate["sha256"]:
            raise HTTPException(409, "portrait candidate bytes changed after generation")
        crop = _portrait_crop(source, ids.index(character_id))
        target = store.root / "characters" / character_id
        target.mkdir(parents=True, exist_ok=True)
        (target / "portrait.png").write_bytes(crop)
        record = {
            "character_id": character_id,
            "character_version": next(
                row.version for row in catalog.characters if row.id == character_id
            ),
            "candidate_id": selection.candidate_id,
            "candidate_count": len(manifest.get("candidates", [])),
            "selection_reason": selection.reason,
            "selected_by": selection.editor,
            "source_sha256": candidate["sha256"],
            "portrait_sha256": hashlib.sha256(crop).hexdigest(),
            "prompt_source": manifest["prompt_source"],
            "status": "selected-pending-catalog-publication",
        }
        (target / "portrait-selection.json").write_text(
            json.dumps(record, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
        )
        return record

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
