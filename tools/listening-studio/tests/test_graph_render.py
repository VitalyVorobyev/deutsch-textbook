"""Rendering a scene end to end, and proving the cache does what it claims.

Everything here runs on `FakeSpeech`, `FakeSound` and ffmpeg. No torch, no model download, no
network — the property the CI engine job exists to keep.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
import soundfile as sf

from listening_studio.catalogs import CatalogVoiceProfile, CharacterDefinition, NarrationProfile
from listening_studio.domain import Bilingual
from listening_studio.generative.fake import FakeSound, FakeSpeech
from listening_studio.generative.gateway import SoundRequest
from listening_studio.graph.assets import AssetStore
from listening_studio.graph.nodes import QA_RATE, WORKING_RATE
from listening_studio.graph.render import render_scene
from listening_studio.reading_audio import ReadingSource
from listening_studio.scene.convert import scene_from_reading
from listening_studio.scene.model import (
    AmbienceEntry,
    AssetRef,
    CastMember,
    DifficultyVariant,
    Placement,
    Scene,
    SceneAcoustics,
    SceneBrief,
    SfxEntry,
    SoundSpec,
    SpeechEntry,
    Utterance,
    VoiceSpec,
)

DIGEST = "0" * 64


def tone_in_store(store_dir: Path) -> str:
    """A generated tone, put into the asset store, whose digest a scene can reference.

    This is what an imported room tone looks like to the renderer once `sources.py` has vouched
    for it: a sha256 and nothing else. Generating one rather than importing a Freesound file
    keeps the fixture free of a licence record it would have to invent.
    """

    store = AssetStore(store_dir)
    raw = store_dir / "tone.wav"
    FakeSound().generate(
        SoundRequest(prompt="quiet room tone", seed=3, duration_seconds=4.0), raw
    )
    return store.put(raw, {"kind": "test-fixture", "note": "generated tone"})


def cafe_scene(ref: str, **overrides: object) -> Scene:
    """Two roles, three utterances, one ambience bed by reference, one generated sfx."""

    base: dict[str, object] = {
        "slug": "fixture-cafe",
        "kind": "dialogue",
        "title": Bilingual(en="At the café", ru="В кафе"),
        "brief": SceneBrief(
            level="A2",
            scenario="Im Café etwas bestellen",
            topic="essen-trinken",
            vocabulary=["Kaffee"],
        ),
        "cast": [
            CastMember(role="Mara", voice=VoiceSpec(engine="fake", voice="Vivian", seed=101)),
            CastMember(role="Jonas", voice=VoiceSpec(engine="fake", voice="Eric", seed=102)),
        ],
        "script": [
            Utterance(
                id="line-1",
                role="Mara",
                display_text="Guten Tag, ich hätte gern einen Kaffee.",
                pause_after_ms=400,
            ),
            Utterance(
                id="line-2",
                role="Jonas",
                display_text="Gern. Mit Milch oder ohne?",
                pause_after_ms=600,
            ),
            Utterance(
                id="line-3", role="Mara", display_text="Mit Milch, bitte.", pause_after_ms=0
            ),
        ],
        "timeline": [
            SpeechEntry(utterance_id="line-1"),
            SpeechEntry(utterance_id="line-2", placement=Placement(pan=0.4)),
            SpeechEntry(utterance_id="line-3"),
            AmbienceEntry(sound=AssetRef(ref=ref, source_start_ms=500), gain_db=-24.0),
            SfxEntry(
                sound=SoundSpec(prompt="a cup on a saucer", seed=7, duration_seconds=1.2),
                at_ms=300,
                gain_db=-12.0,
            ),
        ],
        "acoustics": SceneAcoustics(lead_in_ms=800),
    }
    base.update(overrides)
    return Scene.model_validate(base)


def render(scene: Scene, store_dir: Path, **kwargs: object):  # type: ignore[no-untyped-def]
    return render_scene(
        scene,
        store_dir,
        speech_engines={"fake": FakeSpeech(), "qwen_tts": FakeSpeech()},
        sound_engine=FakeSound(),
        **kwargs,  # type: ignore[arg-type]
    )


# -- end to end ---------------------------------------------------------------


@pytest.fixture
def rendered(tmp_path: Path):  # type: ignore[no-untyped-def]
    scene = cafe_scene(tone_in_store(tmp_path))
    return scene, render(scene, tmp_path)


def test_the_master_is_stereo_48k_24_bit(rendered) -> None:  # type: ignore[no-untyped-def]
    _scene, result = rendered
    master = result.directory / "master.wav"
    info = sf.info(str(master))
    assert (info.samplerate, info.channels, info.subtype) == (WORKING_RATE, 2, "PCM_24")


def test_the_qa_derivative_is_what_whisper_and_wavlm_can_read(rendered) -> None:  # type: ignore[no-untyped-def]
    _scene, result = rendered
    info = sf.info(str(result.directory / "qa.wav"))
    assert (info.samplerate, info.channels, info.subtype) == (QA_RATE, 1, "PCM_16")


def test_the_published_derivative_exists_and_is_an_mp3(rendered) -> None:  # type: ignore[no-untyped-def]
    _scene, result = rendered
    published = result.directory / "publish.mp3"
    assert published.exists() and published.stat().st_size > 0
    assert published.read_bytes()[:3] in {b"ID3", b"\xff\xfb", b"\xff\xf3"}


def test_every_entry_gets_a_stem_and_the_dialogue_bus_is_kept(rendered) -> None:  # type: ignore[no-untyped-def]
    _scene, result = rendered
    stems = sorted(path.name for path in (result.directory / "stems").glob("*.wav"))
    assert stems == ["ambience-1.wav", "line-1.wav", "line-2.wav", "line-3.wav", "sfx-1.wav"]
    assert (result.directory / "dry.wav").exists()


def test_the_manifest_states_every_hash_asset_and_time(rendered) -> None:  # type: ignore[no-untyped-def]
    scene, result = rendered
    manifest = json.loads(result.manifest_path.read_text())
    assert manifest["scene_sha256"] == scene.sha256()
    assert manifest["variant"] == "natural"
    assert manifest["ffmpeg"].startswith("ffmpeg version")
    assert manifest["engines"]["fake"]["revision"] == FakeSpeech.revision
    # `fake` is not a locked model, and the manifest says so rather than omitting it.
    assert manifest["models_lock"]["fake"] is None
    assert {row["type"] for row in manifest["nodes"]} == {
        "synth", "pace", "sound-gen", "import", "track", "mix", "loudnorm", "encode"
    }
    assert all(len(row["hash"]) == 64 for row in manifest["nodes"])
    assert all(manifest["assets"][row["asset"]] is not None for row in manifest["nodes"])
    assert manifest["nodes_evaluated"] + manifest["nodes_cached"] == len(manifest["nodes"])
    assert [row["kind"] for row in manifest["artifacts"]].count("master") == 1


def test_timing_is_monotonic_and_its_gaps_are_the_authored_pauses(rendered) -> None:  # type: ignore[no-untyped-def]
    scene, result = rendered
    timing = result.timing
    assert [row.utterance_id for row in timing] == ["line-1", "line-2", "line-3"]
    # Lead-in offsets the speech, which is what makes room for a sound before anyone talks.
    assert timing[0].start_ms == scene.acoustics.lead_in_ms
    assert all(row.end_ms > row.start_ms for row in timing)
    gaps = [later.start_ms - earlier.end_ms for earlier, later in zip(timing, timing[1:])]
    assert gaps == [scene.utterance("line-1").pause_after_ms, scene.utterance("line-2").pause_after_ms]


def test_an_sfx_at_zero_is_scene_time_and_a_bed_fills_the_scene(rendered) -> None:  # type: ignore[no-untyped-def]
    _scene, result = rendered
    spans = {row.entry_id: row for row in result.timeline}
    # 300 ms is before the first word at 800 ms: `at_ms` on a sound is absolute scene time.
    assert spans["sfx-1"].start_ms == 300
    assert spans["ambience-1"].start_ms == 0
    assert spans["ambience-1"].end_ms == result.duration_ms
    assert result.duration_ms == max(row.end_ms for row in result.timing)


def test_a_bed_cannot_make_the_scene_longer_than_its_speech(tmp_path: Path) -> None:
    """Found on the first real render: `ls-wohnen-01` came out 45.0 s against a 33 s artifact.

    Every converted dialogue's bed carries an explicit `end_ms`, because the legacy manifest's
    `duration_ms` recorded how much of the looped source the old mixer trimmed — not a second end
    time for the scene. Honouring it literally appends room tone after the last word.
    """

    reference = tone_in_store(tmp_path)
    timeline = [row for row in cafe_scene(reference).timeline if row.type != "ambience"]
    timeline.append(
        AmbienceEntry(sound=AssetRef(ref=reference), start_ms=0, end_ms=600_000, gain_db=-24.0)
    )
    result = render(cafe_scene(reference, timeline=timeline), tmp_path)
    speech_end = max(row.end_ms for row in result.timing)
    assert result.duration_ms == speech_end
    bed = next(row for row in result.timeline if row.entry_id == "ambience-1")
    # Clipped, and the manifest says so: the rendered span is what the timeline reports.
    assert bed.end_ms == speech_end


def test_a_bed_that_ends_early_keeps_its_own_end(tmp_path: Path) -> None:
    """"Under *some* of the scene" is a thing the model can say, and clipping must not lose it."""

    reference = tone_in_store(tmp_path)
    timeline = [row for row in cafe_scene(reference).timeline if row.type != "ambience"]
    timeline.append(
        AmbienceEntry(sound=AssetRef(ref=reference), start_ms=0, end_ms=2_000, gain_db=-24.0)
    )
    result = render(cafe_scene(reference, timeline=timeline), tmp_path)
    bed = next(row for row in result.timeline if row.entry_id == "ambience-1")
    assert bed.end_ms == 2_000 < result.duration_ms


def test_the_rendered_master_is_about_as_long_as_the_timeline_says(rendered) -> None:  # type: ignore[no-untyped-def]
    _scene, result = rendered
    measured = sf.info(str(result.directory / "master.wav")).duration * 1000
    assert abs(measured - result.duration_ms) < 200


# -- caching ------------------------------------------------------------------


def test_a_second_render_of_the_same_scene_evaluates_nothing(tmp_path: Path) -> None:
    scene = cafe_scene(tone_in_store(tmp_path))
    first = render(scene, tmp_path)
    assert first.nodes_evaluated > 0
    second = render(scene, tmp_path)
    assert second.nodes_evaluated == 0
    assert second.nodes_cached == len(second.nodes)


def test_editing_one_line_re_synthesizes_only_that_line(tmp_path: Path) -> None:
    """The claim the whole render graph exists for, measured rather than asserted."""

    ref = tone_in_store(tmp_path)
    scene = cafe_scene(ref)
    first = render(scene, tmp_path)
    assert len(first.evaluated_of_type("synth")) == 3

    script = [row.model_dump(mode="json") for row in scene.script]
    script[1]["display_text"] = "Gern. Möchten Sie Milch dazu?"
    edited = cafe_scene(ref, script=script)
    second = render(edited, tmp_path)

    # Exactly one synthesis re-ran, and it is the line that was edited.
    synths = second.evaluated_of_type("synth")
    assert [row.params["request"]["text"] for row in synths] == ["Gern. Möchten Sie Milch dazu?"]
    assert len(second.evaluated_of_type("pace")) == 1
    # No *other* generation re-ran: the imported bed and the generated sfx are untouched, and so
    # are the other two voices.
    assert second.evaluated_of_type("sound-gen") == []
    assert second.evaluated_of_type("import") == []

    # Placement is where the blast radius becomes visible, and it is not "only the edited line":
    # the new take is longer, so line-3 starts later and the bed's window grows with the scene.
    # Three of the five stems therefore re-run — and the two that cannot have moved do not.
    tracks = [row for row in second.nodes if row.type == "track"]
    assert len(tracks) == 5
    assert sorted(row.params["delay_ms"] for row in tracks if row.cached) == [300, 800]

    # The graph has the same shape either way; what changed is how much of it had to be computed.
    # 11 of 19: one synth, one pace, three tracks, and the mixes, masters and encodes that any
    # change at all must reach. The eight that were reused are the two other takes and their
    # paces, the two unmoved stems, the import and the sound generation.
    assert len(second.nodes) == len(first.nodes) == 19
    assert (first.nodes_evaluated, second.nodes_evaluated) == (19, 11)


def test_a_second_scene_reusing_a_line_reuses_its_take(tmp_path: Path) -> None:
    """The cache is keyed on the computation, not on the scene it was first needed by."""

    ref = tone_in_store(tmp_path)
    render(cafe_scene(ref), tmp_path)
    other = cafe_scene(ref, slug="fixture-cafe-2")
    second = render(other, tmp_path)
    assert second.evaluated_of_type("synth") == []


# -- acoustics ----------------------------------------------------------------


def graded_scene(ref: str, **overrides: object) -> Scene:
    """The café, in a café, with one voice on a telephone and the three difficulty variants."""

    timeline = list(cafe_scene(ref).timeline)
    timeline[0] = SpeechEntry(
        utterance_id="line-1", placement=Placement(device="telephone", distance=1.5)
    )
    base: dict[str, object] = {
        "timeline": timeline,
        "acoustics": SceneAcoustics(room="cafe", lead_in_ms=800),
        "variants": [
            DifficultyVariant(id="clean", preset="clean"),
            DifficultyVariant(id="natural", preset="natural"),
            DifficultyVariant(id="challenging", preset="challenging"),
        ],
    }
    base.update(overrides)
    return cafe_scene(ref, **base)


def hashes_of(result, node_type: str) -> set[str]:  # type: ignore[no-untyped-def]
    return {row.node_hash for row in result.nodes if row.type == node_type}


def test_a_device_placement_renders_its_chain_onto_that_stem_alone(tmp_path: Path) -> None:
    ref = tone_in_store(tmp_path)
    timeline = list(cafe_scene(ref).timeline)
    timeline[0] = SpeechEntry(utterance_id="line-1", placement=Placement(device="telephone"))
    result = render(cafe_scene(ref, timeline=timeline), tmp_path)
    tracks = {row.params.get("acoustics", {}).get("device") for row in result.nodes
              if row.type == "track"}
    assert tracks == {"telephone", None}
    treated = next(row for row in result.nodes
                   if row.type == "track" and row.params.get("fx"))
    assert treated.params["fx"].startswith("highpass=f=300:p=2")
    assert treated.params["acoustics"]["device_version"] == 1


def test_a_distance_other_than_one_becomes_gain_and_darkening(tmp_path: Path) -> None:
    ref = tone_in_store(tmp_path)
    timeline = list(cafe_scene(ref).timeline)
    timeline[0] = SpeechEntry(utterance_id="line-1", placement=Placement(distance=2.0))
    result = render(cafe_scene(ref, timeline=timeline), tmp_path)
    treated = next(row for row in result.nodes
                   if row.type == "track" and row.params.get("fx"))
    assert treated.params["fx"] == "volume=-6.00dB,lowpass=f=8000:p=2"
    assert treated.params["acoustics"] == {"distance": 2.0}


def test_a_room_convolves_once_and_the_manifest_names_the_impulse_response(
    tmp_path: Path,
) -> None:
    ref = tone_in_store(tmp_path)
    scene = cafe_scene(ref, acoustics=SceneAcoustics(room="cafe", lead_in_ms=0))
    result = render(scene, tmp_path)
    irs = [row for row in result.nodes if row.type == "ir"]
    assert len(irs) == 1 and irs[0].params["room"] == "cafe"
    manifest = json.loads(result.manifest_path.read_text())
    assert manifest["acoustics"]["room"] == "cafe"
    assert manifest["acoustics"]["wet"] == 0.2
    assert manifest["acoustics"]["ir_assets"] == {"cafe": irs[0].asset}
    # The IR is an input to the mix, so a different room is a different mix by construction.
    mixes = [row for row in result.nodes if row.type == "mix"]
    assert all(row.params["room"]["ir"] == irs[0].asset for row in mixes)
    # …and the bed is never sent into it.
    bed = next(
        row for row in mixes[0].params["inputs"] if row["stem_id"] == "ambience-1"
    )
    assert bed["send_db"] is None


def test_a_variant_with_an_unknown_override_key_is_refused_with_the_vocabulary(
    tmp_path: Path,
) -> None:
    ref = tone_in_store(tmp_path)
    scene = cafe_scene(
        ref,
        variants=[
            DifficultyVariant(id="natural"),
            DifficultyVariant(id="challenging", preset="challenging",
                             overrides={"snr_db": 6.0}),
        ],
    )
    with pytest.raises(ValueError, match="snr_db"):
        render(scene, tmp_path, variant="challenging")
    # …and the variant that carries nothing still renders.
    assert render(scene, tmp_path, variant="natural").nodes_evaluated > 0


def test_an_unknown_room_is_refused_with_the_file_that_would_define_it(tmp_path: Path) -> None:
    ref = tone_in_store(tmp_path)
    scene = cafe_scene(ref, acoustics=SceneAcoustics(room="kitchen", lead_in_ms=0))
    with pytest.raises(ValueError, match="unknown room 'kitchen'") as error:
        render(scene, tmp_path)
    assert "acoustic-profiles.yaml" in str(error.value)


def test_an_unknown_device_is_refused_with_the_file_that_would_define_it(tmp_path: Path) -> None:
    ref = tone_in_store(tmp_path)
    timeline = list(cafe_scene(ref).timeline)
    timeline[0] = SpeechEntry(utterance_id="line-1", placement=Placement(device="megaphone"))
    with pytest.raises(ValueError, match="unknown device 'megaphone'") as error:
        render(cafe_scene(ref, timeline=timeline), tmp_path)
    assert "acoustic-profiles.yaml" in str(error.value)


def test_an_unknown_preset_is_refused_with_the_file_that_would_define_it(tmp_path: Path) -> None:
    ref = tone_in_store(tmp_path)
    scene = cafe_scene(ref, variants=[DifficultyVariant(id="brutal", preset="brutal")])
    with pytest.raises(ValueError, match="unknown difficulty preset 'brutal'") as error:
        render(scene, tmp_path, variant="brutal")
    assert "acoustic-difficulty.yaml" in str(error.value)


def test_a_scene_that_says_nothing_acoustic_never_reads_the_data_files(tmp_path: Path) -> None:
    """`render_scene` derives its repository root, so a plain scene must not need one at all."""

    scene = cafe_scene(tone_in_store(tmp_path))
    result = render(scene, tmp_path, repo=tmp_path / "not-a-repository")
    assert result.nodes_evaluated > 0
    assert [row for row in result.nodes if row.type == "ir"] == []
    manifest = json.loads(result.manifest_path.read_text())
    assert manifest["acoustics"]["room"] is None
    assert manifest["acoustics"]["profiles_version"] is None


# -- difficulty variants ------------------------------------------------------


def test_two_variants_share_their_takes_and_diverge_where_their_parameters_do(
    tmp_path: Path,
) -> None:
    """The cache-correctness claim, stated exactly: disjoint hashes where the params differ.

    Synthesis is upstream of every acoustic parameter, so `clean` and `challenging` ask the model
    for the same twelve things and share every `synth` node. Everything downstream of a differing
    parameter is a different node: `clean` paces at 0.95 and `challenging` at 1.05, so no `pace`
    node survives; the stems then differ by distance, by the bed's gain and by their delays; and
    the mixes differ by the room's wet level on top of that.
    """

    ref = tone_in_store(tmp_path)
    scene = graded_scene(ref)
    clean = render(scene, tmp_path, variant="clean")
    challenging = render(scene, tmp_path, variant="challenging")

    assert hashes_of(clean, "synth") == hashes_of(challenging, "synth")
    assert len(hashes_of(clean, "synth")) == 3
    # The imported bed and the generated sfx are upstream of the acoustics too.
    assert hashes_of(clean, "import") == hashes_of(challenging, "import")
    assert hashes_of(clean, "sound-gen") == hashes_of(challenging, "sound-gen")

    for node_type in ("pace", "track", "mix", "loudnorm", "encode"):
        assert not (hashes_of(clean, node_type) & hashes_of(challenging, node_type)), node_type
    # The room is the same room at a different wet level, so the IR itself is shared.
    assert hashes_of(clean, "ir") == hashes_of(challenging, "ir")


def test_two_variants_with_the_same_pace_share_their_paced_takes_as_well(
    tmp_path: Path,
) -> None:
    """Where and *only* where: equal pace deltas must not force a re-pace, and do not."""

    ref = tone_in_store(tmp_path)
    scene = graded_scene(
        ref,
        variants=[
            DifficultyVariant(id="a", preset="challenging", overrides={"pace": 1.0}),
            DifficultyVariant(
                id="b", preset="challenging", overrides={"pace": 1.0, "ambience_gain_db": 0.0}
            ),
        ],
    )
    first = render(scene, tmp_path, variant="a")
    second = render(scene, tmp_path, variant="b")

    assert hashes_of(first, "synth") == hashes_of(second, "synth")
    assert hashes_of(first, "pace") == hashes_of(second, "pace")
    # Only the bed moved, so exactly one of the five stems is a different node — and it is the
    # looped one, at the two gains the two `ambience_gain_db` deltas resolve to.
    assert len(hashes_of(first, "track") - hashes_of(second, "track")) == 1
    gains = {
        result.variant: next(
            row.params["gain_db"] for row in result.nodes
            if row.type == "track" and row.params["loop"]
        )
        for result in (first, second)
    }
    assert gains == {"a": -18.0, "b": -24.0}
    assert hashes_of(first, "mix") != hashes_of(second, "mix")


def test_the_ambience_delta_reaches_the_bed_and_is_clamped_to_the_models_window(
    tmp_path: Path,
) -> None:
    """The concept document's -35 dB and -18 dB, and the floor a preset cannot push past."""

    ref = tone_in_store(tmp_path)
    scene = graded_scene(ref)
    beds = {}
    for variant in ("clean", "natural", "challenging"):
        result = render(scene, tmp_path, variant=variant)
        beds[variant] = next(
            row.params["gain_db"] for row in result.nodes
            if row.type == "track" and row.params["loop"]
        )
    assert (beds["clean"], beds["natural"], beds["challenging"]) == (-35.0, -24.0, -18.0)

    # A delta that would leave the model's -40..-6 window is clamped, not honoured: a bed at
    # speech level is not a bed, whatever a preset says.
    shouted = cafe_scene(
        ref, variants=[DifficultyVariant(id="loud", overrides={"ambience_gain_db": 40.0})]
    )
    result = render(shouted, tmp_path, variant="loud")
    bed = next(row.params["gain_db"] for row in result.nodes
               if row.type == "track" and row.params["loop"])
    assert bed == -6.0


def test_overlap_moves_a_turn_only_when_the_speaker_changes(tmp_path: Path) -> None:
    """Nobody overlaps themselves — that is one take mixed over itself, not a hard scene."""

    ref = tone_in_store(tmp_path)
    script = [row.model_dump(mode="json") for row in cafe_scene(ref).script]
    # The fixture is Mara / Jonas / Mara. Recast it to Mara / Mara / Jonas, so the first boundary
    # keeps the speaker and the second changes it — one of each, in one render.
    script[1]["role"] = "Mara"
    script[2]["role"] = "Jonas"
    scene = cafe_scene(
        ref,
        script=script,
        variants=[
            DifficultyVariant(id="plain", overrides={"overlap_ms": 0}),
            DifficultyVariant(id="tight", overrides={"overlap_ms": 200}),
        ],
    )
    plain = {row.utterance_id: row for row in render(scene, tmp_path, variant="plain").timing}
    tight = {row.utterance_id: row for row in render(scene, tmp_path, variant="tight").timing}

    # Mara → Mara: untouched.
    assert tight["line-2"].start_ms - plain["line-2"].start_ms == 0
    # Mara → Jonas: pulled forward by the whole overlap, and by nothing more.
    assert plain["line-3"].start_ms - tight["line-3"].start_ms == 200


def test_overlap_never_pulls_the_first_turn_before_the_scenes_speech_start(
    tmp_path: Path,
) -> None:
    """`lead_in_ms` bought room for an opening sound; a preset must not spend it."""

    ref = tone_in_store(tmp_path)
    scene = cafe_scene(
        ref, variants=[DifficultyVariant(id="tight", overrides={"overlap_ms": 2000})]
    )
    result = render(scene, tmp_path, variant="tight")
    assert result.timing[0].start_ms == scene.acoustics.lead_in_ms
    assert all(row.start_ms >= scene.acoustics.lead_in_ms for row in result.timing)
    # And no turn is reordered behind the one before it.
    starts = [row.start_ms for row in result.timing]
    assert starts == sorted(starts)


def test_a_variant_pace_that_leaves_the_models_window_is_clamped_and_logged(
    tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    """A scene-wide preset must not make a scene with one fast turn unrenderable."""

    ref = tone_in_store(tmp_path)
    script = [row.model_dump(mode="json") for row in cafe_scene(ref).script]
    script[0]["pace"] = 1.28
    scene = cafe_scene(
        ref, script=script, variants=[DifficultyVariant(id="fast", overrides={"pace": 1.1})]
    )
    with caplog.at_level("INFO", logger="listening_studio.graph.render"):
        result = render(scene, tmp_path, variant="fast")
    paces = sorted(row.params["pace"] for row in result.nodes if row.type == "pace")
    assert paces == [1.1, 1.1, 1.3]
    assert "clamped" in caplog.text and "line-1" in caplog.text


def test_the_manifest_records_the_resolved_state_and_not_just_the_preset_id(
    tmp_path: Path,
) -> None:
    ref = tone_in_store(tmp_path)
    result = render(graded_scene(ref), tmp_path, variant="challenging")
    acoustics = json.loads(result.manifest_path.read_text())["acoustics"]
    assert acoustics["preset"] == "challenging"
    assert acoustics["preset_version"] == 1
    assert acoustics["room_version"] == 1
    assert acoustics["deltas"] == {
        "ambience_gain_db": 6.0,
        "distance": 1.25,
        "overlap_ms": 220,
        "pace": 1.05,
        "wet": 0.15,
    }
    # cafe's 0.20 plus the preset's 0.15.
    assert acoustics["wet"] == 0.35
    assert set(acoustics["ir_assets"]) == {"cafe"}


def test_every_variant_of_the_graded_scene_renders_a_master(tmp_path: Path) -> None:
    """The smoke check: three variants, three masters, all of them audio."""

    ref = tone_in_store(tmp_path)
    scene = graded_scene(ref)
    for variant in ("clean", "natural", "challenging"):
        result = render(scene, tmp_path, variant=variant)
        info = sf.info(str(result.directory / "master.wav"))
        assert (info.samplerate, info.channels) == (WORKING_RATE, 2)
        assert info.duration > 1.0


# -- refusals -----------------------------------------------------------------


def test_an_unknown_variant_is_refused_by_name(tmp_path: Path) -> None:
    ref = tone_in_store(tmp_path)
    with pytest.raises(ValueError, match="has no variant"):
        render(cafe_scene(ref), tmp_path, variant="clean")


def test_a_sound_spec_without_a_generator_is_refused_not_silently_dropped(
    tmp_path: Path,
) -> None:
    scene = cafe_scene(tone_in_store(tmp_path))
    with pytest.raises(ValueError, match="no sound engine installed"):
        render_scene(
            scene,
            tmp_path,
            speech_engines={"fake": FakeSpeech()},
            sound_engine=None,
        )


def test_a_missing_asset_reference_is_refused(tmp_path: Path) -> None:
    scene = cafe_scene(DIGEST)
    with pytest.raises(ValueError, match="is not in the store"):
        render(scene, tmp_path)


def test_an_engine_the_render_was_not_given_is_refused(tmp_path: Path) -> None:
    scene = cafe_scene(tone_in_store(tmp_path))
    with pytest.raises(ValueError, match="which this render was not given"):
        render_scene(
            scene,
            tmp_path,
            speech_engines={"qwen_tts": FakeSpeech()},
            sound_engine=FakeSound(),
        )


# -- narration ----------------------------------------------------------------


def narration_scene() -> Scene:
    source = ReadingSource(
        id="a2/im-buero",
        level="A2",
        topic="arbeit-beruf",
        title_de="Im Büro",
        paragraphs=[
            "Anna arbeitet seit drei Jahren in einem kleinen Büro.",
            "Am Morgen liest sie zuerst ihre E-Mails und plant den Tag.",
            "Nach der Pause spricht sie mit ihrer Kollegin über das neue Projekt.",
        ],
        source_sha256="a" * 64,
    )
    profile = NarrationProfile(
        id="ruhig",
        version=1,
        character_id="lena",
        label="Ruhige Erzählung",
        description="Fixture",
        allowed_kinds=["intensive"],
        pace_by_level={"A1": 0.9, "A2": 0.95, "B1": 1.0},
        paragraph_pause_ms=700,
        instruction="Lies ruhig und deutlich.",
    )
    character = CharacterDefinition(
        id="lena",
        version=1,
        display_name="Lena",
        age_band="young-adult",
        persona="Fixture narrator",
        registers=["neutral"],
        roles=["Erzählerin"],
        casting_tags=["narration"],
        narration_capable=True,
        status="reviewed-profile",
        voice_profile=CatalogVoiceProfile(
            voice="Vivian", seed=101, style="Freundlich und klar.", pace=1.0
        ),
        demo_phrases=["Guten Tag.", "Wie geht es Ihnen?", "Bis bald."],
    )
    return scene_from_reading(source, profile, character)


def test_a_converted_narration_renders_one_timing_row_per_paragraph(tmp_path: Path) -> None:
    """The cue table is the generalization of `ParagraphCue`, so it must still be one per text."""

    scene = narration_scene()
    result = render(scene, tmp_path)
    assert [row.utterance_id for row in result.timing] == ["p1", "p2", "p3"]
    gaps = [
        later.start_ms - earlier.end_ms
        for earlier, later in zip(result.timing, result.timing[1:])
    ]
    assert gaps == [700, 700]
    # A narration has no bed and no events, so the dialogue-only mix *is* the master mix: the
    # second `_mix_and_normalize` call builds the same node and costs nothing.
    assert (result.directory / "dry.wav").read_bytes() == (
        result.directory / "master.wav"
    ).read_bytes()
