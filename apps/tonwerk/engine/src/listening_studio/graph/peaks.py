"""Waveform peaks of a rendered master and its stems, for the editor's timeline.

A peak is the loudest sample in one window of `resolution_ms`, across both channels, expressed on a
**60 dB scale quantised to 0..255**: 255 is full scale, 0 is −60 dBFS or quieter. Logarithmic
because a bed mixed at −27 dB is a real part of the scene, and on a linear scale it would draw as a
flat line two pixels high beside the speech.

The numbers are a picture of bytes that already exist, so they are computed from the stem files
the render wrote and cached beside them (`peaks-<resolution>ms.json`). A render directory is keyed
by scene sha and variant and never rewritten with other audio, so the cache cannot go stale; the
reaper removes it with its tree.
"""

from __future__ import annotations

import json
import math
import os
import tempfile
from pathlib import Path
from typing import Any

import numpy as np
import soundfile as sf

PEAK_FLOOR_DBFS = -60.0
PEAK_LEVELS = 255
RESOLUTION_MIN_MS, RESOLUTION_MAX_MS = 5, 1000


def peak_levels(
    path: Path, *, resolution_ms: int, start_ms: int = 0, end_ms: int | None = None
) -> list[int]:
    """One level per `resolution_ms` window of `path` between `start_ms` and `end_ms`.

    The last window may be shorter than the rest; it still gets a level, so the count is
    `ceil((end - start) / resolution)` and a span's picture ends where the span does.
    """

    audio, rate = sf.read(str(path), always_2d=True, dtype="float32")
    first = min(len(audio), int(start_ms * rate / 1000))
    last = len(audio) if end_ms is None else min(len(audio), int(end_ms * rate / 1000))
    loudest = np.abs(audio[first:last]).max(axis=1) if last > first else np.zeros(0)
    window = max(1, int(resolution_ms * rate / 1000))
    count = math.ceil(len(loudest) / window)
    padded = np.zeros(count * window, dtype=np.float32)
    padded[: len(loudest)] = loudest
    peaks = padded.reshape(count, window).max(axis=1) if count else np.zeros(0)
    with np.errstate(divide="ignore"):
        dbfs = 20 * np.log10(peaks)
    scaled = np.clip((dbfs - PEAK_FLOOR_DBFS) / -PEAK_FLOOR_DBFS, 0.0, 1.0) * PEAK_LEVELS
    return [int(value) for value in np.round(scaled)]


def render_peaks(directory: Path, *, resolution_ms: int) -> dict[str, Any]:
    """The master's peaks and every timeline entry's, each over its own measured span.

    Read from `render.json`: the timeline says where each entry landed, and only a stem the
    manifest declares is read, so this can reach no file the artifact route would refuse.
    """

    cached = directory / f"peaks-{resolution_ms}ms.json"
    if cached.is_file():
        result: dict[str, Any] = json.loads(cached.read_text())
        return result
    manifest = json.loads((directory / "render.json").read_text())
    declared = {row["path"] for row in manifest.get("artifacts", [])}
    tracks = []
    for row in manifest.get("timeline", []):
        stem = f"stems/{row['entry_id']}.wav"
        if stem not in declared:
            continue
        tracks.append(
            {
                "entry_id": row["entry_id"],
                "type": row["type"],
                "start_ms": row["start_ms"],
                "end_ms": row["end_ms"],
                "path": stem,
                "peaks": peak_levels(
                    directory / stem,
                    resolution_ms=resolution_ms,
                    start_ms=row["start_ms"],
                    end_ms=row["end_ms"],
                ),
            }
        )
    result = {
        "resolution_ms": resolution_ms,
        "floor_dbfs": PEAK_FLOOR_DBFS,
        "levels": PEAK_LEVELS,
        "duration_ms": manifest.get("duration_ms"),
        "master": peak_levels(directory / "master.wav", resolution_ms=resolution_ms),
        "tracks": tracks,
    }
    # Written whole or not at all: two tabs asking at once must not leave half a file behind.
    with tempfile.NamedTemporaryFile(
        "w", dir=directory, prefix=".peaks-", suffix=".json", delete=False
    ) as handle:
        json.dump(result, handle, separators=(",", ":"))
    os.replace(handle.name, cached)
    return result
