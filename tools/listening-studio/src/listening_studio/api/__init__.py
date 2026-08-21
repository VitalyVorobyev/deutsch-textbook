"""The JSON API, one module per concern, all under `/api`.

This package replaced a single 724-line `studio_api.py`. The split is by *what a caller is doing*
rather than by what the data is: reading the corpus overview (`dashboard`, `registry`), editing a
scene document (`scenes`), acting on one (`workflow`), and the legacy dialogue/reading endpoints
the React dashboard still reads (`projects`, `characters`, `sounds`, `readings`).

**Registration order is load-bearing.** FastAPI matches routes in the order they are included,
and `readings.py` ends with `/api/readings/{reading_id:path}/seed` — a greedy converter, because
a reading id contains a slash. Anything registered after it that lives under `/api/readings/`
would be shadowed. Scenes and the registry are registered before it for that reason, and the
readings router is last.

Everything here is additive to the legacy HTML surface in `web.py` and `ui.py`, which keeps
working untouched until the desktop app reaches parity.
"""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter

from ..storage import Store
from . import (
    acoustics,
    characters,
    dashboard,
    projects,
    readings,
    registry,
    scenes,
    sounds,
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
    api.include_router(dashboard.router(store, repo))
    api.include_router(registry.router(store, repo))
    api.include_router(scenes.router(store, repo))
    api.include_router(
        workflow.router(
            store, repo, allow_test_adapters=allow_test_adapters, transcribe_fn=transcribe_fn
        )
    )
    api.include_router(characters.router(store, repo))
    api.include_router(acoustics.router(store, repo))
    api.include_router(
        sounds.router(store, repo, allow_test_adapters=allow_test_adapters)
    )
    api.include_router(projects.router(store, repo))
    # Last: its final route is a greedy `:path` under `/api/readings/`.
    api.include_router(readings.router(store, repo))
    return api
