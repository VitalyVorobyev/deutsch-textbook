"""What the studio keeps on disk, and the reaper for the part of it that can be made again.

Four trees live beside the database. `assets/` holds every synthesised line and imported sound,
content-addressed and shared by every render that uses them; `cache/` holds graph nodes. Both are
what makes a re-render cheap, so neither is reaped here. `renders/<scene sha>/<variant>/` holds the
mixed masters, about 30 MB per scene, one tree for every revision ever rendered — that is the tree
that grows with editing, and the one a reaper may shrink. `replaced/` holds the published bytes a
republish backed up, and is never touched.

A render tree is **kept** when its scene sha is one of a project's newest `keep` revisions, a
revision with a completed approval, or the revision a provenance manifest in the course repository
says it published. Everything else — older revisions, and trees no revision hashes to any more —
can be rendered again from its revision, so removing it loses time and never a take.
"""

from __future__ import annotations

import json
import shutil
from dataclasses import dataclass
from pathlib import Path

from .storage import Store

#: Revisions per project whose renders stay: the head, and the take before it to compare against.
DEFAULT_KEEP = 2

#: The trees `disk_usage` reports, in the order Tonwerk lists them.
AREAS = ("renders", "assets", "cache", "replaced")


def tree_bytes(path: Path) -> int:
    if not path.exists():
        return 0
    return sum(entry.stat().st_size for entry in path.rglob("*") if entry.is_file())


def published_scene_shas(repo: Path) -> set[str]:
    """The scene sha every scene-era provenance manifest names. Pre-scene manifests name none."""

    found: set[str] = set()
    for manifest in (repo / "data" / "audio-provenance").rglob("*.json"):
        try:
            sha = json.loads(manifest.read_text()).get("scene_sha256")
        except (ValueError, AttributeError):
            continue
        if isinstance(sha, str):
            found.add(sha)
    return found


@dataclass(frozen=True)
class RenderTree:
    scene_sha256: str
    bytes: int
    #: Why it stays, or None when the reaper may remove it.
    kept_because: str | None


def render_trees(store: Store, repo: Path, keep: int) -> list[RenderTree]:
    """Every tree under `renders/`, each with its verdict."""

    if keep < 1:
        raise ValueError("keep must be at least 1: a project's head revision is always kept")
    newest: dict[int, list[tuple[int, str]]] = {}
    signed: set[str] = set()
    for project_id, number, sha, approved in store.revision_index():
        newest.setdefault(project_id, []).append((number, sha))
        if approved:
            signed.add(sha)
    recent = {
        sha
        for revisions in newest.values()
        for _, sha in sorted(revisions, reverse=True)[:keep]
    }
    published = published_scene_shas(repo)
    root = store.root / "renders"
    trees: list[RenderTree] = []
    for directory in sorted(root.iterdir()) if root.is_dir() else []:
        if not directory.is_dir():
            continue
        sha = directory.name
        reason = (
            "published"
            if sha in published
            else "signed"
            if sha in signed
            else f"one of the newest {keep}"
            if sha in recent
            else None
        )
        trees.append(RenderTree(sha, tree_bytes(directory), reason))
    return trees


def disk_usage(store: Store, repo: Path, keep: int) -> dict[str, object]:
    trees = render_trees(store, repo, keep)
    reapable = [tree for tree in trees if tree.kept_because is None]
    return {
        "root": str(store.root),
        "areas": {area: tree_bytes(store.root / area) for area in AREAS},
        "renders": len(trees),
        "keep": keep,
        "reapable": {"renders": len(reapable), "bytes": sum(tree.bytes for tree in reapable)},
    }


def reap_renders(store: Store, repo: Path, keep: int) -> dict[str, object]:
    """Remove every render tree `render_trees` gives no reason to keep, and say what went."""

    removed = [tree for tree in render_trees(store, repo, keep) if tree.kept_because is None]
    for tree in removed:
        shutil.rmtree(store.root / "renders" / tree.scene_sha256)
    return {
        "keep": keep,
        "removed": [tree.scene_sha256 for tree in removed],
        "bytes": sum(tree.bytes for tree in removed),
    }
