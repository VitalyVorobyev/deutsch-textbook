from __future__ import annotations

import wave
from pathlib import Path

import numpy as np
import pytest

from listening_studio.domain import Line, lock_voice_profiles
from listening_studio.speaker_qa import (
    CharacterPairSimilarity,
    CharacterSimilarity,
    SpeakerConsistencyReport,
    WavLMSpeakerEmbedder,
    check_speaker_consistency,
    derive_calibration,
)
from test_domain import payload


class QueueBackend:
    def __init__(self, vectors: list[list[float]]) -> None:
        self.vectors = iter(np.asarray(vector, dtype=np.float64) for vector in vectors)

    def embed(self, samples: np.ndarray, sample_rate: int) -> np.ndarray:
        assert sample_rate == 16_000 and len(samples) >= 8_000
        return next(self.vectors)


def wav(path: Path, seconds: float = 1.0) -> Path:
    count = int(16_000 * seconds)
    time = np.arange(count) / 16_000
    samples = (0.2 * np.sin(2 * np.pi * 140 * time) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as target:
        target.setnchannels(1)
        target.setsampwidth(2)
        target.setframerate(16_000)
        target.writeframes(samples.tobytes())
    return path


def four_line_payload():  # type: ignore[no-untyped-def]
    base = payload()
    lines = [
        Line(id="lea-1", speaker="Lea", display_text="Guten Morgen."),
        Line(id="lea-2", speaker="Lea", display_text="Bis später."),
        Line(id="tom-1", speaker="Tom", display_text="Hallo Lea."),
        Line(id="tom-2", speaker="Tom", display_text="Bis morgen."),
    ]
    return lock_voice_profiles(base.model_copy(update={"lines": lines}))


def test_similarity_report_compares_characters_and_their_lines(tmp_path: Path) -> None:
    project = four_line_payload()
    paths = {line.id: wav(tmp_path / f"{line.id}.wav") for line in project.lines}
    report = check_speaker_consistency(
        project,
        paths,
        QueueBackend([[1, 0], [0.98, 0.2], [0, 1], [0.1, 0.99]]),
    )
    assert all((row.minimum_similarity or 0) > 0.95 for row in report.characters)
    assert len(report.different_characters) == 1
    assert report.different_characters[0].similarity < 0.2
    assert report.threshold is None
    assert report.threshold_status == "uncalibrated-warning-only"
    # Pitch remains secondary evidence in the same serializable provenance report.
    assert all(row.pitch_spread_hz is not None for row in report.characters)
    assert report.model_dump(mode="json")["model_revision"]


def test_short_lines_are_sent_to_manual_review(tmp_path: Path) -> None:
    project = four_line_payload()
    paths = {
        line.id: wav(tmp_path / f"{line.id}.wav", 0.1 if line.id == "lea-1" else 1.0)
        for line in project.lines
    }
    report = check_speaker_consistency(
        project,
        paths,
        QueueBackend([[1, 0], [0, 1], [0.1, 0.99]]),
    )
    first = next(row for row in report.lines if row.line_id == "lea-1")
    assert first.manual_review and "0.5 s" in str(first.reason)


def test_missing_pinned_weights_are_a_readable_failure(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    """Speaker QA can be unavailable two ways, and both must be a sentence rather than a traceback.

    Which one fires depends on the environment, so the test states both: a machine that has run
    `install-qwen.sh` reaches the weights lookup and reports the missing checkout, while CI and
    any fresh checkout have no torch at all and stop one step earlier. Matching only the first
    made this test a claim about the developer's laptop.
    """

    def missing(*_args, **_kwargs):  # type: ignore[no-untyped-def]
        raise RuntimeError("run atlas-listening models fetch first")

    monkeypatch.setattr("listening_studio.speaker_qa.locked_snapshot", missing)
    with pytest.raises(RuntimeError, match="models fetch first|runtime is not installed"):
        WavLMSpeakerEmbedder()


def test_calibration_uses_reviewed_corpus_distributions() -> None:
    reports = [
        SpeakerConsistencyReport(
            characters=[
                CharacterSimilarity(speaker="Lea", line_count=2, measured_lines=2, minimum_similarity=0.91),
                CharacterSimilarity(speaker="Tom", line_count=2, measured_lines=2, minimum_similarity=0.89),
            ],
            lines=[],
            different_characters=[
                CharacterPairSimilarity(speakers=("Lea", "Tom"), similarity=0.22)
            ],
        ),
        SpeakerConsistencyReport(
            characters=[
                CharacterSimilarity(speaker="A", line_count=2, measured_lines=2, minimum_similarity=0.94),
                CharacterSimilarity(speaker="B", line_count=2, measured_lines=2, minimum_similarity=0.90),
            ],
            lines=[],
            different_characters=[
                CharacterPairSimilarity(speakers=("A", "B"), similarity=0.31)
            ],
        ),
    ]
    calibration = derive_calibration(reports)
    assert calibration.reviewed_projects == 2
    assert 0.89 <= calibration.within_character_warning_below < 0.90
    assert 0.30 < calibration.different_character_warning_above <= 0.31
