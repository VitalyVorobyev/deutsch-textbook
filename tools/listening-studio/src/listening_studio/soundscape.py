from __future__ import annotations

import math
from pathlib import Path

import numpy as np
import numpy.typing as npt
from pydantic import BaseModel, Field

from .adapters import wav_duration
from .domain import RevisionPayload


class SoundscapeReport(BaseModel):
    version: int = 1
    bed_count: int
    event_count: int
    continuous_ambience: bool
    configured_coverage_ratio: float = Field(ge=0, le=1)
    configured_gain_min_db: float | None = None
    configured_gain_max_db: float | None = None
    measured_ambience_rms_dbfs: float | None = None
    warnings: list[str] = Field(default_factory=list)


def _read_mono(path: Path) -> tuple[npt.NDArray[np.float32], int]:
    import soundfile as sf

    samples, rate = sf.read(path, dtype="float32", always_2d=False)
    audio = np.asarray(samples, dtype=np.float32)
    return (audio.mean(axis=1) if audio.ndim > 1 else audio), int(rate)


def _aligned_ambience_rms(
    dry: npt.NDArray[np.float32],
    final: npt.NDArray[np.float32],
    rate: int,
    expected_offset: int,
) -> float | None:
    """Measure the bed in speech-free samples after compensating for limiter latency.

    FFmpeg's look-ahead limiter delays the mixed signal by roughly 5 ms. Subtracting the dry
    waveform at the nominal lead-in therefore counts two misaligned copies of the speech as
    "ambience". Find that small lag from the speech itself, then measure only samples where the
    dry master is effectively silent. That leaves the room bed and events, which is the signal
    this diagnostic is meant to rank.
    """

    if not len(dry) or not len(final):
        return None
    decimation = max(1, round(rate / 1000))
    dry_coarse = dry[::decimation]
    max_lag = 100  # milliseconds at the coarse 1 kHz rate
    best: tuple[float, int] | None = None
    for lag in range(-max_lag, max_lag + 1):
        start = expected_offset + lag * decimation
        if start < 0:
            continue
        candidate = final[start : start + len(dry) : decimation]
        count = min(len(dry_coarse), len(candidate), 200_000)
        if count < 1000:
            continue
        left = dry_coarse[:count]
        right = candidate[:count]
        score = float(
            np.dot(left, right) / (np.linalg.norm(left) * np.linalg.norm(right) + 1e-12)
        )
        if best is None or score > best[0]:
            best = (score, start)
    if best is None:
        return None
    start = best[1]
    count = min(len(dry), len(final) - start)
    if count <= 0:
        return None
    dry_aligned = dry[:count]
    final_aligned = final[start : start + count]
    quiet = np.abs(dry_aligned) < 0.001  # approximately -60 dBFS
    if int(np.count_nonzero(quiet)) < rate:
        return None
    ambience = final_aligned[quiet].astype(np.float64)
    return 20 * math.log10(max(float(np.sqrt(np.mean(ambience**2))), 1e-12))


def soundscape_report(
    payload: RevisionPayload, dry: Path, final: Path
) -> SoundscapeReport:
    beds = [sound for sound in payload.context_sounds if sound.role == "bed"]
    events = [sound for sound in payload.context_sounds if sound.role == "event"]
    duration = wav_duration(final) or wav_duration(dry) or 0
    event_seconds = sum(sound.duration_ms / 1000 for sound in events)
    coverage = 1.0 if beds else min(1.0, event_seconds / duration) if duration else 0.0
    warnings: list[str] = []
    if not beds:
        warnings.append("no continuous environment bed; the scene falls silent between events")

    ambience_rms: float | None = None
    if payload.context_sounds and dry.exists() and final.exists():
        dry_audio, dry_rate = _read_mono(dry)
        final_audio, final_rate = _read_mono(final)
        if dry_rate == final_rate:
            offset = round(payload.lead_in_ms * dry_rate / 1000)
            ambience_rms = _aligned_ambience_rms(
                dry_audio, final_audio, dry_rate, offset
            )
    gains = [sound.gain_db for sound in payload.context_sounds]
    return SoundscapeReport(
        bed_count=len(beds),
        event_count=len(events),
        continuous_ambience=bool(beds),
        configured_coverage_ratio=coverage,
        configured_gain_min_db=min(gains) if gains else None,
        configured_gain_max_db=max(gains) if gains else None,
        measured_ambience_rms_dbfs=ambience_rms,
        warnings=warnings,
    )
