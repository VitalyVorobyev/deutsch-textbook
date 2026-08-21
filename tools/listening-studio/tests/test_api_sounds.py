"""The sound library's two new reads and its one write.

`POST /api/sounds/generate` is the first endpoint that runs a generative model outside a render,
so what is asserted here is that it did **not** become a second pipeline: the asset it produces is
the one a render's `SoundSpec` would produce, under the same node hash, in the same store, with
the same provenance sidecar — which is what makes the row appear in `GET /api/sounds` without
anything copying it there.

`GET /api/acoustics` is asserted against the repository's own data files rather than a fixture,
because the whole point of the endpoint is that a client must not hold its own copy of the
vocabulary: a test with an invented room would be the same mistake one layer down.
"""

from __future__ import annotations

import shutil
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from listening_studio.graph.assets import AssetStore
from listening_studio.storage import Store
from listening_studio.web import app

REPO = Path(__file__).resolve().parents[3]

AUTH = {"Authorization": "Bearer test"}


def acoustic_repo(tmp_path: Path) -> Path:
    """A course repo holding the two acoustic data files, and nothing else."""

    repo = tmp_path / "repo"
    (repo / "data").mkdir(parents=True)
    for name in ("acoustic-profiles.yaml", "acoustic-difficulty.yaml"):
        shutil.copyfile(REPO / "data" / name, repo / "data" / name)
    return repo


@pytest.fixture
def client(tmp_path: Path) -> Any:
    store = Store(tmp_path / "db.sqlite3")
    api = app(store, acoustic_repo(tmp_path), token="test", allow_test_adapters=True)
    return TestClient(api), store


@pytest.fixture
def sealed(tmp_path: Path) -> Any:
    """The same server without the test gate: what a real machine answers."""

    store = Store(tmp_path / "db.sqlite3")
    api = app(store, acoustic_repo(tmp_path), token="test")
    return TestClient(api), store


REQUEST = {
    "prompt": "a cup set down on a saucer",
    "seed": 7,
    "duration_seconds": 1.2,
    "engine": "fake",
}


def test_a_generated_sound_is_stored_with_its_provenance_and_joins_the_library(
    client: Any,
) -> None:
    http, store = client

    assert http.get("/api/sounds", headers=AUTH).json() == []

    made = http.post("/api/sounds/generate", json=REQUEST, headers=AUTH)
    assert made.status_code == 201, made.text
    row = made.json()

    # The row is the *library's* row, not a receipt: origin, the editorial record of why these
    # bytes, and the waveform the list draws.
    assert row["origin"] == "generated"
    assert row["prompt"] == REQUEST["prompt"]
    assert row["seed"] == 7
    assert row["engine"] == "fake_sound"
    assert row["license"] == "none"
    assert row["cached"] is False
    assert len(row["peaks"]) > 0

    # Stored the way a render stores it: the asset is named by its own digest and has a sidecar.
    assets = AssetStore(store.root)
    assert assets.get(row["asset_sha256"]) is not None
    provenance = assets.provenance(row["asset_sha256"])
    assert provenance is not None and provenance["kind"] == "generated-sound"

    listed = http.get("/api/sounds", headers=AUTH).json()
    assert [entry["asset_sha256"] for entry in listed] == [row["asset_sha256"]]

    # And it plays: the same digest, through the path both origins are auditioned by.
    audio = http.get(f"/api/sounds/{row['asset_sha256']}/audio", headers=AUTH)
    assert audio.status_code == 200
    assert audio.content


def test_the_same_request_twice_costs_the_model_once(client: Any) -> None:
    # The node cache is what makes the sound library affordable to browse: a re-request of a
    # prompt at a seed is a cache walk, and the endpoint says so rather than looking like a
    # second generation that happened to produce identical bytes.
    http, _ = client

    first = http.post("/api/sounds/generate", json=REQUEST, headers=AUTH).json()
    second = http.post("/api/sounds/generate", json=REQUEST, headers=AUTH).json()

    assert second["asset_sha256"] == first["asset_sha256"]
    assert first["cached"] is False and second["cached"] is True
    assert len(http.get("/api/sounds", headers=AUTH).json()) == 1


def test_the_fake_engine_is_refused_without_the_test_gate(sealed: Any) -> None:
    http, _ = sealed

    refused = http.post("/api/sounds/generate", json=REQUEST, headers=AUTH)

    assert refused.status_code == 409
    assert "tone" in refused.json()["detail"]


def test_absent_weights_are_a_409_naming_the_installer(sealed: Any) -> None:
    # CI has never run install-stable-audio.sh, which is the state this asserts against: the
    # engine exists, the machine cannot run it, and the answer says what to do rather than
    # arriving as a 500 with a RuntimeError in it.
    http, _ = sealed

    refused = http.post(
        "/api/sounds/generate",
        json={**REQUEST, "engine": "stable_audio_sfx"},
        headers=AUTH,
    )

    assert refused.status_code == 409
    assert "install-stable-audio.sh" in refused.json()["detail"]


def test_a_request_the_engine_cannot_be_asked_is_a_400(client: Any) -> None:
    http, _ = client

    refused = http.post(
        "/api/sounds/generate",
        json={**REQUEST, "params": {"cfg": 3.0}},
        headers=AUTH,
    )

    assert refused.status_code == 400
    assert "accepts no engine parameters" in refused.json()["detail"]


def test_a_zero_length_sound_is_refused_by_the_schema(client: Any) -> None:
    http, _ = client

    refused = http.post(
        "/api/sounds/generate", json={**REQUEST, "duration_seconds": 0}, headers=AUTH
    )

    assert refused.status_code == 422


def test_acoustics_serves_the_repository_s_own_vocabulary(client: Any) -> None:
    http, _ = client

    catalog = http.get("/api/acoustics", headers=AUTH)
    assert catalog.status_code == 200
    body = catalog.json()

    # Ids and versions, both: the version is a hashed render parameter, so an editor that shows
    # it can say which calibration a stored scene was authored against.
    rooms = {row["id"]: row for row in body["rooms"]}
    assert "studio" in rooms and rooms["studio"]["version"] >= 1
    assert rooms["studio"]["label"]
    devices = {row["id"]: row for row in body["devices"]}
    assert "telephone" in devices and devices["telephone"]["label"]

    presets = {row["id"]: row for row in body["presets"]}
    assert set(presets) >= {"clean", "natural", "challenging"}
    # `natural` is the identity — every delta a no-op — which is what makes it the reference the
    # other two are heard against.
    assert presets["natural"]["deltas"] == {
        "ambience_gain_db": 0.0,
        "wet": 0.0,
        "distance": 1.0,
        "pace": 1.0,
        "overlap_ms": 0,
    }
    assert presets["challenging"]["deltas"]["overlap_ms"] > 0

    # The closed override vocabulary, so a variant editor cannot offer a key the renderer refuses.
    assert body["override_keys"] == [
        "ambience_gain_db",
        "wet",
        "distance",
        "pace",
        "overlap_ms",
    ]


def test_acoustics_names_the_file_it_could_not_read(tmp_path: Path) -> None:
    # An empty list would make an editor offer no rooms, which reads exactly like a repository
    # that defines none. The refusal says which file would have to exist.
    store = Store(tmp_path / "db.sqlite3")
    http = TestClient(app(store, tmp_path / "leer", token="test"))

    refused = http.get("/api/acoustics", headers=AUTH)

    assert refused.status_code == 409
    assert "acoustic-profiles.yaml" in refused.json()["detail"]
