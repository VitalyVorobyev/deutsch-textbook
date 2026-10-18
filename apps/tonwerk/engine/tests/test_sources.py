import hashlib
import json
import math
import struct
import wave
from pathlib import Path

import pytest

from listening_studio.adapters import assemble, generate_lines, mix_context, wav_duration
from listening_studio.generative.fake import FakeSpeech
from listening_studio.domain import ContextSound
from listening_studio.soundscape import soundscape_report
from listening_studio.sources import import_source, load_source
from test_domain import payload


def make_wav(path: Path) -> None:
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(16000)
        wav.writeframes(b"\0\0" * 16000)


def metadata(path: Path, **updates: object) -> None:
    data = {
        "sound_id": 12345,
        "page_url": "https://freesound.org/s/12345/",
        "title": "Quiet room tone",
        "uploader": "fixture-author",
        "retrieved_at": "2026-08-01",
        "license": "CC0-1.0",
        "license_url": "https://creativecommons.org/publicdomain/zero/1.0/",
        "description": "Synthetic test fixture representing a short room tone.",
        "rights_risk_note": "Synthetic fixture; production imports require manual source review.",
        "contains_speech": False,
        "contains_music": False,
        "contains_brands": False,
        "contains_personal_data": False,
        **updates,
    }
    path.write_text(json.dumps(data))


def test_manual_source_import_and_deterministic_mix(tmp_path: Path) -> None:
    original = tmp_path / "room.wav"
    make_wav(original)
    info = tmp_path / "source.json"
    metadata(info)
    source = import_source(original, info, tmp_path / "store")
    loaded, copied = load_source(tmp_path / "store", source.original_sha256)
    assert loaded.sound_id == 12345
    assert hashlib.sha256(copied.read_bytes()).hexdigest() == source.original_sha256

    project = payload().model_copy(
        update={
            "context_sounds": [
                ContextSound(
                    source_sha256=source.original_sha256,
                    sound_id=source.sound_id,
                    duration_ms=500,
                )
            ]
        }
    )
    lines = generate_lines(project, tmp_path / "project", FakeSpeech())
    dry = tmp_path / "dry.wav"
    assemble(project, lines, dry)
    first = tmp_path / "first.wav"
    second = tmp_path / "second.wav"
    mix_context(project, tmp_path / "store", dry, first)
    mix_context(project, tmp_path / "store", dry, second)
    assert first.read_bytes() == second.read_bytes()


def test_source_policy_rejects_speech(tmp_path: Path) -> None:
    original = tmp_path / "voice.wav"
    make_wav(original)
    info = tmp_path / "source.json"
    metadata(info, contains_speech=True)
    with pytest.raises(ValueError, match="speech"):
        import_source(original, info, tmp_path / "store")


def test_source_policy_rejects_noncommercial_license(tmp_path: Path) -> None:
    original = tmp_path / "room.wav"
    make_wav(original)
    info = tmp_path / "source.json"
    metadata(info, license="CC-BY-NC-4.0")
    with pytest.raises(ValueError):
        import_source(original, info, tmp_path / "store")


def test_lead_in_puts_the_scene_sound_before_the_speech(tmp_path: Path) -> None:
    """A ring belongs before "hello", not on top of it.

    `adelay` moves a context sound later and `amix duration=first` cuts the mix to the
    speech, so without a lead-in there is no way to place a sound ahead of the dialogue.
    Five shipped artifacts proved it: a ring-back tone under an already-answered call, a
    Freizeichen over the office already talking, an answering-machine beep across the
    caller's first words.
    """

    original = tmp_path / "room.wav"
    make_wav(original)
    info = tmp_path / "source.json"
    metadata(info)
    source = import_source(original, info, tmp_path / "store")

    sound = ContextSound(
        source_sha256=source.original_sha256, sound_id=source.sound_id, duration_ms=500
    )
    plain = payload().model_copy(update={"context_sounds": [sound]})
    delayed = payload().model_copy(update={"context_sounds": [sound], "lead_in_ms": 1500})

    lines = generate_lines(plain, tmp_path / "project", FakeSpeech())
    dry = tmp_path / "dry.wav"
    assemble(plain, lines, dry)

    without = tmp_path / "without.wav"
    with_lead = tmp_path / "with.wav"
    mix_context(plain, tmp_path / "store", dry, without)
    mix_context(delayed, tmp_path / "store", dry, with_lead)

    assert wav_duration(with_lead) == pytest.approx(
        (wav_duration(without) or 0) + 1.5, abs=0.05
    ), "the mix must grow by exactly the lead-in — that silence is where the sound plays"
    # Deterministic like every other mix, or the approval hash means nothing.
    again = tmp_path / "again.wav"
    mix_context(delayed, tmp_path / "store", dry, again)
    assert with_lead.read_bytes() == again.read_bytes()


def test_lead_in_alone_still_mixes(tmp_path: Path) -> None:
    """Without this the early return copies the dry take and silently drops the lead-in."""

    project = payload().model_copy(update={"lead_in_ms": 800})
    lines = generate_lines(project, tmp_path / "project", FakeSpeech())
    dry = tmp_path / "dry.wav"
    assemble(project, lines, dry)
    out = tmp_path / "out.wav"
    mix_context(project, tmp_path / "store", dry, out)
    assert wav_duration(out) == pytest.approx((wav_duration(dry) or 0) + 0.8, abs=0.05)


def test_environment_bed_loops_under_the_complete_dialogue(tmp_path: Path) -> None:
    original = tmp_path / "short-bed.wav"
    samples = [int(3000 * math.sin(2 * math.pi * 180 * i / 16000)) for i in range(4000)]
    with wave.open(str(original), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(16000)
        wav.writeframes(b"".join(struct.pack("<h", sample) for sample in samples))
    info = tmp_path / "source.json"
    metadata(info)
    source = import_source(original, info, tmp_path / "store")
    sound = ContextSound(
        source_sha256=source.original_sha256,
        sound_id=source.sound_id,
        duration_ms=250,
        role="bed",
        editorial_reason="test bed",
        placement_authoring="ai-assisted",
    )
    project = payload().model_copy(update={"context_sounds": [sound]})
    lines = generate_lines(project, tmp_path / "project", FakeSpeech())
    dry = tmp_path / "dry.wav"
    assemble(project, lines, dry)
    mixed = tmp_path / "mixed.wav"
    mix_context(project, tmp_path / "store", dry, mixed)
    with wave.open(str(mixed), "rb") as wav:
        wav.setpos(max(0, wav.getnframes() - 4000))
        tail = wav.readframes(4000)
    assert any(tail), "a short bed must still be audible at the end of a longer dialogue"
    report = soundscape_report(project, dry, mixed)
    assert report.configured_coverage_ratio == 1
    assert report.measured_ambience_rms_dbfs is not None
    assert report.measured_ambience_rms_dbfs < -25


def test_ai_assisted_placement_requires_an_honest_reason() -> None:
    with pytest.raises(ValueError, match="editorial reason"):
        ContextSound(
            source_sha256="a" * 64,
            sound_id=1,
            duration_ms=1000,
            placement_authoring="ai-assisted",
        )
