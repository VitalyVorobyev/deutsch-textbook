"""The shared vocabulary: questions, the voice list, model pins and the WER comparison."""

import pytest
from pydantic import ValidationError

from listening_studio.domain import (
    Bilingual,
    Question,
    SingleChoice,
    normalized_words,
    word_error_rate,
)
from listening_studio.qa import check_units


def test_an_exact_transcript_scores_zero_and_passes() -> None:
    assert word_error_rate("Der Termin ist Freitag", "Der Termin ist Freitag") == 0
    report = check_units(
        [("u1", "Der Termin ist am Freitag."), ("u2", "Das passt gut.")],
        {"u1": "Der Termin ist am Freitag.", "u2": "Das passt gut."},
        vocabulary=["Termin"],
    )
    assert report.passed and report.full_wer == 0


def test_a_question_is_single_choice_and_nothing_else() -> None:
    """`audio-comprehension` is single-choice, so a question of any other shape is refused."""

    question = {
        "id": "q1",
        "instruction": {"en": "Listen.", "ru": "Слушайте."},
        "response": {
            "kind": "single-choice",
            "prompt": "Wann?",
            "options": ["Freitag", "Montag"],
            "correct": 0,
        },
        "explain": {"en": "Friday is stated.", "ru": "Названа пятница."},
    }
    loaded = Question.model_validate(question)
    assert loaded.response == SingleChoice(
        kind="single-choice", prompt="Wann?", options=["Freitag", "Montag"], correct=0
    )
    assert loaded.instruction == Bilingual(en="Listen.", ru="Слушайте.")
    with pytest.raises(ValidationError):
        Question.model_validate(
            question | {"response": {"kind": "true-false", "statement": "Freitag.", "correct": True}}
        )


def test_the_voice_lists_match_the_provenance_record() -> None:
    """Two sources of truth for the same fact: `VOICE_SETS` gates validation, models.lock.json
    is what the manifest publishes. They have to agree or a legal voice becomes unsavable."""

    import json
    from pathlib import Path

    from listening_studio.domain import VOICE_SETS

    lock = json.loads((Path(__file__).resolve().parents[1] / "models.lock.json").read_text())
    for adapter, voices in VOICE_SETS.items():
        assert tuple(lock["models"][adapter]["voices"]) == voices, adapter


def test_a_local_checkout_is_accepted_only_at_the_pinned_revision(tmp_path) -> None:  # type: ignore[no-untyped-def]
    """The published manifest states the model revision as fact, so a directory that merely has
    the right name must not satisfy it."""

    from listening_studio.generative import locks

    models = tmp_path / ".models" / "Some-Model"
    download = models / ".cache" / "huggingface" / "download"
    download.mkdir(parents=True)

    pinned = "a" * 40
    # No metadata at all: a directory of weights nobody can date.
    assert locks.local_checkout("Org/Some-Model", pinned, tmp_path) is None

    (download / "config.json.metadata").write_text(f"{pinned}\nsha\n1.0\n")
    (download / "model.safetensors.metadata").write_text(f"{pinned}\nsha\n1.0\n")
    assert locks.local_checkout("Org/Some-Model", pinned, tmp_path) == models

    # One file from a different commit is a mixed checkout, not the pinned revision.
    (download / "model.safetensors.metadata").write_text(f"{'b' * 40}\nsha\n1.0\n")
    assert locks.local_checkout("Org/Some-Model", pinned, tmp_path) is None


def test_the_models_root_is_the_repository_the_run_was_started_against(tmp_path) -> None:  # type: ignore[no-untyped-def]
    """`--repo` decides where `.models/` is read from; the path-derived root is only a fallback.

    Watching it fail: without `set_models_root`, `local_checkout` looks under this package's own
    parent directories, where the fabricated checkout below does not exist — and reports the
    checkpoint as absent rather than as looked for in the wrong place.
    """

    from listening_studio.generative import locks

    pinned = "c" * 40
    download = tmp_path / ".models" / "Some-Model" / ".cache" / "huggingface" / "download"
    download.mkdir(parents=True)
    (download / "config.json.metadata").write_text(f"{pinned}\nsha\n1.0\n")

    assert locks.local_checkout("Org/Some-Model", pinned) is None
    try:
        locks.set_models_root(tmp_path)
        assert locks.models_root() == tmp_path.resolve()
        assert locks.local_checkout("Org/Some-Model", pinned) == tmp_path / ".models" / "Some-Model"
    finally:
        locks.set_models_root(None)
    assert locks.local_checkout("Org/Some-Model", pinned) is None


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


def test_the_qwen_download_script_fetches_the_revision_the_engine_loads() -> None:
    """`local_checkout` refuses a directory at any other commit, so `main` would be rejected."""

    import importlib.util
    from pathlib import Path

    from listening_studio.generative.qwen import QwenSpeech
    from listening_studio.generative.qwen_clone import QwenBaseClone

    path = Path(__file__).resolve().parents[4] / "scripts" / "download-qwen3-tts.py"
    spec = importlib.util.spec_from_file_location("download_qwen3_tts", path)
    assert spec is not None and spec.loader is not None
    script = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(script)
    assert script.pinned("custom-voice") == (QwenSpeech.model_id, QwenSpeech.revision)
    assert script.pinned("base") == (QwenBaseClone.model_id, QwenBaseClone.revision)


def test_a_motorway_or_a_gate_is_the_same_words_spelled_closed() -> None:
    # Whisper writes `A3` and `Gate C4` where the script spells `A drei` and `Gate C vier`; read as
    # one token, the number was "missing" from a flawless take of a traffic report.
    assert word_error_rate("Fahren Sie bitte über die A sieben.", "Fahren Sie bitte über die A7.") == 0
    assert word_error_rate(
        "nicht von Gate B zwölf, sondern von Gate C vier", "nicht von Gate B12, sondern von Gate C4"
    ) == 0
    assert word_error_rate("über die A sieben", "über die A8") > 0
    # The protected-token check compares word sets, so the number must be a word of its own.
    assert normalized_words("Auf der A3 und der A7") == normalized_words("Auf der A drei und der A sieben")
    assert normalized_words("Gate B12") == ["gate", "b", "1", "2"]


def test_a_spelled_abbreviation_is_its_letters() -> None:
    # The script spells what the voice must say letter by letter (`I C E`); Whisper writes the
    # abbreviation (`ICE`). Both are the same three letters.
    assert word_error_rate("Anschluss an den I C E nach München", "Anschluss an den ICE nach München") == 0
    assert word_error_rate("zum Flug L H zweihundertdreißig", "zum Flug LH 230") == 0
    assert word_error_rate("Anschluss an den I C E", "Anschluss an den IC") > 0
    assert normalized_words("den ICE und die S-Bahn") == normalized_words("den I C E und die S-Bahn")
    # Only an abbreviation is spelled out: a capitalised noun stays a word.
    assert normalized_words("Der Bus") == ["der", "bus"]


def test_minutes_past_the_hour_are_said_without_their_leading_zero() -> None:
    # `11.05 Uhr` is spoken `elf Uhr fünf`, never `elf Uhr null fünf`; a full hour has no minutes.
    assert word_error_rate("Abfahrt elf Uhr fünf von Gleis sechs", "Abfahrt 11.05 Uhr von Gleis 6") == 0
    assert word_error_rate("Abfahrt elf Uhr", "Abfahrt 11.00 Uhr") == 0
    assert word_error_rate("Abfahrt elf Uhr fünfzehn", "Abfahrt 11.15 Uhr") == 0
    assert word_error_rate("Abfahrt elf Uhr fünf", "Abfahrt 11.50 Uhr") > 0
