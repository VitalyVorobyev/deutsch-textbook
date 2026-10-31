"""Waveform peaks: the loudest sample per window, on the 60 dB scale the timeline draws."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import soundfile as sf

from listening_studio.graph.peaks import peak_levels



def test_a_peak_level_is_the_loudest_sample_on_a_sixty_db_scale(tmp_path: Path) -> None:
    rate = 48_000
    signal = np.zeros(rate, dtype=np.float32)
    signal[: rate // 2] = 0.5  # −6.02 dBFS for half a second, then silence
    path = tmp_path / "half.wav"
    sf.write(str(path), np.stack([signal, signal * 0.1], axis=1), rate)
    levels = peak_levels(path, resolution_ms=100)
    assert len(levels) == 10
    assert levels[:5] == [round(255 * (60 - 6.0206) / 60)] * 5
    assert levels[5:] == [0] * 5
    # A span is read in its own time: 250 ms from 400 ms is three windows, the last one short.
    assert peak_levels(path, resolution_ms=100, start_ms=400, end_ms=650) == [levels[0], 0, 0]
