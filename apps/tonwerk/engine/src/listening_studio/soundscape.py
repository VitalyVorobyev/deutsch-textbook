"""The soundscape diagnostic: how loud the non-speech material sits in a finished mix."""

from __future__ import annotations

import math
from pathlib import Path

import numpy as np
import numpy.typing as npt
from pydantic import BaseModel, Field


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


def ambience_rms_dbfs(dry: Path, final: Path, lead_in_ms: int) -> float | None:
    """The bed level in the finished mix, measured against the speech-only reference.

    `graph.scene_qa` reads the configured counts and gains off the scene and asks this function
    for the one number only the audio can give.
    """

    if not dry.exists() or not final.exists():
        return None
    dry_audio, dry_rate = _read_mono(dry)
    final_audio, final_rate = _read_mono(final)
    if dry_rate != final_rate:
        return None
    return _aligned_ambience_rms(
        dry_audio, final_audio, dry_rate, round(lead_in_ms * dry_rate / 1000)
    )

