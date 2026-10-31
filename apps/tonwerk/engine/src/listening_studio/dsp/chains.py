"""Profiles into filter strings. Pure functions, no audio, no ffmpeg process.

The same argument `graph.nodes` makes about its filtergraph builders applies twice over here: a
filter chain is the part of this pipeline that is wrong *silently*. A `lowpass` whose cutoff is
written in kHz instead of Hz still renders, an `acompressor` threshold given in dB where ffmpeg
expects a linear amplitude clamps to a legal value and compresses nothing, and every gate stays
green. Building the strings in a module that touches no audio is what lets a test assert them
character by character.

Two translations live here and nowhere else:

* **dB to whatever ffmpeg wants.** A profile is written in the units an editor thinks in — dB and
  milliseconds. `acompressor`'s `threshold` and `makeup` are linear factors, so they are converted
  at the one place the filter string is built.
* **Steepness to a cascade.** ffmpeg's `highpass`/`lowpass` are 12 dB per octave at most, so a
  profile's `sections` count becomes that many identical filter instances.
"""

from __future__ import annotations

import functools
import math
import subprocess

from typing import TYPE_CHECKING, Sequence

from .profiles import BandFilter, Compression, DeviceProfile

if TYPE_CHECKING:  # the scene model imports this package, so the reverse import is type-only
    from ..scene.model import Effects

# -- distance -----------------------------------------------------------------
#
# One formula, three effects, and every constant named. Distance is a *multiplier* on a scene's
# authored `Placement.distance`, so 1.0 must be exactly a no-op — otherwise every existing scene
# would gain a filter chain the moment this module landed.

#: The inverse-square law for a point source: twice as far is 6 dB quieter.
DISTANCE_GAIN_DB_PER_DOUBLING = -6.0

#: Air and furnishings both attenuate treble first, so the usable bandwidth falls off with
#: distance. Inversely proportional: twice as far is half as bright.
DISTANCE_LOWPASS_AT_UNITY_HZ = 16_000.0
DISTANCE_LOWPASS_FLOOR_HZ = 800.0

#: Farther away means a larger share of what reaches the listener is reflected rather than direct,
#: which is the *only* cue that survives when the level is turned back up. Expressed as a send
#: level into the scene's room, so it costs no second convolution.
DISTANCE_SEND_DB_PER_UNIT = 5.0
DISTANCE_SEND_DB_MIN, DISTANCE_SEND_DB_MAX = -6.0, 9.0

#: The window the formula is defined on. A scene may say `distance: 0.0` — the model allows it,
#: and it means "at the listener" — and the inverse-square law says −∞ dB is 0 and +∞ dB is 0
#: distance. Clamping is the honest reading: below a quarter and beyond eight, the number has
#: stopped describing a position in a room.
DISTANCE_MIN, DISTANCE_MAX = 0.25, 8.0


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def effective_distance(distance: float) -> float:
    return clamp(distance, DISTANCE_MIN, DISTANCE_MAX)


def distance_gain_db(distance: float) -> float:
    """−6 dB per doubling. +6 dB per halving, which is what a `distance` below 1 asks for."""

    return DISTANCE_GAIN_DB_PER_DOUBLING * math.log2(effective_distance(distance))


def distance_lowpass_hz(distance: float) -> float:
    """The cutoff at this distance, or `DISTANCE_LOWPASS_AT_UNITY_HZ` when there is nothing to do."""

    raw = DISTANCE_LOWPASS_AT_UNITY_HZ / effective_distance(distance)
    return clamp(raw, DISTANCE_LOWPASS_FLOOR_HZ, DISTANCE_LOWPASS_AT_UNITY_HZ)


def distance_send_db(distance: float) -> float:
    """How much more (or less) of this stem goes into the room than at unit distance."""

    return clamp(
        DISTANCE_SEND_DB_PER_UNIT * (effective_distance(distance) - 1.0),
        DISTANCE_SEND_DB_MIN,
        DISTANCE_SEND_DB_MAX,
    )


def distance_chain(distance: float) -> str:
    """Gain and darkening for one distance. Empty at unit distance, so the hash does not move."""

    if distance == 1.0:
        return ""
    parts = [f"volume={distance_gain_db(distance):.2f}dB"]
    cutoff = distance_lowpass_hz(distance)
    if cutoff < DISTANCE_LOWPASS_AT_UNITY_HZ:
        parts.append(f"lowpass=f={cutoff:.0f}:p=2")
    return ",".join(parts)


# -- devices ------------------------------------------------------------------


def _band(name: str, band: BandFilter) -> str:
    """`sections` identical 2-pole biquads. See `BandFilter` for why steepness is a count."""

    return ",".join([f"{name}=f={band.hz:g}:p=2"] * band.sections)


def _compressor(compression: Compression) -> str:
    """dB in the profile, linear amplitude in the filter. `acompressor`, never `compand`."""

    threshold = 10.0 ** (compression.threshold_db / 20.0)
    makeup = 10.0 ** (compression.makeup_db / 20.0)
    return (
        f"acompressor=threshold={threshold:.6f}:ratio={compression.ratio:g}"
        f":attack={compression.attack_ms:g}:release={compression.release_ms:g}"
        f":makeup={makeup:.6f}"
    )


def device_chain(device: DeviceProfile) -> str:
    """One device profile as one filter chain.

    Order is the signal path, and it is load-bearing. Band-limiting comes first because everything
    after it is level-dependent and there is no point compressing energy the channel does not
    carry; the crush sits inside the band for the same reason; levelling comes after, so the
    compressor sees what the channel actually passes; the fixed gain is last, because a device
    that is simply quieter is quieter *after* it has been levelled, not before.
    """

    parts: list[str] = []
    if device.highpass is not None:
        parts.append(_band("highpass", device.highpass))
    if device.lowpass is not None:
        parts.append(_band("lowpass", device.lowpass))
    if device.crush is not None:
        # `mode=log` rather than the default linear: logarithmic bit reduction quantises quiet
        # samples as coarsely as loud ones in *relative* terms, which is what a codec does and
        # what keeps the artefact audible on speech rather than only on peaks.
        parts.append(f"acrusher=bits={device.crush.bits:g}:mix={device.crush.mix:g}:mode=log")
    if device.compression is not None:
        parts.append(_compressor(device.compression))
    if device.gain_db:
        parts.append(f"volume={device.gain_db:g}dB")
    return ",".join(parts)


# -- effects -----------------------------------------------------------------

#: The equalizer's three fixed bands (`scene.model.Equalizer`).
EQ_LOW_SHELF_HZ = 200.0
EQ_MID_HZ = 1500.0
EQ_MID_Q = 1.0
EQ_HIGH_SHELF_HZ = 5000.0


def effects_chain(effects: Effects | None) -> str:
    """An editor's insert chain on one stem. Empty when there is none.

    Band limits, equalizer, crush, compressor: the device's order, for the device's reason — the
    compressor levels what the stages before it left, so it comes last. A band at 0 dB emits no
    filter, so a flattened band costs no cache miss.
    """

    if effects is None:
        return ""
    parts: list[str] = []
    if effects.highpass is not None:
        parts.append(_band("highpass", effects.highpass))
    if effects.lowpass is not None:
        parts.append(_band("lowpass", effects.lowpass))
    if effects.eq is not None:
        if effects.eq.low_db:
            parts.append(f"lowshelf=f={EQ_LOW_SHELF_HZ:g}:g={effects.eq.low_db:g}")
        if effects.eq.mid_db:
            parts.append(
                f"equalizer=f={EQ_MID_HZ:g}:t=q:w={EQ_MID_Q:g}:g={effects.eq.mid_db:g}"
            )
        if effects.eq.high_db:
            parts.append(f"highshelf=f={EQ_HIGH_SHELF_HZ:g}:g={effects.eq.high_db:g}")
    if effects.crush is not None:
        parts.append(f"acrusher=bits={effects.crush.bits:g}:mix={effects.crush.mix:g}:mode=log")
    if effects.compression is not None:
        parts.append(_compressor(effects.compression))
    return ",".join(parts)


# -- ducking ------------------------------------------------------------------

#: How long the bed takes to go down before a turn and to come back after it. The fall starts
#: *before* the first word so the word is never masked; the rise is slower, because a bed that
#: jumps back the instant a speaker stops is the "pumping" a listener notices.
DUCK_ATTACK_MS = 150
DUCK_RELEASE_MS = 400

#: Turns closer together than this are one ducked stretch. An ordinary pause between turns (600
#: ms by default) is shorter than a full release and attack, so the bed would only half-rise and
#: fall again on every turn; holding it down through the gap is what a mixer would do by hand.
DUCK_HOLD_GAP_MS = 1000

#: The envelope is re-evaluated every this many samples (10 ms at 48 kHz). `volume`'s per-frame
#: evaluation otherwise steps once per decoded frame, whose size depends on the source file.
DUCK_FRAME_SAMPLES = 480


def duck_spans(
    speech: Sequence[tuple[int, int]], *, window_start_ms: int, window_end_ms: int
) -> list[tuple[int, int]]:
    """The speech spans, in the bed's own time, merged across short gaps and clipped to the bed.

    A span that ends before the bed starts or starts after it ends is dropped, but one that is
    only *near* the window is kept: its attack or release still reaches into the bed.
    """

    merged: list[list[int]] = []
    for start, end in sorted(speech):
        if merged and start - merged[-1][1] < DUCK_HOLD_GAP_MS:
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])
    length = window_end_ms - window_start_ms
    spans: list[tuple[int, int]] = []
    for start, end in merged:
        local_start, local_end = start - window_start_ms, end - window_start_ms
        if local_end + DUCK_RELEASE_MS <= 0 or local_start - DUCK_ATTACK_MS >= length:
            continue
        spans.append((local_start, local_end))
    return spans


def duck_chain(duck_db: float, spans: Sequence[tuple[int, int]]) -> str:
    """A gain envelope that sits at `duck_db` over every span and at 0 dB between them.

    Each span contributes a trapezoid — up over `DUCK_ATTACK_MS` ending at the first word, flat,
    down over `DUCK_RELEASE_MS` after the last — and merged spans are further apart than one
    attack plus one release, so at most one trapezoid is non-zero at any moment and their sum is
    the envelope. Empty when there is nothing to duck, so an unducked bed keeps its node hash.
    """

    if not duck_db or not spans:
        return ""
    attack, release = DUCK_ATTACK_MS / 1000, DUCK_RELEASE_MS / 1000
    terms = [
        f"clip((t-{start / 1000 - attack:.3f})/{attack:.3f},0,1)"
        f"*clip(({end / 1000 + release:.3f}-t)/{release:.3f},0,1)"
        for start, end in spans
    ]
    expression = f"pow(10,{duck_db:g}*({'+'.join(terms)})/20)"
    return f"asetnsamples=n={DUCK_FRAME_SAMPLES},volume='{expression}':eval=frame"


# -- the whole stem chain -----------------------------------------------------


def stem_chain(
    device: DeviceProfile | None, distance: float, effects: Effects | None = None
) -> str:
    """Everything acoustic that happens to one stem before it is panned and delayed.

    Distance first, device second, effects last, because that is the signal path: the sound crosses
    the room to the microphone, the channel — a phone, a horn, a wall — gets hold of it, and only
    what arrives is in the editor's hands.
    Reversing the two would band-limit the source and then darken it by distance, which double-
    counts the treble loss the device already imposed.

    Returns `""` when there is nothing to do, and `graph.nodes.track_filters` omits the parameter
    entirely in that case: a no-op filter is a cache key that moves for no audio reason.
    """

    parts = (
        distance_chain(distance),
        device_chain(device) if device else "",
        effects_chain(effects),
    )
    return ",".join(chain for chain in parts if chain)


# -- the room send-return -----------------------------------------------------

#: One option, and both halves of this line are measured decisions rather than defaults.
#:
#: **No `dry=0:wet=1`.** `afir` already outputs the convolution alone — it does not pass its input
#: through, so there is no dry signal here to turn off. Its `dry` option is an **input** gain
#: applied *before* the convolution, so the obvious-looking `afir=dry=0:wet=1` multiplies the
#: input by zero and the filter emits **silence**. Every gate passed on that: the graph is legal,
#: ffmpeg exits 0, the master is the right length and the right format, and a fixture rendered on
#: `FakeSpeech` is silence either way. It was caught by measuring the wet return's RMS against a
#: real noise stem, which is the only screen this class of mistake has. The room's `wet` level is
#: applied on the return instead (`reverb_chains`), where it is a number in the manifest.
#:
#: **`irnorm=-1` disables afir's own normalisation**, because `dsp.ir` has already done it. The
#: default is an L1 normalisation, and normalising an impulse response by the *sum of its
#: magnitudes* penalises a long tail twice — measured against a 4 s noise stem, it returned
#: `car` at -31.3 dB and `station-hall` at -43.4 dB, so the same authored `wet` would have meant
#: two things 12 dB apart. With the unit-energy IR passed through untouched, every one of the
#: seven rooms returns within 0.21 dB of the dry level, which is what makes `wet` a number an
#: editor can reason about.
#: The two spellings of "leave my IR alone", by ffmpeg generation. They are NOT interchangeable
#: where both parse: on ffmpeg 9, `gtype` is a deprecated no-op and the default `irnorm=1` (L1)
#: still applies — measured against a 4 s noise stem it put the same wet 34–46 dB down,
#: tail-length-dependent, the exact defect the unit-energy IR exists to remove. On ffmpeg 6.x
#: (Ubuntu's package, what CI runs) `irnorm` does not parse at all (exit 8) and `gtype=none` is
#: the disable. Which spelling is right is a property of the *installed binary*, so it is probed
#: from `ffmpeg -h filter=afir` once per process — at execution, never in node params, so node
#: hashes stay machine-independent. The CI-run wet-level measurement is what proves the legacy
#: spelling's semantics on 6.x rather than assuming them.
AFIR_PRENORMALIZED = "afir=irnorm=-1"
AFIR_PRENORMALIZED_LEGACY = "afir=gtype=none"


@functools.cache
def afir_disable_norm() -> str:
    """The afir invocation that passes the pre-normalised IR through untouched, per binary."""

    try:
        probe = subprocess.run(
            ["ffmpeg", "-hide_banner", "-h", "filter=afir"],
            capture_output=True,
            text=True,
            check=True,
        ).stdout
    except (OSError, subprocess.CalledProcessError) as exc:
        raise RuntimeError("ffmpeg is required to render (install it and retry)") from exc
    return AFIR_PRENORMALIZED if "irnorm" in probe else AFIR_PRENORMALIZED_LEGACY


def reverb_chains(*, ir_index: int, wet: float) -> list[str]:
    """The send-return, as the three filtergraph links `mix_filtergraph` appends.

    One convolution per render. Per-stem reverb amount is a *send gain* on the way into this bus
    (`distance_send_db`, `DeviceProfile.room_send_db`), which is how a single `afir` can still
    give a distant speaker more room than a close one.

    The IR is stored mono and duplicated to stereo here rather than passed with `afir`'s
    `irfmt=mono`, which is recent: Ubuntu's packaged ffmpeg is what CI has, and a filter option
    that is missing there fails the render rather than degrading it. The cost is that the reverb
    is mono-correlated — the same tail in both channels. A decorrelated stereo IR would sound
    wider and is a later improvement, not a correctness question.
    """

    return [
        f"[{ir_index}:a]pan=stereo|c0=c0|c1=c0[ir]",
        f"[send][ir]{afir_disable_norm()}[reverb]",
        f"[reverb]volume={wet:.4f}[wet]",
    ]
