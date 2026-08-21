"""The acoustic vocabularies, served so no client has to know an id.

`SceneAcoustics.room`, `Placement.device` and `DifficultyVariant.preset` are free strings in the
scene contract and closed vocabularies at render time: `data/acoustic-profiles.yaml` and
`data/acoustic-difficulty.yaml` decide which values exist, and a render refuses anything else.
Until this endpoint there was no way to *read* that vocabulary over HTTP, so an editor could only
offer a hardcoded list — which is the same failure `dsp.profiles` documents for a misspelled key,
moved one layer out: the picker keeps offering `cafe` after the room is renamed, and the render
that refuses is the first anybody hears about it.

So the ids come from the same loaders the renderer uses, and each row carries its **version**.
The version is a hashed render parameter — editing a room's decay and editing only its version
both retire the cached audio — so an editor that shows it can say which calibration a stored scene
was authored against.

Read-only, and deliberately thin: labels, notes, versions and the difficulty deltas. The DSP
parameters themselves (impulse-response seeds, filter sections, compressor curves) are not here.
They are what the values *do*, not what an author picks between, and a client that rendered them
would be a second reader of a format `dsp.chains` owns.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException

from ..dsp.profiles import (
    DELTA_KEYS,
    DIFFICULTY_PATH,
    PROFILES_PATH,
    load_acoustic_profiles,
    load_difficulty_presets,
)
from ..storage import Store


def router(store: Store, repo: Path) -> APIRouter:
    """`store` is unused and still taken: every router in this package has one signature, and a
    module that quietly differs is the one somebody forgets to register the same way."""

    api = APIRouter(prefix="/api", tags=["acoustics"])

    @api.get("/acoustics")
    def acoustics() -> dict[str, Any]:
        """Rooms, devices, difficulty presets and the override vocabulary, in one read.

        One endpoint rather than three: an editor needs all four to draw a single acoustics
        panel, and three requests would let it render a room list beside a stale preset list.

        A missing or malformed data file is a **409 naming the file**, not a 500 and not an empty
        list. An empty list would make the editor offer no rooms, which reads exactly like a
        repository that defines none.
        """

        try:
            profiles = load_acoustic_profiles(repo)
        except (OSError, ValueError) as error:
            raise HTTPException(409, f"cannot read {PROFILES_PATH}: {error}") from error
        try:
            presets = load_difficulty_presets(repo)
        except (OSError, ValueError) as error:
            raise HTTPException(409, f"cannot read {DIFFICULTY_PATH}: {error}") from error

        return {
            "profiles_version": profiles.version,
            "difficulty_version": presets.version,
            "rooms": [
                {
                    "id": room_id,
                    "label": room.label,
                    "note": room.note,
                    "version": room.version,
                    # The default send level into this room, which is the one number an author
                    # compares two rooms by without rendering either.
                    "wet": room.wet,
                }
                for room_id, room in sorted(profiles.rooms.items())
            ],
            "devices": [
                {
                    "id": device_id,
                    "label": device.label,
                    "note": device.note,
                    "version": device.version,
                }
                for device_id, device in sorted(profiles.devices.items())
            ],
            "presets": [
                {
                    "id": preset_id,
                    "label": preset.label,
                    "note": preset.note,
                    "version": preset.version,
                    # The deltas, so a variant editor can show what a preset does and what an
                    # override is departing *from*. Every one of these is a delta against the
                    # scene as authored; `natural` is the identity.
                    "deltas": preset.deltas().model_dump(mode="json"),
                }
                for preset_id, preset in sorted(presets.presets.items())
            ],
            # The closed override vocabulary, derived from the delta model rather than restated.
            # `DifficultyVariant.overrides` is loosely typed in the scene contract; this is what
            # the renderer will actually accept.
            "override_keys": list(DELTA_KEYS),
        }

    return api
