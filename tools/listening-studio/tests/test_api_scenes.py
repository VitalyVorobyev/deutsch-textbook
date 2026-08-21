"""The scene lifecycle over HTTP, end to end: create → validate → render → QA → approve.

This is the API the desktop app is built on, so the assertions are about the *contract* — status
codes, the keys of each envelope, and which requests are refused — rather than about audio. The
audio is `FakeSpeech` and `FakeSound` under the test gate; what is being checked is that the
gates, the stage machine and the approval's binding to specific bytes all behave through HTTP
exactly as they do through `atlas-listening scene`.
"""

from __future__ import annotations

import hashlib
import shutil
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from listening_studio import ui
from listening_studio.api.workflow import APPROVAL_CHECKLIST
from listening_studio.domain import Stage
from listening_studio.scene.model import Scene
from listening_studio.storage import Store
from listening_studio.web import app
from test_graph_render import cafe_scene, tone_in_store

REPO = Path(__file__).resolve().parents[3]

#: The bearer token every request in this file presents. The app is created with the same value.
AUTH = {"Authorization": "Bearer test"}


def acoustic_repo(tmp_path: Path) -> Path:
    """A course repo holding only what a scene render and `scene validate --repo` read.

    Copied rather than pointed at the real checkout so the test states its own inputs: with the
    two files absent, `catalog_warnings` correctly reports that it cannot read them, and a
    validate assertion of `warnings == []` would then be asserting the wrong thing for the
    wrong reason.
    """

    repo = tmp_path / "repo"
    (repo / "data").mkdir(parents=True)
    for name in ("acoustic-profiles.yaml", "acoustic-difficulty.yaml"):
        shutil.copyfile(REPO / "data" / name, repo / "data" / name)
    return repo


def transcript_of(scene: Scene) -> Any:
    """A transcriber that hears exactly what the script says.

    `scene_qa` cuts one WAV per utterance out of `qa.wav` and names each after its utterance id,
    then transcribes the whole file too. Keying on the filename is what lets a fake stand in for
    Whisper without a model: the point of the test is the workflow, and a QA report that fails
    for synthetic reasons would never reach the approval step this file exists to check.
    """

    def transcribe(path: Path) -> str:
        if path.stem == "qa":
            return " ".join(utterance.spoken_text() for utterance in scene.script)
        return scene.utterance(path.stem).spoken_text()

    return transcribe


@pytest.fixture
def client(tmp_path: Path) -> Any:
    store = Store(tmp_path / "db.sqlite3")
    scene = cafe_scene(tone_in_store(store.root))
    api = app(
        store,
        acoustic_repo(tmp_path),
        token="test",
        allow_test_adapters=True,
        transcribe_fn=transcript_of(scene),
    )
    return TestClient(api), store, scene


def create(http: TestClient, scene: Scene, **extra: Any) -> Any:
    return http.post(
        "/api/scenes",
        json={"scene": scene.model_dump(mode="json"), **extra},
        headers=AUTH,
    )


def test_the_full_scene_lifecycle_reaches_a_human_approval(client: Any) -> None:
    http, store, scene = client

    created = create(http, scene)
    assert created.status_code == 201, created.text
    assert created.json() == {
        "project_id": 1,
        "slug": scene.slug,
        "kind": "dialogue",
        "stage": str(Stage.DRAFT),
        "revision": 1,
        "scene_sha256": scene.sha256(),
        "has_exercise": False,
    }

    listed = http.get("/api/scenes", headers=AUTH).json()
    assert [row["slug"] for row in listed] == [scene.slug]
    assert listed[0]["stage"] == str(Stage.DRAFT)
    assert listed[0]["revision"] == 1
    assert listed[0]["scene_sha256"] == scene.sha256()
    assert listed[0]["has_exercise"] is False
    assert listed[0]["updated"]

    # Validate against a repository that defines the acoustic catalogs: no errors, no warnings.
    checked = http.post(f"/api/scenes/{scene.slug}/validate", headers=AUTH).json()
    assert checked == {
        "ok": True,
        "slug": scene.slug,
        "sha256": scene.sha256(),
        "errors": [],
        "warnings": [],
    }

    rendered = http.post(f"/api/scenes/{scene.slug}/render", json={}, headers=AUTH)
    assert rendered.status_code == 200, rendered.text
    render = rendered.json()
    assert render["stage"] == str(Stage.AUDIO_GENERATED)
    assert render["variant"] == "natural"
    assert render["nodes_evaluated"] > 0 and render["nodes_cached"] == 0
    assert {row["kind"] for row in render["artifacts"]} == {
        "master", "qa", "publish", "dry", "stem"
    }

    detail = http.get(f"/api/scenes/{scene.slug}", headers=AUTH).json()
    natural = next(row for row in detail["renders"] if row["variant"] == "natural")
    assert natural["rendered"] is True and natural["has_master"] is True
    assert natural["duration_ms"] == render["duration_ms"]
    # The render's own measurement of where everything landed, carried on the row it belongs to.
    # A client can otherwise say a variant is rendered and nothing about what it sounds like.
    assert [row["utterance_id"] for row in natural["timing"]] == [
        utterance.id for utterance in scene.script
    ]
    assert {row["type"] for row in natural["timeline"]} == {"speech", "ambience", "sfx"}
    assert {row["kind"] for row in natural["artifacts"]} == {
        "master", "qa", "publish", "dry", "stem"
    }
    assert detail["qa"] is None and detail["approval"] is None

    checked_qa = http.post(f"/api/scenes/{scene.slug}/qa", json={}, headers=AUTH)
    assert checked_qa.status_code == 200, checked_qa.text
    assert checked_qa.json()["passed"] is True
    assert checked_qa.json()["stage"] == str(Stage.AUTOMATICALLY_CHECKED)

    # Both review surfaces: the bytes and the machine's report on exactly those bytes.
    audio = http.get(f"/api/scenes/{scene.slug}/renders/natural/master", headers=AUTH)
    assert audio.status_code == 200
    assert audio.headers["content-type"] == "audio/wav"
    report = http.get(f"/api/scenes/{scene.slug}/renders/natural/qa-report", headers=AUTH)
    assert report.status_code == 200 and report.json()["variant"] == "natural"
    assert (
        http.get(f"/api/scenes/{scene.slug}/renders/challenging/qa-report", headers=AUTH).status_code
        == 404
    )

    master = store.root / "renders" / scene.sha256() / "natural" / "master.wav"
    digest = hashlib.sha256(master.read_bytes()).hexdigest()
    assert audio.content == master.read_bytes()

    approved = http.post(
        f"/api/scenes/{scene.slug}/approve",
        json={
            "editor": "Vitaly Vorobyev",
            "master_sha256": digest,
            # This scene has an ambience bed and an sfx event, so `context` is required; it
            # carries no exercise, so `questions` is not.
            "checklist": [
                "accent", "naturalness", "intelligibility", "identity",
                "speakers", "pace", "context",
            ],
        },
        headers=AUTH,
    )
    assert approved.status_code == 200, approved.text
    approval = approved.json()["approval"]
    assert approval["status"] == "complete"
    assert approval["editor"] == "Vitaly Vorobyev"
    assert approval["audio_sha256"] == digest
    assert approval["scene_sha256"] == scene.sha256()
    assert approval["variant"] == "natural"
    assert approval["dry_audio_sha256"]
    stored = store.get_scene_by_slug(scene.slug)
    assert stored is not None and stored[0].stage == Stage.HUMAN_APPROVED


def test_an_approval_naming_other_bytes_is_refused(client: Any) -> None:
    """The signature is bound to the audio, or it vouches for whatever is on disk later.

    The dialogue pipeline learned this on 2026-08-02: an approval that recorded who and when but
    nothing about the bytes let a regenerated WAV be published carrying it unchanged, and no
    downstream gate could see it. Here the reviewer states the digest they listened to, and a
    disagreement is the server's to refuse — before anything is stored.
    """

    http, store, scene = client
    assert create(http, scene).status_code == 201
    assert http.post(f"/api/scenes/{scene.slug}/render", json={}, headers=AUTH).status_code == 200
    assert http.post(f"/api/scenes/{scene.slug}/qa", json={}, headers=AUTH).status_code == 200

    body = {
        "editor": "Vitaly",
        "master_sha256": "0" * 64,
        "checklist": [
            "accent", "naturalness", "intelligibility", "identity", "speakers", "pace", "context",
        ],
    }
    refused = http.post(f"/api/scenes/{scene.slug}/approve", json=body, headers=AUTH)
    assert refused.status_code == 409
    assert "re-listen to the current render" in refused.json()["detail"]

    master = store.root / "renders" / scene.sha256() / "natural" / "master.wav"
    digest = hashlib.sha256(master.read_bytes()).hexdigest()
    # The refusal names both digests, so the reviewer can see which render they were on.
    assert digest in refused.json()["detail"] and "0" * 64 in refused.json()["detail"]

    stored = store.get_scene_by_slug(scene.slug)
    assert stored is not None
    assert stored[0].stage == Stage.AUTOMATICALLY_CHECKED
    assert stored[1].approval_json is None

    # The same request with the digest of the bytes that exist passes.
    accepted = http.post(
        f"/api/scenes/{scene.slug}/approve", json=body | {"master_sha256": digest}, headers=AUTH
    )
    assert accepted.status_code == 200, accepted.text


def test_an_approval_that_does_not_certify_the_required_checks_is_refused(client: Any) -> None:
    http, _store, scene = client
    assert create(http, scene).status_code == 201
    assert http.post(f"/api/scenes/{scene.slug}/render", json={}, headers=AUTH).status_code == 200
    assert http.post(f"/api/scenes/{scene.slug}/qa", json={}, headers=AUTH).status_code == 200
    detail = http.get(f"/api/scenes/{scene.slug}", headers=AUTH).json()
    digest = next(row for row in detail["renders"] if row["variant"] == "natural")["master_sha256"]

    short = http.post(
        f"/api/scenes/{scene.slug}/approve",
        json={"editor": "V", "master_sha256": digest, "checklist": ["accent", "pace"]},
        headers=AUTH,
    )
    assert short.status_code == 400
    assert "context" in short.json()["detail"] and "identity" in short.json()["detail"]

    invented = http.post(
        f"/api/scenes/{scene.slug}/approve",
        json={"editor": "V", "master_sha256": digest, "checklist": ["vibes"]},
        headers=AUTH,
    )
    assert invented.status_code == 400
    assert "unknown checklist key(s) vibes" in invented.json()["detail"]


def test_declining_returns_the_scene_to_draft_with_the_reason_recorded(client: Any) -> None:
    """A refusal is a step in the workflow, not closing the tab."""

    http, store, scene = client
    assert create(http, scene).status_code == 201
    assert http.post(f"/api/scenes/{scene.slug}/render", json={}, headers=AUTH).status_code == 200
    assert http.post(f"/api/scenes/{scene.slug}/qa", json={}, headers=AUTH).status_code == 200

    declined = http.post(
        f"/api/scenes/{scene.slug}/decline",
        json={"editor": "Vitaly", "reason": "Jonas drifts into another voice on line 2."},
        headers=AUTH,
    )
    assert declined.status_code == 200, declined.text
    assert declined.json()["stage"] == str(Stage.DRAFT)

    detail = http.get(f"/api/scenes/{scene.slug}", headers=AUTH).json()
    assert detail["stage"] == str(Stage.DRAFT)
    assert detail["approval"]["status"] == "declined"
    assert detail["approval"]["reason"].startswith("Jonas drifts")
    # The machine's measurement of these bytes is not invalidated by a human disliking them.
    assert detail["qa"]["passed"] is True
    # And the render is still there: declining does not delete audio, it refuses to sign it.
    assert next(row for row in detail["renders"] if row["variant"] == "natural")["rendered"] is True

    already = http.post(
        f"/api/scenes/{scene.slug}/decline", json={"reason": "the same thing again"}, headers=AUTH
    )
    assert already.status_code == 409


def test_revising_a_scene_returns_it_to_draft_and_unrenders_it(client: Any) -> None:
    """New bytes are a new scene sha, so nothing about the old take follows them forward."""

    http, store, scene = client
    assert create(http, scene).status_code == 201
    assert http.post(f"/api/scenes/{scene.slug}/render", json={}, headers=AUTH).status_code == 200
    assert http.post(f"/api/scenes/{scene.slug}/qa", json={}, headers=AUTH).status_code == 200

    edited = scene.model_copy(
        update={
            "script": [
                scene.script[0].model_copy(update={"display_text": "Guten Tag, einen Tee bitte."}),
                *scene.script[1:],
            ]
        }
    )
    revised = http.put(
        f"/api/scenes/{scene.slug}",
        json={"scene": edited.model_dump(mode="json")},
        headers=AUTH,
    )
    assert revised.status_code == 200, revised.text
    assert revised.json()["revision"] == 2
    assert revised.json()["stage"] == str(Stage.DRAFT)
    assert revised.json()["scene_sha256"] == edited.sha256() != scene.sha256()

    detail = http.get(f"/api/scenes/{scene.slug}", headers=AUTH).json()
    assert detail["stage"] == str(Stage.DRAFT)
    assert detail["qa"] is None and detail["approval"] is None
    # The old render still exists on disk under the old sha; it is simply not this scene's.
    assert all(row["rendered"] is False for row in detail["renders"])


def test_a_revision_may_not_rename_the_scene_and_a_duplicate_slug_is_refused(client: Any) -> None:
    http, _store, scene = client
    assert create(http, scene).status_code == 201

    again = create(http, scene)
    assert again.status_code == 409 and "already exists" in again.json()["detail"]

    renamed = scene.model_copy(update={"slug": "fixture-cafe-two"})
    refused = http.put(
        f"/api/scenes/{scene.slug}",
        json={"scene": renamed.model_dump(mode="json")},
        headers=AUTH,
    )
    assert refused.status_code == 409 and "cannot rename" in refused.json()["detail"]

    assert http.get("/api/scenes/nothing-here", headers=AUTH).status_code == 404


def test_qa_before_a_render_and_a_render_of_an_unknown_variant_are_both_refused(
    client: Any,
) -> None:
    http, _store, scene = client
    assert create(http, scene).status_code == 201

    early = http.post(f"/api/scenes/{scene.slug}/qa", json={}, headers=AUTH)
    assert early.status_code == 409 and "render it first" in early.json()["detail"]

    unknown = http.post(
        f"/api/scenes/{scene.slug}/render", json={"variant": "cinema"}, headers=AUTH
    )
    assert unknown.status_code == 409 and "has no variant cinema" in unknown.json()["detail"]

    bad_engine = http.post(
        f"/api/scenes/{scene.slug}/render", json={"sound_engine": "bark"}, headers=AUTH
    )
    assert bad_engine.status_code == 400
    assert "known: fake, stable_audio_sfx" in bad_engine.json()["detail"]


def test_qa_says_so_when_the_local_asr_runtime_is_missing(tmp_path: Path) -> None:
    """The expected answer on a machine without MLX Whisper is a sentence, not a traceback."""

    store = Store(tmp_path / "db.sqlite3")
    scene = cafe_scene(tone_in_store(store.root))

    def unavailable(_path: Path) -> str:
        raise RuntimeError("Install the pinned MLX Whisper adapter before running QA")

    http = TestClient(
        app(
            store,
            acoustic_repo(tmp_path),
            token="test",
            allow_test_adapters=True,
            transcribe_fn=unavailable,
        ),
        raise_server_exceptions=False,
    )
    assert create(http, scene).status_code == 201
    assert http.post(f"/api/scenes/{scene.slug}/render", json={}, headers=AUTH).status_code == 200

    refused = http.post(f"/api/scenes/{scene.slug}/qa", json={}, headers=AUTH)
    assert refused.status_code == 409
    assert "MLX Whisper" in refused.json()["detail"]
    stored = store.get_scene_by_slug(scene.slug)
    assert stored is not None and stored[0].stage == Stage.AUDIO_GENERATED


def test_the_fake_engine_is_gated_exactly_as_the_cli_gates_it(tmp_path: Path) -> None:
    """Without the test gate, a scene cast on `fake` renders nothing and approves nothing."""

    store = Store(tmp_path / "db.sqlite3")
    scene = cafe_scene(tone_in_store(store.root))
    http = TestClient(app(store, acoustic_repo(tmp_path), token="test"))
    assert create(http, scene).status_code == 201

    refused = http.post(f"/api/scenes/{scene.slug}/render", json={}, headers=AUTH)
    assert refused.status_code == 409
    assert "cast on the fake engine" in refused.json()["detail"]


def test_the_api_checklist_is_the_one_the_html_form_certifies() -> None:
    """`api.workflow` re-declares the eight keys rather than importing them from `ui`.

    `ui.py` is the legacy HTML surface and is deleted when the desktop app reaches parity, so the
    API must not be what keeps it alive. This test is the seam that makes the duplication safe:
    the two lists are held equal today, and on the day `ui.py` goes the assertion goes with it —
    a deliberate one-line change instead of a checklist key quietly disappearing.
    """

    assert set(APPROVAL_CHECKLIST) == set(ui.APPROVAL_CHECKS)
