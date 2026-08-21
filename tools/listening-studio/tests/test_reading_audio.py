from pathlib import Path

import pytest
import yaml

from listening_studio.adapters import FakeTTS
from listening_studio.cli import reading_payload
from listening_studio.reading_audio import ParagraphCue, ReadingRevisionPayload, load_reading_sources, spoken_paragraph, text_sha256
from listening_studio.reading_pipeline import generate_reading, reading_qa
from listening_studio.reading_export import publish_reading
from listening_studio.export import sha256
from listening_studio.storage import Store


REPO = Path(__file__).resolve().parents[3]


def test_glosses_reduce_to_their_german_surface() -> None:
    assert spoken_paragraph("Das ist [[ein Termin::an appointment::встреча]].") == "Das ist ein Termin."


def test_inventory_is_the_full_reading_corpus() -> None:
    # A tripwire, not a fixture: growing content/reading/ must move these numbers in the
    # same change, or narration planning is projected from a corpus that no longer exists
    # (the 59-text figure went stale exactly that way).
    sources = load_reading_sources(REPO)
    assert len(sources) == 85
    assert sum(len(row.paragraphs) for row in sources) == 380
    assert sum(row.word_count for row in sources) == 13514


def test_profile_assignment_is_deterministic() -> None:
    lena = reading_payload(REPO, "a1/lena-1-der-erste-tag")
    official = reading_payload(REPO, "a2/aemter-dienstleistungen")
    assert lena.narration_profile_id == "warm-narrative"
    assert official.narration_profile_id == "formal-informational"


def test_cues_cover_every_paragraph_and_detect_text_drift() -> None:
    payload = reading_payload(REPO, "a1/erste-schritte")
    cues = []
    cursor = 0
    for paragraph in payload.paragraphs:
        cues.append(ParagraphCue(paragraph_index=paragraph.index, start_ms=cursor, end_ms=cursor + 1000, text_sha256=text_sha256(paragraph.display_text)))
        cursor += 1200
    validated = ReadingRevisionPayload.model_validate(payload.model_dump(mode="json") | {"cues": [row.model_dump(mode="json") for row in cues]})
    assert len(validated.cues) == len(validated.paragraphs)
    broken = validated.model_dump(mode="json")
    broken["paragraphs"][0]["display_text"] += " geändert"
    with pytest.raises(ValueError, match="text hash"):
        ReadingRevisionPayload.model_validate(broken)


def test_fake_pipeline_persists_revision_and_reports_pending_human_review(tmp_path: Path) -> None:
    payload = reading_payload(REPO, "a1/erste-schritte")
    store = Store(tmp_path / "studio.sqlite3")
    project = store.create_reading(payload)
    target, generated = generate_reading(payload, tmp_path / "work", FakeTTS())
    assert target.exists()
    assert len(generated.cues) == len(payload.paragraphs)
    report = reading_qa(generated, tmp_path / "work", FakeTTS.revision, fake=True)
    assert report["passed"] is True
    assert report["cue_coverage"] == 1
    state = store.reading_state(project.id)
    assert state.approval is None


def test_reading_publication_is_bound_to_the_approved_master(tmp_path: Path) -> None:
    payload = reading_payload(REPO, "a1/erste-schritte")
    wav, generated = generate_reading(payload, tmp_path / "work", FakeTTS())
    qa = reading_qa(generated, tmp_path / "work", FakeTTS.revision, fake=True)
    approval = {
        "editor": "Human Editor",
        "reviewed_at": "2026-08-03T09:00:00+00:00",
        "audio_sha256": sha256(wav),
        "checklist": ["natural_long_prosody"],
    }
    audio, record, provenance = publish_reading(
        tmp_path / "repo", tmp_path / "local", generated, wav, qa, approval
    )
    assert audio.exists() and record.exists() and provenance.exists()
    assert yaml.safe_load(record.read_text())["paragraphs"] == [
        row.model_dump(mode="json") for row in generated.cues
    ]

    record.unlink()
    with pytest.raises(ValueError, match="partial existing"):
        publish_reading(
            tmp_path / "repo", tmp_path / "local", generated, wav, qa, approval
        )

    wav.write_bytes(wav.read_bytes() + b"changed")
    with pytest.raises(ValueError, match="changed since human approval"):
        publish_reading(
            tmp_path / "repo", tmp_path / "local", generated, wav, qa, approval
        )
