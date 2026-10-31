"""Turn cues: where each line of a published recording starts and ends, in milliseconds.

The learner app uses them after an answer, to replay one turn and to follow the transcript while
the recording plays. They come from one of two places, and the difference matters:

* **A scene publish knows them exactly.** The render's timing table says where every take was
  placed (`scene.publish.listening_record`), so those cues are the mix's own geometry.
* **A recording published before scenes existed does not.** Its assembly kept no per-turn times,
  and the line takes it was assembled from are no longer in any store. Those cues are *measured*:
  Whisper's word timestamps on the published file, aligned to the transcript the recording is
  already held equal to. `measure_cues` is that measurement, and it refuses a turn none of whose
  words it can find rather than inventing a span for it.

A measured cue starts `LEAD_MS` before its first heard word (never before the previous turn's last
word) and runs to the next cue's start, the last one to the end of the file. Measured cues tile
the recording, and that is deliberate: Whisper's word *ends* are its weakest number. On the six local
scene renders, "drei" was still audible about 700 ms after the end Whisper gave it. A turn of a
sequential recording ends before the next one starts, so a cue that runs to the next start always
contains its speech, and only the start depends on Whisper.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from difflib import SequenceMatcher
from pathlib import Path

from .domain import normalized_words
from .generative.locks import locked_snapshot

LEAD_MS = 120

#: The checkout `qa.transcribe` uses, so a cue and a QA verdict come from the same ears.
WHISPER_REPO = "mlx-community/whisper-large-v3-turbo"
WHISPER_REVISION = "a4aaeec0636e6fef84abdcbe3544cb2bf7e9f6fb"


@dataclass(frozen=True)
class Word:
    text: str
    start_ms: int
    end_ms: int


def heard_words(path: Path) -> list[Word]:
    """Every word Whisper hears in `path`, with its time. Raises RuntimeError without MLX Whisper."""

    try:
        import mlx_whisper
    except ImportError as exc:
        raise RuntimeError("Install the pinned MLX Whisper adapter to measure cues") from exc
    result = mlx_whisper.transcribe(
        str(path),
        path_or_hf_repo=locked_snapshot(WHISPER_REPO, WHISPER_REVISION),
        language="de",
        word_timestamps=True,
        # The same guard `qa.transcribe` states: conditioning on its own output is how Whisper
        # loops, and a looped transcript would align its repeats to the wrong turns.
        condition_on_previous_text=False,
    )
    return [
        Word(str(word["word"]), round(float(word["start"]) * 1000), round(float(word["end"]) * 1000))
        for segment in result.get("segments", [])
        for word in segment.get("words", [])
    ]


def align_cues(
    turns: Sequence[str], words: Sequence[Word], duration_ms: int
) -> list[tuple[int, int]]:
    """One `(start_ms, end_ms)` per turn, from the heard words that match the turn's own words.

    Both sides are reduced by `normalized_words`, the comparison QA already uses, and matched as
    sequences, so a word Whisper spelled differently ("14" for "vierzehn") costs only itself: the
    turn is placed by the words around it that did match.
    """

    expected: list[int] = []  # turn index of every expected token
    expected_tokens: list[str] = []
    for index, text in enumerate(turns):
        for token in normalized_words(text):
            expected.append(index)
            expected_tokens.append(token)
    owner: list[int] = []  # heard word index of every heard token
    heard_tokens: list[str] = []
    for position, word in enumerate(words):
        for token in normalized_words(word.text):
            owner.append(position)
            heard_tokens.append(token)

    turn_of: dict[int, int] = {}  # heard word index -> turn
    matcher = SequenceMatcher(a=expected_tokens, b=heard_tokens, autojunk=False)
    for block in matcher.get_matching_blocks():
        for offset in range(block.size):
            turn_of.setdefault(owner[block.b + offset], expected[block.a + offset])

    missing = sorted(set(range(len(turns))) - set(turn_of.values()))
    if missing:
        raise ValueError(
            "no heard word matches turn(s) "
            + ", ".join(f"{index + 1} ({turns[index]!r})" for index in missing)
        )
    _adopt_unmatched(words, turn_of)

    spans: dict[int, list[int]] = {}
    for position, turn in turn_of.items():
        word = words[position]
        span = spans.setdefault(turn, [word.start_ms, word.end_ms])
        span[0] = min(span[0], word.start_ms)
        span[1] = max(span[1], word.end_ms)
    raw = [(spans[index][0], spans[index][1]) for index in range(len(turns))]
    if any(later[0] < earlier[0] for earlier, later in zip(raw, raw[1:], strict=False)):
        raise ValueError("the heard turns are not in transcript order")

    starts = [
        max(raw[index - 1][1] if index else 0, start - LEAD_MS)
        for index, (start, _) in enumerate(raw)
    ]
    ends = [*starts[1:], max(duration_ms, raw[-1][1])]
    return list(zip(starts, ends, strict=True))


#: How far an unmatched heard word may sit from a matched one and still be adopted by its turn.
#: Within a turn words follow each other closely; a word further off than this is more likely a
#: hallucinated tail ("Untertitel …") than a misheard part of a line.
ADOPT_GAP_MS = 1500


def _adopt_unmatched(words: Sequence[Word], turn_of: dict[int, int]) -> None:
    """Give each unmatched heard word to the neighbouring turn it is closer to in time.

    A misheard word ("Achtemann" for "Achtung an") or a numeral for a spelled-out number ("3" for
    "drei") matches nothing, and left out it would cut its turn short: measured on the six local
    scene renders, that is how "Achtung an Gleis drei" lost its first word or its last.
    """

    matched = sorted(turn_of)
    for position in range(len(words)):
        if position in turn_of:
            continue
        before = max((m for m in matched if m < position), default=None)
        after = min((m for m in matched if m > position), default=None)
        word = words[position]
        gap_before = word.start_ms - words[before].end_ms if before is not None else None
        gap_after = words[after].start_ms - word.end_ms if after is not None else None
        choices = [
            (gap, turn_of[neighbour])
            for gap, neighbour in ((gap_before, before), (gap_after, after))
            if gap is not None and neighbour is not None and gap <= ADOPT_GAP_MS
        ]
        if choices:
            turn_of[position] = min(choices)[1]


#: The window an inner boundary may move in to find the pause, before and after Whisper's guess,
#: and the frame the level is measured over. Measured on the 40 published recordings: Whisper's
#: boundary sat in the previous turn's last syllable, or after the next turn's first, in 7 of 286
#: cases, each by about 200 ms.
SNAP_BEFORE_MS = 400
SNAP_AFTER_MS = 300
SNAP_FRAME_MS = 30


def snap_to_pauses(
    cues: Sequence[tuple[int, int]], level_db: Sequence[float]
) -> list[tuple[int, int]]:
    """Move every inner boundary to the quietest frame near it. `level_db` is one value per frame.

    A boundary moves only inside its window and never past a neighbouring boundary, so the cues
    still tile the recording in order.
    """

    starts = [start for start, _ in cues]
    for index in range(1, len(starts)):
        low = max(starts[index - 1] + SNAP_FRAME_MS, starts[index] - SNAP_BEFORE_MS)
        high = starts[index] + SNAP_AFTER_MS
        if index + 1 < len(starts):
            high = min(high, starts[index + 1] - SNAP_FRAME_MS)
        frames = range(low // SNAP_FRAME_MS, min(len(level_db), high // SNAP_FRAME_MS + 1))
        if frames:
            quietest = min(frames, key=lambda frame: (level_db[frame], abs(frame * SNAP_FRAME_MS - starts[index])))
            starts[index] = quietest * SNAP_FRAME_MS
    return list(zip(starts, [*starts[1:], cues[-1][1]], strict=True))


def frame_levels(path: Path) -> list[float]:
    """The file's RMS level per `SNAP_FRAME_MS` frame, in dBFS, mixed down to mono."""

    import subprocess

    import numpy as np

    rate = 16_000
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "1", "-ar", str(rate), "-"],
        capture_output=True,
        check=True,
    ).stdout
    samples = np.frombuffer(raw, dtype=np.float32)
    size = rate * SNAP_FRAME_MS // 1000
    count = len(samples) // size
    frames = samples[: count * size].reshape(count, size)
    rms = np.sqrt(np.mean(frames.astype(np.float64) ** 2, axis=1))
    return [float(value) for value in 20 * np.log10(np.maximum(rms, 1e-9))]


def measure_cues(path: Path, turns: Sequence[str]) -> list[tuple[int, int]]:
    """The cues of one recording, measured: `heard_words`, `align_cues`, then `snap_to_pauses`."""

    levels = frame_levels(path)
    return snap_to_pauses(
        align_cues(turns, heard_words(path), len(levels) * SNAP_FRAME_MS), levels
    )
