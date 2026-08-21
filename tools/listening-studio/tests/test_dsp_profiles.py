"""The two acoustic data files, and the vocabulary they define.

These are content files in `data/`, beside the character roster, so they are loaded from the real
repository rather than from a fixture: a test that invented its own rooms would prove the loader
works and say nothing about whether the rooms this course ships are loadable.
"""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml

from listening_studio.dsp.profiles import (
    DELTA_KEYS,
    DIFFICULTY_PATH,
    PROFILES_PATH,
    AcousticProfiles,
    DifficultyDeltas,
    DifficultyPresets,
    apply_overrides,
    load_acoustic_profiles,
    load_difficulty_presets,
)

REPO = Path(__file__).resolve().parents[3]


# -- the shipped files --------------------------------------------------------


def test_every_shipped_room_and_device_loads() -> None:
    profiles = load_acoustic_profiles(REPO)
    assert profiles.version == 1
    assert set(profiles.rooms) == {
        "studio", "small-room", "cafe", "office", "station-hall", "street", "car"
    }
    assert set(profiles.devices) == {"telephone", "mobile", "pa", "radio", "next-room"}


def test_the_rooms_are_ordered_the_way_their_names_claim() -> None:
    """A studio is drier than a café is drier than a station hall — checked, not assumed.

    The values are editorial, but the *relations* between them are the whole point of having seven
    rooms: if `station-hall` were shorter than `cafe`, every scene set in one would be wrong in a
    way no schema could see.
    """

    rooms = load_acoustic_profiles(REPO).rooms
    by_decay = sorted(rooms, key=lambda name: rooms[name].ir.decay_s)
    assert by_decay[0] == "car"
    assert by_decay[-1] == "station-hall"
    assert rooms["studio"].wet < rooms["cafe"].wet < rooms["station-hall"].wet


def test_the_telephone_band_is_the_band_it_is_named_after() -> None:
    device = load_acoustic_profiles(REPO).device("telephone")
    assert device.highpass is not None and device.highpass.hz == 300
    assert device.lowpass is not None and device.lowpass.hz == 3400
    assert device.compression is not None


def test_the_three_shipped_presets_and_the_identity_of_natural() -> None:
    presets = load_difficulty_presets(REPO)
    assert set(presets.presets) == {"clean", "natural", "challenging"}
    # `natural` is the scene as authored. Every delta must be the identity, or the variant every
    # scene carries by default would quietly be a treatment.
    assert presets.preset("natural").deltas() == DifficultyDeltas()


def test_the_presets_reproduce_the_concept_documents_background_levels() -> None:
    """§16 of the concept doc states absolutes; the file states deltas. This is the arithmetic.

    Clean ≈ -35 dB and challenging ≈ -18 dB of background, against `AmbienceEntry.gain_db`'s
    default of -24 dB, which is what every converted scene uses.
    """

    presets = load_difficulty_presets(REPO)
    authored = -24.0
    assert authored + presets.preset("clean").ambience_gain_db == -35.0
    assert authored + presets.preset("challenging").ambience_gain_db == -18.0
    assert presets.preset("challenging").overlap_ms > 0
    assert presets.preset("clean").overlap_ms == 0


# -- unknown ids --------------------------------------------------------------


def test_an_unknown_room_names_the_file_to_edit_and_what_is_in_it() -> None:
    profiles = load_acoustic_profiles(REPO)
    with pytest.raises(ValueError, match=r"unknown room 'kitchen'") as error:
        profiles.room("kitchen")
    assert str(PROFILES_PATH) in str(error.value)
    assert "station-hall" in str(error.value)


def test_an_unknown_device_names_the_file_to_edit() -> None:
    profiles = load_acoustic_profiles(REPO)
    with pytest.raises(ValueError, match=r"unknown device 'megaphone'") as error:
        profiles.device("megaphone")
    assert str(PROFILES_PATH) in str(error.value)


def test_an_unknown_preset_names_the_other_file() -> None:
    presets = load_difficulty_presets(REPO)
    with pytest.raises(ValueError, match=r"unknown difficulty preset 'brutal'") as error:
        presets.preset("brutal")
    assert str(DIFFICULTY_PATH) in str(error.value)


# -- strictness ---------------------------------------------------------------


def test_an_unknown_key_in_a_profile_is_refused_rather_than_ignored() -> None:
    """A misspelled parameter that loads is a parameter that silently does nothing."""

    document = yaml.safe_load((REPO / PROFILES_PATH).read_text())
    document["rooms"]["studio"]["predelay_ms"] = 12
    with pytest.raises(ValueError, match="predelay_ms"):
        AcousticProfiles.model_validate(document)


def test_a_device_whose_band_passes_nothing_is_refused() -> None:
    document = yaml.safe_load((REPO / PROFILES_PATH).read_text())
    document["devices"]["telephone"]["lowpass"]["hz"] = 200
    with pytest.raises(ValueError, match="passes nothing"):
        AcousticProfiles.model_validate(document)


def test_a_preset_file_with_an_unknown_delta_is_refused() -> None:
    document = yaml.safe_load((REPO / DIFFICULTY_PATH).read_text())
    document["presets"]["clean"]["snr_db"] = 6.0
    with pytest.raises(ValueError, match="snr_db"):
        DifficultyPresets.model_validate(document)


# -- overrides ----------------------------------------------------------------


def test_overrides_replace_individual_deltas_of_the_preset() -> None:
    base = load_difficulty_presets(REPO).preset("challenging").deltas()
    merged = apply_overrides(base, {"overlap_ms": 0}, preset="challenging")
    assert merged.overlap_ms == 0
    # Everything not named is the preset's.
    assert merged.ambience_gain_db == base.ambience_gain_db
    assert merged.pace == base.pace


def test_an_unknown_override_key_names_the_whole_vocabulary() -> None:
    """The loose typing on `DifficultyVariant.overrides` is a schema decision, not an open door."""

    with pytest.raises(ValueError, match="snr_db") as error:
        apply_overrides(DifficultyDeltas(), {"snr_db": 6.0}, preset="challenging")
    message = str(error.value)
    assert all(key in message for key in DELTA_KEYS)
    assert str(DIFFICULTY_PATH) in message


def test_the_override_vocabulary_is_derived_from_the_deltas_rather_than_restated() -> None:
    assert set(DELTA_KEYS) == set(DifficultyDeltas.model_fields)
