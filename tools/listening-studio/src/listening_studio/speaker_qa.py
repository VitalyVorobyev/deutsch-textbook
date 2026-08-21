from __future__ import annotations

from pathlib import Path
from typing import Mapping, Protocol, Sequence

import numpy as np
import numpy.typing as npt
from pydantic import BaseModel, Field

from .generative.locks import locked_snapshot
from .domain import RevisionPayload


MODEL_ID = "microsoft/wavlm-base-plus-sv"
MODEL_REVISION = "1ca8d40afff4d98a4356cf2b1a2000f9ba645649"
MIN_SPEECH_SAMPLES = 8_000  # 0.5 s at the studio's canonical 16 kHz


def weights_available() -> bool:
    """Whether the pinned WavLM checkout is on this machine, without downloading it.

    A caller that skips speaker QA has to say so explicitly — the alternative is a QA report that
    is silently missing its identity half, which reads exactly like one that passed it.
    """

    try:
        locked_snapshot(MODEL_ID, MODEL_REVISION)
    except RuntimeError:
        return False
    return True


class EmbeddingBackend(Protocol):
    def embed(self, samples: npt.NDArray[np.float32], sample_rate: int) -> npt.NDArray[np.float64]: ...


class WavLMSpeakerEmbedder:
    """Pinned, local-only speaker embeddings; model weights are never fetched implicitly."""

    def __init__(self) -> None:
        try:
            import torch
            from transformers import Wav2Vec2FeatureExtractor, WavLMForXVector
        except ImportError as exc:  # pragma: no cover - exercised by the studio runtime
            raise RuntimeError("the pinned WavLM speaker-QA runtime is not installed") from exc
        model_path = locked_snapshot(MODEL_ID, MODEL_REVISION)
        self._torch = torch
        self._extractor = Wav2Vec2FeatureExtractor.from_pretrained(model_path)
        self._model = WavLMForXVector.from_pretrained(model_path)
        self._model.eval()

    def embed(
        self, samples: npt.NDArray[np.float32], sample_rate: int
    ) -> npt.NDArray[np.float64]:
        inputs = self._extractor(
            samples, sampling_rate=sample_rate, return_tensors="pt", padding=True
        )
        with self._torch.inference_mode():
            vector = self._model(**inputs).embeddings[0]
        vector = self._torch.nn.functional.normalize(vector, dim=-1).cpu().numpy()
        return np.asarray(vector, dtype=np.float64)


class LineSimilarity(BaseModel):
    line_id: str
    speaker: str
    similarity_to_character: float | None = None
    manual_review: bool = False
    reason: str | None = None


class CharacterSimilarity(BaseModel):
    speaker: str
    line_count: int
    measured_lines: int
    minimum_similarity: float | None = None
    pitch_min_hz: float | None = None
    pitch_max_hz: float | None = None
    pitch_spread_hz: float | None = None


class CharacterPairSimilarity(BaseModel):
    speakers: tuple[str, str]
    similarity: float


class SpeakerConsistencyReport(BaseModel):
    model_id: str = MODEL_ID
    model_revision: str = MODEL_REVISION
    threshold: float | None = None
    threshold_status: str = "uncalibrated-warning-only"
    lines: list[LineSimilarity]
    characters: list[CharacterSimilarity]
    different_characters: list[CharacterPairSimilarity]
    warnings: list[str] = Field(default_factory=list)


class SpeakerQACalibration(BaseModel):
    version: int = 1
    qa_model_revision: str = MODEL_REVISION
    reviewed_projects: int
    within_character_warning_below: float
    different_character_warning_above: float


def derive_calibration(reports: list[SpeakerConsistencyReport]) -> SpeakerQACalibration:
    """Derive conservative warning bounds from a fully human-reviewed corpus."""

    within = [
        row.minimum_similarity
        for report in reports
        for row in report.characters
        if row.minimum_similarity is not None
    ]
    between = [
        row.similarity for report in reports for row in report.different_characters
    ]
    if not within or not between:
        raise ValueError("calibration needs measurable within- and different-character scores")
    return SpeakerQACalibration(
        reviewed_projects=len(reports),
        within_character_warning_below=float(np.percentile(within, 5)),
        different_character_warning_above=float(np.percentile(between, 95)),
    )


def _normalize(vector: npt.NDArray[np.float64]) -> npt.NDArray[np.float64]:
    norm = float(np.linalg.norm(vector))
    if norm == 0:
        raise ValueError("speaker embedding has zero length")
    return vector / norm


def _trimmed_audio(path: Path) -> tuple[npt.NDArray[np.float32], int]:
    try:
        import soundfile as sf
    except ImportError as exc:  # pragma: no cover - runtime dependency guard
        raise RuntimeError("soundfile is required for speaker-consistency QA") from exc
    samples, rate = sf.read(path, dtype="float32", always_2d=False)
    audio = np.asarray(samples, dtype=np.float32)
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    if rate != 16_000:
        raise ValueError(f"{path} is {rate} Hz; speaker QA requires the canonical 16000 Hz cache")
    active = np.flatnonzero(np.abs(audio) >= 10 ** (-45 / 20))
    if active.size:
        audio = audio[int(active[0]) : int(active[-1]) + 1]
    return audio, rate


def _median_f0(audio: npt.NDArray[np.float32], rate: int) -> float | None:
    """Median voiced-frame pitch with the same octave correction as the corpus report."""

    win, hop = 640, 320
    lo, hi = rate // 320, rate // 65
    values: list[float] = []
    for offset in range(0, len(audio) - win, hop):
        frame = audio[offset : offset + win].astype(np.float64)
        if float(np.sqrt(np.mean(frame**2))) < 0.02:
            continue
        frame -= np.mean(frame)
        correlation = np.correlate(frame, frame, "full")[win - 1 :]
        if correlation[0] <= 0:
            continue
        lag = lo + int(np.argmax(correlation[lo:hi]))
        best = correlation[lag]
        if best / correlation[0] < 0.3:
            continue
        for multiple in (2, 3):
            candidate = lag * multiple
            if candidate < hi and correlation[candidate] > 0.80 * best:
                lag, best = candidate, correlation[candidate]
        values.append(rate / lag)
    return float(np.median(values)) if values else None


def check_speaker_consistency(
    payload: RevisionPayload,
    paths: dict[str, Path],
    backend: EmbeddingBackend | None = None,
    calibration: SpeakerQACalibration | None = None,
) -> SpeakerConsistencyReport:
    return check_unit_consistency(
        [(line.id, line.speaker) for line in payload.lines],
        payload.speakers,
        paths,
        backend=backend,
        calibration=calibration,
    )


def check_unit_consistency(
    units: Sequence[tuple[str, str]],
    speakers: Sequence[str],
    paths: Mapping[str, Path],
    backend: EmbeddingBackend | None = None,
    calibration: SpeakerQACalibration | None = None,
) -> SpeakerConsistencyReport:
    """Rank identity drift without pretending an uncalibrated score is a verdict.

    A "unit" is `(id, speaker)`: a line of a `RevisionPayload` or an utterance of a `Scene`. The
    two models name the same two facts differently and nothing else here depends on either, so
    the measurement takes the pair rather than a payload — building a synthetic `RevisionPayload`
    to reach this function would mean inventing a brief, a question and an adapter name that no
    editor chose, in order to ask about a voice.
    """

    embedder = backend or WavLMSpeakerEmbedder()
    embeddings: dict[str, npt.NDArray[np.float64]] = {}
    pitches: dict[str, float] = {}
    line_scores: dict[str, LineSimilarity] = {}
    warnings: list[str] = []
    for unit_id, speaker in units:
        audio, rate = _trimmed_audio(paths[unit_id])
        if len(audio) < MIN_SPEECH_SAMPLES:
            reason = "less than 0.5 s of voiced audio; listen manually"
            line_scores[unit_id] = LineSimilarity(
                line_id=unit_id,
                speaker=speaker,
                manual_review=True,
                reason=reason,
            )
            warnings.append(f"{unit_id}: {reason}")
            continue
        embeddings[unit_id] = _normalize(embedder.embed(audio, rate))
        pitch = _median_f0(audio, rate)
        if pitch is not None:
            pitches[unit_id] = pitch

    character_rows: list[CharacterSimilarity] = []
    centroids: dict[str, npt.NDArray[np.float64]] = {}
    for speaker in speakers:
        speaker_units = [unit_id for unit_id, name in units if name == speaker]
        measured = [unit_id for unit_id in speaker_units if unit_id in embeddings]
        if measured:
            centroids[speaker] = _normalize(
                np.mean([embeddings[unit_id] for unit_id in measured], axis=0)
            )
        similarities: list[float] = []
        speaker_pitches = [pitches[unit_id] for unit_id in speaker_units if unit_id in pitches]
        if len(measured) < 2:
            warnings.append(f"{speaker}: fewer than two measurable lines; identity is manual-only")
        for unit_id in measured:
            others = [embeddings[other] for other in measured if other != unit_id]
            if not others:
                line_scores[unit_id] = LineSimilarity(
                    line_id=unit_id,
                    speaker=speaker,
                    manual_review=True,
                    reason="only one measurable line for this character",
                )
                continue
            aggregate = _normalize(np.mean(others, axis=0))
            similarity = float(np.dot(embeddings[unit_id], aggregate))
            similarities.append(similarity)
            line_scores[unit_id] = LineSimilarity(
                line_id=unit_id,
                speaker=speaker,
                similarity_to_character=similarity,
            )
        character_rows.append(
            CharacterSimilarity(
                speaker=speaker,
                line_count=len(speaker_units),
                measured_lines=len(measured),
                minimum_similarity=min(similarities) if similarities else None,
                pitch_min_hz=min(speaker_pitches) if speaker_pitches else None,
                pitch_max_hz=max(speaker_pitches) if speaker_pitches else None,
                pitch_spread_hz=(
                    max(speaker_pitches) - min(speaker_pitches)
                    if len(speaker_pitches) >= 2
                    else None
                ),
            )
        )

    pairs: list[CharacterPairSimilarity] = []
    ordered_speakers = list(speakers)
    for index, left in enumerate(ordered_speakers):
        for right in ordered_speakers[index + 1 :]:
            if left in centroids and right in centroids:
                pairs.append(
                    CharacterPairSimilarity(
                        speakers=(left, right),
                        similarity=float(np.dot(centroids[left], centroids[right])),
                    )
                )

    ordered_lines = [
        line_scores.get(
            unit_id,
            LineSimilarity(
                line_id=unit_id,
                speaker=speaker,
                manual_review=True,
                reason="no speaker embedding",
            ),
        )
        for unit_id, speaker in units
    ]
    if calibration is not None:
        for character_row in character_rows:
            if (
                character_row.minimum_similarity is not None
                and character_row.minimum_similarity < calibration.within_character_warning_below
            ):
                warnings.append(
                    f"{character_row.speaker}: similarity "
                    f"{character_row.minimum_similarity:.3f} is below the "
                    f"reviewed-corpus warning bound {calibration.within_character_warning_below:.3f}"
                )
        for pair_row in pairs:
            if pair_row.similarity > calibration.different_character_warning_above:
                warnings.append(
                    f"{' / '.join(pair_row.speakers)}: similarity "
                    f"{pair_row.similarity:.3f} is above the "
                    "reviewed-corpus separation warning bound "
                    f"{calibration.different_character_warning_above:.3f}"
                )
    return SpeakerConsistencyReport(
        threshold=(calibration.within_character_warning_below if calibration else None),
        threshold_status=("reviewed-corpus-warning-bounds" if calibration else "uncalibrated-warning-only"),
        lines=ordered_lines,
        characters=character_rows,
        different_characters=pairs,
        warnings=warnings,
    )
