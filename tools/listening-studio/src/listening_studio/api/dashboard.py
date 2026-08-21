"""`GET /api/dashboard` — everything the React overview renders in one document.

One request, not four: the overview shows dialogues, readings, the ranked issue list and a
summary at once, and four round trips would each recompute the same two project tables.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import APIRouter

from ..catalogs import load_character_catalog
from ..sources import list_sources
from ..storage import Store
from .rows import dialogue_rows, issues, reading_rows


def router(store: Store, repo: Path) -> APIRouter:
    api = APIRouter(prefix="/api", tags=["dashboard"])

    @api.get("/dashboard")
    def dashboard() -> dict[str, Any]:
        dialogues = dialogue_rows(store, repo)
        readings = reading_rows(store, repo)
        return {
            "dialogues": dialogues,
            "readings": readings,
            "issues": issues(dialogues, readings),
            "summary": {
                "dialogues": len(dialogues),
                "dialogues_approved": sum(row["approved"] for row in dialogues),
                "readings": len(readings),
                "readings_approved": sum(row["approved"] for row in readings),
                "paragraphs": sum(row["paragraph_count"] for row in readings),
                "characters": len(load_character_catalog(repo).characters),
                "sounds": len(list_sources(store.root)),
            },
        }

    return api
