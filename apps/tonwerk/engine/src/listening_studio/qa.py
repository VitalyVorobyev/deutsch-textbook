"""Transcript QA: what counts as a take the machine may pass on to a human.

The thresholds live in `check_units` and nothing else may restate them; `graph.scene_qa` is the
caller. `transcribe` is the pinned local ASR the scene QA, the wave runner and a voice
registration's best-effort reference transcript all use.
"""

from __future__ import annotations

from pathlib import Path
from typing import Mapping, Sequence

from .domain import LineQA, QAReport, normalized_words, word_error_rate
from .generative.locks import locked_snapshot

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

    A "unit" is one utterance of a scene: its id and the text it was asked to say.
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



def transcribe(path: Path) -> str:
    """One file through the pinned MLX Whisper checkout. Raises RuntimeError when it is absent."""

    try:
        import mlx_whisper
    except ImportError as exc:
        raise RuntimeError("Install the pinned MLX Whisper adapter before running QA") from exc
    model_path = locked_snapshot(
        "mlx-community/whisper-large-v3-turbo",
        "a4aaeec0636e6fef84abdcbe3544cb2bf7e9f6fb",
    )
    # `condition_on_previous_text=False` is the guard against Whisper's long-form repetition
    # loop. Takes have transcribed their whole script correctly and then degenerated — "ist mir
    # klar, ist mir klar, ist mir klar…" for hundreds of characters — which scored full WER 1.6 to
    # 1.9 while every individual line passed at 0.00. That signature is unmistakable: the speech
    # is fine and the decoder is feeding its own output back to itself. Conditioning on previous
    # text buys fluency across segment boundaries, which is worth nothing here — the comparison
    # is against a script we already have, word by word.
    result = mlx_whisper.transcribe(
        str(path),
        path_or_hf_repo=model_path,
        language="de",
        condition_on_previous_text=False,
    )
    return str(result["text"]).strip()
