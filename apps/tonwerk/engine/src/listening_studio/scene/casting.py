"""Casting a role from the character catalog: the voice, the character pin, and the pace.

A catalog profile is three things a scene needs at once — which engine and voice speak the role,
which catalog version that was, and how fast the voice runs — and the third one lives on the
**lines**, not on the voice: `VoiceSpec` has no pace, and `Utterance.pace` is the `atempo` a take
is given after synthesis. So adopting a profile writes the voice and the character pin onto the
cast member and the profile's pace onto every line the role speaks. Both scene imports that cast
from the catalog (a Lesetext narration, and the cast editor's "Stimme aus dem Katalog übernehmen")
are meant to go through `adopt_catalog_voice`; a narration composes the profile's pace with its
level's (`catalog_pace`).
"""

from __future__ import annotations

from ..catalogs import DESIGNED_ENGINE, CharacterDefinition
from .model import PACE_MAX, PACE_MIN, CastMember, CharacterRef, Scene, VoiceSpec


def catalog_voice(character: CharacterDefinition, *, style: str | None = None) -> VoiceSpec:
    """The `VoiceSpec` a catalog profile casts.

    `style` is appended to a preset profile's own style sentence (a narration profile's reading
    instruction) and dropped for a designed one, whose engine takes no instruction: storing a
    sentence no model hears would read as a delivery decision that was honoured.
    """

    profile = character.voice_profile
    if profile.engine == DESIGNED_ENGINE:
        spoken_style = None
    else:
        spoken_style = " ".join(part for part in (profile.style, style) if part) or None
    return VoiceSpec(
        engine=profile.engine, voice=profile.voice, seed=profile.seed, style=spoken_style
    )


def catalog_pace(character: CharacterDefinition, delivery: float = 1.0) -> float:
    """A line's pace: the delivery the scene asks for, times the character's catalog pace.

    Rounded to three places and held inside the scene model's bounds, so a slow level on a voice
    that is already slowed stays a valid line rather than an invalid document.
    """

    paced = round(delivery * character.voice_profile.pace, 3)
    return min(PACE_MAX, max(PACE_MIN, paced))


def adopt_catalog_voice(scene: Scene, role: str, character: CharacterDefinition) -> Scene:
    """The scene with `role` cast from `character`'s current catalog profile.

    Sets the member's voice and its `CharacterRef` (id and version), and the pace of every line the
    role speaks to the character's catalog pace. Replaced, not multiplied: the catalog pace is the
    voice's rate correction, and adopting the same profile twice must give the same scene. A
    delivery change on one line is an edit made after adoption.

    Raises `KeyError` for a role the scene does not cast.
    """

    if all(member.role != role for member in scene.cast):
        raise KeyError(f"{scene.slug} casts no role {role}")
    cast = [
        CastMember(
            role=member.role,
            character=CharacterRef(id=character.id, version=character.version),
            voice=catalog_voice(character),
        )
        if member.role == role
        else member
        for member in scene.cast
    ]
    script = [
        utterance.model_copy(update={"pace": catalog_pace(character)})
        if utterance.role == role
        else utterance
        for utterance in scene.script
    ]
    return Scene.model_validate(
        scene.model_dump(mode="python") | {"cast": cast, "script": script}
    )
