"""Which engine a stored name selects: the speech table, the sound table, and how to build one.

A scene's cast names a speech engine per voice (`VoiceSpec.engine`) and a render names a sound
engine; both surfaces — the `scene` CLI and the studio API — resolve those names here, so an engine
added or removed is added or removed once.
"""

from __future__ import annotations

import logging
from typing import Mapping, cast

from .fake import FakeClone, FakeDesigned, FakeSound, FakeSpeech
from .gateway import ClonableVoice, DesignedVoice, SoundGenerator, SpeechGenerator
from .qwen import QwenSpeech
from .qwen_clone import QwenBaseClone
from .qwen_designed import QwenDesignedClone
from .stable_audio_mlx import StableAudioSfx

log = logging.getLogger(__name__)

#: The stored engine name, and the class it selects.
ENGINES: dict[
    str,
    type[QwenSpeech]
    | type[FakeSpeech]
    | type[QwenBaseClone]
    | type[FakeClone]
    | type[QwenDesignedClone]
    | type[FakeDesigned],
] = {
    "qwen_tts": QwenSpeech,
    "qwen_tts_base": QwenBaseClone,
    "qwen_tts_designed": QwenDesignedClone,
    "fake": FakeSpeech,
    "fake_clone": FakeClone,
    "fake_designed": FakeDesigned,
}

#: The engines whose speech comes from a stored voice reference. One reading of that fact, because
#: the engine constructor below, the render path (which resolves voices before it can build an
#: engine) and the voices store all need it.
CLONING_ENGINES: frozenset[str] = frozenset({"qwen_tts_base", "fake_clone"})

#: The engines whose speech comes from a designed synthetic reference, named by its digest in
#: `VoiceSpec.voice`. Not cloning engines in the sense above: they take no consented voice and
#: offer no `make_voice`. The render path resolves their references from app data
#: (`generative.designed`) and the publisher records them as synthetic.
DESIGNED_ENGINES: frozenset[str] = frozenset({"qwen_tts_designed", "fake_designed"})

#: The same table for non-speech sound, and deliberately a second one rather than a merged
#: registry: the two protocols take different requests, and a caller that could look a speech
#: engine up by a sound engine's name would be one typo away from a scene cast on a tone
#: generator. The key is the name a command line uses; `FakeSound.name` stays `fake_sound`, which
#: is what a provenance record and a render manifest report, because that is what produced the
#: bytes.
SOUND_ENGINES: dict[str, type[StableAudioSfx] | type[FakeSound]] = {
    "stable_audio_sfx": StableAudioSfx,
    "fake": FakeSound,
}


def engine_for(
    name: str,
    voices: Mapping[str, ClonableVoice] | None = None,
    designed: Mapping[str, DesignedVoice] | None = None,
) -> SpeechGenerator:
    """The engine a stored name selects. Never a gate — the fake-engine gate stays at the caller.

    `voices` is the resolved set of stored voice references this render may synthesize through, and
    it reaches only a cloning engine; `designed` is the resolved set of designed synthetic
    references, by digest, and it reaches only a designed-voice engine. Both are **injected here
    rather than looked up there** so that the engines keep knowing nothing about a database or an
    app-data root: the store, the digest check and the revocation check all live on the caller's
    side, and a model can be replaced without taking those rules with it.
    """

    try:
        engine = ENGINES[name]
    except KeyError:
        raise ValueError(f"unknown synthesis engine {name}") from None
    if name in CLONING_ENGINES:
        return cast(SpeechGenerator, engine(voices or {}))  # type: ignore[call-arg, arg-type]
    if name in DESIGNED_ENGINES:
        return cast(SpeechGenerator, engine(designed or {}))  # type: ignore[call-arg, arg-type]
    return cast(SpeechGenerator, engine())


def sound_engine_for(name: str) -> SoundGenerator:
    """The sound engine a command line names. Constructing it downloads and loads nothing."""

    try:
        return SOUND_ENGINES[name]()
    except KeyError:
        raise ValueError(
            f"unknown sound engine {name}; known: {', '.join(sorted(SOUND_ENGINES))}"
        ) from None


def warn_if_style_is_inert(engine: SpeechGenerator, styled: bool) -> None:
    """One warning per render when a styled utterance meets an engine that discards style.

    Not per utterance: a twelve-turn dialogue would print twelve identical lines and teach the
    editor to scroll past them. Not an error either — the style is still the editorial record of
    how the turn should be delivered, and a bigger checkpoint would honour it.
    """

    if styled and not engine.supports_style:
        log.warning(
            "%s does not apply style instructions: the delivery notes on these lines are stored "
            "and hashed, but they do not reach the audio (docs/architecture/tts-reliability.md)",
            engine.name,
        )
