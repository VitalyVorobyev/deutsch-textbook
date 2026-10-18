from __future__ import annotations

import logging
import wave
from pathlib import Path

import pytest

from listening_studio.adapters import generate_lines, speech_request
from listening_studio.domain import VoiceProfile
from listening_studio.generative.fake import FakeSound, FakeSpeech
from listening_studio.generative.gateway import SoundRequest, SpeechRequest
from test_domain import payload


def test_a_request_hashes_the_same_however_its_params_were_written() -> None:
    """Two spellings of the same request are the same request.

    The hash goes into provenance, so a dict whose keys happened to be inserted in a different
    order must not read as a different generation.
    """

    first = SpeechRequest(
        text="Guten Morgen.",
        voice="Ryan",
        seed=100,
        params={"temperature": 0.7, "top_p": 0.9},
    )
    second = SpeechRequest(
        text="Guten Morgen.",
        voice="Ryan",
        seed=100,
        params={"top_p": 0.9, "temperature": 0.7},
    )
    assert first.sha256() == second.sha256()
    assert first.canonical_json() == second.canonical_json()
    # No whitespace, sorted keys — the RevisionPayload rule, so the two are comparable by eye.
    assert ", " not in first.canonical_json()

    # And a request that differs in anything at all hashes differently.
    for change in (
        {"text": "Guten Abend."},
        {"voice": "Aiden"},
        {"language": "English"},
        {"style": "freundlich"},
        {"seed": 101},
        {"params": {"temperature": 0.8, "top_p": 0.9}},
    ):
        assert first.model_copy(update=change).sha256() != first.sha256(), change


def test_a_sound_request_hashes_the_same_way() -> None:
    quiet = SoundRequest(prompt="quiet German café", seed=7, duration_seconds=4.0)
    assert quiet.sha256() == SoundRequest(
        prompt="quiet German café", seed=7, duration_seconds=4.0
    ).sha256()
    assert quiet.sha256() != quiet.model_copy(update={"negative_prompt": "music"}).sha256()


def test_an_asset_carries_the_provenance_every_engine_owes(tmp_path: Path) -> None:
    request = SpeechRequest(text="Das passt gut.", voice="Ryan", seed=3)
    asset = FakeSpeech().generate(request, tmp_path / "line.wav")

    assert asset.path.exists()
    assert asset.sample_rate == 16000
    assert asset.sha256 == _sha256(asset.path)
    assert set(asset.provenance) >= {
        "engine",
        "model_id",
        "model_revision",
        "adapter_code_revision",
        "seed",
        "request_sha256",
        "params",
    }
    assert asset.provenance["engine"] == "fake"
    assert asset.provenance["seed"] == 3
    assert asset.provenance["request_sha256"] == request.sha256()


def test_the_fake_engines_are_deterministic(tmp_path: Path) -> None:
    """A fixture that generates different bytes on two runs cannot prove a bundle deterministic."""

    request = SpeechRequest(text="Der Termin ist am Freitag.", voice="Ryan", seed=100)
    first = FakeSpeech().generate(request, tmp_path / "a.wav")
    second = FakeSpeech().generate(request, tmp_path / "b.wav")
    assert first.path.read_bytes() == second.path.read_bytes()
    assert first.sha256 == second.sha256

    sound = SoundRequest(prompt="espresso machine", seed=11, duration_seconds=0.25)
    one = FakeSound().generate(sound, tmp_path / "c.wav")
    two = FakeSound().generate(sound, tmp_path / "d.wav")
    assert one.path.read_bytes() == two.path.read_bytes()
    # Different seeds are audibly and byte-wise different, or seeding proves nothing.
    other = FakeSound().generate(
        sound.model_copy(update={"seed": 12}), tmp_path / "e.wav"
    )
    assert other.path.read_bytes() != one.path.read_bytes()
    with wave.open(str(one.path)) as opened:
        assert opened.getframerate() == 16000 and opened.getnchannels() == 1


def test_an_engine_refuses_parameters_it_would_only_drop(tmp_path: Path) -> None:
    request = SpeechRequest(text="Hallo.", voice="Ryan", params={"cfg_scale": 3})
    with pytest.raises(ValueError, match="no engine parameters"):
        FakeSpeech().generate(request, tmp_path / "line.wav")


def test_pace_never_reaches_the_engine() -> None:
    """Pace is DSP. An engine that saw it would have to re-generate for every tempo."""

    line = payload().lines[0].model_copy(update={"pace": 0.9, "style": "ruhig"})
    request = speech_request(line)
    assert "pace" not in request.model_dump()
    assert request.style == "ruhig"


def test_an_inert_style_warns_once_per_run(tmp_path: Path, caplog: pytest.LogCaptureFixture) -> None:
    """`supports_style = False` must be audible to the editor, not just true in the code.

    One warning per generation run, not per line: twelve identical warnings in a dialogue is how
    an editor learns to scroll past them.
    """

    base = payload()
    project = base.model_copy(
        update={
            "voice_profiles": [
                VoiceProfile(speaker="Lea", voice="Ryan", seed=100, style="freundlich"),
                VoiceProfile(speaker="Tom", voice="Aiden", seed=105, style="freundlich"),
            ]
        }
    )
    with caplog.at_level(logging.WARNING, logger="listening_studio.adapters"):
        generate_lines(project, tmp_path / "styled", FakeSpeech())
    warnings = [record for record in caplog.records if record.levelno == logging.WARNING]
    assert len(warnings) == 1
    assert "fake" in warnings[0].getMessage()

    # No style, no warning — the message has to mean something when it appears.
    caplog.clear()
    with caplog.at_level(logging.WARNING, logger="listening_studio.adapters"):
        generate_lines(base, tmp_path / "plain", FakeSpeech())
    assert not [record for record in caplog.records if record.levelno == logging.WARNING]


def _sha256(path: Path) -> str:
    import hashlib

    return hashlib.sha256(path.read_bytes()).hexdigest()
