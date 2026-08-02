
from listening_studio.domain import (
    Brief,
    Bilingual,
    Line,
    Question,
    RevisionPayload,
    SingleChoice,
    line_cache_key,
    word_error_rate,
)
from listening_studio.qa import check_transcripts


def payload() -> RevisionPayload:
    return RevisionPayload(
        title=Bilingual(en="Test", ru="Тест"),
        brief=Brief(
            scenario="Termin",
            topic="termine-vereinbaren",
            outcomes=["termine-aushandeln"],
            vocabulary=["Termin"],
        ),
        speakers=["Lea", "Tom"],
        lines=[
            Line(id="l1", speaker="Lea", display_text="Der Termin ist am Freitag."),
            Line(id="l2", speaker="Tom", display_text="Das passt gut."),
        ],
        questions=[
            Question(
                id="q1",
                instruction=Bilingual(en="Listen.", ru="Слушайте."),
                response=SingleChoice(
                    kind="single-choice", prompt="Wann?", options=["Freitag", "Montag"], correct=0
                ),
                explain=Bilingual(en="Friday is stated.", ru="Названа пятница."),
            )
        ],
        tts_adapter="fake",
    )


def test_wer_and_cache_key() -> None:
    assert word_error_rate("Der Termin ist Freitag", "Der Termin ist Freitag") == 0
    a = payload().lines[0]
    b = a.model_copy(update={"voice": "Aiden"})
    assert line_cache_key(a, "x") != line_cache_key(b, "x")


def test_qa_passes_exact_transcript() -> None:
    p = payload()
    report = check_transcripts(p, {line.id: line.spoken_text() for line in p.lines})
    assert report.passed and report.full_wer == 0


def test_authoring_provenance_defaults_to_manual() -> None:
    """An unmarked payload claims no generation history — see write_bundle in export.py."""

    assert payload().authoring == "manual"
    assert payload().generation_prompt is None


def test_a_legacy_question_still_loads() -> None:
    """A store must be able to read its own history.

    The first pass at removing the `listening` item type narrowed `Question.response` to
    SingleChoice outright, which made 12 of 13 already-drafted projects unloadable — every
    action in the editor answered a wall of pydantic errors with real authored German behind
    it. The shapes stay parseable; `exercise_yaml` is what refuses them.
    """

    base = payload().model_dump(mode="json")
    for legacy in [
        {"kind": "multi-select", "prompt": "?", "options": ["a", "b"], "correct": [0]},
        {"kind": "true-false", "statement": "?", "correct": True},
        {"kind": "ordering", "prompt": "?", "units": ["a", "b"]},
        {"kind": "short-answer", "prompt": "?", "answers": ["ja"]},
        {"kind": "dictation", "line_id": "l1", "accept": []},
    ]:
        candidate = {**base, "questions": [{**base["questions"][0], "response": legacy}]}
        assert RevisionPayload.model_validate(candidate).questions[0].response.kind == legacy["kind"]
