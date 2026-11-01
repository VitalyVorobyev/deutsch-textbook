"""The soundscape diagnostic: how loud the non-speech material sits in a finished mix."""

from __future__ import annotations

import math
from pathlib import Path
from typing import Callable, Sequence

import numpy as np
import numpy.typing as npt
from pydantic import BaseModel, Field


#: How far under its asked-for level a bed may measure before it counts as absent. Generous on
#: purpose: the measurement is RMS over a few gaps and the expectation is integrated loudness, which
#: weigh a rumble and a hiss differently by a few dB. A bed that was there measured within that;
#: the inaudible ones this exists to catch sat 25 dB and more under.
BED_SHORTFALL_DB = 15.0

#: How long after an event's span its sound may still be in the master: in the test scene the half
#: second after a 1.2 s event's span still measured -37 dBFS, where the silence after it was digital
#: zero.
EVENT_MARGIN_MS = 500


class BedLevel(BaseModel):
    """One bed in the finished mix: where the scene asked for it and where it measured.

    Both levels are in the master. `expected_db` is the speech's loudness plus the bed's gain;
    `measured_rms_dbfs` is the master where the bed plays alone — no speech, no reverb of speech,
    no event — or None when the scene leaves no such stretch long enough to measure.
    """

    entry_id: str
    expected_db: float
    measured_rms_dbfs: float | None
    missing: bool


class SoundscapeReport(BaseModel):
    #: 2: each bed is measured against the level its scene asks for, and a missing one fails QA.
    version: int = 2
    bed_count: int
    event_count: int
    continuous_ambience: bool
    configured_coverage_ratio: float = Field(ge=0, le=1)
    configured_gain_min_db: float | None = None
    configured_gain_max_db: float | None = None
    measured_ambience_rms_dbfs: float | None = None
    beds: list[BedLevel] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)

    @property
    def bed_missing(self) -> bool:
        return any(bed.missing for bed in self.beds)


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
    keep: Callable[[int], npt.NDArray[np.bool_]] | None = None,
    minimum: int | None = None,
    envelope_ms: int = 0,
) -> float | None:
    """Measure the bed in speech-free samples after compensating for limiter latency.

    `keep`, given the aligned length, narrows the samples further (one bed's span, less every
    event); `minimum` is how many samples must be left for a figure, a second by default.
    `envelope_ms` judges quiet by the dry signal's short-term RMS rather than sample by sample, so
    the zero crossings inside a word or a reverb tail do not count as silence.

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
    if envelope_ms:
        width = max(1, round(envelope_ms * rate / 1000))
        power = np.convolve(dry_aligned.astype(np.float64) ** 2, np.ones(width) / width, "same")
        quiet = np.sqrt(power) < 0.001  # approximately -60 dBFS
    else:
        quiet = np.abs(dry_aligned) < 0.001  # approximately -60 dBFS
    if keep is not None:
        quiet &= keep(count)
    if int(np.count_nonzero(quiet)) < (rate if minimum is None else minimum):
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



def bed_rms_dbfs(
    dry: Path,
    final: Path,
    span_ms: tuple[int, int],
    events_ms: Sequence[tuple[int, int]],
) -> float | None:
    """One bed's level in the master: inside its span, outside speech and every event.

    An event is kept out for `EVENT_MARGIN_MS` past its span too, because the master's loudness
    stage smears its end later than the timeline says. A quarter of a second is enough: a bed is
    steady, and announcements leave only their pauses.
    """

    if not dry.exists() or not final.exists():
        return None
    dry_audio, rate = _read_mono(dry)
    final_audio, final_rate = _read_mono(final)
    if rate != final_rate:
        return None

    def keep(count: int) -> npt.NDArray[np.bool_]:
        mask = np.zeros(count, dtype=np.bool_)
        mask[round(span_ms[0] * rate / 1000) : round(span_ms[1] * rate / 1000)] = True
        for start, end in events_ms:
            mask[round(start * rate / 1000) : round((end + EVENT_MARGIN_MS) * rate / 1000)] = False
        return mask

    return _aligned_ambience_rms(dry_audio, final_audio, rate, 0, keep, rate // 4, envelope_ms=50)
