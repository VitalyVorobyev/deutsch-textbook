"""The sound library: imported Freesound originals and generated assets, one list.

Unchanged from `studio_api.py`; the React dashboard reads both paths.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from ..catalogs import (
    SourceEditorial,
    load_source_editorial,
    save_source_editorial,
    suggested_source_editorial,
)
from ..sources import generated_sound_path, list_generated_sounds, list_sources, load_source
from ..storage import Store
from .rows import peaks


def router(store: Store, repo: Path) -> APIRouter:
    api = APIRouter(prefix="/api", tags=["sounds"])

    @api.get("/sounds")
    def sounds() -> list[dict[str, Any]]:
        """The whole sound library, imported and generated, each row saying which it is.

        `origin` is on every row and is what a caller filters on. The soundscape picker still
        wants Freesound rows only — a `ContextSound` names an imported `sound_id` and the
        soundscape endpoint refuses anything else — so the field is not decoration: it is how a
        second origin joins the list without the picker offering a sound it cannot place.
        """

        usage: dict[str, int] = {}
        for project in store.projects():
            _, _, payload = store.get(project.id)
            for sound in payload.context_sounds:
                usage[sound.source_sha256] = usage.get(sound.source_sha256, 0) + 1
        rows = []
        for source in list_sources(store.root):
            _, path = load_source(store.root, source.original_sha256)
            editorial_file = store.root / "sources" / source.original_sha256 / "editorial.json"
            editorial = (
                load_source_editorial(store.root, source.original_sha256)
                if editorial_file.exists()
                else suggested_source_editorial(source.title, source.description)
            )
            rows.append({"origin": "freesound"} | source.model_dump(mode="json") | {"editorial": editorial.model_dump(mode="json"), "usage_count": usage.get(source.original_sha256, 0), "peaks": peaks(path)})
        for generated in list_generated_sounds(store.root):
            audio = generated_sound_path(store.root, generated.asset_sha256)
            if audio is None:
                # A sidecar whose audio is gone or no longer hashes to its name. Skipped rather
                # than listed with an empty waveform: the row would offer a play button for
                # bytes nobody can prove are the ones the provenance describes.
                continue
            rows.append(
                {"origin": "generated"}
                | generated.model_dump(mode="json")
                | {"peaks": peaks(audio)}
            )
        return rows

    @api.put("/sounds/{source_hash}/editorial")
    def update_sound(source_hash: str, metadata: SourceEditorial) -> dict[str, Any]:
        try:
            load_source(store.root, source_hash)
        except ValueError as error:
            raise HTTPException(404, str(error)) from error
        save_source_editorial(store.root, source_hash, metadata)
        return metadata.model_dump(mode="json")

    @api.get("/sounds/{source_hash}/audio")
    def source_audio(source_hash: str) -> FileResponse:
        """Audition one library row, whichever origin it came from.

        The import is tried first because that is the older meaning of this path and the only
        one a stored `ContextSound` ever refers to; a generated asset is looked up by the same
        digest in the asset store. Both lookups verify the bytes against the hash before serving.
        """

        try:
            _, path = load_source(store.root, source_hash)
        except ValueError as error:
            generated = generated_sound_path(store.root, source_hash)
            if generated is None:
                raise HTTPException(404, str(error)) from error
            return FileResponse(generated)
        return FileResponse(path)

    return api
