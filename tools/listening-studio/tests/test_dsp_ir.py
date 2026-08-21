"""The impulse-response generator: determinism first, then the properties a convolution needs.

Determinism is the load-bearing one. The IR is a content-addressed asset and its sha is an input
to the mix node, so a generator that varied by a rounding step between two runs would produce a
second copy of every room, invalidate every mix that used it, and look — in the manifest, on disk,
and in every check this repository has — exactly like a room that had been edited.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest
import soundfile as sf

from listening_studio.dsp.ir import (
    IR_ENERGY,
    IR_IMPL_VERSION,
    IR_PEAK_CEILING,
    IR_RATE,
    synthesize_ir,
    write_ir,
)
from listening_studio.dsp.profiles import load_acoustic_profiles
from listening_studio.graph.assets import sha256_file

REPO = Path(__file__).resolve().parents[3]

CAFE = {"seed": 1103, "decay_s": 0.85, "pre_delay_ms": 14, "lowpass_hz": 5000.0,
        "early_reflections": 10}


def written(target: Path, **overrides: object) -> dict[str, object]:
    params = dict(CAFE)
    params.update(overrides)
    return write_ir(target, **params)  # type: ignore[arg-type]


# -- determinism --------------------------------------------------------------


def test_the_same_parameters_produce_the_same_bytes(tmp_path: Path) -> None:
    first, second = tmp_path / "a.wav", tmp_path / "b.wav"
    written(first)
    written(second)
    assert sha256_file(first) == sha256_file(second)


@pytest.mark.parametrize(
    "change",
    [
        {"seed": 1104},
        {"decay_s": 0.86},
        {"pre_delay_ms": 15},
        {"lowpass_hz": 5100.0},
        {"early_reflections": 11},
    ],
)
def test_every_parameter_changes_the_bytes(tmp_path: Path, change: dict[str, object]) -> None:
    """All five reach the audio. A parameter that did not would be a room nobody could edit."""

    base, moved = tmp_path / "base.wav", tmp_path / "moved.wav"
    written(base)
    written(moved, **change)
    assert sha256_file(base) != sha256_file(moved)


def test_the_generator_is_deterministic_across_processes(tmp_path: Path) -> None:
    """A fresh interpreter, because a seeded generator that read module state would pass above.

    Not a hypothetical: `default_rng(seed)` is deterministic, and a later refactor reaching for a
    module-level generator, a `set` iteration order or `hash()` would not be.
    """

    import subprocess
    import sys

    target = tmp_path / "child.wav"
    script = "\n".join(
        [
            "from pathlib import Path",
            "from listening_studio.dsp.ir import write_ir",
            f"write_ir(Path({str(target)!r}), **{CAFE!r})",
        ]
    )
    subprocess.run([sys.executable, "-c", script], check=True)
    here = tmp_path / "here.wav"
    written(here)
    assert sha256_file(target) == sha256_file(here)


# -- the audio ----------------------------------------------------------------


def test_the_file_is_48k_mono_and_as_long_as_the_room(tmp_path: Path) -> None:
    target = tmp_path / "cafe.wav"
    record = written(target)
    info = sf.info(str(target))
    assert (info.samplerate, info.channels) == (IR_RATE, 1)
    # Pre-delay plus RT60, to the millisecond.
    assert info.duration == pytest.approx(0.85 + 0.014, abs=0.002)
    assert record["ir_impl_version"] == IR_IMPL_VERSION
    assert record["params"] == CAFE


@pytest.mark.parametrize("room_id", ["car", "cafe", "station-hall"])
def test_the_samples_are_finite_and_normalised_to_unit_energy(room_id: str) -> None:
    """Unit *energy*, not unit peak — the property that makes `wet` mean one thing in every room.

    A peak-normalised IR returns a level that falls with the tail's length: measured through the
    real filter chain, the same `wet` gave -31.3 dB in `car` and -43.4 dB in `station-hall`.
    Energy normalisation puts all seven rooms within 0.21 dB of each other.
    """

    room = load_acoustic_profiles(REPO).room(room_id)
    impulse = synthesize_ir(
        seed=room.ir.seed,
        decay_s=room.ir.decay_s,
        pre_delay_ms=room.ir.pre_delay_ms,
        lowpass_hz=room.ir.lowpass_hz,
        early_reflections=room.ir.early_reflections,
    )
    assert np.all(np.isfinite(impulse))
    assert float(np.sqrt(np.sum(impulse**2))) == pytest.approx(IR_ENERGY, rel=1e-9)
    # Well clear of full scale, so nothing clips on the way into 24-bit PCM.
    assert float(np.max(np.abs(impulse))) < IR_PEAK_CEILING


@pytest.mark.parametrize("room_id", ["studio", "small-room", "cafe", "station-hall", "car"])
def test_nothing_arrives_before_the_pre_delay(room_id: str) -> None:
    """Two properties at once, and the second is the one that goes wrong silently.

    The pre-delay is what the ear reads as the size of the space, so it has to be audible as a
    gap. And this IR is used on a **send**, where the dry signal reaches the master by its own
    path: a direct hit at sample zero would sum a second, unattenuated copy of every stem into the
    mix. That defect is inaudible as a defect — the mix just comes out louder — which is why it is
    asserted rather than listened for.
    """

    room = load_acoustic_profiles(REPO).room(room_id)
    impulse = synthesize_ir(
        seed=room.ir.seed,
        decay_s=room.ir.decay_s,
        pre_delay_ms=room.ir.pre_delay_ms,
        lowpass_hz=room.ir.lowpass_hz,
        early_reflections=room.ir.early_reflections,
    )
    gap = int(round(room.ir.pre_delay_ms / 1000 * IR_RATE))
    assert gap > 0
    assert float(np.max(np.abs(impulse[:gap]))) == 0.0
    assert float(np.max(np.abs(impulse[gap:]))) > 0.0


def test_a_longer_room_keeps_more_energy_in_its_second_half() -> None:
    """RT60 is the definition, so the tail's shape is checked rather than its length alone."""

    short = synthesize_ir(seed=1, decay_s=0.3, pre_delay_ms=0, lowpass_hz=6000.0,
                          early_reflections=0)
    long = synthesize_ir(seed=1, decay_s=2.0, pre_delay_ms=0, lowpass_hz=6000.0,
                         early_reflections=0)
    for impulse in (short, long):
        half = len(impulse) // 2
        # 60 dB over the whole length means the halfway point sits at -30 dB, whatever the length.
        first = float(np.sqrt(np.mean(impulse[:half] ** 2)))
        second = float(np.sqrt(np.mean(impulse[half:] ** 2)))
        assert 20.0 * np.log10(second / first) == pytest.approx(-27.0, abs=6.0)


def test_every_shipped_room_generates(tmp_path: Path) -> None:
    """Seven rooms, seven files, seven distinct shas. A duplicate would be a copy-pasted seed."""

    rooms = load_acoustic_profiles(REPO).rooms
    shas = set()
    for name, room in rooms.items():
        target = tmp_path / f"{name}.wav"
        write_ir(
            target,
            seed=room.ir.seed,
            decay_s=room.ir.decay_s,
            pre_delay_ms=room.ir.pre_delay_ms,
            lowpass_hz=room.ir.lowpass_hz,
            early_reflections=room.ir.early_reflections,
        )
        shas.add(sha256_file(target))
    assert len(shas) == len(rooms)
