"""The DSP layer: acoustic profiles as data, and the filter chains they translate into.

Three modules, and the split is the boundary the concept document draws in §2 and §15. Nothing
here generates audio; everything here *shapes* audio that a model or the library already produced.

* `profiles` — what a room, a device and a difficulty preset **are**. Pydantic models over
  `data/acoustic-profiles.yaml` and `data/acoustic-difficulty.yaml`, loaded the way `catalogs.py`
  loads the character roster: strict, versioned, and given the repository root.
* `ir` — the synthetic impulse response a room profile describes. Seeded noise under an
  exponential decay, with a pre-delay and a few discrete early reflections. Deterministic to the
  byte, because the IR is a content-addressed asset and a re-render must not produce a second copy
  of the same room.
* `chains` — pure builders. A device profile, a distance and a room become ffmpeg filter strings
  and nothing else, so the whole layer can be asserted exactly in a test that needs no audio.

**No module here imports from `graph`.** The dependency runs one way: the render graph knows about
DSP profiles, and DSP profiles know nothing about nodes, caches or asset stores. That is what lets
`chains` be tested as string arithmetic and `ir` as numpy arithmetic.
"""

from .chains import device_chain, distance_chain, distance_send_db, stem_chain
from .ir import IR_IMPL_VERSION, IR_RATE, synthesize_ir, write_ir
from .profiles import (
    DIFFICULTY_PATH,
    PROFILES_PATH,
    AcousticProfiles,
    DeviceProfile,
    DifficultyDeltas,
    DifficultyPresets,
    RoomProfile,
    load_acoustic_profiles,
    load_difficulty_presets,
)

__all__ = [
    "AcousticProfiles",
    "DIFFICULTY_PATH",
    "DeviceProfile",
    "DifficultyDeltas",
    "DifficultyPresets",
    "IR_IMPL_VERSION",
    "IR_RATE",
    "PROFILES_PATH",
    "RoomProfile",
    "device_chain",
    "distance_chain",
    "distance_send_db",
    "load_acoustic_profiles",
    "load_difficulty_presets",
    "stem_chain",
    "synthesize_ir",
    "write_ir",
]
