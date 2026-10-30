"""`/api/library` — what the studio holds on disk, and the render reaper (`library.py`)."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..library import DEFAULT_KEEP, disk_usage, reap_renders
from ..storage import Store


class ReapRequest(BaseModel):
    keep: int = Field(default=DEFAULT_KEEP, ge=1, le=20)


def router(store: Store, repo: Path) -> APIRouter:
    api = APIRouter(prefix="/api/library", tags=["library"])

    @api.get("/disk")
    def disk(keep: int = DEFAULT_KEEP) -> dict[str, Any]:
        return disk_usage(store, repo, max(1, keep))

    @api.post("/reap")
    def reap(request: ReapRequest) -> dict[str, Any]:
        return reap_renders(store, repo, request.keep)

    return api
