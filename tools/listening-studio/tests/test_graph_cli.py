"""`scene render` and `scene qa` — the two headless verbs, and the gates around them.

The `--json` envelope is what an agent reads, so its shape is asserted rather than described.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest
from typer.testing import CliRunner

from listening_studio.domain import Stage
from listening_studio.scene import cli as scene_cli
from listening_studio.storage import Store
from test_graph_render import cafe_scene, narration_scene, tone_in_store

# The terminal is pinned, because the CI runner's is not ours: on GitHub Actions rich rendered
# the same BadParameter in color at 80 columns, which wrapped `test-adapter` across a box border
# and put escape codes inside every substring these tests assert on. Width and color are inputs
# to the text under test, so the tests state them.
runner = CliRunner(env={"NO_COLOR": "1", "TERM": "dumb", "COLUMNS": "200"})

ANSI = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")


def flat(output: str) -> str:
    """Typer boxes a `BadParameter` and hard-wraps it, splitting sentences across `│` borders.

    Asserting on a message therefore needs the escape codes, the borders and the wrapping
    removed first, or the test is really asserting on the terminal the runner happened to pick.
    """

    plain = ANSI.sub("", output)
    return " ".join(plain.replace("│", " ").replace("╭", " ").replace("╰", " ").split())


@pytest.fixture
def studio(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Store:
    """A throwaway store whose `root` is also the asset store and the render directory."""

    store = Store(tmp_path / "studio.sqlite3")
    monkeypatch.setattr(scene_cli, "Store", lambda: store)
    return store


def seeded(store: Store):  # type: ignore[no-untyped-def]
    scene = cafe_scene(tone_in_store(store.root))
    store.create_scene(scene)
    return scene


def test_render_emits_the_envelope_and_records_audio_generated(studio: Store) -> None:
    scene = seeded(studio)
    result = runner.invoke(
        scene_cli.app, ["render", scene.slug, "--test-adapter", "--engine", "fake", "--json"]
    )
    assert result.exit_code == 0, result.output
    payload = json.loads(result.stdout)
    assert payload["task"] == "scene.render"
    assert (payload["slug"], payload["revision"], payload["stage"]) == (
        scene.slug,
        1,
        str(Stage.AUDIO_GENERATED),
    )
    assert payload["payload_sha256"] == scene.sha256()
    assert payload["nodes_evaluated"] > 0 and payload["nodes_cached"] == 0
    kinds = {row["kind"] for row in payload["artifacts"]}
    assert {"master", "qa", "publish", "dry", "stem"} == kinds
    assert all(Path(row["path"]).exists() for row in payload["artifacts"])
    assert all(len(row["sha256"]) == 64 for row in payload["artifacts"])


def test_a_second_render_is_all_cache_and_leaves_the_stage_alone(studio: Store) -> None:
    scene = seeded(studio)
    args = ["render", scene.slug, "--test-adapter", "--engine", "fake", "--json"]
    runner.invoke(scene_cli.app, args)
    again = runner.invoke(scene_cli.app, args)
    assert again.exit_code == 0, again.output
    payload = json.loads(again.stdout)
    assert payload["nodes_evaluated"] == 0
    assert payload["stage"] == str(Stage.AUDIO_GENERATED)


def test_the_fake_engine_needs_the_test_adapter_flag(studio: Store) -> None:
    """The gate the dialogue and reading verbs already carry, on the scene verbs too."""

    scene = seeded(studio)
    result = runner.invoke(scene_cli.app, ["render", scene.slug, "--engine", "fake"])
    assert result.exit_code != 0
    assert "test-adapter" in flat(result.output)


def test_a_scene_cast_on_the_fake_engine_needs_it_too(studio: Store) -> None:
    """The cast can name `fake` without anyone passing `--engine`; that is the same request."""

    scene = seeded(studio)
    result = runner.invoke(scene_cli.app, ["render", scene.slug])
    assert result.exit_code != 0
    assert "cast on the fake engine" in flat(result.output)


def test_an_unknown_engine_is_refused_by_name(studio: Store) -> None:
    scene = seeded(studio)
    result = runner.invoke(scene_cli.app, ["render", scene.slug, "--engine", "elevenlabs"])
    assert result.exit_code != 0 and "unknown engine elevenlabs" in flat(result.output)


def test_render_refuses_a_slug_that_is_not_stored(studio: Store) -> None:
    result = runner.invoke(scene_cli.app, ["render", "nichts-da", "--test-adapter"])
    assert result.exit_code != 0 and "no scene project nichts-da" in flat(result.output)


def test_qa_refuses_a_scene_that_was_never_rendered(studio: Store) -> None:
    scene = seeded(studio)
    result = runner.invoke(scene_cli.app, ["qa", scene.slug])
    assert result.exit_code != 0
    assert "run `scene render` first" in flat(result.output)


def test_qa_stores_its_report_and_advances_the_stage(
    studio: Store, monkeypatch: pytest.MonkeyPatch
) -> None:
    scene = seeded(studio)
    runner.invoke(
        scene_cli.app, ["render", scene.slug, "--test-adapter", "--engine", "fake", "--json"]
    )
    spoken = {utterance.id: utterance.spoken_text() for utterance in scene.script}

    def transcribe(path: Path) -> str:
        if path.name == "qa.wav":
            return " ".join(spoken[utterance.id] for utterance in scene.script)
        return spoken[path.stem]

    # Patched where the verb imports it from, because the import is inside the command body.
    monkeypatch.setattr("listening_studio.adapters.transcribe", transcribe)
    monkeypatch.setattr("listening_studio.graph.scene_qa.weights_available", lambda: False)
    result = runner.invoke(scene_cli.app, ["qa", scene.slug, "--json"])
    assert result.exit_code == 0, result.output
    payload = json.loads(result.stdout)
    assert payload["task"] == "scene.qa"
    assert payload["passed"] is True
    assert payload["stage"] == str(Stage.AUTOMATICALLY_CHECKED)
    assert payload["qa"]["speaker_qa"] == "weights-missing"
    assert {row["kind"] for row in payload["artifacts"]} >= {"master", "qa", "publish"}

    project, revision, _scene, _exercise = studio.get_scene_by_slug(scene.slug)  # type: ignore[misc]
    assert project.stage == Stage.AUTOMATICALLY_CHECKED
    assert json.loads(revision.qa_json or "{}")["passed"] is True


def test_qa_fails_fast_when_the_local_asr_runtime_is_absent(
    studio: Store, monkeypatch: pytest.MonkeyPatch
) -> None:
    """In CI there is no MLX Whisper, and the verb must say that rather than raise."""

    scene = seeded(studio)
    runner.invoke(
        scene_cli.app, ["render", scene.slug, "--test-adapter", "--engine", "fake", "--json"]
    )

    def absent(path: Path) -> str:
        raise RuntimeError("Install the pinned MLX Whisper adapter before running QA")

    monkeypatch.setattr("listening_studio.adapters.transcribe", absent)
    result = runner.invoke(scene_cli.app, ["qa", scene.slug])
    assert result.exit_code == 1
    assert "scene qa needs the local ASR runtime" in flat(result.output)


def test_a_narration_scene_renders_through_the_same_verb(studio: Store) -> None:
    """A converted Lesetext is cast on `qwen_tts`; `--engine fake` is what lets CI render it."""

    scene = narration_scene()
    studio.create_scene(scene)
    result = runner.invoke(
        scene_cli.app, ["render", scene.slug, "--test-adapter", "--engine", "fake", "--json"]
    )
    assert result.exit_code == 0, result.output
    payload = json.loads(result.stdout)
    stems = sorted(
        Path(row["path"]).stem for row in payload["artifacts"] if row["kind"] == "stem"
    )
    assert stems == ["p1", "p2", "p3"]
