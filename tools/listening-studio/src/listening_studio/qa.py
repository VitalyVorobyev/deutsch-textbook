from __future__ import annotations

from .domain import LineQA, QAReport, RevisionPayload, normalized_words, word_error_rate


def check_transcripts(
    payload: RevisionPayload,
    transcripts: dict[str, str],
    full_transcript: str | None = None,
) -> QAReport:
    lines: list[LineQA] = []
    failures: list[str] = []
    protected = {
        w.casefold() for phrase in payload.brief.vocabulary for w in normalized_words(phrase)
    }
    if payload.brief.grammar_target:
        protected.update(normalized_words(payload.brief.grammar_target))
    for line in payload.lines:
        expected = line.spoken_text()
        actual = transcripts.get(line.id, "")
        wer = word_error_rate(expected, actual)
        actual_words = set(normalized_words(actual))
        line_protected = sorted(
            w for w in protected if w in normalized_words(expected) and w not in actual_words
        )
        passed = (
            bool(actual.strip())
            and (wer <= 0.12 or len(normalized_words(expected)) * wer <= 1)
            and not line_protected
        )
        if not passed:
            failures.append(f"{line.id}: transcription mismatch")
        lines.append(
            LineQA(
                line_id=line.id,
                expected=expected,
                transcript=actual,
                wer=wer,
                passed=passed,
                missing_protected=line_protected,
            )
        )
    expected_full = " ".join(line.spoken_text() for line in payload.lines)
    protected.update(
        word
        for word in normalized_words(expected_full)
        if word.isdigit() or word in {"nicht", "nichts", "nie", "kein", "keine", "keinen"}
    )
    actual_full = full_transcript or " ".join(
        transcripts.get(line.id, "") for line in payload.lines
    )
    full_wer = word_error_rate(expected_full, actual_full)
    if full_wer > 0.08:
        failures.append(f"full WER {full_wer:.1%} exceeds 8%")
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
