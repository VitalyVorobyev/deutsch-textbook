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

import math

from .profiles import BandFilter, Compression, DeviceProfile

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


# -- the whole stem chain -----------------------------------------------------


def stem_chain(device: DeviceProfile | None, distance: float) -> str:
    """Everything acoustic that happens to one stem before it is panned and delayed.

    Distance first, device second, because that is the signal path: the sound crosses the room to
    the microphone, and only then does the channel — a phone, a horn, a wall — get hold of it.
    Reversing the two would band-limit the source and then darken it by distance, which double-
    counts the treble loss the device already imposed.

    Returns `""` when there is nothing to do, and `graph.nodes.track_filters` omits the parameter
    entirely in that case: a no-op filter is a cache key that moves for no audio reason.
    """

    parts = [chain for chain in (distance_chain(distance), device_chain(device) if device else "")]
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
AFIR = "afir=irnorm=-1"


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
        f"[send][ir]{AFIR}[reverb]",
        f"[reverb]volume={wet:.4f}[wet]",
    ]
