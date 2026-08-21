"""Filter chains, twice over: the exact strings, and then what the strings do to real audio.

The string half is the `test_graph_nodes` argument — a filter chain is the part of this pipeline
that is wrong *silently*, and asserting it character by character is the only screen a
misinterpreted unit has. The measurement half exists because the string half cannot catch the
other failure: a chain that is exactly as written and does not sound like the thing it is named
after. "Sounds like a phone" is not an assertion a test can make, so the honest machine-checkable
version of it is measured instead — how far down the stopbands actually are.
"""

from __future__ import annotations

import subprocess
from pathlib import Path

import numpy as np
import pytest
import soundfile as sf

from listening_studio.dsp.chains import (
    AFIR_PRENORMALIZED,
    AFIR_PRENORMALIZED_LEGACY,
    afir_disable_norm,
    DISTANCE_LOWPASS_AT_UNITY_HZ,
    device_chain,
    distance_chain,
    distance_gain_db,
    distance_send_db,
    reverb_chains,
    stem_chain,
)
from listening_studio.dsp.profiles import load_acoustic_profiles

REPO = Path(__file__).resolve().parents[3]
RATE = 48_000


@pytest.fixture(scope="module")
def profiles():  # type: ignore[no-untyped-def]
    return load_acoustic_profiles(REPO)


# -- devices ------------------------------------------------------------------


def test_the_telephone_chain_is_the_band_then_the_levelling(profiles) -> None:  # type: ignore[no-untyped-def]
    """Three cascaded sections per edge: ffmpeg's biquads stop at 12 dB per octave each."""

    assert device_chain(profiles.device("telephone")) == (
        "highpass=f=300:p=2,highpass=f=300:p=2,highpass=f=300:p=2,"
        "lowpass=f=3400:p=2,lowpass=f=3400:p=2,lowpass=f=3400:p=2,"
        "acompressor=threshold=0.100000:ratio=4:attack=5:release=120:makeup=1.584893"
    )


def test_a_threshold_in_db_becomes_the_linear_amplitude_ffmpeg_wants(profiles) -> None:  # type: ignore[no-untyped-def]
    """-20 dB is 0.1 and +4 dB of makeup is 1.5849. Given in dB, ffmpeg wants neither."""

    chain = device_chain(profiles.device("telephone"))
    assert "threshold=0.100000" in chain
    assert "makeup=1.584893" in chain


def test_the_pa_chain_ends_on_its_level_offset_and_carries_no_reverb(profiles) -> None:  # type: ignore[no-untyped-def]
    """A device's extra room is a send, not a second reverb — so nothing here convolves."""

    chain = device_chain(profiles.device("pa"))
    assert chain == (
        "highpass=f=180:p=2,highpass=f=180:p=2,lowpass=f=5600:p=2,lowpass=f=5600:p=2,"
        "acompressor=threshold=0.079433:ratio=3.5:attack=8:release=200:makeup=1.412538,"
        "volume=-1dB"
    )
    assert "afir" not in chain and "aecho" not in chain
    assert profiles.device("pa").room_send_db == 5.0


def test_the_mobile_chain_puts_the_crush_inside_the_band(profiles) -> None:  # type: ignore[no-untyped-def]
    chain = device_chain(profiles.device("mobile"))
    assert "acrusher=bits=12:mix=0.3:mode=log" in chain
    assert chain.index("acrusher") > chain.index("lowpass")
    assert chain.index("acrusher") < chain.index("acompressor")


def test_next_room_is_a_wall_and_not_a_channel(profiles) -> None:  # type: ignore[no-untyped-def]
    assert device_chain(profiles.device("next-room")) == (
        "highpass=f=90:p=2,lowpass=f=850:p=2,lowpass=f=850:p=2,lowpass=f=850:p=2,volume=-13dB"
    )


# -- distance -----------------------------------------------------------------


def test_unit_distance_is_exactly_nothing() -> None:
    """The multiplier's identity has to be an empty chain, or every scene gains a filter."""

    assert distance_chain(1.0) == ""
    assert distance_gain_db(1.0) == 0.0
    assert distance_send_db(1.0) == 0.0


def test_a_doubling_costs_six_decibels_and_half_the_bandwidth() -> None:
    assert distance_chain(2.0) == "volume=-6.00dB,lowpass=f=8000:p=2"
    assert distance_chain(4.0) == "volume=-12.00dB,lowpass=f=4000:p=2"


def test_halving_the_distance_brings_it_forward() -> None:
    """A `distance` below 1 is a legal thing for a scene to say, and `clean` says it everywhere."""

    assert distance_chain(0.5) == "volume=6.00dB"
    # Nothing is brightened past the reference: the cutoff clamps rather than climbing to 32 kHz.
    assert "lowpass" not in distance_chain(0.5)


def test_the_formula_is_clamped_at_both_ends() -> None:
    """`Placement.distance` allows 0.0, and `log2(0)` is not a filter parameter."""

    assert distance_chain(0.0) == distance_chain(0.25)
    assert distance_chain(100.0) == distance_chain(8.0)


def test_a_further_source_sends_more_of_itself_into_the_room() -> None:
    assert distance_send_db(2.0) == 5.0
    assert distance_send_db(0.5) == pytest.approx(-2.5)
    # Clamped, so a scene at the far end of the window cannot flood the reverb bus.
    assert distance_send_db(8.0) == 9.0


def test_a_stem_chain_crosses_the_room_before_it_reaches_the_device(profiles) -> None:  # type: ignore[no-untyped-def]
    """Distance first, device second — the signal path, not an alphabetical order."""

    chain = stem_chain(profiles.device("telephone"), 2.0)
    assert chain.startswith("volume=-6.00dB,lowpass=f=8000:p=2,highpass=f=300")


def test_a_stem_with_neither_a_device_nor_a_distance_has_no_chain() -> None:
    assert stem_chain(None, 1.0) == ""


# -- the room send-return -----------------------------------------------------


def test_the_reverb_return_duplicates_a_mono_ir_and_adds_it_at_the_rooms_wet() -> None:
    assert reverb_chains(ir_index=5, wet=0.35) == [
        "[5:a]pan=stereo|c0=c0|c1=c0[ir]",
        f"[send][ir]{afir_disable_norm()}[reverb]",
        "[reverb]volume=0.3500[wet]",
    ]


def test_the_convolution_normalises_nothing_of_its_own() -> None:
    """Two mistakes this line is one character away from, both of them silent.

    `dry=0` reads as "no dry signal" and is an *input* gain: it would emit silence. And afir's
    default L1 normalisation would make the same authored `wet` mean 12 dB apart in a car and in
    a station hall, because it penalises a long tail twice over.
    """

    # Which spelling this machine gets is a property of its ffmpeg binary; what the test can
    # pin machine-independently is that the probe picks one of the two disable spellings and
    # NEVER an auto-gain default. The 6.x/9.x non-equivalence measurements live in chains.py.
    assert afir_disable_norm() in {AFIR_PRENORMALIZED, AFIR_PRENORMALIZED_LEGACY}
    assert AFIR_PRENORMALIZED == "afir=irnorm=-1"
    assert AFIR_PRENORMALIZED_LEGACY == "afir=gtype=none"


# -- what the chains actually do ----------------------------------------------


def _through_ffmpeg(chain: str, signal: np.ndarray, tmp_path: Path) -> np.ndarray:
    source, target = tmp_path / "in.wav", tmp_path / "out.wav"
    sf.write(str(source), signal, RATE, subtype="PCM_24")
    subprocess.run(
        [
            "ffmpeg", "-v", "error", "-i", str(source), "-filter:a", chain,
            "-ar", str(RATE), "-ac", "1", "-c:a", "pcm_s24le", "-y", str(target),
        ],
        check=True,
    )
    read, _rate = sf.read(str(target))
    return np.asarray(read, dtype=np.float64)


def _band_psd(samples: np.ndarray, low: float, high: float) -> float:
    """Mean power spectral density in one band — a *density*, not a total.

    Bands of different widths are being compared, so totals would make the wider band win by
    arithmetic. The mean per bin is the figure that answers "how much is there, per hertz".
    """

    spectrum = np.abs(np.fft.rfft(samples)) ** 2
    frequencies = np.fft.rfftfreq(len(samples), 1.0 / RATE)
    selected = (frequencies >= low) & (frequencies < high)
    return float(np.mean(spectrum[selected]))


#: Broadband noise, not a swept sine. A sweep presents the chain with one tone at a time, and a
#: compressor's gain modulation on a single tone generates harmonics that land squarely in the
#: stopbands — measuring those would be measuring the compressor's distortion rather than the
#: channel's band. Under noise every band is excited at once, the compressor settles to a steady
#: gain, and what the FFT reads is the transfer function. Seeded, so the figures are reproducible.
def _noise(seconds: float = 4.0, seed: int = 7) -> np.ndarray:
    return 0.15 * np.random.default_rng(seed).standard_normal(int(RATE * seconds))


def test_a_telephone_stem_is_measurably_a_telephone(profiles, tmp_path: Path) -> None:  # type: ignore[no-untyped-def]
    """The objective version of "sounds like a phone", since nothing here can listen.

    Both stopbands at least 20 dB below the passband, measured as mean PSD. The measured figures
    on ffmpeg 9.0.1 are -22.5 dB below 250 Hz and -27.9 dB above 4 kHz, so the bar is met with
    2.5 dB and 7.9 dB of margin respectively.
    """

    output = _through_ffmpeg(device_chain(profiles.device("telephone")), _noise(), tmp_path)
    passband = _band_psd(output, 400.0, 3000.0)
    below = 10.0 * np.log10(_band_psd(output, 20.0, 250.0) / passband)
    above = 10.0 * np.log10(_band_psd(output, 4000.0, 20000.0) / passband)
    assert below <= -20.0, f"below 250 Hz is only {below:.1f} dB down"
    assert above <= -20.0, f"above 4 kHz is only {above:.1f} dB down"


def test_a_next_room_stem_loses_everything_above_the_wall(profiles, tmp_path: Path) -> None:  # type: ignore[no-untyped-def]
    """Different device, different claim: a wall is a lowpass, so the top has to be gone.

    Measured at -67.5 dB in the 4–6 kHz band against 300–700 Hz, which is what a 36 dB/octave
    slope from 850 Hz buys.
    """

    output = _through_ffmpeg(device_chain(profiles.device("next-room")), _noise(), tmp_path)
    passband = _band_psd(output, 300.0, 700.0)
    above = 10.0 * np.log10(_band_psd(output, 4000.0, 6000.0) / passband)
    assert above <= -30.0, f"above the wall is only {above:.1f} dB down"


def test_distance_takes_six_decibels_out_of_a_stem(tmp_path: Path) -> None:
    """The formula, measured rather than read back out of the string that encodes it."""

    signal = _noise(seconds=2.0)
    close = _through_ffmpeg("anull", signal, tmp_path)
    far = _through_ffmpeg(distance_chain(2.0), signal, tmp_path)
    # In the band the distance lowpass has not reached yet, the whole difference is the gain.
    band = (200.0, 1000.0)
    drop = 10.0 * np.log10(_band_psd(far, *band) / _band_psd(close, *band))
    assert drop == pytest.approx(-6.0, abs=0.5)
    # …and above the cutoff there is more than the gain missing.
    high = 10.0 * np.log10(
        _band_psd(far, 16000.0, 20000.0) / _band_psd(close, 16000.0, 20000.0)
    )
    assert high < -12.0
    assert DISTANCE_LOWPASS_AT_UNITY_HZ == 16_000.0


# -- the room, measured -------------------------------------------------------
#
# The tests below are the ones that catch the class of mistake the `AFIR` comment records: a
# filtergraph that is legal, exits 0, produces a file of the right length and format, and carries
# no reverb at all. Nothing upstream can see it — every fixture scene in this suite renders on
# `FakeSpeech`, which is silence, so a silent wet bus and a working one are the same bytes.


def _wet_return(room_id: str, wet: float, tmp_path: Path) -> float:
    """The reverb return's level relative to the dry stem, in dB, through the real filtergraph."""

    from listening_studio.dsp.ir import write_ir

    room = load_acoustic_profiles(REPO).room(room_id)
    ir = tmp_path / f"{room_id}.wav"
    write_ir(
        ir,
        seed=room.ir.seed,
        decay_s=room.ir.decay_s,
        pre_delay_ms=room.ir.pre_delay_ms,
        lowpass_hz=room.ir.lowpass_hz,
        early_reflections=room.ir.early_reflections,
    )
    stem = np.repeat(_noise(seconds=4.0)[:, None], 2, axis=1)
    source, target = tmp_path / "stem.wav", tmp_path / "wet.wav"
    sf.write(str(source), stem, RATE, subtype="PCM_24")
    # The send-return alone, built from the same three links `mix_filtergraph` appends. The dry
    # bus and the limiter are left out on purpose: what is being measured is the return's level,
    # and a limiter in the path would compress exactly the figure under test.
    links = ["[0:a]anull[send]", *reverb_chains(ir_index=1, wet=wet)]
    graph = ";".join(links).replace("[wet]", "[out]")
    subprocess.run(
        [
            "ffmpeg", "-v", "error", "-i", str(source), "-i", str(ir),
            "-filter_complex", graph, "-map", "[out]",
            "-ar", str(RATE), "-ac", "2", "-c:a", "pcm_s24le", "-y", str(target),
        ],
        check=True,
    )
    returned, _rate = sf.read(str(target))
    dry = float(np.sqrt(np.mean(stem**2)))
    got = float(np.sqrt(np.mean(np.asarray(returned) ** 2)))
    return 20.0 * float(np.log10(max(got, 1e-12) / dry))


def test_the_convolution_actually_returns_signal(tmp_path: Path) -> None:
    """`afir=dry=0:wet=1` reads as "wet only" and emits silence. This is the screen for that."""

    assert _wet_return("cafe", wet=1.0, tmp_path=tmp_path) > -3.0


def test_the_rooms_wet_level_is_the_return_level(tmp_path: Path) -> None:
    """A `wet` of 0.35 is a return 9 dB under the dry — the point of applying it on the return."""

    assert _wet_return("cafe", wet=0.35, tmp_path=tmp_path) == pytest.approx(-9.2, abs=1.0)


@pytest.mark.parametrize("room_id", ["car", "cafe", "station-hall"])
def test_the_same_wet_means_the_same_level_in_every_room(room_id: str, tmp_path: Path) -> None:
    """What unit-energy normalisation plus `irnorm=-1` buys, and the reason for both.

    Under afir's default L1 normalisation the same figure meant -31.3 dB in `car` and -43.4 dB in
    `station-hall`; every room would have needed its authored `wet` tuned to cancel its own
    length, which is not a number an editor could reason about.
    """

    assert _wet_return(room_id, wet=1.0, tmp_path=tmp_path) == pytest.approx(0.0, abs=0.5)
