from pathlib import Path

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


def test_wave_one_review_collects_audio_and_qa(tmp_path: Path) -> None:
    store = Store(tmp_path / "db.sqlite3")
    store.create("not-in-wave", payload())
    project = store.create("ls-review-01", payload().model_copy(update={"tts_adapter": "fake"}))
    client = TestClient(app(store, tmp_path, token="test", allow_test_adapters=True))
    for action in ["validate", "generate", "qa"]:
        response = client.post(f"/projects/{project.id}/{action}?token=test")
        assert response.status_code == 200

    response = client.get("/corpus/wave-1?token=test")
    assert response.status_code == 200
    assert "ls-review-01" in response.text
    assert "Automatic QA passed" in response.text
    assert "Transcript" in response.text
