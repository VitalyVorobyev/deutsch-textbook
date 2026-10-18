"""Engines that generate nothing, so the pipeline around them can be tested.

Both are pure arithmetic: no model, no torch, no download. The test suite runs in an environment
where `install-qwen.sh` has never been executed, and that is the property these two keep.
"""

from __future__ import annotations

import math
import struct
import wave
from pathlib import Path
from typing import Mapping

from .gateway import AudioAsset, ClonableVoice, SoundRequest, SpeechRequest, VoiceRef

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
        if request.voice_ref is not None:
            # The gateway's rule for an engine without the cloning capability, kept here too so the
            # test engine cannot be the one place a `voice_ref` is silently ignored — which is
            # exactly where an ignored one would never be noticed.
            raise ValueError(
                f"{self.name} cannot synthesize through a voice reference "
                f"({request.voice_ref}); it has no cloning capability"
            )
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


class FakeClone:
    """A cloning engine that clones nothing, so the consent pipeline around it can be tested.

    **A sibling rather than a flag on `FakeSpeech`, deliberately.** `FakeSpeech` *refuses* a
    `voice_ref`, and that refusal is itself under test — an engine that could be switched between
    refusing and accepting would make the two behaviours one object, and the test suite could no
    longer state which of them a given engine has.

    It is the shape a real cloning engine has and nothing else: `make_voice` binds an identity,
    `generate` refuses a request with no `voice_ref` and one naming a voice it was not given, and
    the take's provenance carries the voice. The audio is the same deterministic silence
    `FakeSpeech` writes — the *length* differs from `FakeSpeech`'s by a constant so that two
    renders of one line on the two engines cannot land on identical bytes and hide a mix-up.
    """

    name = "fake_clone"
    revision = "fake-clone-v1"
    supports_style = False
    supports_cloning = True

    def __init__(self, voices: Mapping[str, ClonableVoice] | None = None) -> None:
        self._voices: dict[str, ClonableVoice] = dict(voices or {})

    def make_voice(
        self,
        *,
        voice_id: str,
        reference: Path,
        reference_sha256: str,
        ref_text: str | None,
        consent_sha256: str,
        x_vector_only: bool,
    ) -> VoiceRef:
        if not reference.exists():
            raise ValueError(f"the reference recording {reference} is not on this machine")
        del ref_text, x_vector_only
        return VoiceRef(
            id=voice_id,
            engine=self.name,
            model_revision=self.revision,
            reference_sha256=reference_sha256,
            consent_sha256=consent_sha256,
        )

    def generate(self, request: SpeechRequest, target: Path) -> AudioAsset:
        if request.params:
            raise ValueError(f"{self.name} accepts no engine parameters: {sorted(request.params)}")
        if request.voice_ref is None:
            raise ValueError(
                f"{self.name} synthesizes only through a stored voice reference; "
                "this request names none"
            )
        voice = self._voices.get(request.voice_ref)
        if voice is None:
            known = ", ".join(sorted(self._voices)) or "none"
            raise ValueError(
                f"{self.name} was not given voice reference {request.voice_ref}; "
                f"resolved for this render: {known}"
            )
        frames = int(SAMPLE_RATE * max(0.30, len(request.text) / 12))
        _write_wav(target, b"\0\0" * frames)
        return AudioAsset.record(
            target,
            SAMPLE_RATE,
            engine=self.name,
            model_id="none",
            model_revision=self.revision,
            adapter_code_revision=self.revision,
            license="none",
            seed=request.seed,
            request_sha256=request.sha256(),
            params=request.params,
            voice=voice.ref,
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
