"""Node identity and the filter strings, neither of which needs a single sample of audio.

Both halves exist for the same reason: they are the parts of the render that are wrong
*silently*. A hash that ignores one parameter serves a stale take forever and every file on disk
looks right; an `adelay` with one value on a stereo stream delays the left channel only and the
render still succeeds. Asserting the strings is the only screen either failure has.
"""

from __future__ import annotations

from listening_studio.generative.fake import FakeSpeech
from listening_studio.generative.gateway import SpeechRequest
from listening_studio.graph.nodes import (
    IMPL_VERSIONS,
    LIMITER,
    LOUDNORM,
    MixInput,
    Node,
    import_filters,
    mix_filtergraph,
    pan_filter,
    synth_node,
    track_filters,
)


def node(**overrides: object) -> Node:
    base: dict[str, object] = {
        "type": "synth",
        "impl_version": 1,
        "params": {"voice": "Vivian", "seed": 101},
        "inputs": (),
    }
    base.update(overrides)
    return Node(**base)  # type: ignore[arg-type]


# -- identity -----------------------------------------------------------------


def test_the_same_parameters_hash_the_same() -> None:
    assert node().node_hash() == node().node_hash()


def test_parameter_key_order_does_not_change_the_hash() -> None:
    """A dict is not ordered content. Two authors writing the same node must reuse one take."""

    first = node(params={"voice": "Vivian", "seed": 101})
    second = node(params={"seed": 101, "voice": "Vivian"})
    assert first.node_hash() == second.node_hash()


def test_nested_parameter_key_order_does_not_change_the_hash_either() -> None:
    """`sort_keys` recurses, and a `SpeechRequest` dump nests `params` inside itself."""

    first = node(params={"request": {"text": "Hallo", "params": {"a": 1, "b": 2}}})
    second = node(params={"request": {"params": {"b": 2, "a": 1}, "text": "Hallo"}})
    assert first.node_hash() == second.node_hash()


def test_a_changed_parameter_changes_the_hash() -> None:
    assert node().node_hash() != node(params={"voice": "Eric", "seed": 101}).node_hash()


def test_an_input_hash_change_propagates() -> None:
    """The whole point of the tree: a new take must not be paced by reading the old paced file."""

    downstream = node(type="pace", params={"pace": 1.0}, inputs=("a" * 64,))
    moved = node(type="pace", params={"pace": 1.0}, inputs=("b" * 64,))
    assert downstream.node_hash() != moved.node_hash()


def test_input_order_does_not_change_the_hash() -> None:
    """Inputs are sorted: a mix is the same mix however its stems were enumerated."""

    left = node(type="mix", params={}, inputs=("a" * 64, "b" * 64))
    right = node(type="mix", params={}, inputs=("b" * 64, "a" * 64))
    assert left.node_hash() == right.node_hash()


def test_an_impl_version_bump_changes_the_hash() -> None:
    """The cache-invalidation contract, exercised: bumping a version retires that node's cache."""

    assert node().node_hash() != node(impl_version=2).node_hash()


def test_every_node_type_starts_at_impl_version_one() -> None:
    assert set(IMPL_VERSIONS) == {
        "synth", "pace", "sound-gen", "import", "track", "mix", "loudnorm", "encode"
    }
    assert set(IMPL_VERSIONS.values()) == {1}


def test_a_synth_node_is_keyed_by_the_engine_that_actually_ran() -> None:
    """Not by the engine the cast declared — that is how a fake take poisons a Qwen cache slot."""

    request = SpeechRequest(text="Guten Tag.", voice="Vivian", seed=101)
    built = synth_node(request, FakeSpeech())
    assert built.params["engine"] == "fake"
    assert built.params["engine_revision"] == FakeSpeech.revision
    assert built.impl_version == IMPL_VERSIONS["synth"]


# -- filtergraph --------------------------------------------------------------


def test_the_pan_law_is_constant_power() -> None:
    assert pan_filter(0.0) == "pan=stereo|c0=0.707107*c0|c1=0.707107*c0"
    assert pan_filter(-1.0) == "pan=stereo|c0=1.000000*c0|c1=0.000000*c0"
    assert pan_filter(1.0) == "pan=stereo|c0=0.000000*c0|c1=1.000000*c0"


def test_a_centred_pan_keeps_the_same_power_as_a_hard_one() -> None:
    """The property the law exists for, checked as arithmetic rather than as a string.

    Read off the *rendered filter*, not off the maths that produced it: what ffmpeg receives is
    six decimal places, so the identity is asserted to the precision the audio actually gets
    (≈5e-7 at the worst position) rather than to the precision `math.cos` had.
    """

    for pan in (-1.0, -0.5, 0.0, 0.25, 1.0):
        left, right = (
            float(part.split("=")[-1].removesuffix("*c0"))
            for part in pan_filter(pan).split("|")[1:]
        )
        assert abs(left**2 + right**2 - 1.0) < 1e-5


def test_a_speech_track_pans_then_delays_and_states_both_channels() -> None:
    assert track_filters(pan=0.0, gain_db=0.0, delay_ms=800, window_ms=None) == (
        "pan=stereo|c0=0.707107*c0|c1=0.707107*c0,adelay=800|800"
    )


def test_a_gain_is_applied_to_the_take_and_not_to_the_delay_silence() -> None:
    assert track_filters(pan=-0.5, gain_db=-18.0, delay_ms=300, window_ms=None) == (
        "pan=stereo|c0=0.923880*c0|c1=0.382683*c0,volume=-18dB,adelay=300|300"
    )


def test_a_bed_is_trimmed_to_its_window_before_anything_else() -> None:
    assert track_filters(pan=0.0, gain_db=-24.0, delay_ms=0, window_ms=9000) == (
        "atrim=duration=9.000,asetpts=PTS-STARTPTS,"
        "pan=stereo|c0=0.707107*c0|c1=0.707107*c0,volume=-24dB"
    )


def test_an_unmoved_unattenuated_track_carries_no_extra_filters() -> None:
    """A no-op filter is a cache key that changes for no audio reason."""

    assert track_filters(pan=0.0, gain_db=0.0, delay_ms=0, window_ms=None) == (
        "pan=stereo|c0=0.707107*c0|c1=0.707107*c0"
    )


def test_an_import_trim_states_a_duration_only_when_the_scene_gave_one() -> None:
    assert import_filters(500, 1600) == "atrim=start=0.500:duration=1.600,asetpts=PTS-STARTPTS"
    assert import_filters(500, None) == "atrim=start=0.500,asetpts=PTS-STARTPTS"


def test_the_mix_sums_per_bus_then_masters_with_the_limiter() -> None:
    graph = mix_filtergraph(
        [
            MixInput(stem_id="line-1", bus="dialogue"),
            MixInput(stem_id="line-2", bus="dialogue"),
            MixInput(stem_id="line-3", bus="dialogue"),
            MixInput(
                stem_id="ambience-1",
                bus="ambience",
                fade_in_ms=350,
                fade_in_start_ms=0,
                fade_out_ms=450,
                fade_out_start_ms=9550,
            ),
            MixInput(stem_id="sfx-1", bus="sfx"),
        ]
    )
    assert graph == ";".join(
        [
            "[3:a]afade=t=in:st=0.000:d=0.350,afade=t=out:st=9.550:d=0.450[s3]",
            "[0:a][1:a][2:a]amix=inputs=3:duration=longest:normalize=0[dialogue]",
            "[s3]amix=inputs=1:duration=longest:normalize=0[ambience]",
            "[4:a]amix=inputs=1:duration=longest:normalize=0[sfx]",
            "[dialogue][ambience][sfx]amix=inputs=3:duration=longest:normalize=0,"
            f"{LIMITER}[out]",
        ]
    )


def test_a_speech_only_mix_has_one_bus_and_still_ends_on_the_limiter() -> None:
    """This graph is `dry.wav`, which the soundscape diagnostic measures the final mix against."""

    graph = mix_filtergraph([MixInput(stem_id="line-1", bus="dialogue")])
    assert graph == (
        "[0:a]amix=inputs=1:duration=longest:normalize=0[dialogue];"
        f"[dialogue]amix=inputs=1:duration=longest:normalize=0,{LIMITER}[out]"
    )


def test_the_loudness_target_is_the_shipped_corpus_target() -> None:
    """A scene rendered louder than the 41 artifacts beside it is a defect no gate would see."""

    assert LOUDNORM == "loudnorm=I=-19:TP=-1.5:LRA=7"
