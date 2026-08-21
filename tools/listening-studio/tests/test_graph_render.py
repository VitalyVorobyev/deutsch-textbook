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


# -- refusals -----------------------------------------------------------------


def test_a_device_placement_is_refused_and_names_the_dsp_pr(tmp_path: Path) -> None:
    ref = tone_in_store(tmp_path)
    timeline = cafe_scene(ref).timeline
    timeline[0] = SpeechEntry(utterance_id="line-1", placement=Placement(device="telephone"))
    scene = cafe_scene(ref, timeline=timeline)
    with pytest.raises(ValueError, match="Tonwerk PR 5"):
        render(scene, tmp_path)


def test_a_distance_other_than_one_is_refused(tmp_path: Path) -> None:
    ref = tone_in_store(tmp_path)
    timeline = cafe_scene(ref).timeline
    timeline[0] = SpeechEntry(utterance_id="line-1", placement=Placement(distance=2.5))
    with pytest.raises(ValueError, match="Tonwerk PR 5"):
        render(cafe_scene(ref, timeline=timeline), tmp_path)


def test_a_room_is_refused(tmp_path: Path) -> None:
    ref = tone_in_store(tmp_path)
    scene = cafe_scene(ref, acoustics=SceneAcoustics(room="small-office", lead_in_ms=0))
    with pytest.raises(ValueError, match="Tonwerk PR 5"):
        render(scene, tmp_path)


def test_a_variant_with_overrides_is_refused(tmp_path: Path) -> None:
    ref = tone_in_store(tmp_path)
    scene = cafe_scene(
        ref,
        variants=[
            DifficultyVariant(id="natural"),
            DifficultyVariant(id="challenging", overrides={"snr_db": 6.0}),
        ],
    )
    with pytest.raises(ValueError, match="Tonwerk PR 5"):
        render(scene, tmp_path, variant="challenging")
    # …and the variant that carries nothing still renders.
    assert render(scene, tmp_path, variant="natural").nodes_evaluated > 0


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
