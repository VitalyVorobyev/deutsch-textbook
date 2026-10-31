"""The voice evaluation runner: its workspace boundary, its manifest, and its blind key."""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import numpy as np
import numpy.typing as npt
import pytest
import soundfile as sf
from pydantic import ValidationError

from listening_studio.catalogs import CharacterCatalog, load_character_catalog
from listening_studio.evaluation import (
    CANDIDATES,
    DESIGN_LOCK_KEY,
    VoiceDesigns,
    load_designs,
    reveal,
    run_voice_evaluation,
)
from listening_studio.generative.registry import ENGINES

PACKAGE_ROOT = Path(__file__).resolve().parents[1]
REPO = PACKAGE_ROOT.parents[2]
LOCK = json.loads((PACKAGE_ROOT / "models.lock.json").read_text())["models"]
RATE = 16_000


def character(id_: str, voice: str, seed: int) -> dict[str, object]:
    return {
        "id": id_,
        "version": 1,
        "display_name": id_.title(),
        "age_band": "adult",
        "persona": "Ruhig.",
        "registers": ["neutral"],
        "roles": ["friend"],
        "casting_tags": ["calm"],
        "status": "draft-profile",
        "voice_profile": {"voice": voice, "seed": seed, "style": "Sprich ruhig.", "pace": 1.0},
        "demo_phrases": ["Guten Morgen.", "Wie geht es dir?", "Bis morgen."],
    }


CATALOG = CharacterCatalog.model_validate(
    {"version": 1, "characters": [character("ada", "Vivian", 10), character("bo", "Ryan", 20)]}
)
DESIGNS = VoiceDesigns(
    version=1,
    reference_text="Hallo, ich wohne seit drei Jahren hier.",
    shared_lines=["Der Bus kommt gleich."],
    designs={"ada": "A calm adult woman.", "bo": "A calm adult man."},
)


def tone(target: Path, frequency: float, seconds: float = 1.0) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    t = np.arange(int(RATE * seconds)) / RATE
    sf.write(target, 0.3 * np.sin(2 * np.pi * frequency * t), RATE)


class ToneBackend:
    """A tone per voice: preset speakers by name, clones by their reference's file name."""

    FREQUENCY = {"Vivian": 220.0, "Ryan": 110.0}

    def __init__(self) -> None:
        self.calls: list[tuple[str, ...]] = []
        self.loaded: list[str] = []

    def preset(self, lock_key, text, speaker, style, seed, target):  # type: ignore[no-untyped-def]
        self.calls.append(("preset", lock_key, speaker, str(style)))
        tone(target, self.FREQUENCY[speaker])

    def design(self, text, instruct, seed, target):  # type: ignore[no-untyped-def]
        self.calls.append(("design", str(seed)))
        tone(target, 300.0 if "woman" in instruct else 150.0)

    def clone(self, lock_key, text, reference, reference_text, seed, target):  # type: ignore[no-untyped-def]
        self.calls.append(("clone", lock_key, reference.name))
        tone(target, 300.0 if reference.name.startswith("ada") else 150.0)

    def release(self) -> None:
        self.loaded.append("released")


class PitchEmbedder:
    """The dominant frequency as a two-dimensional unit vector: one direction per voice."""

    def embed(self, samples: npt.NDArray[np.float32], sample_rate: int) -> npt.NDArray[np.float64]:
        spectrum = np.abs(np.fft.rfft(samples))
        peak = float(np.argmax(spectrum)) * sample_rate / len(samples)
        angle = peak / 100.0
        return np.array([np.cos(angle), np.sin(angle)])


def copy(source: Path, target: Path, pace: float) -> None:
    shutil.copyfile(source, target)


def perfect(text_of: dict[str, str]):  # type: ignore[no-untyped-def]
    """A transcriber that hears every file say what it was asked to."""

    def hear(path: Path) -> str:
        return text_of.get(path.name.split(".")[0], "")

    return hear


def run(workspace: Path, transcribe=None, **overrides):  # type: ignore[no-untyped-def]
    texts = {"01": "Guten Morgen.", "02": "Wie geht es dir?", "03": "Bis morgen.",
             "04": "Der Bus kommt gleich."}
    for name in ("ada", "bo"):
        texts[name] = DESIGNS.reference_text
    arguments = dict(
        workspace=workspace,
        catalog=CATALOG,
        designs=DESIGNS,
        lock=LOCK,
        candidates=list(CANDIDATES),
        backend=ToneBackend(),
        transcribe=transcribe or perfect(texts),
        embedder=PitchEmbedder(),
        conformer=copy,
    )
    arguments.update(overrides)
    return run_voice_evaluation(**arguments)  # type: ignore[arg-type]


def test_a_run_records_every_take_model_and_prompt(tmp_path: Path) -> None:
    workspace = tmp_path / "evaluations" / "voices-1"
    backend = ToneBackend()
    manifest = run(workspace, backend=backend)

    assert manifest["publishable"] is False and manifest["synthetic_references"] is True
    assert set(manifest["models"]) == {c.lock_key for c in CANDIDATES.values()} | {DESIGN_LOCK_KEY}
    for name, pin in manifest["models"].items():
        assert pin == {"id": LOCK[name]["id"], "revision": LOCK[name]["revision"]}
    # 2 characters x 4 lines x 4 candidates, every one hashed, heard and passed.
    takes = manifest["takes"]
    assert len(takes) == 32
    assert all(take["sha256"] and take["model_sha256"] and take["passed"] for take in takes)
    references = manifest["designs"]["references"]
    assert references["ada"]["instruct"] == "A calm adult woman."
    assert references["ada"]["accepted"] and references["ada"]["attempts"][0]["sha256"]
    # The style instruction goes only to the checkpoint that uses it.
    styles = {call[1]: call[3] for call in backend.calls if call[0] == "preset"}
    assert styles == {"qwen_tts": "None", "qwen_tts_1_7b": "Sprich ruhig."}
    # The tone voices are perfectly consistent and perfectly distinct.
    summary = manifest["summary"]
    assert summary["preset-0.6b"]["within_character_min_median"] == pytest.approx(1.0)
    assert summary["design-clone-1.7b"]["reference_similarity_median"] == pytest.approx(1.0)
    assert summary["preset-1.7b"]["different_character_max"] < 0.95
    assert json.loads((workspace / "run.json").read_text())["run"] == "voices-1"


def test_the_listening_page_is_blind(tmp_path: Path) -> None:
    workspace = tmp_path / "voices-2"
    manifest = run(workspace)
    page = (workspace / "listen" / "index.html").read_text()
    for candidate in CANDIDATES:
        assert candidate not in page
    assert "takes/" not in page
    key = manifest["blind_key"]
    assert set(key) == {"ada", "bo"}
    assert sorted(key["ada"].values()) == sorted(CANDIDATES)
    blind = sorted(path.name for path in (workspace / "listen" / "audio").iterdir())
    assert len(blind) == 32 and blind[0] == "ada-01-A.wav"
    # The copy under a letter is the take of the candidate the key names for that letter.
    take = next(
        t for t in manifest["takes"]
        if t["character"] == "bo" and t["line"] == "02" and t["candidate"] == key["bo"]["C"]
    )
    copied = (workspace / "listen" / "audio" / "bo-02-C.wav").read_bytes()
    assert copied == (workspace / take["path"]).read_bytes()


def test_a_run_never_overwrites_an_earlier_one(tmp_path: Path) -> None:
    workspace = tmp_path / "voices-3"
    run(workspace)
    before = (workspace / "run.json").read_bytes()
    with pytest.raises(FileExistsError, match="never overwrites"):
        run(workspace)
    assert (workspace / "run.json").read_bytes() == before


def test_bad_arguments_are_refused_before_anything_is_written(tmp_path: Path) -> None:
    workspace = tmp_path / "voices-4"
    with pytest.raises(ValueError, match="unknown candidate"):
        run(workspace, candidates=["preset-9b"])
    with pytest.raises(ValueError, match="unknown character"):
        run(workspace, characters=["zed"])
    with pytest.raises(ValueError, match="pins no"):
        run(workspace, lock={"qwen_tts": LOCK["qwen_tts"]})
    assert not workspace.exists()


def test_a_reference_whisper_cannot_hear_is_redesigned_on_the_next_seed(tmp_path: Path) -> None:
    texts = {"01": "Guten Morgen.", "02": "Wie geht es dir?", "03": "Bis morgen.",
             "04": "Der Bus kommt gleich.", "bo": DESIGNS.reference_text}

    def hear(path: Path) -> str:
        stem = path.name.split(".")[0]
        if stem == "ada":
            # The first seed mumbles; the next one is heard.
            return DESIGNS.reference_text if ".seed11." in path.name else "Hallo."
        return texts.get(stem, "")

    manifest = run(tmp_path / "voices-5", transcribe=hear, candidates=["design-clone-0.6b"])
    attempts = manifest["designs"]["references"]["ada"]["attempts"]
    assert [a["seed"] for a in attempts] == [10, 11]
    assert [a["passed"] for a in attempts] == [False, True]
    assert manifest["designs"]["references"]["ada"]["model_path"] == "references/ada.seed11.model.wav"


def test_a_character_with_no_usable_reference_fails_its_clone_takes(tmp_path: Path) -> None:
    def hear(path: Path) -> str:
        if path.name.startswith("ada."):
            return ""
        return DESIGNS.reference_text if path.name.startswith("bo.") else "Guten Morgen."

    manifest = run(tmp_path / "voices-6", transcribe=hear, candidates=["design-clone-0.6b"])
    assert len(manifest["designs"]["references"]["ada"]["attempts"]) == 3
    failed = [t for t in manifest["takes"] if t["character"] == "ada"]
    assert failed and all("no designed reference" in str(t["error"]) for t in failed)
    assert manifest["summary"]["design-clone-0.6b"]["failed_generation"] == 4


def test_an_imitation_is_refused() -> None:
    with pytest.raises(ValidationError, match="imitation"):
        VoiceDesigns(
            version=1,
            reference_text="Hallo, ich wohne seit drei Jahren hier.",
            designs={"ada": "A woman who sounds like a famous newsreader."},
        )


def test_reveal_unblinds_through_the_key(tmp_path: Path) -> None:
    manifest = run(tmp_path / "voices-7")
    key = manifest["blind_key"]
    choices = {
        "run": "voices-7",
        "choices": {
            "ada/01": {"best": "A", "rejected": ["B"]},
            "ada/02": {"best": "A"},
            "ada/stimme": {"best": "A"},
            "bo/01": {"best": "D", "rejected": ["B", "C"]},
        },
    }
    result = reveal(manifest, choices)
    tally = result["tally"]
    assert tally[key["ada"]["A"]]["best_lines"] == 2
    assert tally[key["ada"]["A"]]["best_voice"] == 1
    assert result["voice_per_character"] == {"ada": key["ada"]["A"]}
    assert sum(row["rejected_lines"] for row in tally.values()) == 3
    with pytest.raises(ValueError, match="not 'voices-7'"):
        reveal(manifest, {"run": "voices-8", "choices": {}})
    with pytest.raises(ValueError, match="never had"):
        reveal(manifest, {"run": "voices-7", "choices": {"ada/01": {"best": "H"}}})


def test_no_evaluation_checkpoint_is_a_production_engine() -> None:
    evaluation_only = {name for name, spec in LOCK.items() if spec.get("scope") == "evaluation"}
    assert evaluation_only == {"qwen_tts_1_7b"}
    assert not evaluation_only & set(ENGINES)
    # Every real engine a scene can be cast on is a production row of the lock, under its own name:
    # that is the row a render manifest copies.
    real = {name for name in ENGINES if not name.startswith("fake")}
    assert real <= set(LOCK)
    assert all(LOCK[name].get("scope") != "evaluation" for name in real)


def test_the_design_file_describes_every_roster_character() -> None:
    designs = load_designs()
    roster = {c.id for c in load_character_catalog(REPO).characters}
    assert set(designs.designs) == roster
    lines = set(designs.shared_lines)
    assert not any(designs.reference_text in line or line in designs.reference_text for line in lines)
