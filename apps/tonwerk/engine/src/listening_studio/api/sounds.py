"""The sound library: imported Freesound originals and generated assets, one list — and the one
way to add a row to the second half.

Two origins under one roof, and the split is the whole reason `origin` is on every row: an import
is somebody else's recording with a reviewed licence, and a generated sound is a prompt, a seed
and a model revision. `sources.py` keeps them in two schemas for that reason and this module never
merges them.

**Generating is not a second pipeline.** `POST /api/sounds/generate` runs the same `SoundGenNode`
a scene's `SoundSpec` resolves to at render time, through the same node cache and the same asset
store (`graph.render.generate_sound`). So a prompt auditioned here and the same prompt rendered
into a scene are one asset under one hash: the model is paid for once, the provenance sidecar is
written once, and the library shows one row rather than two.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from ..adapters import SOUND_ENGINES, sound_engine_for
from ..catalogs import (
    SourceEditorial,
    load_source_editorial,
    save_source_editorial,
    suggested_source_editorial,
)
from ..generative.gateway import SoundRequest
from ..generative.locks import set_models_root
from ..graph.render import generate_sound
from ..sources import (
    GeneratedSound,
    generated_sound,
    generated_sound_path,
    list_generated_sounds,
    list_sources,
    load_source,
)
from ..storage import Store
from .rows import peaks


class SoundGenerationRequest(BaseModel):
    """One sound to make, in the gateway's own engine-neutral vocabulary.

    The fields are `SoundSpec`'s, not a second spelling of them: what an author writes into a
    scene's timeline and what they audition in the library have to be the same request, or the
    take they approved by ear is not the take the render produces.

    `engine` is named rather than defaulted server-side. There is one real generator today and a
    fake one behind the test gate, and a request that did not say which it wanted would be a take
    whose origin depends on how the server was started.
    """

    prompt: str = Field(min_length=1)
    negative_prompt: str | None = None
    seed: int = Field(default=0, ge=0)
    duration_seconds: float = Field(gt=0)
    #: Engine parameters, opaque here exactly as they are in `SoundSpec`. The engine validates
    #: them and names its own vocabulary when it refuses.
    params: dict[str, Any] = Field(default_factory=dict)
    engine: Literal["stable_audio_sfx", "fake"] = "stable_audio_sfx"


def generated_row(root: Path, sound: GeneratedSound) -> dict[str, Any] | None:
    """One generated sound as the library renders it, or None when its audio cannot be proved.

    A sidecar whose audio is gone — or no longer hashes to its own name — is skipped rather than
    listed with an empty waveform: the row would offer a play button for bytes nobody can prove
    are the ones the provenance describes.
    """

    audio = generated_sound_path(root, sound.asset_sha256)
    if audio is None:
        return None
    return {"origin": "generated"} | sound.model_dump(mode="json") | {"peaks": peaks(audio)}


def router(store: Store, repo: Path, *, allow_test_adapters: bool = False) -> APIRouter:
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
            row = generated_row(store.root, generated)
            if row is not None:
                rows.append(row)
        return rows

    @api.post("/sounds/generate", status_code=201)
    def generate(request: SoundGenerationRequest) -> dict[str, Any]:
        """Make one sound, store it with its provenance, and answer with its library row.

        Three refusals, and each one is a different thing being absent:

        * **400** — the request is not one this engine can be asked. An unknown parameter, a
          length outside the model's window, a negative prompt at a guidance scale where it
          reaches nothing. These are authoring errors and are reachable without an install,
          deliberately (`stable_audio_mlx.resolve_params`).
        * **409, weights absent** — the engine exists and is not installed on this machine. The
          message carries the installer to run, because the alternative is a 500 with a
          `RuntimeError` in it on the one machine that cannot fix itself.
        * **409, fake engine** — the same gate `POST /scenes/{slug}/render` holds: a tone is not
          a sound, and a take generated from one must never be able to reach a learner.
        """

        if request.engine not in SOUND_ENGINES:
            raise HTTPException(
                400,
                f"unknown sound engine {request.engine}; "
                f"known: {', '.join(sorted(SOUND_ENGINES))}",
            )
        if request.engine == "fake" and not allow_test_adapters:
            raise HTTPException(409, "the fake sound engine renders a tone, not a sound")
        engine = sound_engine_for(request.engine)
        # The repository this server was started against is where `.models/` is looked for —
        # the same line `POST /scenes/{slug}/render` runs before it touches a generator.
        set_models_root(repo)
        sound_request = SoundRequest(
            prompt=request.prompt,
            negative_prompt=request.negative_prompt,
            seed=request.seed,
            duration_seconds=request.duration_seconds,
            params=request.params,
        )
        try:
            asset, cached = generate_sound(sound_request, engine, store.root)
        except ValueError as error:
            raise HTTPException(400, str(error)) from error
        except RuntimeError as error:
            raise HTTPException(409, str(error)) from error

        sound = generated_sound(store.root, asset)
        row = generated_row(store.root, sound) if sound is not None else None
        if row is None:
            # The engine reported success and the store cannot show what it made. Never seen,
            # and stated rather than returned as a half-row: a library entry nobody can play is
            # worse than an error, because it looks like a sound.
            raise HTTPException(
                500, f"the engine produced asset {asset} but the store cannot read it back"
            )
        # `cached` is the incremental story this endpoint shares with render: the same prompt at
        # the same seed on the same engine costs nothing the second time.
        return row | {"cached": cached}

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
