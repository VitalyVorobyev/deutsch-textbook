from __future__ import annotations

import subprocess
from pathlib import Path

import numpy as np
import soundfile as sf

from .adapters import TTSAdapter, transcribe, wav_duration
from .domain import Bilingual, Brief, Line, Question, RevisionPayload, SingleChoice, normalized_words, word_error_rate
from .reading_audio import ParagraphCue, ReadingRevisionPayload, text_sha256
from .speaker_qa import EmbeddingBackend, check_speaker_consistency


def paragraph_line(payload: ReadingRevisionPayload, index: int) -> Line:
    paragraph = payload.paragraphs[index]
    return Line(
        id=f"paragraph-{index + 1}",
        speaker=payload.character_id,
        display_text=paragraph.display_text,
        synthesis_text=paragraph.synthesis_text,
        voice=payload.voice,
        style=payload.style,
        pace=payload.pace,
        pause_after_ms=payload.paragraph_pause_ms,
        seed=payload.seed,
        pronunciation_overrides=paragraph.pronunciation_overrides,
    )


def generate_reading(
    payload: ReadingRevisionPayload, root: Path, adapter: TTSAdapter
) -> tuple[Path, ReadingRevisionPayload]:
    cache = root / "cache"
    paths: list[Path] = []
    for index, paragraph in enumerate(payload.paragraphs):
        path = cache / f"{payload.paragraph_cache_key(paragraph, adapter.revision)}.wav"
        if not path.exists():
            path.parent.mkdir(parents=True, exist_ok=True)
            adapter.synthesize(paragraph_line(payload, index), path)
        paths.append(path)

    target = root / "final.wav"
    target.parent.mkdir(parents=True, exist_ok=True)
    concat = root / "reading.concat.txt"
    parts: list[str] = []
    cues: list[ParagraphCue] = []
    cursor_ms = 0
    for index, (paragraph, path) in enumerate(zip(payload.paragraphs, paths, strict=True)):
        duration = wav_duration(path)
        if duration is None:
            raise ValueError(f"cannot measure paragraph {index + 1}")
        start = cursor_ms
        end = start + round(duration * 1000)
        cues.append(
            ParagraphCue(
                paragraph_index=index,
                start_ms=start,
                end_ms=end,
                text_sha256=text_sha256(paragraph.display_text),
            )
        )
        parts.append(f"file '{path.as_posix()}'")
        if index < len(paths) - 1:
            silence = root / f"silence-{payload.paragraph_pause_ms}.wav"
            if not silence.exists():
                subprocess.run(
                    [
                        "ffmpeg", "-v", "error", "-f", "lavfi", "-i",
                        "anullsrc=r=16000:cl=mono", "-t",
                        str(payload.paragraph_pause_ms / 1000), "-y", str(silence),
                    ],
                    check=True,
                )
            parts.append(f"file '{silence.as_posix()}'")
            cursor_ms = end + payload.paragraph_pause_ms
        else:
            cursor_ms = end
    concat.write_text("\n".join(parts) + "\n")
    subprocess.run(
        [
            "ffmpeg", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(concat),
            "-af", "loudnorm=I=-19:TP=-1.5:LRA=7", "-ar", "16000", "-ac", "1",
            "-c:a", "pcm_s16le", "-y", str(target),
        ],
        check=True,
    )
    concat.unlink(missing_ok=True)
    return target, ReadingRevisionPayload.model_validate(
        payload.model_dump(mode="json") | {"cues": [cue.model_dump(mode="json") for cue in cues]}
    )


def reading_qa(
    payload: ReadingRevisionPayload,
    root: Path,
    adapter_revision: str,
    *,
    fake: bool = False,
    embedding_backend: EmbeddingBackend | None = None,
) -> dict[str, object]:
    paths = {
        f"paragraph-{index + 1}": root / "cache" / f"{payload.paragraph_cache_key(paragraph, adapter_revision)}.wav"
        for index, paragraph in enumerate(payload.paragraphs)
    }
    expected = [paragraph_line(payload, index).spoken_text() for index in range(len(payload.paragraphs))]
    transcripts = expected if fake else [transcribe(paths[f"paragraph-{index + 1}"]) for index in range(len(expected))]
    line_wer = [word_error_rate(want, heard) for want, heard in zip(expected, transcripts, strict=True)]
    full_transcript = " ".join(transcripts) if fake else transcribe(root / "final.wav")
    full_expected = " ".join(expected)
    full_wer = word_error_rate(full_expected, full_transcript)
    duration = wav_duration(root / "final.wav") or 0
    words = len(full_expected.split())
    samples, sample_rate = sf.read(root / "final.wav", dtype="float32", always_2d=True)
    mono = np.max(np.abs(samples), axis=1)
    threshold = 10 ** (-45 / 20)
    voiced = np.flatnonzero(mono >= threshold)
    voiced_seconds = float(len(voiced) / sample_rate)
    leading_silence = float(voiced[0] / sample_rate) if len(voiced) else duration
    trailing_silence = (
        float((len(mono) - 1 - voiced[-1]) / sample_rate) if len(voiced) else duration
    )
    peak = float(np.max(mono)) if len(mono) else 0.0
    rms = float(np.sqrt(np.mean(np.square(samples)))) if len(samples) else 0.0
    cue_gaps = [
        payload.cues[index + 1].start_ms - payload.cues[index].end_ms
        for index in range(len(payload.cues) - 1)
    ]
    cue_bounds_valid = bool(payload.cues) and payload.cues[-1].end_ms <= round(duration * 1000)
    protected = {
        word
        for word in normalized_words(full_expected)
        if word.isdigit() or word in {"nicht", "nichts", "nie", "kein", "keine", "keinen"}
    }
    heard_words = set(normalized_words(full_transcript))
    missing_protected = sorted(protected - heard_words)
    qa_payload = RevisionPayload(
        title=Bilingual(en=payload.title_de, ru=payload.title_de),
        brief=Brief(
            level=payload.level,
            scenario="Reading narration speaker QA",
            duration_seconds=max(5, round(duration)),
            speaker_count=1,
            topic=payload.reading_id.split("/")[-1],
            outcomes=["reading-narration-qa"],
        ),
        speakers=[payload.character_id],
        lines=[paragraph_line(payload, index) for index in range(len(payload.paragraphs))],
        questions=[Question(
            id="qa-placeholder",
            instruction=Bilingual(en="QA", ru="QA"),
            response=SingleChoice(kind="single-choice", prompt="QA", options=["A", "B"], correct=0),
            explain=Bilingual(en="QA", ru="QA"),
        )],
        tts_adapter="fake" if fake else "qwen_tts",
    )
    consistency: dict[str, object]
    if fake:
        consistency = {"status": "not-run-test-adapter"}
    else:
        consistency = check_speaker_consistency(
            qa_payload, paths, backend=embedding_backend
        ).model_dump(mode="json")
    return {
        "passed": full_wer <= 0.08 and all(value <= 0.12 for value in line_wer) and not missing_protected and cue_bounds_valid,
        "full_transcript": full_transcript,
        "full_wer": full_wer,
        "paragraphs": [
            {"index": index, "expected": want, "transcript": heard, "wer": value}
            for index, (want, heard, value) in enumerate(zip(expected, transcripts, line_wer, strict=True))
        ],
        "duration_seconds": duration,
        "word_count": words,
        "voiced_words_per_second": words / voiced_seconds if voiced_seconds else None,
        "duration_per_100_words": duration / words * 100 if words else None,
        "leading_silence_seconds": leading_silence,
        "trailing_silence_seconds": trailing_silence,
        "peak_dbfs": float(20 * np.log10(peak)) if peak else None,
        "rms_dbfs": float(20 * np.log10(rms)) if rms else None,
        "clipped_sample_count": int(np.count_nonzero(mono >= 0.999)),
        "paragraph_gap_ms": cue_gaps,
        "cue_bounds_valid": cue_bounds_valid,
        "missing_protected_tokens": missing_protected,
        "cue_coverage": len(payload.cues) / len(payload.paragraphs),
        "narrator_consistency": consistency,
    }
