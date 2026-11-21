"""Figuren's images: read from the checkout's `public/characters/`, never from app data.

`bun run characters:import` writes one folder per person, `<id>.webp` and `<id>-<n>.webp`. The
roster is keyed by voice, so a voice that speaks a cast member under another name (Timo through
`jonas`) carries that person's images too.
"""

from __future__ import annotations

import shutil
from pathlib import Path

from fastapi.testclient import TestClient

from listening_studio.storage import Store
from listening_studio.web import app

REPO = Path(__file__).resolve().parents[4]
AUTH = {"Authorization": "Bearer test"}


def checkout(tmp_path: Path) -> Path:
    repo = tmp_path / "repo"
    (repo / "data").mkdir(parents=True)
    for name in ("listening-characters.yaml", "listening-narration-profiles.yaml"):
        shutil.copy(REPO / "data" / name, repo / "data" / name)
    people = repo / "content" / "characters"
    people.mkdir(parents=True)
    (people / "timo.yaml").write_text("id: timo\nname: Timo\nvoice: jonas\n")
    (people / "lena.yaml").write_text("id: lena\nname: Lena\nvoice: lena\n")
    for folder, names in {
        "lena": ["lena", "lena-2", "lena-10", "lena-1", "lena-x"],
        "timo": ["timo-1"],
    }.items():
        (repo / "public" / "characters" / folder).mkdir(parents=True)
        for name in names:
            (repo / "public" / "characters" / folder / f"{name}.webp").write_bytes(b"RIFF")
    return repo


def roster(tmp_path: Path) -> tuple[TestClient, dict[str, dict[str, object]]]:
    http = TestClient(app(Store(tmp_path / "db.sqlite3"), checkout(tmp_path), token="test"))
    response = http.get("/api/characters", headers=AUTH)
    assert response.status_code == 200
    return http, {row["id"]: row for row in response.json()["characters"]}


def test_a_character_with_images_lists_its_portrait_and_scenes_in_number_order(
    tmp_path: Path,
) -> None:
    _, rows = roster(tmp_path)
    assert rows["lena"]["portrait_url"] == "/api/characters/lena/images/lena"
    assert rows["lena"]["scene_urls"] == [
        "/api/characters/lena/images/lena-1",
        "/api/characters/lena/images/lena-2",
        "/api/characters/lena/images/lena-10",
    ]
    # Lena's voice speaks Lena, so there is no second person on her card.
    assert "cast" not in rows["lena"]


def test_a_character_without_images_is_an_empty_state(tmp_path: Path) -> None:
    _, rows = roster(tmp_path)
    assert rows["mira"]["portrait_url"] is None
    assert rows["mira"]["scene_urls"] == []


def test_a_voice_that_speaks_a_cast_member_carries_that_persons_images(tmp_path: Path) -> None:
    _, rows = roster(tmp_path)
    assert rows["jonas"]["cast"] == {
        "id": "timo",
        "name": "Timo",
        "portrait_url": None,
        "scene_urls": ["/api/characters/timo/images/timo-1"],
    }


def test_an_image_is_served_and_nothing_outside_its_folder_is(tmp_path: Path) -> None:
    http, _ = roster(tmp_path)
    image = http.get("/api/characters/lena/images/lena-1", headers=AUTH)
    assert image.status_code == 200
    assert image.headers["content-type"] == "image/webp"
    assert http.get("/api/characters/lena/images/lena-9", headers=AUTH).status_code == 404
    assert http.get("/api/characters/lena/images/..%2Flena", headers=AUTH).status_code == 404
    assert http.get("/api/characters/lena/images/lena-1", headers={}).status_code == 401
