"""The JSON API, one module per concern, all under `/api`.

The split is by *what a caller is doing* rather than by what the data is: reading the corpus
overview (`registry`), editing a scene document (`scenes`), acting on one (`workflow`), what the
studio holds on disk (`library`), and the libraries a scene draws on — characters and narration
profiles (`characters`), consented voices (`voices`), acoustic profiles (`acoustics`) and sounds
(`sounds`).

This is the **whole** surface: there are no server-rendered forms beside it, and Tonwerk reads
nothing else.
"""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter

from ..storage import Store
from . import (
    acoustics,
    characters,
    library,
    registry,
    scenes,
    sounds,
    voices,
    workflow,
)
from .workflow import Transcriber

__all__ = ["Transcriber", "router"]


def router(
    store: Store,
    repo: Path,
    *,
    allow_test_adapters: bool = False,
    transcribe_fn: Transcriber | None = None,
) -> APIRouter:
    """Every `/api` route, as one router the app factory includes once."""

    api = APIRouter()
    api.include_router(registry.router(store, repo))
    api.include_router(library.router(store, repo))
    api.include_router(scenes.router(store, repo))
    api.include_router(
        workflow.router(
            store, repo, allow_test_adapters=allow_test_adapters, transcribe_fn=transcribe_fn
        )
    )
    api.include_router(characters.router(store, repo))
    api.include_router(
        voices.router(
            store, repo, allow_test_adapters=allow_test_adapters, transcribe_fn=transcribe_fn
        )
    )
    api.include_router(acoustics.router(store, repo))
    api.include_router(
        sounds.router(store, repo, allow_test_adapters=allow_test_adapters)
    )
    return api
