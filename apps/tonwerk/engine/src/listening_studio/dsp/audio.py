"""Two operations on a WAV that are not acoustics: measuring its length, and conforming its format.

Here rather than in `graph` because a sound engine (`generative.stable_audio_mlx`) conforms its own
output before the graph ever sees it, and `generative` must not import the render graph.
"""

from __future__ import annotations

import subprocess
from pathlib import Path


def wav_duration(path: Path) -> float | None:
    """Seconds of audio, or None when the file is missing or unreadable."""

    if not path.exists():
        return None
    try:
        import soundfile as sf

        return float(sf.info(str(path)).duration)
    except Exception:
        return None


def conform(
    source: Path,
    target: Path,
    pace: float = 1.0,
    *,
    rate: int = 16000,
    channels: int = 1,
    codec: str = "pcm_s16le",
) -> None:
    """Apply pace and a target PCM format to a model's raw output.

    The whole of what an engine's audio has done to it before it reaches the timeline. `atempo`
    changes duration without changing pitch, which is why pace is a filter here rather than a
    generation parameter — the same take can be re-paced without asking the model again.

    The defaults are 16 kHz mono `pcm_s16le`, the format Whisper and WavLM are given and the one an
    audition demo is stored in. The render graph works at 48 kHz (`graph.nodes`) and passes its
    own format: one `atempo` invocation for both, so the two pace behaviours cannot diverge.
    """

    target.parent.mkdir(parents=True, exist_ok=True)
    filters = [f"atempo={pace}"] if pace != 1.0 else []
    subprocess.run(
        [
            "ffmpeg",
            "-v",
            "error",
            "-i",
            str(source),
            *(["-filter:a", ",".join(filters)] if filters else []),
            "-ar",
            str(rate),
            "-ac",
            str(channels),
            "-c:a",
            codec,
            "-y",
            str(target),
        ],
        check=True,
    )
