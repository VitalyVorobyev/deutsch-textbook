"""`voices adopt-designed`: an evaluation run's designed references become the roster's voices.

The run directory, the catalog and the app-data root are fixtures built here, so every assertion
states its own inputs and nothing is written outside `tmp_path`.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

import pytest
import yaml

import listening_studio.cli as cli_module
from listening_studio.adoption import (
    ADOPTED_CANDIDATE,
    adopt_designed,
    baseline_words_per_second,
    pace_for,
)
from listening_studio.catalogs import load_character_catalog
from listening_studio.generative.designed import designed_path, load_designed
from listening_studio.generative.qwen_designed import QwenDesignedClone
from listening_studio.storage import Store
from conftest import RUNNER, flat

PACKAGE_ROOT = Path(__file__).resolve().parents[1]
LOCK = json.loads((PACKAGE_ROOT / "models.lock.json").read_text())["models"]

CATALOG = """version: 1
characters:
  - id: lena
    version: 1
    display_name: Lena
    age_band: young-adult
    persona: "Warm."
    registers: [informal]
    roles: [friend]
    casting_tags: [warm]
    narration_capable: true
    incompatible_with: []
    status: draft-profile
    demo_phrases: ["Eins.", "Zwei.", "Drei."]
    voice_profile: {voice: Vivian, seed: 100, style: "Sprich warm.", pace: 0.96}
  # Paul stays after Lena; this comment and the order survive the edit.
  - id: paul
    version: 3
    display_name: Paul
    age_band: adult
    persona: "Ruhig."
    registers: [neutral]
    roles: [colleague]
    casting_tags: [calm]
    narration_capable: false
    incompatible_with: []
    status: draft-profile
    demo_phrases: ["Eins.", "Zwei.", "Drei."]
    voice_profile: {voice: Ryan, seed: 205, style: "Sprich ruhig.", pace: 1.0}
"""


def make_run(root: Path, *, clone_revision: str = QwenDesignedClone.revision) -> Path:
    """An evaluation run as `evaluate voices` writes one, reduced to what adoption reads."""

    run = root / "evaluations" / "voices-fixture"
    (run / "references").mkdir(parents=True)
    references: dict[str, Any] = {}
    takes: list[dict[str, Any]] = []
    rates = {"lena": [3.3, 3.4, 3.5], "paul": [2.5, 2.6, 2.7]}
    for name, seed in (("lena", 100), ("paul", 205)):
        raw = run / "references" / f"{name}.seed{seed}.model.wav"
        raw.write_bytes(f"model output for {name}".encode())
        conformed = raw.with_name(f"{name}.seed{seed}.wav")
        conformed.write_bytes(f"conformed for {name}".encode())
        references[name] = {
            "origin": "voice-design",
            "instruct": f"Eine erfundene Person namens {name}.",
            "accepted": True,
            "path": str(conformed.relative_to(run)),
            "model_path": str(raw.relative_to(run)),
            "attempts": [
                {
                    "seed": seed,
                    "model_sha256": hashlib.sha256(raw.read_bytes()).hexdigest(),
                    "sha256": hashlib.sha256(conformed.read_bytes()).hexdigest(),
                    "transcript": "Hallo.",
                    "wer": 0.0,
                    "passed": True,
                }
            ],
        }
        for rate in rates[name]:
            takes.append(
                {"candidate": ADOPTED_CANDIDATE, "character": name, "words_per_second": rate}
            )
        # The production voice's rate is the default target: 2.96 here, so the paces below are
        # the arithmetic of `pace_for` against it.
        takes.append({"candidate": "preset-0.6b", "character": name, "words_per_second": 2.96})
    manifest = {
        "kind": "voice-evaluation",
        "run": run.name,
        "candidates": [
            {"id": "preset-0.6b", "lock_key": "qwen_tts"},
            {"id": ADOPTED_CANDIDATE, "lock_key": "qwen_tts_base_1_7b"},
        ],
        "models": {
            "qwen_tts_base_1_7b": {"id": QwenDesignedClone.model_id, "revision": clone_revision},
            "qwen_tts_voice_design": {
                "id": LOCK["qwen_tts_voice_design"]["id"],
                "revision": LOCK["qwen_tts_voice_design"]["revision"],
            },
        },
        "designs": {"reference_text": "Hallo, schön, dass Sie da sind.", "references": references},
        "characters": [{"id": "lena", "pace": 0.96}, {"id": "paul", "pace": 1.0}],
        "takes": takes,
    }
    (run / "run.json").write_text(json.dumps(manifest))
    return run


@pytest.fixture
def setup(tmp_path: Path) -> tuple[Path, Path, Path]:
    repo = tmp_path / "repo"
    (repo / "data").mkdir(parents=True)
    (repo / "data" / "listening-characters.yaml").write_text(CATALOG)
    studio = tmp_path / "studio"
    return repo, studio, make_run(studio)


def test_pace_corrects_for_the_pace_the_run_measured_at() -> None:
    # Measured 3.4 w/s at 0.96: the raw rate is 3.4 / 0.96, and 2.96 needs 2.96 * 0.96 / 3.4.
    assert pace_for(3.4, 0.96, 2.96) == round(2.96 * 0.96 / 3.4, 2) == 0.84
    assert pace_for(9.0, 1.0, 2.96) == 0.7
    assert pace_for(1.0, 1.0, 2.96) == 1.15


def test_the_default_target_is_the_production_voices_median() -> None:
    # What learners hear today, measured by the same rule on the same lines: the clones are paced
    # to it, not to a figure carried in from somewhere else.
    run = {
        "takes": [
            {"candidate": "preset-0.6b", "words_per_second": rate} for rate in (2.5, 2.9, 3.1)
        ]
        + [{"candidate": ADOPTED_CANDIDATE, "words_per_second": 9.0}]
    }
    assert baseline_words_per_second(run) == 2.9
    with pytest.raises(ValueError, match="preset-0.6b"):
        baseline_words_per_second({"takes": []})


def test_adoption_stores_every_reference_and_rewrites_the_catalog(
    setup: tuple[Path, Path, Path],
) -> None:
    repo, studio, run = setup
    adopted = adopt_designed(run, studio, repo)
    assert [row.character for row in adopted] == ["lena", "paul"]
    lena, paul = adopted
    assert (lena.pace, paul.pace) == (0.84, 1.14)
    assert (lena.version, paul.version) == (2, 4)
    # The reference stored is the raw model output the clones were conditioned on.
    raw = (run / "references" / "lena.seed100.model.wav").read_bytes()
    assert lena.reference_sha256 == hashlib.sha256(raw).hexdigest()
    assert designed_path(studio, lena.reference_sha256).read_bytes() == raw
    voice = load_designed(studio, lena.reference_sha256)
    assert voice.record["source_run"] == "voices-fixture"
    assert voice.record["clone_model"]["revision"] == QwenDesignedClone.revision
    assert voice.record["seed"] == 100 and voice.record["synthetic"] is True

    text = (repo / "data" / "listening-characters.yaml").read_text()
    assert "# Paul stays after Lena; this comment and the order survive the edit." in text
    assert (
        f"    voice_profile: {{engine: qwen_tts_designed, voice: {lena.reference_sha256}, "
        "seed: 100, style: null, pace: 0.84}"
    ) in text
    catalog = load_character_catalog(repo)
    assert [row.id for row in catalog.characters] == ["lena", "paul"]
    profile = catalog.characters[1].voice_profile
    assert (profile.engine, profile.seed, profile.style, profile.pace) == (
        "qwen_tts_designed",
        205,
        None,
        1.14,
    )
    assert yaml.safe_load(text)["characters"][0]["version"] == 2


def test_adopting_the_same_run_twice_changes_nothing(setup: tuple[Path, Path, Path]) -> None:
    repo, studio, run = setup
    adopt_designed(run, studio, repo)
    catalog = (repo / "data" / "listening-characters.yaml").read_bytes()
    again = adopt_designed(run, studio, repo)
    assert not any(row.catalog_changed or row.reference_written for row in again)
    assert [row.version for row in again] == [2, 4]
    assert (repo / "data" / "listening-characters.yaml").read_bytes() == catalog


def test_a_run_whose_reference_changed_adopts_nothing(setup: tuple[Path, Path, Path]) -> None:
    repo, studio, run = setup
    (run / "references" / "paul.seed205.model.wav").write_bytes(b"other bytes")
    with pytest.raises(ValueError, match="no longer hashes"):
        adopt_designed(run, studio, repo)
    assert (repo / "data" / "listening-characters.yaml").read_text() == CATALOG
    assert not (studio / "voices").exists()


def test_a_run_on_another_clone_checkpoint_is_refused(tmp_path: Path) -> None:
    repo = tmp_path / "repo"
    (repo / "data").mkdir(parents=True)
    (repo / "data" / "listening-characters.yaml").write_text(CATALOG)
    run = make_run(tmp_path / "studio", clone_revision="0" * 40)
    with pytest.raises(ValueError, match="not on the production checkpoint"):
        adopt_designed(run, tmp_path / "studio", repo)


def test_app_data_inside_the_repository_is_refused(setup: tuple[Path, Path, Path]) -> None:
    repo, _studio, run = setup
    with pytest.raises(ValueError, match="never written into the repository"):
        adopt_designed(run, repo / ".studio", repo)
    assert not (repo / ".studio").exists()


def test_the_verb_reports_each_voice(
    setup: tuple[Path, Path, Path], monkeypatch: pytest.MonkeyPatch
) -> None:
    repo, studio, _run = setup
    monkeypatch.setattr(cli_module, "Store", lambda: Store(studio / "studio.sqlite3"))
    result = RUNNER.invoke(
        cli_module.app, ["voices", "adopt-designed", "voices-fixture", "--repo", str(repo), "--json"]
    )
    assert result.exit_code == 0, result.output
    payload = json.loads(result.stdout)
    assert payload["task"] == "voices.adopt-designed"
    assert [row["pace"] for row in payload["voices"]] == [0.84, 1.14]
    missing = RUNNER.invoke(
        cli_module.app, ["voices", "adopt-designed", "voices-nope", "--repo", str(repo)]
    )
    assert missing.exit_code != 0
    assert "holds no evaluation run" in flat(missing.output)
