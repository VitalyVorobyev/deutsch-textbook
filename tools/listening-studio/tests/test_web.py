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
                "artifacts": [
                    {"id": slug, "wave": 1, "scenario": f"Szenario {slug}"} for slug in wave_one
                ]
                + [{"id": "ls-not-planned-01", "wave": 2, "scenario": "Szenario zwei"}],
            }
        ],
    }
    (repo / "data").mkdir(parents=True, exist_ok=True)
    (repo / "data" / "listening-plan.yaml").write_text(yaml.safe_dump(plan))


def test_the_index_lists_every_planned_recording_by_slug(tmp_path: Path) -> None:
    store = Store(tmp_path / "db.sqlite3")
    # Created FIRST, so it takes the low id the old window would have included.
    store.create("not-in-wave", payload())
    project = store.create("ls-review-01", payload().model_copy(update={"tts_adapter": "fake"}))
    write_plan(tmp_path, ["ls-review-01"])
    client = TestClient(app(store, tmp_path, token="test", allow_test_adapters=True))
    for action in ["validate", "generate", "qa"]:
        assert client.post(f"/projects/{project.id}/{action}?token=test").status_code == 200

    response = client.get("/?token=test")
    assert response.status_code == 200
    # Every planned recording appears — wave 1 and wave 2 alike — because the index is the
    # whole corpus, and selection is by plan slug rather than by database id.
    assert "ls-review-01" in response.text
    assert "ls-not-planned-01" in response.text
    # A project that is not in the plan is not production work and is not listed.
    assert "not-in-wave" not in response.text


def test_the_index_names_a_planned_recording_with_no_project(tmp_path: Path) -> None:
    store = Store(tmp_path / "db.sqlite3")
    write_plan(tmp_path, ["ls-never-seeded-01"])
    client = TestClient(app(store, tmp_path, token="test"))
    response = client.get("/?token=test")
    assert "ls-never-seeded-01" in response.text
    assert "geplant" in response.text


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


def test_an_unavailable_step_answers_409_with_the_next_one_named(tmp_path: Path) -> None:
    """Every button that is not the legal next step used to answer a 500 traceback.

    A project sits at `automatically_checked` for the whole of its review — which is most of
    its life — and Validate, Generate and QA all raise there. `Store.transition` raises a bare
    ValueError and nothing caught it, so the editor saw a stack trace instead of being told
    where the project was and what came next.
    """

    store = Store(tmp_path / "db.sqlite3")
    project = store.create("stuck", payload().model_copy(update={"tts_adapter": "fake"}))
    client = TestClient(app(store, tmp_path, token="test", allow_test_adapters=True))
    for action in ["validate", "generate", "qa"]:
        assert client.post(f"/projects/{project.id}/{action}?token=test").status_code == 200

    repeated = client.post(f"/projects/{project.id}/validate?token=test")
    assert repeated.status_code == 409
    assert "automatically_checked" in repeated.text
    assert "human_approved" in repeated.text
    assert "Traceback" not in repeated.text


def test_switching_the_synthesis_model_through_the_form_keeps_the_project_loadable(
    tmp_path: Path,
) -> None:
    """P22-3, end to end: the form used to store a payload `Store.get()` then refused, which put
    the project permanently out of reach — and switching Parler → Qwen is move one of any
    voice-quality pass."""

    store = Store(tmp_path / "db.sqlite3")
    base = payload()
    draft = base.model_copy(
        update={
            "tts_adapter": "parler_tts",
            "lines": [
                base.lines[0].model_copy(update={"voice": "Nicole"}),
                base.lines[1].model_copy(update={"voice": "Christopher"}),
            ],
        }
    )
    project = store.create("switch", draft)
    client = TestClient(app(store, tmp_path, token="test", allow_test_adapters=True))
    headers = {"origin": "http://127.0.0.1:8765"}

    form = {"adapter": "qwen_tts", "max_replays": "2"}
    for index, line in enumerate(draft.lines):
        form |= {
            f"line.{index}.speaker": line.speaker,
            f"line.{index}.text": line.display_text,
            f"line.{index}.voice": line.voice,  # still the Parler voices — the form has no others
            f"line.{index}.pace": str(line.pace),
            f"line.{index}.pause": str(line.pause_after_ms),
            f"line.{index}.seed": str(line.seed),
        }
    saved = client.post(
        f"/projects/{project.id}/script?token=test", data=form, headers=headers, follow_redirects=False
    )
    assert saved.status_code == 303

    _, _, stored = store.get(project.id)  # the assertion: this used to raise
    assert stored.tts_adapter == "qwen_tts"
    assert len({line.voice for line in stored.lines}) == 2
    assert client.get(f"/projects/{project.id}?token=test", headers=headers).status_code == 200


def test_the_approval_page_shows_what_it_asks_the_editor_to_certify(tmp_path: Path) -> None:
    """The form used to be six English words and a name box — no audio, no questions, no QA.

    It also rendered unstyled, because `web.py` carried a local `page()` that returned the body
    verbatim and shadowed `ui.page`; the approval route was its only caller, so the one page
    nobody had built was also the one page with no stylesheet. Both are the same defect: a
    checklist that shows nothing it asks about is a rubber stamp, and the published manifest
    states that a named human vouched for exactly these six things.
    """

    store = Store(tmp_path / "db.sqlite3")
    project = store.create("ls-review-01", payload().model_copy(update={"tts_adapter": "fake"}))
    plan = {
        "version": 1,
        "units": [
            {
                "unit": "termine-vereinbaren",
                "level": "A2",
                "artifacts": [
                    {
                        "id": "ls-review-01",
                        "wave": 1,
                        "scenario": "Termin",
                        "duration_seconds": {"min": 40, "max": 50},
                    }
                ],
            }
        ],
    }
    (tmp_path / "data").mkdir(parents=True, exist_ok=True)
    (tmp_path / "data" / "listening-plan.yaml").write_text(yaml.safe_dump(plan))

    client = TestClient(app(store, tmp_path, token="test", allow_test_adapters=True))
    for action in ["validate", "generate", "qa"]:
        assert client.post(f"/projects/{project.id}/{action}?token=test").status_code == 200

    page = client.get(f"/projects/{project.id}/approve?token=test")
    assert page.status_code == 200
    body = page.text

    # A whole document, not a fragment: this is what the shadowed `page()` was swallowing.
    assert body.startswith("<!doctype html>")
    assert "<style>" in body and "Listening Studio</h1>" in body

    # The audio itself, and the speech-only take beside it.
    assert f"/projects/{project.id}/audio" in body

    # The questions as the learner meets them, with the key marked — `questions` is uncheckable
    # without them, and every drafted Wave-1 question turned out to be about another script.
    assert "Wann?" in body and "Freitag" in body and "✓" in body

    # The script, present but collapsed: reading along is how you hear words nobody said.
    assert "<details>" in body and "Der Termin ist am Freitag." in body

    # What the machine already checked, so the human is not asked to redo it.
    assert "Automatische Prüfung" in body

    # Full sentences, not bare keys — and the level is named in the two checks that depend on it.
    assert "Es klingt nach einer sprechenden Person" in body
    assert "Auf A2 ist jedes Wort heraushörbar" in body
    for key in ["accent", "naturalness", "intelligibility", "speakers", "pace", "questions"]:
        assert f"name={key} " in body, key
    # No context sound in this payload, so nothing is certified about one.
    assert "name=context " not in body

    # The measured length against the window the curriculum asked for. The fake adapter's take is
    # nowhere near 40-50 s, so this is the failing branch — which is the one that has to be legible.
    assert "Plan 40–50 s" in body
    assert "class=fail>Dauer" in body

    # Declining is a step, not closing the tab.
    assert f"/projects/{project.id}/regenerate" in body
