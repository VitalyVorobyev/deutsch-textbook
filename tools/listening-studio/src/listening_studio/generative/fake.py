"""Engines that generate nothing, so the pipeline around them can be tested.

Both are pure arithmetic: no model, no torch, no download. The test suite runs in an environment
where `install-qwen.sh` has never been executed, and that is the property these two keep.
"""

from __future__ import annotations

import math
import struct
import wave
from pathlib import Path

from .gateway import AudioAsset, SoundRequest, SpeechRequest

SAMPLE_RATE = 16000


def _write_wav(target: Path, frames: bytes) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(target), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        wav.writeframes(frames)


class FakeSpeech:
    """Deterministic silence for tests and UI workflow development."""

    name = "fake"
    revision = "fake-v1"
    supports_style = False

    def generate(self, request: SpeechRequest, target: Path) -> AudioAsset:
        if request.params:
            raise ValueError(f"{self.name} accepts no engine parameters: {sorted(request.params)}")
        # Length tracks the text so a fixture's timeline is at least plausible; ~14 characters
        # per second is roughly a German speaking rate.
        frames = int(SAMPLE_RATE * max(0.25, len(request.text) / 14))
        _write_wav(target, b"\0\0" * frames)
        return AudioAsset.record(
            target,
            SAMPLE_RATE,
            engine=self.name,
            model_id="none",
            model_revision=self.revision,
            adapter_code_revision=self.revision,
            # No model, so no model licence. "none" rather than an empty string: a reader of a
            # sidecar has to be able to tell a fake engine from a field somebody forgot to fill.
            license="none",
            seed=request.seed,
            request_sha256=request.sha256(),
            params=request.params,
        )


class FakeSound:
    """A deterministic tone standing in for generated ambience or an event.

    Audible rather than silent, because the mixer's own tests need something with energy in it;
    the pitch comes from the seed so two different seeds are distinguishable by ear and by hash.
    """

    name = "fake_sound"
    revision = "fake-sound-v1"

    def generate(self, request: SoundRequest, target: Path) -> AudioAsset:
        if request.params:
            raise ValueError(f"{self.name} accepts no engine parameters: {sorted(request.params)}")
        # `negative_prompt` and `prompt` steer nothing here — a fake engine that pretended to
        # read them would make a test look like evidence about a model.
        frames = int(SAMPLE_RATE * max(0.05, request.duration_seconds))
        frequency = 110.0 + float(request.seed % 24) * 20.0
        samples = bytearray()
        for index in range(frames):
            value = 0.2 * math.sin(2.0 * math.pi * frequency * index / SAMPLE_RATE)
            samples += struct.pack("<h", int(value * 32767))
        _write_wav(target, bytes(samples))
        return AudioAsset.record(
            target,
            SAMPLE_RATE,
            engine=self.name,
            model_id="none",
            model_revision=self.revision,
            adapter_code_revision=self.revision,
            # No model, so no model licence. "none" rather than an empty string: a reader of a
            # sidecar has to be able to tell a fake engine from a field somebody forgot to fill.
            license="none",
            seed=request.seed,
            request_sha256=request.sha256(),
            params=request.params,
        )
