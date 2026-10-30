"""Scene v1 — the one artifact model.

A dialogue and a narration are the same shape: a cast, a script, and a timeline that places
speech and sound on one time axis. This package is that model (`model`), its exercise attachment
(`exercise`), its published JSON Schema (`schema_export`), the lossless converters from the shipped
corpus (`convert`, `reading_source`), the repository checks (`checks`), the publisher (`publish`),
the corpus regeneration wave (`wave`) and the `scene` verbs (`cli`).
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
