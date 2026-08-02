
import pytest
from pydantic import ValidationError

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


def test_switching_the_model_leaves_a_payload_the_store_can_still_load() -> None:
    """P22-3: `model_copy(update=...)` skipped `consistent()`, so a Parler voice could be saved
    under `qwen_tts` — and every later `Store.get()` then refused the project."""

    from listening_studio.domain import VOICE_SETS, reassign_voices

    base = payload()
    parler = base.model_copy(
        update={
            "tts_adapter": "parler_tts",
            "lines": [
                base.lines[0].model_copy(update={"voice": "Nicole"}),
                base.lines[1].model_copy(update={"voice": "Christopher"}),
            ],
        }
    )

    # Watching it fail: the unvalidated copy the form used to build is not loadable.
    broken = parler.model_copy(update={"tts_adapter": "qwen_tts"})
    with pytest.raises(ValidationError):
        RevisionPayload.model_validate_json(broken.canonical_json())

    lines = reassign_voices(list(parler.lines), "qwen_tts")
    fixed = RevisionPayload.model_validate(
        parler.model_dump() | {"tts_adapter": "qwen_tts", "lines": [line.model_dump() for line in lines]}
    )
    assert RevisionPayload.model_validate_json(fixed.canonical_json()) == fixed
    # Two speakers still sound like two people — that is the property the reassignment keeps.
    assert len({line.voice for line in fixed.lines}) == 2
    assert all(line.voice in VOICE_SETS["qwen_tts"] for line in fixed.lines)

    # A voice the new adapter already offers is left where it is.
    kept = reassign_voices(list(fixed.lines), "qwen_tts")
    assert [line.voice for line in kept] == [line.voice for line in fixed.lines]


def test_the_voice_lists_match_the_provenance_record() -> None:
    """Two sources of truth for the same fact: `VOICE_SETS` gates validation, models.lock.json
    is what the manifest publishes. They have to agree or a legal voice becomes unsavable."""

    import json
    from pathlib import Path

    from listening_studio.domain import VOICE_SETS

    lock = json.loads((Path(__file__).resolve().parents[1] / "models.lock.json").read_text())
    for adapter, voices in VOICE_SETS.items():
        assert tuple(lock["models"][adapter]["voices"]) == voices, adapter


def test_a_local_checkout_is_accepted_only_at_the_pinned_revision(tmp_path, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    """The published manifest states the model revision as fact, so a directory that merely has
    the right name must not satisfy it."""

    from listening_studio import adapters

    models = tmp_path / ".models" / "Some-Model"
    download = models / ".cache" / "huggingface" / "download"
    download.mkdir(parents=True)
    monkeypatch.setattr(adapters, "REPO_ROOT", tmp_path)

    pinned = "a" * 40
    # No metadata at all: a directory of weights nobody can date.
    assert adapters.local_checkout("Org/Some-Model", pinned) is None

    (download / "config.json.metadata").write_text(f"{pinned}\nsha\n1.0\n")
    (download / "model.safetensors.metadata").write_text(f"{pinned}\nsha\n1.0\n")
    assert adapters.local_checkout("Org/Some-Model", pinned) == models

    # One file from a different commit is a mixed checkout, not the pinned revision.
    (download / "model.safetensors.metadata").write_text(f"{'b' * 40}\nsha\n1.0\n")
    assert adapters.local_checkout("Org/Some-Model", pinned) is None


def test_a_price_said_in_german_order_is_not_two_errors() -> None:
    """`zwei Euro fünfzig` comes back from Whisper as `2,50 Euro`.

    Same defect as the clock case: the amount is identical and only the unit word moves, but the
    comparison read it as two edits and failed a flawless market-stall take on both of the lines
    carrying the prices its questions ask about.
    """

    assert word_error_rate("Zusammen sind das sieben Euro fünfzig.", "Zusammen sind das 7,50 Euro.") == 0
    assert (
        word_error_rate(
            "Die Äpfel kosten drei Euro, die Kartoffeln zwei Euro fünfzig.",
            "Die Äpfel kosten 3 Euro. Die Kartoffeln 2,50 Euro.",
        )
        == 0
    )
    # Watched failing, as a new rule must be: a different amount is still a different amount.
    assert word_error_rate("Zusammen sind das sieben Euro fünfzig.", "Zusammen sind das 8,50 Euro.") > 0
    # And the rule needs "Euro" present — it does not rewrite every decimal it sees.
    assert word_error_rate("Das Paket wiegt zwei Komma fünf Kilo.", "Das Paket wiegt 2,50 Kilo.") > 0


def test_written_out_german_numerals_parse_up_to_999() -> None:
    """Written German closes a numeral into one word; Whisper writes the digits.

    A lookup table cannot hold this range, and the gap was real content: a 600-euro rent, ICE
    612 and a 300-kilometre delivery all failed QA on spelling rather than on speech.
    """

    from listening_studio.domain import german_number

    assert german_number("sechshundert") == "600"
    assert german_number("sechshundertzwölf") == "612"
    assert german_number("dreihundert") == "300"
    assert german_number("hundert") == "100"
    # Casefolding is the function's own job: dreißig folds to dreissig, which is how it is keyed.
    assert german_number("siebenunddreißig") == "37"
    assert german_number("Zwölf") == "12"

    # `ein` is the indefinite article far more often than the number. Whisper writes the article
    # as a word, so converting it would turn a correct line into a mismatch.
    assert german_number("ein") is None
    assert german_number("eins") == "1"
    assert word_error_rate("Ich möchte ein Kilo Äpfel.", "Ich möchte ein Kilo Äpfel.") == 0
    # Inside a compound it is the number again.
    assert german_number("einundzwanzig") == "21"

    assert german_number("Bahnhof") is None
    # Watched failing: a different number is still a different number.
    assert word_error_rate("Sechshundert Euro im Monat.", "700 Euro im Monat.") > 0


def test_a_date_said_as_an_ordinal_matches_the_numeral_whisper_writes() -> None:
    """Dates are spoken as ordinals and written as numerals: `am zwanzigsten November` comes
    back as `am 20. November`. Two clean takes failed on that alone."""

    from listening_studio.domain import ordinal_number

    assert ordinal_number("zwanzigsten") == "20"
    assert ordinal_number("einundzwanzigsten") == "21"
    assert ordinal_number("zwölften") == "12"
    # Irregular stems: erst-, dritt-, siebt-, acht-.
    assert ordinal_number("ersten") == "1"
    assert ordinal_number("dritten") == "3"
    assert ordinal_number("siebten") == "7"
    assert ordinal_number("achten") == "8"
    # A cardinal is not an ordinal, and an ordinary word is neither.
    assert ordinal_number("sieben") is None
    assert ordinal_number("November") is None

    assert word_error_rate("Der Stadtrat entscheidet am zwanzigsten November.", "Der Stadtrat entscheidet am 20. November.") == 0
    # Watched failing: the wrong day is still the wrong day.
    assert word_error_rate("am zwanzigsten November", "am 21. November") > 0


def test_a_compound_split_by_the_asr_is_not_a_misheard_word() -> None:
    """German writes compounds closed up and Whisper does not always agree.

    `kaputtgegangen` came back as `kaputt gegangen` — the same syllables, differing only in where
    the ASR guessed a boundary — and scored 0.67 on a three-word line. A boundary is not evidence
    about the speech; a missing word still is.
    """

    assert word_error_rate("Ist etwas kaputtgegangen?", "Ist etwas kaputt gegangen?") == 0
    assert word_error_rate("Ich muss noch einkaufen.", "Ich muss noch ein kaufen.") == 0
    # Watched failing: dropping a word is not a boundary difference.
    assert word_error_rate("Ist etwas kaputtgegangen?", "Ist etwas kaputt.") > 0
    assert word_error_rate("Ist etwas kaputtgegangen?", "Ist nichts kaputtgegangen?") > 0
