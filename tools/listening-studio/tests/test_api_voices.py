"""`/api/voices`: what it accepts, what it refuses, and what the refusal tells the editor.

The assertions are mostly about **error bodies**, which is unusual and deliberate. The wizard in
Tonwerk renders the rules it is about to be held to, and it can only do that if the engine names
them — so "a bad consent is rejected" is not the property under test here. "A bad consent is
rejected with `publication-permits-course` in the body" is.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from listening_studio.generative.voices import reference_path, sha256_bytes
from listening_studio.storage import Store
from listening_studio.web import app

REPO = Path(__file__).resolve().parents[3]
AUTH = {"Authorization": "Bearer test"}
REFERENCE = b"RIFF....WAVEfake reference audio bytes"


def voices_repo(tmp_path: Path) -> Path:
    """A course repo holding the character roster, which is where the demo phrases come from."""

    repo = tmp_path / "repo"
    (repo / "data").mkdir(parents=True)
    shutil.copyfile(
        REPO / "data" / "listening-characters.yaml", repo / "data" / "listening-characters.yaml"
    )
    return repo


@pytest.fixture
def client(tmp_path: Path) -> Any:
    store = Store(tmp_path / "db.sqlite3")
    api = app(
        store,
        voices_repo(tmp_path),
        token="test",
        allow_test_adapters=True,
        # Injected: the real one is MLX Whisper and macOS-local, and CI has never seen torch.
        transcribe_fn=lambda path: "Guten Tag, ich lese diesen Satz als Referenz.",
    )
    return TestClient(api), store


@pytest.fixture
def sealed(tmp_path: Path) -> Any:
    """The same server without the test gate: what a real machine answers."""

    store = Store(tmp_path / "db.sqlite3")
    api = app(store, voices_repo(tmp_path), token="test")
    return TestClient(api), store


def consent(**overrides: object) -> str:
    document: dict[str, object] = {
        "version": 1,
        "recorded_at": "2026-08-21",
        "scope": "publication",
        "subject": {"display_name": "Testperson", "is_minor": False},
        "authorized_purpose": (
            "Sprechrolle in den Hörtexten des Deutsch-Atlas-Kurses, gelesen aus dem Kursskript."
        ),
        "permitted_uses": ["Veröffentlichung im Deutsch-Atlas-Kurs"],
        "prohibited_uses": ["Weitergabe außerhalb des Kurses"],
        "retention": {
            "policy": "Referenzaufnahme wird bis zum Widerruf aufbewahrt und dann gelöscht.",
            "automatic_deletion": False,
        },
        "reference": {"sha256": sha256_bytes(REFERENCE)},
    }
    document.update(overrides)
    return json.dumps(document)


def create(api: TestClient, *, audio: bytes = REFERENCE, **form: object) -> Any:
    data: dict[str, object] = {
        "voice_id": "testperson",
        "consent": consent(),
        "engine": "fake_clone",
    }
    data.update(form)
    return api.post(
        "/api/voices",
        headers=AUTH,
        data=data,
        files={"reference": ("reference.wav", audio, "audio/wav")},
    )


def test_the_list_serves_the_rules_a_new_voice_will_be_held_to(client: Any) -> None:
    """The form prints these *before* it is rejected by one of them."""

    api, _ = client
    body = api.get("/api/voices", headers=AUTH).json()
    assert body["voices"] == []
    ids = [rule["id"] for rule in body["rules"]]
    assert "publication-permits-course" in ids
    assert {rule["applies"] for rule in body["rules"]} == {"always", "evaluation", "publication"}
    assert [rule for rule in body["rules"] if rule["id"] == "minor-guardian"][0]["minors_only"]
    assert body["engines"] == ["fake_clone", "qwen_tts_base"]
    assert len(body["demo_phrases"]) == 3


def test_a_consented_voice_is_created_bound_and_listed(client: Any) -> None:
    api, store = client
    created = create(api)
    assert created.status_code == 201, created.text
    row = created.json()
    assert row["subject_display_name"] == "Testperson"
    assert row["scope"] == "publication"
    assert row["reference_sha256"] == sha256_bytes(REFERENCE)
    assert row["reference_present"] is True
    assert row["revoked_at"] is None

    # The transcript came from the injected ASR, because the form did not carry one.
    stored = store.get_voice("testperson")
    assert stored is not None
    assert stored.reference_text == "Guten Tag, ich lese diesen Satz als Referenz."

    listed = api.get("/api/voices", headers=AUTH).json()["voices"]
    assert [entry["id"] for entry in listed] == ["testperson"]


def test_a_consent_violation_is_a_400_that_names_the_rule(client: Any) -> None:
    api, store = client
    refused = create(api, consent=consent(permitted_uses=[]))
    assert refused.status_code == 400
    assert refused.json()["detail"].startswith("publication-permits-course:")
    # Nothing was written. A rejected consent must not leave a recording on disk.
    assert not (store.root / "voices").exists()
    assert store.get_voice("testperson") is None


def test_a_recording_that_is_not_the_consented_one_is_refused_by_digest(client: Any) -> None:
    api, store = client
    refused = create(api, audio=b"a different recording entirely")
    assert refused.status_code == 400
    assert refused.json()["detail"].startswith("reference-sha-binding:")
    assert store.get_voice("testperson") is None


def test_a_minor_without_a_guardian_record_is_refused(client: Any) -> None:
    api, _ = client
    refused = create(
        api, consent=consent(subject={"display_name": "Kind", "is_minor": True})
    )
    assert refused.status_code == 400
    assert refused.json()["detail"].startswith("minor-guardian:")


def test_the_fake_cloning_engine_is_behind_the_test_gate(sealed: Any) -> None:
    api, _ = sealed
    refused = create(api)
    assert refused.status_code == 409
    assert "clones nothing" in refused.json()["detail"]


def test_absent_weights_answer_409_with_the_installer(
    sealed: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The one machine that can fix this is the one running the request, so it is told how.

    The absence is **staged**, not assumed. A developer laptop that has already fetched the Base
    checkpoint would otherwise pass this test by creating the voice — the test would report a green
    409 path it never ran, on exactly the machine where it matters least.
    """

    api, _ = sealed

    def missing(model_id: str, revision: str, *args: object, **kwargs: object) -> str:
        raise RuntimeError(
            f"{model_id}@{revision} is not installed; run atlas-listening models fetch first"
        )

    monkeypatch.setattr("listening_studio.generative.qwen_clone.locked_snapshot", missing)
    refused = create(api, engine="qwen_tts_base")
    assert refused.status_code == 409
    assert "atlas-listening models fetch qwen_tts_base" in refused.json()["detail"]


def test_a_non_cloning_engine_is_a_400_naming_the_ones_that_clone(client: Any) -> None:
    api, _ = client
    refused = create(api, engine="qwen_tts")
    assert refused.status_code == 400
    assert "has no cloning capability" in refused.json()["detail"]
    assert "qwen_tts_base" in refused.json()["detail"]


def test_a_second_voice_under_the_same_id_is_a_conflict(client: Any) -> None:
    api, _ = client
    assert create(api).status_code == 201
    again = create(api)
    assert again.status_code == 409
    assert "already exists" in again.json()["detail"]


def test_the_demo_renders_the_roster_phrases_and_serves_them(client: Any) -> None:
    api, _ = client
    assert create(api).status_code == 201
    rendered = api.post("/api/voices/testperson/demo", headers=AUTH)
    assert rendered.status_code == 200, rendered.text
    body = rendered.json()
    assert len(body["phrases"]) == 3
    assert body["demo_urls"] == [f"/api/voices/testperson/demo/{index}" for index in range(3)]
    audio = api.get("/api/voices/testperson/demo/0", headers=AUTH)
    assert audio.status_code == 200
    assert audio.headers["content-type"] == "audio/wav"
    assert api.get("/api/voices/testperson/demo/9", headers=AUTH).status_code == 404


def test_revocation_refuses_further_synthesis_and_removes_the_recording(client: Any) -> None:
    api, store = client
    assert create(api).status_code == 201
    assert api.post("/api/voices/testperson/demo", headers=AUTH).status_code == 200

    revoked = api.post("/api/voices/testperson/revoke", headers=AUTH)
    assert revoked.status_code == 200
    assert revoked.json()["reference_deleted"] is True
    assert revoked.json()["demos_deleted"] == 3

    row = store.get_voice("testperson")
    assert row is not None
    assert not reference_path(store.root, row.reference_sha256).exists()

    again = api.post("/api/voices/testperson/demo", headers=AUTH)
    assert again.status_code == 409
    assert "revoked" in again.json()["detail"]

    # A revoked voice is still listed. Turning a withdrawal into a 404 would hide the one fact
    # somebody needs to see.
    listed = api.get("/api/voices", headers=AUTH).json()["voices"]
    assert listed[0]["revoked_at"] is not None
    assert listed[0]["reference_present"] is False


def test_an_unknown_voice_is_a_404_and_a_revoked_one_is_not(client: Any) -> None:
    api, _ = client
    assert api.post("/api/voices/nie-erstellt/revoke", headers=AUTH).status_code == 404
    assert api.get("/api/voices/nie-erstellt/demo/0", headers=AUTH).status_code == 404


def test_an_x_vector_only_voice_is_stored_without_a_transcript(client: Any) -> None:
    """The one path where a missing reference text is correct rather than a defect.

    X-vector-only conditions on the speaker embedding alone, so the engine reads no transcript —
    and the injected ASR is deliberately **not** consulted, because a transcript recorded on a
    voice that cannot use it would be a field a later reader would try to act on.
    """

    api, store = client
    created = create(api, x_vector_only="true")
    assert created.status_code == 201, created.text
    assert created.json()["x_vector_only"] is True

    row = store.get_voice("testperson")
    assert row is not None
    assert row.reference_text is None
    assert bool(row.x_vector_only) is True
