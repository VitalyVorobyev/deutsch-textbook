"""`atlas-listening voices …`: the shell half of the consent capability.

Parity with `/api/voices` is the property, and it is not cosmetic. An agent working this repository
has a shell and no browser, so a capability reachable only through Tonwerk is a capability half the
operators of this studio cannot use — and the half that cannot use it is the half that writes the
content.

Every test runs on `fake_clone` and touches no model.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from listening_studio.cli import app
from listening_studio.generative.voices import reference_path, sha256_bytes
from listening_studio.storage import Store

from conftest import RUNNER, flat

REFERENCE = b"RIFF....WAVEfake reference audio bytes"
#: The course repository, which is where the character roster the demo phrases come from lives.
REPO = Path(__file__).resolve().parents[3]


def consent_file(tmp_path: Path, **overrides: object) -> Path:
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
    path = tmp_path / "consent.json"
    path.write_text(json.dumps(document, ensure_ascii=False))
    return path


@pytest.fixture
def studio(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """A store rooted in the temp directory, so `voices/` never lands in a real app-data."""

    root = tmp_path / "app-data"
    root.mkdir()
    monkeypatch.setattr("listening_studio.storage.app_dir", lambda: root)
    return root


def create(tmp_path: Path, *args: str) -> object:
    reference = tmp_path / "reference.wav"
    reference.write_bytes(REFERENCE)
    return RUNNER.invoke(
        app,
        [
            "voices", "create", "testperson",
            "--reference", str(reference),
            "--consent", str(consent_file(tmp_path)),
            "--ref-text", "Guten Tag, ich lese diesen Satz als Referenz.",
            "--engine", "fake_clone",
            *args,
        ],
    )


def test_create_list_demo_revoke_mirror_the_api(studio: Path, tmp_path: Path) -> None:
    created = create(tmp_path, "--json")
    assert created.exit_code == 0, created.output
    voice = json.loads(created.output)["voice"]
    assert voice["scope"] == "publication"
    assert voice["reference_sha256"] == sha256_bytes(REFERENCE)

    listed = RUNNER.invoke(app, ["voices", "list", "--json"])
    assert listed.exit_code == 0
    assert [row["id"] for row in json.loads(listed.output)["voices"]] == ["testperson"]

    demo = RUNNER.invoke(app, ["voices", "demo", "testperson", "--repo", str(REPO), "--json"])
    assert demo.exit_code == 0, demo.output
    rendered = json.loads(demo.output)
    assert len(rendered["phrases"]) == 3
    assert rendered["status"] == "pending-human-review"

    revoked = RUNNER.invoke(app, ["voices", "revoke", "testperson", "--json"])
    assert revoked.exit_code == 0
    record = json.loads(revoked.output)
    assert record["reference_deleted"] is True
    assert record["demos_deleted"] == 3

    store = Store()
    row = store.get_voice("testperson")
    assert row is not None and row.revoked_at is not None
    assert not reference_path(store.root, row.reference_sha256).exists()

    again = RUNNER.invoke(app, ["voices", "demo", "testperson", "--repo", str(REPO)])
    assert again.exit_code != 0
    assert "revoked" in flat(again.output)


def test_a_consent_violation_names_its_rule_on_the_command_line_too(
    studio: Path, tmp_path: Path
) -> None:
    reference = tmp_path / "reference.wav"
    reference.write_bytes(REFERENCE)
    consent = consent_file(tmp_path, permitted_uses=[])
    refused = RUNNER.invoke(
        app,
        [
            "voices", "create", "testperson",
            "--reference", str(reference),
            "--consent", str(consent),
            "--engine", "fake_clone",
        ],
    )
    assert refused.exit_code != 0
    assert "publication-permits-course" in flat(refused.output)
    assert Store().get_voice("testperson") is None


def test_an_engine_without_the_capability_is_refused_by_name(studio: Path, tmp_path: Path) -> None:
    reference = tmp_path / "reference.wav"
    reference.write_bytes(REFERENCE)
    refused = RUNNER.invoke(
        app,
        [
            "voices", "create", "testperson",
            "--reference", str(reference),
            "--consent", str(consent_file(tmp_path)),
            "--engine", "qwen_tts",
        ],
    )
    assert refused.exit_code != 0
    assert "no cloning capability" in flat(refused.output)


def test_an_empty_list_says_what_to_do_rather_than_nothing(studio: Path) -> None:
    listed = RUNNER.invoke(app, ["voices", "list"])
    assert listed.exit_code == 0
    assert "atlas-listening voices create" in flat(listed.output)
