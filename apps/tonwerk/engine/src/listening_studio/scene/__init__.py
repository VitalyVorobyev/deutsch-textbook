"""Scene v1 — the one artifact model.

`RevisionPayload` describes a dialogue and `ReadingRevisionPayload` describes a narration, and
the two have been diverging field by field: both carry a voice identity, a per-turn pace, a
pause, a pronunciation override list and a synthesis text, under different names, validated by
different rules, stored in different tables. A `Scene` is the shape both of them are special
cases of — a cast, a script, and a timeline that places speech and sound in one time axis.

Nothing here replaces anything yet. The old models keep their forms, their export and their QA
until later PRs reach parity; this package adds the model, its storage, its published JSON
Schema and lossless converters from the shipped corpus.
"""

from .exercise import ExerciseAttachment
from .model import (
    AmbienceEntry,
    AssetRef,
    CastMember,
    CharacterRef,
    DifficultyVariant,
    NarrationRef,
    Placement,
    PronunciationOverride,
    Scene,
    SceneAcoustics,
    SceneBrief,
    SceneKind,
    SfxEntry,
    SoundSpec,
    SpeechEntry,
    TimelineEntry,
    Utterance,
    VoiceSpec,
)

__all__ = [
    "AmbienceEntry",
    "AssetRef",
    "CastMember",
    "CharacterRef",
    "DifficultyVariant",
    "ExerciseAttachment",
    "NarrationRef",
    "Placement",
    "PronunciationOverride",
    "Scene",
    "SceneAcoustics",
    "SceneBrief",
    "SceneKind",
    "SfxEntry",
    "SoundSpec",
    "SpeechEntry",
    "TimelineEntry",
    "Utterance",
    "VoiceSpec",
]
