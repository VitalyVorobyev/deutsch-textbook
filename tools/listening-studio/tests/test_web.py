import hashlib
import json
from pathlib import Path

import yaml

from fastapi.testclient import TestClient

from listening_studio.domain import Stage
from listening_studio.storage import Store
from listening_studio.web import app
from test_domain import payload


def test_local_workflow_reaches_checked_but_needs_real_approval(tmp_path: Path) -> None:
    store = Store(tmp_path / "db.sqlite3")
    draft = payload().model_copy(update={"tts_adapter": "fake"})
    project = store.create("workflow", draft)
    client = TestClient(app(store, tmp_path, token="test", allow_test_adapters=True))
    headers = {"origin": "http://127.0.0.1:8765"}
    for action in ["validate", "generate", "qa"]:
        response = client.post(
            f"/projects/{project.id}/{action}?token=test", headers=headers, follow_redirects=False
        )
        assert response.status_code == 303
    current, revision, _ = store.get(project.id)
    assert current.stage == Stage.AUTOMATICALLY_CHECKED
    assert revision.approval_json is None


def test_qwen_failure_creates_reviewable_parler_draft(tmp_path: Path, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    store = Store(tmp_path / "db.sqlite3")
    draft = payload().model_copy(update={"tts_adapter": "qwen_tts"})
    project = store.create("fallback", draft)
    store.transition(project.id, Stage.DRAFT, Stage.VALIDATED)

    def fail(*_args, **_kwargs) -> None:  # type: ignore[no-untyped-def]
        raise RuntimeError("MPS generated invalid probabilities")

    monkeypatch.setattr("listening_studio.web.generate_lines", fail)
    client = TestClient(app(store, tmp_path, token="test"))
    response = client.post(f"/projects/{project.id}/generate?token=test")
    assert response.status_code == 409
    current, _, revised = store.get(project.id)
    assert current.stage == Stage.DRAFT
    assert revised.tts_adapter == "parler_tts"
    assert {line.voice for line in revised.lines} <= {"Nicole", "Christopher", "Megan", "Michelle"}
    assert list((tmp_path / "projects" / str(project.id)).glob("qwen-failure-*.json"))


def write_plan(repo: Path, wave_one: list[str]) -> None:
    """A minimal listening plan. The fixture must state it, because the assertion depends on it.

    The old version of the test below asserted nothing about the plan and still passed against
    a page that selected Wave 1 by `2 <= project.id <= 13`: the two projects it created just
    happened to land on ids 1 and 2. A fixture that does not state what its assertion depends
    on protects the defect instead of catching it.
    """

    plan = {
        "version": 1,
        "units": [
            {
                "unit": "erste-schritte",
                "level": "A1",
                "artifacts": [{"id": slug, "wave": 1} for slug in wave_one]
                + [{"id": "ls-not-planned-01", "wave": 2}],
            }
        ],
    }
    (repo / "data").mkdir(parents=True, exist_ok=True)
    (repo / "data" / "listening-plan.yaml").write_text(yaml.safe_dump(plan))


def test_wave_one_review_selects_by_plan_slug_not_database_id(tmp_path: Path) -> None:
    store = Store(tmp_path / "db.sqlite3")
    # Created FIRST, so it takes the low id the old window would have included.
    store.create("not-in-wave", payload())
    project = store.create("ls-review-01", payload().model_copy(update={"tts_adapter": "fake"}))
    write_plan(tmp_path, ["ls-review-01"])
    client = TestClient(app(store, tmp_path, token="test", allow_test_adapters=True))
    for action in ["validate", "generate", "qa"]:
        assert client.post(f"/projects/{project.id}/{action}?token=test").status_code == 200

    response = client.get("/corpus/wave-1?token=test")
    assert response.status_code == 200
    assert "ls-review-01" in response.text
    assert "not-in-wave" not in response.text
    assert "ls-not-planned-01" not in response.text
    assert "Automatic QA passed" in response.text
    assert "Transcript" in response.text


def test_wave_one_review_names_a_planned_recording_with_no_project(tmp_path: Path) -> None:
    store = Store(tmp_path / "db.sqlite3")
    write_plan(tmp_path, ["ls-never-seeded-01"])
    client = TestClient(app(store, tmp_path, token="test"))
    response = client.get("/corpus/wave-1?token=test")
    assert "ls-never-seeded-01" in response.text
    assert "seed-wave" in response.text


def test_health_does_not_hand_out_a_session_cookie(tmp_path: Path) -> None:
    """/health is token-exempt so a supervisor can poll it; that must not be a way in.

    Every response used to carry the session cookie, so any client could GET /health, keep the
    cookie it was given, and reach every mutation endpoint without ever knowing the token.
    """

    store = Store(tmp_path / "db.sqlite3")
    project = store.create("guarded", payload())
    client = TestClient(app(store, tmp_path, token="test"), raise_server_exceptions=False)

    health = client.get("/health")
    assert health.status_code == 200
    assert "atlas_studio" not in health.cookies
    assert client.cookies.get("atlas_studio") is None

    denied = client.post(f"/projects/{project.id}/validate")
    assert denied.status_code == 403

    allowed = client.get(f"/projects/{project.id}?token=test")
    assert allowed.status_code == 200
    assert client.cookies.get("atlas_studio") == "test"


def test_approval_records_the_hashes_of_the_audio_reviewed(tmp_path: Path) -> None:
    """Approval must name the exact bytes, or a later regeneration inherits it silently."""

    store = Store(tmp_path / "db.sqlite3")
    project = store.create("approved", payload().model_copy(update={"tts_adapter": "fake"}))
    client = TestClient(app(store, tmp_path, token="test", allow_test_adapters=True))
    for action in ["validate", "generate", "qa"]:
        assert client.post(f"/projects/{project.id}/{action}?token=test").status_code == 200

    checks = {c: "on" for c in ["accent", "naturalness", "intelligibility", "speakers", "pace", "questions"]}
    confirmed = client.post(
        f"/projects/{project.id}/approve/confirm?token=test",
        data={"editor": "Vitaly", **checks},
        follow_redirects=False,
    )
    assert confirmed.status_code == 303

    _, revision, _ = store.get(project.id)
    approval = json.loads(revision.approval_json or "{}")
    final = tmp_path / "projects" / str(project.id) / "final.wav"
    assert approval["audio_sha256"] == hashlib.sha256(final.read_bytes()).hexdigest()
    assert approval["dry_audio_sha256"]
