"""Synthetic impulse responses: a room profile's five numbers become one convolvable WAV.

Why synthesise rather than ship recordings. A convolution reverb is only as good as its impulse
response, and good IRs are somebody's work — a captured hall carries a licence, an attribution and
a provenance record, exactly like the Freesound room tones `sources.py` already handles. Seven
rooms would be seven such records for material the learner never hears directly. Generated noise
under an exponential envelope is a coarser room than a captured one, and it is *this repository's*
room: no licence, no attribution, and a header comment saying plainly that the numbers are
editorial rather than measured.

**Determinism is the contract.** The IR is a content-addressed asset and its sha is an input to
the mix node, so the same five numbers must produce the same bytes on every machine and in every
process. Everything random here comes from `numpy.random.default_rng(seed)` in a fixed call order;
nothing reads the clock, the process id or a set iteration order.

What is generated, in order:

1. **Silence for the pre-delay.** The gap between the direct sound and the first reflection, which
   is how the ear reads the size of a space rather than its liveness.
2. **A few discrete early reflections.** Individual taps, signed, at positions drawn once from the
   seeded generator. Their amplitudes ride the same decay envelope as the tail, so they blend into
   it rather than sitting on top of it.
3. **A diffuse tail.** Gaussian noise under `exp(-ln(1000)·t/decay_s)`, which is the definition of
   RT60: 60 dB of decay in exactly `decay_s` seconds.
4. **Damping.** A one-pole lowpass whose cutoff sweeps downward across the tail, because soft
   surfaces absorb treble faster than bass and a tail that keeps its brightness to the end sounds
   like a delay line, not like a room.

**There is no direct impulse at sample zero.** This IR is used on a send, and the dry signal
reaches the master by its own path; a direct hit here would sum a second, unattenuated copy of
every stem into the mix. That is the single most common way a send-return reverb goes wrong, and
it is inaudible as a defect — it just sounds louder.
"""

from __future__ import annotations

import math
from pathlib import Path
from typing import Any

import numpy as np
import numpy.typing as npt

#: Bumped when *this generator* changes what bytes come out of the same profile. Separate from
#: the room's own `version` in the data file: that one says the editor decided on a different
#: room, this one says the code makes a different room out of the same description.
IR_IMPL_VERSION = 1

#: The rate the render graph works at (`graph.nodes.WORKING_RATE`). Restated rather than imported:
#: nothing in `dsp` imports from `graph`, and a mismatch would be caught by ffmpeg refusing to
#: convolve streams at different rates rather than by producing a subtly wrong room.
IR_RATE = 48_000

#: 24-bit PCM, matching the working master's `pcm_s24le`. Not 16-bit: an IR's tail spends most of
#: its length 40–60 dB below its peak, which is where 16-bit quantisation noise lives.
IR_SUBTYPE = "PCM_24"

#: RT60 is 60 dB of decay, and 60 dB is a factor of 1000 in amplitude.
RT60_LN = math.log(1000.0)

#: **Unit energy**, not unit peak: the IR is scaled so that `sum(ir²) == 1`.
#:
#: This is what makes a room's `wet` mean the same thing in every room. Convolving a signal with a
#: unit-energy impulse response returns roughly the signal's own level, so `wet: 0.20` is "the
#: reverb return sits about 14 dB under the dry" whether the room is a car or a station hall.
#: Peak normalisation — the obvious choice, and the first one tried — is not: measured against a
#: 4 s noise stem, a peak-normalised `car` returned -31.3 dB and a peak-normalised `station-hall`
#: -43.4 dB, so the same `wet` figure would have meant two things 12 dB apart, and every room
#: would have needed its `wet` tuned to cancel its own length.
#:
#: The stored WAV is quiet as a result — a long tail spreads unit energy over a hundred thousand
#: samples, so the peak lands a long way below full scale. That costs nothing: 24-bit PCM at a
#: peak of 0.04 still has better than 19 bits of the signal, and the file is convolution
#: coefficients rather than something anyone listens to.
IR_ENERGY = 1.0

#: A guard, not a target. Unit energy cannot push a decaying noise IR anywhere near full scale,
#: and if it ever did the file would clip on the way to disk — silently, since libsndfile clamps.
IR_PEAK_CEILING = 0.9

#: Early reflections are drawn into this window after the pre-delay. 70 ms is roughly where the
#: ear stops hearing individual reflections and starts hearing a room.
IR_EARLY_WINDOW_MS = 70.0

#: How loud the first reflections are relative to the diffuse tail's envelope. Above 1.0 because
#: a real early reflection *is* louder than the diffuse energy arriving at the same instant — it
#: is one specular bounce rather than a share of the scattered field.
IR_EARLY_GAIN = 3.0

#: The damping sweep: the lowpass cutoff falls from `lowpass_hz` to this fraction of it across
#: the tail. A quarter is two octaves, which is an ordinary amount of high-frequency absorption
#: over an RT60.
IR_DAMPING_SWEEP = 0.25


def synthesize_ir(
    *,
    seed: int,
    decay_s: float,
    pre_delay_ms: int,
    lowpass_hz: float,
    early_reflections: int,
) -> npt.NDArray[np.float64]:
    """One mono impulse response, peak-normalised, at `IR_RATE`.

    Keyword-only and taking the five numbers rather than a `RoomIrSpec`, so the generator can be
    called from a test with values no profile has and stays independent of the model that carries
    them.
    """

    rng = np.random.default_rng(seed)
    tail_samples = int(round(decay_s * IR_RATE))
    pre_samples = int(round(pre_delay_ms / 1000.0 * IR_RATE))
    total = pre_samples + tail_samples

    # -- the diffuse tail -----------------------------------------------------
    noise = rng.standard_normal(tail_samples)
    seconds = np.arange(tail_samples, dtype=np.float64) / IR_RATE
    envelope = np.exp(-RT60_LN * seconds / decay_s)
    tail = noise * envelope

    # -- damping --------------------------------------------------------------
    #
    # A one-pole lowpass with a time-varying coefficient. Recursive by definition, so this is a
    # Python loop rather than a vectorised expression: `y[n] = y[n-1] + a[n]·(x[n] - y[n-1])`
    # cannot be written as an array operation without a scan primitive numpy does not have. It
    # costs a few tens of milliseconds for the longest room here and runs once per room ever,
    # because the result is a content-addressed asset.
    cutoff = np.linspace(lowpass_hz, lowpass_hz * IR_DAMPING_SWEEP, tail_samples)
    alpha = 1.0 - np.exp(-2.0 * math.pi * cutoff / IR_RATE)
    damped = np.empty(tail_samples, dtype=np.float64)
    state = 0.0
    for index in range(tail_samples):
        state += float(alpha[index]) * (float(tail[index]) - state)
        damped[index] = state

    impulse = np.zeros(total, dtype=np.float64)
    impulse[pre_samples:] = damped

    # -- early reflections ----------------------------------------------------
    if early_reflections:
        window = max(1, int(IR_EARLY_WINDOW_MS / 1000.0 * IR_RATE))
        offsets = np.sort(rng.integers(1, window + 1, size=early_reflections))
        signs = rng.choice(np.array([-1.0, 1.0]), size=early_reflections)
        for offset, sign in zip(offsets, signs, strict=True):
            position = pre_samples + int(offset)
            if position >= total:
                continue
            age = float(offset) / IR_RATE
            impulse[position] += (
                float(sign) * IR_EARLY_GAIN * math.exp(-RT60_LN * age / decay_s)
            )

    energy = float(np.sqrt(np.sum(impulse**2)))
    if energy == 0.0:  # pragma: no cover - a positive decay always leaves energy
        raise ValueError("the generated impulse response is silent")
    normalised = impulse * (IR_ENERGY / energy)
    peak = float(np.max(np.abs(normalised)))
    if peak > IR_PEAK_CEILING:  # pragma: no cover - unreachable for any legal profile
        raise ValueError(
            f"the generated impulse response peaks at {peak:.3f}, above the {IR_PEAK_CEILING} "
            "ceiling; it would clip on the way to a WAV"
        )
    return normalised


def write_ir(
    target: Path,
    *,
    seed: int,
    decay_s: float,
    pre_delay_ms: int,
    lowpass_hz: float,
    early_reflections: int,
) -> dict[str, Any]:
    """Generate one room and write it as a 48 kHz mono WAV. Returns the generator's parameters.

    The returned dict is what the asset's provenance sidecar records: every input the generator
    read, plus `ir_impl_version`. An IR is the one asset in this pipeline whose bytes nobody can
    trace back to a model or a licence record, so the sidecar has to carry the whole recipe.
    """

    import soundfile as sf

    impulse = synthesize_ir(
        seed=seed,
        decay_s=decay_s,
        pre_delay_ms=pre_delay_ms,
        lowpass_hz=lowpass_hz,
        early_reflections=early_reflections,
    )
    target.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(target), impulse, IR_RATE, subtype=IR_SUBTYPE)
    return {
        "kind": "impulse-response",
        "ir_impl_version": IR_IMPL_VERSION,
        "generator": "listening_studio.dsp.ir.synthesize_ir",
        "params": {
            "seed": seed,
            "decay_s": decay_s,
            "pre_delay_ms": pre_delay_ms,
            "lowpass_hz": lowpass_hz,
            "early_reflections": early_reflections,
        },
        "rate": IR_RATE,
        "channels": 1,
        "subtype": IR_SUBTYPE,
        "normalisation": "unit-energy",
        "energy": IR_ENERGY,
    }
