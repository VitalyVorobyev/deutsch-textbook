"""Scene v1 model rules.

Every validator here is checked by breaking it. A rule that has never been watched to fail is a
rule that might be unreachable behind an earlier one — two of the placement rules in this repo
turned out to be exactly that the first time anyone tried.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from listening_studio.domain import Bilingual
from listening_studio.scene import (
    AmbienceEntry,
    AssetRef,
    CastMember,
    Scene,
    SceneBrief,
    SfxEntry,
    SoundSpec,
    SpeechEntry,
    Utterance,
    VoiceSpec,
)


DIGEST = "a" * 64


def scene(**overrides: object) -> Scene:
    base: dict[str, object] = {
        "slug": "kiosk-am-morgen",
        "kind": "dialogue",
        "title": Bilingual(en="At the kiosk", ru="У киоска"),
        "cast": [
            CastMember(role="Mara", voice=VoiceSpec(engine="qwen_tts", voice="Vivian", seed=100)),
            CastMember(role="Tom", voice=VoiceSpec(engine="qwen_tts", voice="Dylan", seed=105)),
        ],
        "script": [
            Utterance(id="u1", role="Mara", display_text="Guten Morgen."),
            Utterance(id="u2", role="Tom", display_text="Morgen! Zwei Brötchen, bitte."),
        ],
        "timeline": [SpeechEntry(utterance_id="u1"), SpeechEntry(utterance_id="u2")],
    }
    return Scene.model_validate(base | overrides)


def test_defaults_give_one_natural_variant() -> None:
    built = scene()
    assert [variant.id for variant in built.variants] == ["natural"]
    assert built.acoustics.lead_in_ms == 0
    assert built.script[0].pace == 1.0 and built.script[0].pause_after_ms == 600


def test_round_trip_is_hash_stable() -> None:
    built = scene()
    assert Scene.model_validate_json(built.canonical_json()).sha256() == built.sha256()


def test_unknown_key_is_refused() -> None:
    with pytest.raises(ValidationError, match="extra_forbidden"):
        Scene.model_validate(scene().model_dump(mode="json") | {"tempo": 1.0})


def test_uncast_role_is_refused() -> None:
    with pytest.raises(ValidationError, match="uncast role"):
        scene(script=[Utterance(id="u1", role="Lena", display_text="Hallo.")],
              timeline=[SpeechEntry(utterance_id="u1")])


def test_duplicate_cast_role_is_refused() -> None:
    member = CastMember(role="Mara", voice=VoiceSpec(engine="qwen_tts", voice="Vivian", seed=1))
    with pytest.raises(ValidationError, match="cast roles must be unique"):
        scene(cast=[member, member])


def test_unplaced_utterance_is_refused() -> None:
    with pytest.raises(ValidationError, match="exactly once"):
        scene(timeline=[SpeechEntry(utterance_id="u1")])


def test_twice_placed_utterance_is_refused() -> None:
    with pytest.raises(ValidationError, match="repeated"):
        scene(
            timeline=[
                SpeechEntry(utterance_id="u1"),
                SpeechEntry(utterance_id="u1"),
                SpeechEntry(utterance_id="u2"),
            ]
        )


def test_backwards_explicit_time_is_refused() -> None:
    with pytest.raises(ValidationError, match="must not move backwards"):
        scene(
            timeline=[
                SpeechEntry(utterance_id="u1", at_ms=4000),
                SpeechEntry(utterance_id="u2", at_ms=1000),
            ]
        )


def test_sequential_and_explicit_times_may_mix() -> None:
    """A None is "after the previous one" and cannot go backwards, so it is not compared."""

    built = scene(
        timeline=[
            SpeechEntry(utterance_id="u1", at_ms=4000),
            SpeechEntry(utterance_id="u2"),
        ]
    )
    assert built.timeline[1].at_ms is None


def test_duplicate_variant_ids_are_refused() -> None:
    with pytest.raises(ValidationError, match="variant ids must be unique"):
        scene(variants=[{"id": "natural"}, {"id": "natural", "preset": "noisy"}])


def test_slug_must_be_kebab() -> None:
    with pytest.raises(ValidationError):
        scene(slug="Kiosk Am Morgen")


def test_ambience_must_end_after_it_starts() -> None:
    with pytest.raises(ValidationError, match="end after it starts"):
        AmbienceEntry(sound=AssetRef(ref=DIGEST), start_ms=5000, end_ms=5000)


def test_a_bed_may_not_sit_at_speech_level() -> None:
    with pytest.raises(ValidationError):
        AmbienceEntry(sound=AssetRef(ref=DIGEST), gain_db=-2.0)
    # An event may: a door slam is allowed to be the loudest thing in the room.
    assert SfxEntry(sound=AssetRef(ref=DIGEST), at_ms=0, gain_db=0.0).gain_db == 0.0


def test_seed_override_beats_the_cast_seed() -> None:
    built = scene(
        script=[
            Utterance(id="u1", role="Mara", display_text="Guten Morgen.", seed_override=42),
            Utterance(id="u2", role="Tom", display_text="Morgen!"),
        ]
    )
    assert built.seed_for(built.utterance("u1")) == 42
    assert built.seed_for(built.utterance("u2")) == 105


def test_pronunciation_overrides_reach_the_spoken_text() -> None:
    utterance = Utterance(
        id="u1",
        role="Mara",
        display_text="Frau Dr. Weber kommt.",
        pronunciation_overrides=[{"display": "Dr.", "synthesis": "Doktor"}],
    )
    assert utterance.spoken_text() == "Frau Doktor Weber kommt."


def test_duration_window_must_be_a_window() -> None:
    with pytest.raises(ValidationError, match="non-empty positive range"):
        SceneBrief(scenario="Am Kiosk", duration_seconds=(40, 20))
    assert SceneBrief(scenario="Am Kiosk", duration_seconds=(20, 40)).duration_seconds == (20, 40)


def test_brief_derives_speaker_count_rather_than_storing_it() -> None:
    """`Brief.speaker_count` had to be held equal to the speaker list; `cast` is the list."""

    with pytest.raises(ValidationError, match="extra_forbidden"):
        SceneBrief.model_validate({"scenario": "Am Kiosk", "speaker_count": 2})


def test_a_generated_sound_is_a_spec_rather_than_an_engine_call() -> None:
    """A scene says what should be heard; which model produces it is the renderer's business."""

    built = scene(
        timeline=[
            SpeechEntry(utterance_id="u1"),
            SpeechEntry(utterance_id="u2"),
            SfxEntry(
                sound={"prompt": "eine Ladenklingel", "seed": 7, "params": {"guidance": 3.0}},
                at_ms=200,
            ),
        ]
    )
    entry = built.timeline[-1]
    assert isinstance(entry, SfxEntry)
    assert isinstance(entry.sound, SoundSpec) and entry.sound.prompt == "eine Ladenklingel"
    # And the union stays decidable in both directions after a round trip.
    reloaded = Scene.model_validate_json(built.canonical_json())
    assert isinstance(reloaded.timeline[-1].sound, SoundSpec)  # type: ignore[union-attr]
    assert reloaded.sha256() == built.sha256()


def test_a_library_sound_stays_a_library_sound() -> None:
    built = scene(
        timeline=[
            SpeechEntry(utterance_id="u1"),
            SpeechEntry(utterance_id="u2"),
            AmbienceEntry(sound=AssetRef(ref=DIGEST, source_start_ms=8000), end_ms=30_000),
        ]
    )
    reloaded = Scene.model_validate_json(built.canonical_json())
    entry = reloaded.timeline[-1]
    assert isinstance(entry, AmbienceEntry) and isinstance(entry.sound, AssetRef)
    assert entry.sound.source_start_ms == 8000 and entry.sound.source_duration_ms is None
