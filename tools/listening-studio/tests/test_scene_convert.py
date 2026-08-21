"""Conversion, measured against the real corpus.

The two totality tests are the point of the file. A fixture proves the mechanism; only the
corpus gives the shapes that were actually authored — 25 of the 40 published dialogues carry a
different seed on every line of one speaker, which no invented example would have contained.
"""

from __future__ import annotations

import json
from functools import cache
from pathlib import Path

import pytest
import yaml

from listening_studio.catalogs import (
    CharacterDefinition,
    NarrationProfile,
    load_character_catalog,
    load_narration_catalog,
)
from listening_studio.reading_audio import default_profile_id, load_reading_sources
from listening_studio.scene.convert import (
    EVENT_MAX_DURATION_MS,
    dialogue_scene,
    published_dialogue_ids,
    reading_scene,
    reading_slug,
    scene_from_dialogue,
)
from listening_studio.scene.model import AmbienceEntry, Scene, SfxEntry, SpeechEntry


REPO = Path(__file__).resolve().parents[3]

PUBLISHED = published_dialogue_ids(REPO)
READINGS = load_reading_sources(REPO)


# The corpus is converted once and the 40 parametrized cases read the result — the conversion
# is the subject of the test, not something each case needs its own copy of.
@cache
def dialogues() -> dict[str, tuple[Scene, object]]:
    return {artifact_id: dialogue_scene(REPO, artifact_id) for artifact_id in PUBLISHED}


@cache
def narration_catalogs() -> tuple[list[NarrationProfile], list[CharacterDefinition]]:
    return list(load_narration_catalog(REPO).profiles), list(
        load_character_catalog(REPO).characters
    )


def test_the_corpus_is_the_size_this_suite_thinks_it_is() -> None:
    """If either number moves, the totality tests below stopped covering what they claim."""

    assert len(PUBLISHED) == 40
    assert len(READINGS) == 85


@pytest.mark.parametrize("artifact_id", PUBLISHED)
def test_every_published_dialogue_converts_and_round_trips(artifact_id: str) -> None:
    scene, attachment = dialogues()[artifact_id]
    assert scene.kind == "dialogue"
    assert Scene.model_validate_json(scene.canonical_json()).sha256() == scene.sha256()
    assert attachment.questions

    # The script is the manifest's resolved lines, one for one and in order.
    artifact = yaml.safe_load((REPO / "content" / "listening" / f"{artifact_id}.yaml").read_text())
    provenance = json.loads((REPO / artifact["provenance"]).read_text())
    lines = provenance["settings"]["lines"]
    assert [utterance.id for utterance in scene.script] == [line["id"] for line in lines]
    assert [utterance.display_text for utterance in scene.script] == [
        line["display_text"] for line in lines
    ]
    # Nothing about the synthesis identity may be lost, per-line legacy seeds included.
    assert [scene.seed_for(utterance) for utterance in scene.script] == [
        line["seed"] for line in lines
    ]
    assert [scene.member(utterance.role).voice.voice for utterance in scene.script] == [
        line["voice"] for line in lines
    ]
    assert scene.acoustics.lead_in_ms == provenance["settings"]["assembly"]["lead_in_ms"]
    sounds = [entry for entry in scene.timeline if not isinstance(entry, SpeechEntry)]
    assert len(sounds) == len(provenance["settings"]["context_sounds"])


@pytest.mark.parametrize("reading_id", [source.id for source in READINGS])
def test_every_reading_converts_and_round_trips(reading_id: str) -> None:
    source = next(row for row in READINGS if row.id == reading_id)
    profiles, characters = narration_catalogs()
    profile_id = default_profile_id(source)
    scene = reading_scene(source, profiles, characters, profile_id)
    assert scene.kind == "narration"
    assert len(scene.cast) == 1 and scene.cast[0].character is not None
    assert [utterance.display_text for utterance in scene.script] == source.paragraphs
    # Pace is the profile's value for this level, and the pause is the profile's paragraph gap.
    profile = next(row for row in profiles if row.id == profile_id)
    assert {utterance.pace for utterance in scene.script} == {profile.pace_by_level[source.level]}
    assert {utterance.pause_after_ms for utterance in scene.script} == {
        profile.paragraph_pause_ms
    }
    assert Scene.model_validate_json(scene.canonical_json()).sha256() == scene.sha256()


def test_reading_slug_flattens_the_level_scope() -> None:
    assert reading_slug("a1/erste-schritte") == "a1-erste-schritte"
    assert reading_slug("a2/erste-schritte") == "a2-erste-schritte"


def test_a_lead_in_scene_places_its_ring_before_the_speech() -> None:
    """`at_ms` is absolute mix time; the lead-in delays the speech, not the sound."""

    scene, _ = dialogues()["a1/ls-erste-schritte-01"]
    assert scene.acoustics.lead_in_ms == 1700
    events = [entry for entry in scene.timeline if isinstance(entry, SfxEntry)]
    assert len(events) == 1 and events[0].at_ms == 0
    assert events[0].sound.source_duration_ms == 1600  # type: ignore[union-attr]


def test_a_long_context_sound_becomes_a_bed_with_todays_fades() -> None:
    scene, _ = dialogues()["a1/ls-wohnen-01"]
    beds = [entry for entry in scene.timeline if isinstance(entry, AmbienceEntry)]
    assert len(beds) == 1
    bed = beds[0]
    # 637807 is trimmed from ten seconds into the source and runs 45 s in the mix; the two
    # numbers are different axes and both survive.
    assert bed.sound.source_start_ms == 10_000  # type: ignore[union-attr]
    assert (bed.start_ms, bed.end_ms) == (0, 45_000)
    assert (bed.fade_in_ms, bed.fade_out_ms) == (350, 450)


def _write(tmp_path: Path, name: str, payload: object) -> Path:
    target = tmp_path / name
    target.write_text(yaml.safe_dump(payload, allow_unicode=True))
    return target


def _fixture(tmp_path: Path, context_sounds: list[dict[str, object]]) -> Path:
    """A minimal published pair, so the bed/event boundary can be tested at the boundary."""

    artifact = {
        "id": "ls-probe-01",
        "level": "A2",
        "title": {"en": "Probe", "ru": "Проба"},
        "scenario": "Testszene",
        "duration_seconds": 20,
        "speakers": ["Mara"],
        "transcript": [{"speaker": "Mara", "text": "Guten Morgen."}],
        "provenance": "probe.json",
    }
    provenance = {
        "settings": {
            "adapter": "qwen_tts",
            "assembly": {"lead_in_ms": 0},
            "context_sounds": context_sounds,
            "lines": [
                {
                    "id": "line-1",
                    "speaker": "Mara",
                    "display_text": "Guten Morgen.",
                    "synthesis_text": None,
                    "pronunciation_overrides": [],
                    "voice": "Vivian",
                    "style": "Sprich freundlich.",
                    "pace": 0.95,
                    "pause_after_ms": 450,
                    "seed": 100,
                }
            ],
        }
    }
    exercise = {
        "topic": "probe",
        "items": [
            {
                "id": "q1",
                "type": "audio-comprehension",
                "recording": "ls-probe-01",
                "outcomes": ["probe-outcome"],
                "instruction": {"en": "Listen.", "ru": "Слушайте."},
                "question": "Was sagt Mara?",
                "options": ["Guten Morgen.", "Gute Nacht."],
                "correct": 0,
                "explain": {"en": "She greets.", "ru": "Она здоровается."},
                "max_replays": 2,
            }
        ],
    }
    (tmp_path / "probe.json").write_text(json.dumps(provenance, ensure_ascii=False))
    _write(tmp_path, "exercise.yaml", exercise)
    return _write(tmp_path, "artifact.yaml", artifact)


def _sound(duration_ms: int, **overrides: object) -> dict[str, object]:
    return {
        "source_sha256": "b" * 64,
        "sound_id": 1,
        "start_ms": 0,
        "duration_ms": duration_ms,
        "delay_ms": 0,
        "gain_db": -20.0,
    } | overrides


def test_the_bed_event_boundary_is_the_documented_threshold(tmp_path: Path) -> None:
    artifact = _fixture(
        tmp_path, [_sound(EVENT_MAX_DURATION_MS), _sound(EVENT_MAX_DURATION_MS + 1)]
    )
    scene, _ = scene_from_dialogue(artifact, tmp_path / "probe.json", [tmp_path / "exercise.yaml"])
    sounds = [entry for entry in scene.timeline if not isinstance(entry, SpeechEntry)]
    assert [entry.type for entry in sounds] == ["sfx", "ambience"]


def test_a_delayed_bed_starts_where_the_manifest_delays_it(tmp_path: Path) -> None:
    artifact = _fixture(tmp_path, [_sound(30_000, delay_ms=6_000, start_ms=2_000, gain_db=-26.0)])
    scene, _ = scene_from_dialogue(artifact, tmp_path / "probe.json", [tmp_path / "exercise.yaml"])
    bed = scene.timeline[-1]
    assert isinstance(bed, AmbienceEntry)
    assert (bed.start_ms, bed.end_ms, bed.gain_db) == (6_000, 36_000, -26.0)
    assert bed.sound.source_start_ms == 2_000  # type: ignore[union-attr]


def test_sound_entries_keep_the_manifest_order(tmp_path: Path) -> None:
    """Two events at the same instant are ordered by the manifest, not by role or by gain."""

    artifact = _fixture(
        tmp_path,
        [_sound(1_000, sound_id=1, gain_db=-10.0), _sound(2_000, sound_id=2, gain_db=-30.0)],
    )
    scene, _ = scene_from_dialogue(artifact, tmp_path / "probe.json", [tmp_path / "exercise.yaml"])
    events = [entry for entry in scene.timeline if isinstance(entry, SfxEntry)]
    assert [entry.gain_db for entry in events] == [-10.0, -30.0]


def test_questions_come_from_the_referencing_exercise_set(tmp_path: Path) -> None:
    artifact = _fixture(tmp_path, [])
    _, attachment = scene_from_dialogue(
        artifact, tmp_path / "probe.json", [tmp_path / "exercise.yaml"]
    )
    assert attachment.question_ids == ["q1"]
    assert attachment.max_replays == 2


def test_an_unreferenced_artifact_is_an_error_not_an_empty_attachment(tmp_path: Path) -> None:
    artifact = _fixture(tmp_path, [])
    with pytest.raises(ValueError, match="no audio-comprehension item references"):
        scene_from_dialogue(artifact, tmp_path / "probe.json", [])
