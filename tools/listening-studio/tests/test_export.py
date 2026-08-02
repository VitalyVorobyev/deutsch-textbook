import pytest
import hashlib
import json
from pathlib import Path

from listening_studio.adapters import FakeTTS, assemble, generate_lines
from listening_studio.domain import ShortAnswer, TrueFalse
from listening_studio.export import write_bundle
from test_domain import payload


def test_bundle_is_deterministic_and_records_provenance(tmp_path: Path) -> None:
    project = payload()
    work = tmp_path / "project"
    lines = generate_lines(project, work, FakeTTS())
    wav = work / "final.wav"
    assemble(project, lines, wav)
    approval = {
        "status": "complete",
        "editor": "Synthetic test fixture",
        "reviewed_at": "2026-08-01T12:00:00+00:00",
        "checklist": ["accent", "naturalness", "intelligibility", "speakers", "pace", "questions"],
    }
    models = {
        "dependency_lock_sha256": "d" * 64,
        "model_lock_sha256": "m" * 64,
        "models": {
            "fake": {
                "revision": "fake-v1",
                "license": "test-only",
                "training_data_provenance": "no training data; synthetic silence fixture",
            }
        },
    }
    first = write_bundle(
        tmp_path / "bundle", "deterministic", project, wav, {"passed": True}, approval, models
    )
    first_hash = hashlib.sha256(first.read_bytes()).hexdigest()
    second = write_bundle(
        tmp_path / "bundle", "deterministic", project, wav, {"passed": True}, approval, models
    )
    assert hashlib.sha256(second.read_bytes()).hexdigest() == first_hash
    provenance = json.loads((tmp_path / "bundle" / "provenance.json").read_text())
    # Two hashes, two jobs: the master is what the editor approved and what QA ran on and
    # never leaves the studio; the published MP3 is what lands in the repo.
    assert provenance["master_audio_sha256"] == hashlib.sha256(wav.read_bytes()).hexdigest()
    assert provenance["published_audio_sha256"]
    assert provenance["published_audio_bitrate"] == "64k"
    assert provenance["claims"]["voice_cloning_used"] is False
    assert all(line["cache_key"] for line in provenance["line_artifacts"])


def test_a_legacy_question_cannot_be_exported() -> None:
    """Readable is not shippable: `audio-comprehension` is single-choice, and there is no
    second audio item type to render the rest."""

    from listening_studio.export import exercise_yaml

    base = payload()
    legacy = base.questions[0].model_copy(
        update={"response": ShortAnswer(kind="short-answer", prompt="Wann?", answers=["um neun"])}
    )
    with pytest.raises(ValueError, match="normalize-questions"):
        exercise_yaml("slug", base.model_copy(update={"questions": [legacy]}))


def test_normalize_keeps_the_authored_text() -> None:
    """Conversion loses no drafted German and invents no distractor."""

    from listening_studio.cli import TODO_OPTION, as_single_choice

    base = payload()
    short = base.questions[0].model_copy(
        update={"response": ShortAnswer(kind="short-answer", prompt="Wann?", answers=["um neun"])}
    )
    converted = as_single_choice(short)
    assert converted is not None
    assert converted.response.prompt == "Wann?"
    assert converted.response.options == ["um neun", TODO_OPTION]
    assert converted.response.correct == 0

    tf = base.questions[0].model_copy(
        update={"response": TrueFalse(kind="true-false", statement="Der Zug fährt.", correct=False)}
    )
    converted_tf = as_single_choice(tf)
    assert converted_tf is not None
    assert converted_tf.response.options[converted_tf.response.correct] == "Falsch"

    # A question that is already single-choice is left exactly alone.
    assert as_single_choice(base.questions[0]) is None
