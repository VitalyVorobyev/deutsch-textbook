"""The mixing fields: speech gain, effects, ducking, and per-scene room and device overrides.

Two properties matter beyond "the field reaches the audio". A scene that uses none of them must
hash and render exactly as it did before they existed, because approvals and render trees are
bound to `Scene.sha256()`; and each one must change the audio by the amount it states, which only
a measurement of the rendered stem can show.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pytest
import soundfile as sf
from pydantic import ValidationError

from listening_studio.dsp.chains import (
    DUCK_HOLD_GAP_MS,
    duck_chain,
    duck_spans,
    effects_chain,
)
from listening_studio.graph.assets import AssetStore
from listening_studio.scene.model import (
    AmbienceEntry,
    AssetRef,
    DeviceOverrides,
    Effects,
    Equalizer,
    Placement,
    RoomOverrides,
    Scene,
    SceneAcoustics,
    SpeechEntry,
)
from listening_studio.scene.schema_export import FIXTURE_DIR

from test_graph_render import ToneSpeech, cafe_scene, render, tone_in_store

REPO = Path(__file__).resolve().parents[4]

#: The fixtures' hashes before any mixing field existed. A stored approval names one of these.
PINNED = {
    "dialogue-ls-wohnen-01.scene.json": (
        "3e19255587e3fef98d225f55461e8de6e784c53cd79c458da4fb8a33252ed279"
    ),
    "narration-a1-erste-schritte.scene.json": (
        "e798bbd493af2d99301e297a190ff951ff1f87b370cda274e5ef96955b8f6d9b"
    ),
}


def fixture(name: str) -> Scene:
    return Scene.model_validate_json((REPO / FIXTURE_DIR / name).read_text())


# -- identity -----------------------------------------------------------------


@pytest.mark.parametrize("name", sorted(PINNED))
def test_a_scene_using_no_mixing_field_keeps_the_hash_it_had(name: str) -> None:
    assert fixture(name).sha256() == PINNED[name]


def test_a_neutral_value_written_out_is_the_same_scene_as_one_left_out() -> None:
    raw = json.loads((REPO / FIXTURE_DIR / "dialogue-ls-wohnen-01.scene.json").read_text())
    for entry in raw["timeline"]:
        if entry["type"] == "speech":
            entry.update(gain_db=0.0, effects=None)
        elif entry["type"] == "ambience":
            entry["duck_db"] = 0.0
        else:
            entry["effects"] = None
    explicit = Scene.model_validate(raw)
    assert explicit.sha256() == PINNED["dialogue-ls-wohnen-01.scene.json"]
    assert "duck_db" not in explicit.canonical_json()
    assert "gain_db\":0.0" not in explicit.canonical_json()


def test_a_mixing_field_that_says_something_is_part_of_the_scene() -> None:
    scene = fixture("dialogue-ls-wohnen-01.scene.json")
    timeline = list(scene.timeline)
    timeline[0] = SpeechEntry(utterance_id="line-1", gain_db=-3.0)
    louder = scene.model_copy(update={"timeline": timeline})
    assert louder.sha256() != scene.sha256()
    assert Scene.model_validate_json(louder.canonical_json()).sha256() == louder.sha256()


def test_the_mixed_fixture_carries_every_mixing_field_and_round_trips() -> None:
    scene = fixture("dialogue-mixed.scene.json")
    canonical = scene.canonical_json()
    for key in ("room_overrides", "device_overrides", "effects", "duck_db", '"gain_db":-3.0'):
        assert key in canonical, key
    assert Scene.model_validate_json(canonical).sha256() == scene.sha256()


# -- validation ---------------------------------------------------------------


def test_an_override_or_effect_that_changes_nothing_is_written_as_null() -> None:
    for build in (RoomOverrides, DeviceOverrides, Effects, Equalizer):
        with pytest.raises(ValidationError, match="changes nothing"):
            build()


def test_overrides_need_the_thing_they_override() -> None:
    with pytest.raises(ValidationError, match="names none"):
        Placement(device_overrides=DeviceOverrides(gain_db=-3.0))
    with pytest.raises(ValidationError, match="names none"):
        SceneAcoustics(room_overrides=RoomOverrides(wet=0.3))


def test_an_effects_band_that_passes_nothing_is_refused() -> None:
    with pytest.raises(ValidationError, match="passes nothing"):
        Effects.model_validate({"highpass": {"hz": 3000}, "lowpass": {"hz": 1000}})


# -- filter strings -----------------------------------------------------------


def test_the_effects_chain_runs_bands_eq_crush_then_compressor() -> None:
    effects = Effects.model_validate(
        {
            "highpass": {"hz": 120},
            "eq": {"low_db": -3, "high_db": 2},
            "crush": {"bits": 12, "mix": 0.2},
            "compression": {
                "threshold_db": -20, "ratio": 4, "attack_ms": 5, "release_ms": 100, "makeup_db": 0
            },
        }
    )
    chain = effects_chain(effects)
    assert chain.split(",")[0] == "highpass=f=120:p=2"
    assert "lowshelf=f=200:g=-3" in chain and "highshelf=f=5000:g=2" in chain
    # A flat band emits nothing, so it cannot move a node hash.
    assert "equalizer=" not in chain
    assert chain.index("acrusher") < chain.index("acompressor")
    assert effects_chain(Effects(room_send_db=3.0)) == ""


def test_turns_closer_than_the_hold_gap_are_one_ducked_stretch() -> None:
    speech = [(1000, 2000), (2000 + DUCK_HOLD_GAP_MS - 1, 4000), (9000, 9500), (30_000, 31_000)]
    assert duck_spans(speech, window_start_ms=500, window_end_ms=20_000) == [
        (500, 3500),
        (8500, 9000),
    ]
    assert duck_chain(0.0, [(0, 100)]) == "" and duck_chain(-6.0, []) == ""


# -- rendering ----------------------------------------------------------------


def stem(result, stem_id: str) -> np.ndarray:  # type: ignore[no-untyped-def]
    audio, _ = sf.read(str(result.directory / "stems" / f"{stem_id}.wav"), always_2d=True)
    return audio


def rms_db(samples: np.ndarray) -> float:
    return float(20 * np.log10(max(float(np.sqrt(np.mean(samples**2))), 1e-12)))


def test_an_unmixed_scene_renders_to_the_same_nodes_as_before(tmp_path: Path) -> None:
    """Neutral values written out change no node: the same graph, all of it cached."""

    ref = tone_in_store(tmp_path)
    first = render(cafe_scene(ref), tmp_path)
    timeline = [
        entry.model_copy(update={"gain_db": 0.0}) if isinstance(entry, SpeechEntry)
        else entry.model_copy(update={"duck_db": 0.0}) if isinstance(entry, AmbienceEntry)
        else entry
        for entry in cafe_scene(ref).timeline
    ]
    second = render(cafe_scene(ref, timeline=timeline), tmp_path)
    assert [row.node_hash for row in second.nodes] == [row.node_hash for row in first.nodes]
    assert all(row.cached for row in second.nodes)


def test_speech_gain_moves_that_line_by_the_stated_amount(tmp_path: Path) -> None:
    ref = tone_in_store(tmp_path)
    timeline = list(cafe_scene(ref).timeline)
    timeline[0] = SpeechEntry(utterance_id="line-1", gain_db=-6.0)
    plain = render_with_tone(cafe_scene(ref), tmp_path)
    quieter = render_with_tone(cafe_scene(ref, timeline=timeline), tmp_path)
    before = stem(plain, "line-1")
    after = stem(quieter, "line-1")
    assert rms_db(before) > -40  # a tone, so the comparison is between two signals
    assert rms_db(after) - rms_db(before) == pytest.approx(-6.0, abs=0.1)


def test_effects_and_device_overrides_reach_the_stem_chain(tmp_path: Path) -> None:
    ref = tone_in_store(tmp_path)
    timeline = list(cafe_scene(ref).timeline)
    timeline[0] = SpeechEntry(
        utterance_id="line-1",
        placement=Placement(device="telephone", device_overrides=DeviceOverrides(lowpass_hz=2500)),
        effects=Effects(eq=Equalizer(mid_db=3.0)),
    )
    result = render(cafe_scene(ref, timeline=timeline), tmp_path)
    treated = next(row for row in result.nodes if row.type == "track" and row.params.get("fx"))
    fx = treated.params["fx"]
    assert "lowpass=f=2500:p=2" in fx
    assert fx.endswith("equalizer=f=1500:t=q:w=1:g=3")
    assert treated.params["acoustics"]["device_overrides"] == {"lowpass_hz": 2500.0}
    assert treated.params["acoustics"]["effects"]["eq"]["mid_db"] == 3.0


def test_a_room_override_is_a_different_impulse_response(tmp_path: Path) -> None:
    ref = tone_in_store(tmp_path)
    plain = render(cafe_scene(ref, acoustics=SceneAcoustics(room="cafe")), tmp_path)
    drier = render(
        cafe_scene(
            ref,
            acoustics=SceneAcoustics(room="cafe", room_overrides=RoomOverrides(decay_s=0.3, wet=0.1)),
        ),
        tmp_path,
    )
    ir = {row.node_hash: row.params for row in plain.nodes if row.type == "ir"}
    ir_drier = {row.node_hash: row.params for row in drier.nodes if row.type == "ir"}
    assert ir.keys().isdisjoint(ir_drier.keys())
    assert next(iter(ir_drier.values()))["ir"]["decay_s"] == 0.3
    manifest = json.loads(drier.manifest_path.read_text())
    assert manifest["acoustics"]["wet"] == 0.1
    assert manifest["acoustics"]["room_overrides"] == {"decay_s": 0.3, "wet": 0.1}


def test_a_ducked_bed_drops_by_duck_db_under_speech_and_recovers_after(tmp_path: Path) -> None:
    """Measured on the rendered bed, the only screen an expression that parses but does nothing has."""

    ref = tone_in_store(tmp_path)
    speech = list(cafe_scene(ref).timeline)[:3]
    # A two-second lead-in gives the bed a long unducked stretch, past its fade-in, to compare with.
    ducked = cafe_scene(
        ref,
        timeline=[*speech, AmbienceEntry(sound=AssetRef(ref=ref), gain_db=-24.0, duck_db=-12.0)],
        acoustics=SceneAcoustics(lead_in_ms=2000),
    )
    result = render_with_tone(ducked, tmp_path)
    bed = next(
        row for row in result.nodes
        if row.type == "track" and "duck_spans" in row.params.get("acoustics", {})
    )
    ((start, end),) = bed.params["acoustics"]["duck_spans"]
    assert start == 2000
    audio, rate = sf.read(str(AssetStore(tmp_path).require(bed.asset)), always_2d=True)
    under = audio[int((start + 300) / 1000 * rate) : int((end - 300) / 1000 * rate)]
    lead = audio[int(0.5 * rate) : int((start - 300) / 1000 * rate)]
    assert rms_db(under) - rms_db(lead) == pytest.approx(-12.0, abs=1.0)


def render_with_tone(scene: Scene, store: Path):  # type: ignore[no-untyped-def]
    from listening_studio.generative.fake import FakeSound
    from listening_studio.graph.render import render_scene

    return render_scene(
        scene, store, speech_engines={"fake": ToneSpeech()}, sound_engine=FakeSound()
    )
