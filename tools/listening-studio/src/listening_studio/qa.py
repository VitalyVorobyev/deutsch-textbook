"""Transcript QA: what counts as a take the machine may pass on to a human.

The thresholds live in `check_units` and nothing else may restate them. `check_transcripts` is
the `RevisionPayload` caller and `graph.scene_qa` is the `Scene` one; both ask the same question
about the same kind of evidence, and two copies of "0.12 per line, 0.08 overall, and never lose a
protected token" is two places for one of them to drift.
"""

from __future__ import annotations

from typing import Mapping, Sequence

from .domain import LineQA, QAReport, RevisionPayload, normalized_words, word_error_rate

#: A line may mishear this fraction of its words, or one word, whichever is more forgiving. The
#: "or one word" clause is what keeps a four-word greeting from failing on a single article.
LINE_WER_LIMIT = 0.12

#: The whole recording is held tighter than any line in it: errors that are individually
#: acceptable are not acceptable everywhere at once.
FULL_WER_LIMIT = 0.08

#: Words whose absence changes the meaning of the answer rather than the fluency of the reading.
#: Negation and numbers, plus whatever the brief declared as its own vocabulary.
ALWAYS_PROTECTED = {"nicht", "nichts", "nie", "kein", "keine", "keinen"}


def check_units(
    expected: Sequence[tuple[str, str]],
    transcripts: Mapping[str, str],
    *,
    vocabulary: Sequence[str] = (),
    grammar_target: str | None = None,
    full_transcript: str | None = None,
) -> QAReport:
    """Score one transcript per unit of speech, plus one for the whole recording.

    A "unit" is a line in the dialogue pipeline and an utterance in a scene. The shapes differ;
    the evidence does not.
    """

    lines: list[LineQA] = []
    failures: list[str] = []
    protected = {word.casefold() for phrase in vocabulary for word in normalized_words(phrase)}
    if grammar_target:
        protected.update(normalized_words(grammar_target))
    for unit_id, want in expected:
        actual = transcripts.get(unit_id, "")
        wer = word_error_rate(want, actual)
        actual_words = set(normalized_words(actual))
        unit_protected = sorted(
            word
            for word in protected
            if word in normalized_words(want) and word not in actual_words
        )
        passed = (
            bool(actual.strip())
            and (wer <= LINE_WER_LIMIT or len(normalized_words(want)) * wer <= 1)
            and not unit_protected
        )
        if not passed:
            failures.append(f"{unit_id}: transcription mismatch")
        lines.append(
            LineQA(
                line_id=unit_id,
                expected=want,
                transcript=actual,
                wer=wer,
                passed=passed,
                missing_protected=unit_protected,
            )
        )
    expected_full = " ".join(want for _, want in expected)
    protected.update(
        word
        for word in normalized_words(expected_full)
        if word.isdigit() or word in ALWAYS_PROTECTED
    )
    actual_full = full_transcript or " ".join(
        transcripts.get(unit_id, "") for unit_id, _ in expected
    )
    full_wer = word_error_rate(expected_full, actual_full)
    if full_wer > FULL_WER_LIMIT:
        failures.append(f"full WER {full_wer:.1%} exceeds {FULL_WER_LIMIT:.0%}")
    expected_words = set(normalized_words(expected_full))
    missing_full = sorted(
        {word for word in protected if word in expected_words} - set(normalized_words(actual_full))
    )
    if missing_full:
        failures.append("full audio is missing protected tokens: " + ", ".join(missing_full))
    return QAReport(
        full_transcript=actual_full,
        full_wer=full_wer,
        lines=lines,
        failures=failures,
        warnings=[],
        passed=not failures,
    )


def check_transcripts(
    payload: RevisionPayload,
    transcripts: dict[str, str],
    full_transcript: str | None = None,
) -> QAReport:
    return check_units(
        [(line.id, line.spoken_text()) for line in payload.lines],
        transcripts,
        vocabulary=payload.brief.vocabulary,
        grammar_target=payload.brief.grammar_target or None,
        full_transcript=full_transcript,
    )
