import pytest
import hashlib
import json
from pathlib import Path

from listening_studio.adapters import FakeTTS, assemble, generate_lines
from listening_studio.domain import ShortAnswer, TrueFalse
from listening_studio.export import register_exercise, write_bundle
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


def topic_article(root: Path, level: str, topic: str, refs: str) -> Path:
    path = root / "content" / "topics" / level / f"{topic}.mdx"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        f"---\nid: {topic}\nlevel: {level.upper()}\nexercises: [{refs}]\nvocab: []\n---\n\n"
        "## Kurz gesagt\n"
    )
    return path


def test_a_published_set_is_referenced_by_its_topic(tmp_path: Path) -> None:
    """The set lands at the end of the list, never in front of the primaryPractice."""

    path = topic_article(tmp_path, "a1", "erste-schritte", "a1/erste-schritte")
    register_exercise(tmp_path, "a1", "erste-schritte", "a1/ls-erste-schritte-01-hoeren")
    assert "exercises: [a1/erste-schritte, a1/ls-erste-schritte-01-hoeren]" in path.read_text()

    # Publishing the same recording twice must not list it twice.
    register_exercise(tmp_path, "a1", "erste-schritte", "a1/ls-erste-schritte-01-hoeren")
    assert path.read_text().count("ls-erste-schritte-01-hoeren") == 1


def test_a_set_with_nowhere_to_be_referenced_from_is_refused(tmp_path: Path) -> None:
    """Watching the rule fail: without the article, publish must not write an orphan."""

    with pytest.raises(FileNotFoundError, match="no topic article"):
        register_exercise(tmp_path, "a1", "kein-thema", "a1/ls-kein-thema-01-hoeren")

    (tmp_path / "content" / "topics" / "a1").mkdir(parents=True)
    (tmp_path / "content" / "topics" / "a1" / "ohne-liste.mdx").write_text("---\nid: x\n---\n")
    with pytest.raises(ValueError, match="no inline `exercises:"):
        register_exercise(tmp_path, "a1", "ohne-liste", "a1/ls-ohne-liste-01-hoeren")


def test_an_approval_without_hashes_cannot_vouch_for_audio(tmp_path: Path) -> None:
    """Watching the rule fail: a pre-hash approval must force re-approval, not skip the check."""

    import typer

    from listening_studio.cli import verify_approval

    wav = tmp_path / "final.wav"
    wav.write_bytes(b"RIFF-not-really-audio")
    dry = tmp_path / "dry.wav"
    digest = hashlib.sha256(wav.read_bytes()).hexdigest()

    with pytest.raises(typer.BadParameter, match="predates audio hashing"):
        verify_approval({"status": "complete"}, wav, dry)
    with pytest.raises(typer.BadParameter, match="final.wav has changed"):
        verify_approval({"audio_sha256": "0" * 64}, wav, dry)

    verify_approval({"audio_sha256": digest}, wav, dry)  # no dry take recorded, nothing to check

    dry.write_bytes(b"RIFF-dry")
    with pytest.raises(typer.BadParameter, match="dry.wav has changed"):
        verify_approval({"audio_sha256": digest}, wav, dry)
    verify_approval(
        {"audio_sha256": digest, "dry_audio_sha256": hashlib.sha256(dry.read_bytes()).hexdigest()},
        wav,
        dry,
    )


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
