"""Archive, fork and the render reaper: the library's three operations on the studio's state.

Each is checked against what it must not lose. An archive keeps every revision, a fork never
inherits a signature, and the reaper never removes a tree a person may still play, sign or have
published.
"""

from __future__ import annotations

import json
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import update
from sqlalchemy.orm import Session

from listening_studio.domain import Bilingual, Stage
from listening_studio.library import disk_usage, reap_renders, render_trees
from listening_studio.storage import SceneRevision, Store
from listening_studio.web import app
from test_graph_render import cafe_scene, tone_in_store

AUTH = {"Authorization": "Bearer test"}


def render_tree(store: Store, sha: str, size: int = 1000) -> None:
    directory = store.root / "renders" / sha / "natural"
    directory.mkdir(parents=True)
    (directory / "master.wav").write_bytes(b"\0" * size)


def revisions(store: Store, slug: str, count: int) -> list[str]:
    """A project with `count` revisions, each with a render tree. Returns their shas, oldest first."""

    scene = cafe_scene(tone_in_store(store.root)).model_copy(update={"slug": slug})
    project = store.create_scene(scene)
    shas = [scene.sha256()]
    for number in range(2, count + 1):
        scene = scene.model_copy(update={"title": Bilingual(en=f"Take {number}", ru="Дубль")})
        shas.append(store.revise_scene(project.id, scene).scene_sha256)
    for sha in shas:
        render_tree(store, sha)
    return shas


def test_the_reaper_keeps_the_newest_signed_and_published_takes(tmp_path: Path) -> None:
    store = Store(tmp_path / "studio" / "db.sqlite3")
    repo = tmp_path / "repo"
    shas = revisions(store, "ls-cafe-01", 5)
    render_tree(store, "f" * 64)  # a tree no revision hashes to any more

    # Revision 1 was published from; revision 2 carries a completed approval.
    provenance = repo / "data" / "audio-provenance" / "a1"
    provenance.mkdir(parents=True)
    (provenance / "ls-cafe-01.json").write_text(json.dumps({"scene_sha256": shas[0]}))
    with Session(store.engine) as session:
        session.execute(
            update(SceneRevision)
            .where(SceneRevision.scene_sha256 == shas[1])
            .values(approval_json=json.dumps({"status": "complete"}))
        )
        session.commit()

    verdicts = {tree.scene_sha256: tree.kept_because for tree in render_trees(store, repo, 2)}
    assert verdicts[shas[0]] == "published"
    assert verdicts[shas[1]] == "signed"
    assert verdicts[shas[2]] is None
    assert verdicts[shas[3]] == "one of the newest 2"
    assert verdicts[shas[4]] == "one of the newest 2"
    assert verdicts["f" * 64] is None

    usage = disk_usage(store, repo, 2)
    assert usage["renders"] == 6
    assert usage["reapable"] == {"renders": 2, "bytes": 2000}

    result = reap_renders(store, repo, 2)
    assert sorted(result["removed"]) == sorted([shas[2], "f" * 64])  # type: ignore[arg-type]
    assert not (store.root / "renders" / shas[2]).exists()
    assert all((store.root / "renders" / sha).exists() for sha in (shas[0], shas[1], shas[3]))
    assert disk_usage(store, repo, 2)["reapable"] == {"renders": 0, "bytes": 0}


def test_archive_and_fork_keep_history_and_drop_signatures(tmp_path: Path) -> None:
    store = Store(tmp_path / "studio" / "db.sqlite3")
    repo = tmp_path / "repo"
    (repo / "data").mkdir(parents=True)
    (repo / "data" / "listening-plan.yaml").write_text("version: 1\nunits: []\n")
    revisions(store, "ls-cafe-01", 2)
    origin = store.get_scene_by_slug("ls-cafe-01")
    assert origin
    store.transition_scene(origin[0].id, Stage.DRAFT, Stage.VALIDATED)
    http = TestClient(app(store, repo, token="test"))

    archived = http.post("/api/scenes/ls-cafe-01/archive", json={"archived": True}, headers=AUTH)
    assert archived.json() == {"slug": "ls-cafe-01", "archived": True}
    row = next(row for row in http.get("/api/scenes", headers=AUTH).json())
    assert row["archived"] is True
    assert row["revision"] == 2

    forked = http.post("/api/scenes/ls-cafe-01/fork", json={"slug": "ls-cafe-02"}, headers=AUTH)
    assert forked.status_code == 201, forked.text
    assert forked.json() == {"slug": "ls-cafe-02", "forked_from": "ls-cafe-01@2", "stage": "draft"}
    copy = store.get_scene_by_slug("ls-cafe-02")
    assert copy and copy[1].number == 1 and copy[2].title == origin[2].title
    assert copy[0].archived_at is None

    taken = http.post("/api/scenes/ls-cafe-01/fork", json={"slug": "ls-cafe-02"}, headers=AUTH)
    assert taken.status_code == 409
    malformed = http.post("/api/scenes/ls-cafe-01/fork", json={"slug": "Kein Slug"}, headers=AUTH)
    assert malformed.status_code == 422

    # A fork is owned by no plan entry, so the registry lists it as a studio row of its own.
    registry = http.get("/api/registry", headers=AUTH).json()
    studio = {row["id"]: row for row in registry["rows"] if row["kind"] == "scene"}
    assert set(studio) == {"ls-cafe-01", "ls-cafe-02"}
    assert studio["ls-cafe-02"]["project"]["forked_from"] == "ls-cafe-01@2"
    assert studio["ls-cafe-01"]["project"]["archived"] is True
    assert "Take 2" not in studio["ls-cafe-02"]["text"] and studio["ls-cafe-02"]["text"]

    unarchived = http.post("/api/scenes/ls-cafe-01/archive", json={"archived": False}, headers=AUTH)
    assert unarchived.json()["archived"] is False

    usage = http.get("/api/library/disk?keep=1", headers=AUTH).json()
    assert usage["renders"] == 2 and usage["reapable"]["renders"] == 1
    assert http.post("/api/library/reap", json={"keep": 0}, headers=AUTH).status_code == 422
    assert http.post("/api/library/reap", json={"keep": 1}, headers=AUTH).json()["bytes"] == 1000
