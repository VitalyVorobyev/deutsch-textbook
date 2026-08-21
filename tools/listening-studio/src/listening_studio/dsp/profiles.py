"""Rooms, devices and difficulty presets, as validated data.

The shapes here are the vocabulary `Placement.device`, `SceneAcoustics.room` and
`DifficultyVariant.preset` are resolved against at render time. Three rules hold the file
together, and the first two are the same ones `scene/model.py` states for a scene:

* **`extra="forbid"` everywhere.** A misspelled key in a profile is a parameter that silently does
  nothing, and the render succeeds with audio nobody asked for.
* **Every entry carries its own `version`, and the version reaches the node hash.** Editing a
  room's decay changes the impulse response, so the bytes change and content addressing catches
  it; editing only the version does not — and that is exactly the case a `version` field exists
  for, an editorial decision that the audio is now a different room even though the numbers are
  the same. Both paths must retire the cached render, so the version is a hashed parameter.
* **Unknown ids name the file to edit.** A render that refuses is only useful if it says where the
  vocabulary lives; `unknown room 'kitchen'` sends the reader to grep the codebase.

Loading takes the repository root, the way `catalogs.load_character_catalog` does, because these
files live beside `data/listening-characters.yaml` and belong to the corpus rather than to this
tool.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel, ConfigDict, Field, model_validator

#: Where the two data files live, relative to the repository root.
PROFILES_PATH = Path("data") / "acoustic-profiles.yaml"
DIFFICULTY_PATH = Path("data") / "acoustic-difficulty.yaml"

#: Profile ids follow the corpus's identifier shape, like every other id in this repository.
KEBAB = r"^[a-z0-9]+(?:-[a-z0-9]+)*$"


class Strict(BaseModel):
    """Refuses unknown keys. Stated once rather than on each of the eight models below."""

    model_config = ConfigDict(extra="forbid")


# -- rooms --------------------------------------------------------------------


class RoomIrSpec(Strict):
    """Everything `dsp.ir` needs to generate one room, and nothing else.

    The bounds are wide enough for a cathedral and narrow enough that a typo is caught: a
    `decay_s` of 60 is not a room, it is a mistake, and a `pre_delay_ms` of 2000 is a delay effect.
    """

    seed: int = Field(ge=0)
    #: RT60: the time the reverberant tail takes to fall 60 dB.
    decay_s: float = Field(gt=0.0, le=10.0)
    #: The gap before the first reflection. This is what the ear reads as the size of the space.
    pre_delay_ms: int = Field(ge=0, le=200)
    #: Damping. The cutoff the tail starts at, swept downward as it decays.
    lowpass_hz: float = Field(ge=500.0, le=20_000.0)
    early_reflections: int = Field(ge=0, le=64)


class RoomProfile(Strict):
    version: int = Field(ge=1)
    label: str = Field(min_length=1)
    note: str = ""
    ir: RoomIrSpec
    #: The default send level into the room, before any difficulty delta.
    wet: float = Field(ge=0.0, le=1.0)


# -- devices ------------------------------------------------------------------


class BandFilter(Strict):
    """One band edge, with its steepness stated as a section count.

    ffmpeg's `highpass` and `lowpass` are biquads and top out at two poles — 12 dB per octave.
    A telephone band is much steeper than that, and steepness is most of what makes a phone sound
    like a phone rather than like a blanket over a speaker. So a profile says how many identical
    2-pole sections to cascade, and `chains` emits them; `sections: 3` is 36 dB per octave.
    """

    hz: float = Field(gt=0.0, le=24_000.0)
    sections: int = Field(default=1, ge=1, le=6)


class Compression(Strict):
    """Levelling, in the units an editor thinks in.

    `acompressor` rather than `compand`, and consistently so. Both can produce this effect; the
    difference is what a *data file* can hold. `acompressor` takes five individually named,
    individually typed parameters, each of which is one field below and one dB-to-linear
    conversion in `chains`. `compand`'s transfer curve is a positional `attacks|decays|points`
    string — a data file could only carry it as a pre-formatted ffmpeg fragment, which is the one
    thing this layer exists not to store.
    """

    #: In dB, converted to `acompressor`'s linear threshold by `chains`.
    threshold_db: float = Field(ge=-60.0, le=0.0)
    ratio: float = Field(ge=1.0, le=20.0)
    attack_ms: float = Field(ge=0.01, le=2000.0)
    release_ms: float = Field(ge=0.01, le=9000.0)
    #: In dB, converted to `acompressor`'s linear makeup factor (1..64, i.e. 0..36 dB).
    makeup_db: float = Field(ge=0.0, le=36.0)


class Crush(Strict):
    """Bit reduction, for a codec-ish edge. `mix` keeps it a hint rather than an effect."""

    bits: float = Field(ge=1.0, le=64.0)
    mix: float = Field(ge=0.0, le=1.0)


class DeviceProfile(Strict):
    """The transmission channel between the microphone and the listener.

    There is no `mono` field: a take is one channel from synthesis until `TrackNode` positions it
    with the pan law, so every device chain already runs on mono and a field saying so could never
    be observed to be false.

    There is no reverb field either. `room_send_db` raises this stem's send into the *scene's*
    room, because the render has exactly one convolution and a device that carried its own would
    mean two reverb models in one mix. When a scene names no room the field applies to nothing,
    and the manifest's resolved acoustics says `room: null` rather than hiding it.
    """

    version: int = Field(ge=1)
    label: str = Field(min_length=1)
    note: str = ""
    highpass: BandFilter | None = None
    lowpass: BandFilter | None = None
    compression: Compression | None = None
    crush: Crush | None = None
    room_send_db: float = Field(default=0.0, ge=-12.0, le=12.0)
    gain_db: float = Field(default=0.0, ge=-40.0, le=12.0)

    @model_validator(mode="after")
    def ordered_band(self) -> DeviceProfile:
        if self.highpass is not None and self.lowpass is not None:
            if self.lowpass.hz <= self.highpass.hz:
                raise ValueError(
                    f"device {self.label}: lowpass {self.lowpass.hz} Hz is at or below "
                    f"highpass {self.highpass.hz} Hz, which passes nothing"
                )
        return self


# -- the profile catalog ------------------------------------------------------


def _kebab_keys(rows: dict[str, object], what: str) -> None:
    for key in rows:
        if not re.match(KEBAB, key):
            raise ValueError(f"{what} id {key!r} is not kebab-case")


class AcousticProfiles(Strict):
    """`data/acoustic-profiles.yaml`, whole."""

    version: Literal[1] = 1
    rooms: dict[str, RoomProfile] = Field(min_length=1)
    devices: dict[str, DeviceProfile] = Field(min_length=1)

    @model_validator(mode="after")
    def identifiers(self) -> AcousticProfiles:
        _kebab_keys(dict(self.rooms), "room")
        _kebab_keys(dict(self.devices), "device")
        return self

    def room(self, room_id: str) -> RoomProfile:
        try:
            return self.rooms[room_id]
        except KeyError:
            raise ValueError(
                f"unknown room {room_id!r}; {PROFILES_PATH} defines: "
                f"{', '.join(sorted(self.rooms))}"
            ) from None

    def device(self, device_id: str) -> DeviceProfile:
        try:
            return self.devices[device_id]
        except KeyError:
            raise ValueError(
                f"unknown device {device_id!r}; {PROFILES_PATH} defines: "
                f"{', '.join(sorted(self.devices))}"
            ) from None


# -- difficulty ---------------------------------------------------------------


class DifficultyDeltas(Strict):
    """What a difficulty preset does, expressed against what the scene's author wrote.

    Every default is the identity, so `DifficultyDeltas()` is "render the scene as authored" —
    which is what a variant with no preset and no overrides means, and what `natural` states
    explicitly in the data file.
    """

    #: dB added to each ambience bed's authored `gain_db`, then clamped to the model's -40..-6.
    ambience_gain_db: float = 0.0
    #: Added to the room profile's `wet`, then clamped to 0..1.
    wet: float = 0.0
    #: Multiplies every speech and sfx placement's `distance`.
    distance: float = Field(default=1.0, gt=0.0, le=8.0)
    #: Multiplies every utterance's `pace`, then clamped to the model's PACE_MIN..PACE_MAX.
    pace: float = Field(default=1.0, gt=0.0, le=2.0)
    #: How much of the previous speaker's pause the next speaker may eat into. Across roles only.
    overlap_ms: int = Field(default=0, ge=0, le=2000)


#: The override vocabulary, derived from the deltas rather than restated. A `DifficultyVariant`
#: whose `overrides` name anything else is refused: the loose typing on that field exists because
#: the vocabulary could not be named before this module existed, not because it is open.
DELTA_KEYS: tuple[str, ...] = tuple(DifficultyDeltas.model_fields)


class DifficultyPreset(DifficultyDeltas):
    """One named composition of deltas."""

    version: int = Field(ge=1)
    label: str = Field(min_length=1)
    note: str = ""

    def deltas(self) -> DifficultyDeltas:
        return DifficultyDeltas.model_validate(
            {key: getattr(self, key) for key in DELTA_KEYS}
        )


class DifficultyPresets(Strict):
    """`data/acoustic-difficulty.yaml`, whole."""

    version: Literal[1] = 1
    presets: dict[str, DifficultyPreset] = Field(min_length=1)

    @model_validator(mode="after")
    def identifiers(self) -> DifficultyPresets:
        _kebab_keys(dict(self.presets), "preset")
        return self

    def preset(self, preset_id: str) -> DifficultyPreset:
        try:
            return self.presets[preset_id]
        except KeyError:
            raise ValueError(
                f"unknown difficulty preset {preset_id!r}; {DIFFICULTY_PATH} defines: "
                f"{', '.join(sorted(self.presets))}"
            ) from None


def apply_overrides(
    base: DifficultyDeltas, overrides: dict[str, float | str], *, preset: str | None
) -> DifficultyDeltas:
    """Per-key overrides of a preset's deltas — the same keys, validated strictly.

    Strictly, and only now: `DifficultyVariant.overrides` is `dict[str, float | str]` in the scene
    model because the vocabulary belonged to this PR, and a scene document that was valid before
    the vocabulary existed stays valid. What changes is that reaching the renderer with a key
    outside it is a refusal naming the vocabulary, rather than a parameter that quietly does
    nothing to the audio.
    """

    unknown = sorted(set(overrides) - set(DELTA_KEYS))
    if unknown:
        named = f"preset {preset!r}" if preset else "a variant with no preset"
        raise ValueError(
            f"{named} is overridden with unknown key(s) {', '.join(unknown)}; "
            f"the difficulty vocabulary is: {', '.join(DELTA_KEYS)} ({DIFFICULTY_PATH})"
        )
    merged = {key: getattr(base, key) for key in DELTA_KEYS}
    merged.update(overrides)
    return DifficultyDeltas.model_validate(merged)


# -- loading ------------------------------------------------------------------


def load_acoustic_profiles(repo: Path) -> AcousticProfiles:
    """Rooms and devices, from `<repo>/data/acoustic-profiles.yaml`."""

    return AcousticProfiles.model_validate(yaml.safe_load((repo / PROFILES_PATH).read_text()))


def load_difficulty_presets(repo: Path) -> DifficultyPresets:
    """Difficulty presets, from `<repo>/data/acoustic-difficulty.yaml`."""

    return DifficultyPresets.model_validate(yaml.safe_load((repo / DIFFICULTY_PATH).read_text()))
