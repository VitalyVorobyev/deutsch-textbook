"""The headless `scene` verbs.

Every one of them has a `--json` envelope, because the caller of a studio verb is increasingly
an agent rather than a person, and a program cannot read "Created scene project 3".
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from typer.testing import CliRunner

from listening_studio.scene import cli as scene_cli
from listening_studio.scene.model import Scene
from listening_studio.scene.schema_export import SCHEMA_PATH
from listening_studio.storage import Store


REPO = Path(__file__).resolve().parents[3]
runner = CliRunner()


@pytest.fixture
def local_store(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Point the verbs at a throwaway database instead of the editor's real app-data one."""

    database = tmp_path / "studio.sqlite3"
    monkeypatch.setattr(scene_cli, "Store", lambda: Store(database))
    return database


def test_from_dialogue_writes_a_scene_and_its_attachment(tmp_path: Path) -> None:
    out = tmp_path / "scene.json"
    result = runner.invoke(
        scene_cli.app,
        [
            "from-dialogue",
            "a1/ls-erste-schritte-01",
            "--repo",
            str(REPO),
            "--out",
            str(out),
            "--json",
        ],
    )
    assert result.exit_code == 0, result.output
    payload = json.loads(result.stdout)
    assert payload["slug"] == "ls-erste-schritte-01"
    assert len(payload["files"]) == 2
    scene = Scene.model_validate_json(out.read_text())
    assert scene.sha256() == payload["payload_sha256"]
    attachment = json.loads(Path(payload["files"][1]).read_text())
    assert [question["id"] for question in attachment["questions"]] == ["q1", "q2"]


def test_from_reading_writes_a_narration_scene(tmp_path: Path) -> None:
    out = tmp_path / "reading.json"
    result = runner.invoke(
        scene_cli.app,
        ["from-reading", "a1/erste-schritte", "--repo", str(REPO), "--out", str(out), "--json"],
    )
    assert result.exit_code == 0, result.output
    scene = Scene.model_validate_json(out.read_text())
    assert scene.kind == "narration" and scene.slug == "a1-erste-schritte"


def test_validate_reports_a_sha_and_a_failure_in_the_same_shape(tmp_path: Path) -> None:
    good = tmp_path / "good.json"
    runner.invoke(
        scene_cli.app,
        ["from-reading", "a1/erste-schritte", "--repo", str(REPO), "--out", str(good)],
    )
    result = runner.invoke(scene_cli.app, ["validate", str(good), "--json"])
    assert result.exit_code == 0
    assert json.loads(result.stdout)["ok"] is True

    broken = tmp_path / "broken.json"
    payload = json.loads(good.read_text())
    payload["timeline"] = payload["timeline"][:1]
    broken.write_text(json.dumps(payload))
    failed = runner.invoke(scene_cli.app, ["validate", str(broken), "--json"])
    assert failed.exit_code == 1
    body = json.loads(failed.stdout)
    assert body["ok"] is False and body["errors"]


def test_validate_repo_warns_about_unknown_acoustic_ids_and_still_passes(
    tmp_path: Path,
) -> None:
    """A scene document is valid standalone. The catalog check is a warning, on purpose.

    Holding a published scene against a catalog it does not ship with would make it invalid on any
    machine whose `data/` is a week older than the scene. What the check is for is the other
    direction: an id that will refuse at render time should be visible while the file is being
    edited, not twenty minutes into a synthesis run.
    """

    source = tmp_path / "scene.json"
    runner.invoke(
        scene_cli.app,
        ["from-reading", "a1/erste-schritte", "--repo", str(REPO), "--out", str(source)],
    )
    payload = json.loads(source.read_text())
    payload["acoustics"]["room"] = "kitchen"
    payload["variants"] = [{"id": "hard", "preset": "brutal", "overrides": {"snr_db": 6.0}}]
    edited = tmp_path / "edited.json"
    edited.write_text(json.dumps(payload))

    # Without `--repo`, nothing is checked and nothing is reported.
    plain = runner.invoke(scene_cli.app, ["validate", str(edited), "--json"])
    assert plain.exit_code == 0
    assert json.loads(plain.stdout)["warnings"] == []

    checked = runner.invoke(
        scene_cli.app, ["validate", str(edited), "--repo", str(REPO), "--json"]
    )
    assert checked.exit_code == 0, checked.output
    warnings = json.loads(checked.stdout)["warnings"]
    assert any("kitchen" in row and "acoustic-profiles.yaml" in row for row in warnings)
    assert any("brutal" in row and "acoustic-difficulty.yaml" in row for row in warnings)
    assert any("snr_db" in row for row in warnings)


def test_validate_repo_says_nothing_about_a_scene_whose_ids_are_all_known(
    tmp_path: Path,
) -> None:
    source = tmp_path / "scene.json"
    runner.invoke(
        scene_cli.app,
        ["from-dialogue", "a1/ls-erste-schritte-01", "--repo", str(REPO), "--out", str(source)],
    )
    payload = json.loads(source.read_text())
    payload["acoustics"]["room"] = "cafe"
    payload["variants"] = [{"id": "challenging", "preset": "challenging", "overrides": {}}]
    payload["timeline"][0]["placement"] = {"pan": 0.0, "distance": 1.0, "device": "telephone"}
    edited = tmp_path / "edited.json"
    edited.write_text(json.dumps(payload))
    result = runner.invoke(
        scene_cli.app, ["validate", str(edited), "--repo", str(REPO), "--json"]
    )
    assert result.exit_code == 0, result.output
    assert json.loads(result.stdout)["warnings"] == []


def test_create_then_show_round_trips_through_the_store(
    tmp_path: Path, local_store: Path
) -> None:
    scene_file = tmp_path / "scene.json"
    runner.invoke(
        scene_cli.app,
        ["from-dialogue", "a1/ls-erste-schritte-01", "--repo", str(REPO), "--out", str(scene_file)],
    )
    exercise_file = scene_file.with_name("scene.exercise.json")
    created = runner.invoke(
        scene_cli.app,
        [
            "create",
            "--from",
            str(scene_file),
            "--exercise",
            str(exercise_file),
            "--slug",
            "ls-erste-schritte-01",
            "--json",
        ],
    )
    assert created.exit_code == 0, created.output
    envelope = json.loads(created.stdout)
    assert envelope["task"] == "scene.create"
    assert (envelope["slug"], envelope["revision"], envelope["stage"]) == (
        "ls-erste-schritte-01",
        1,
        "draft",
    )

    shown = runner.invoke(scene_cli.app, ["show", "ls-erste-schritte-01", "--json"])
    assert shown.exit_code == 0
    body = json.loads(shown.stdout)
    assert body["payload_sha256"] == envelope["payload_sha256"]
    assert body["exercise"]["max_replays"] == 3


def test_a_mismatched_slug_is_refused_rather_than_renamed(
    tmp_path: Path, local_store: Path
) -> None:
    scene_file = tmp_path / "scene.json"
    runner.invoke(
        scene_cli.app,
        ["from-reading", "a1/erste-schritte", "--repo", str(REPO), "--out", str(scene_file)],
    )
    result = runner.invoke(
        scene_cli.app, ["create", "--from", str(scene_file), "--slug", "etwas-anderes"]
    )
    assert result.exit_code != 0


def test_import_puts_the_scene_straight_into_the_store(tmp_path: Path, local_store: Path) -> None:
    result = runner.invoke(
        scene_cli.app,
        ["from-reading", "a1/erste-schritte", "--repo", str(REPO), "--import", "--json"],
    )
    assert result.exit_code == 0, result.output
    assert json.loads(result.stdout)["task"] == "scene.create"
    assert Store(local_store).get_scene_by_slug("a1-erste-schritte") is not None


def test_schema_check_passes_against_the_committed_contract() -> None:
    result = runner.invoke(scene_cli.app, ["schema", "--check", "--repo", str(REPO)])
    assert result.exit_code == 0, result.output


def test_schema_check_fails_when_the_committed_contract_is_stale(tmp_path: Path) -> None:
    """Watched to fail once: a tripwire nobody has seen trip is a tripwire nobody has tested."""

    stale = tmp_path / SCHEMA_PATH
    stale.parent.mkdir(parents=True, exist_ok=True)
    stale.write_text('{"$schema": "wrong"}\n')
    result = runner.invoke(scene_cli.app, ["schema", "--check", "--repo", str(tmp_path)])
    assert result.exit_code == 1

    written = runner.invoke(scene_cli.app, ["schema", "--repo", str(tmp_path)])
    assert written.exit_code == 0
    assert stale.read_text() == (REPO / SCHEMA_PATH).read_text()
