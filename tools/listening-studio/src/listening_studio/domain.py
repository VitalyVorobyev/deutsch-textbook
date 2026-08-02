from __future__ import annotations

import hashlib
import json
import re
from datetime import UTC, datetime
from enum import StrEnum
from typing import Annotated, Literal

from pydantic import BaseModel, Field, model_validator


class Stage(StrEnum):
    DRAFT = "draft"
    VALIDATED = "validated"
    AUDIO_GENERATED = "audio_generated"
    AUTOMATICALLY_CHECKED = "automatically_checked"
    HUMAN_APPROVED = "human_approved"
    EXPORTED = "exported"


class Bilingual(BaseModel):
    en: str
    ru: str
    uk: str | None = None


# The preset voices each adapter documents, in the publisher's own order. Ordered because a
# model switch reassigns voices by position, and a set would make that reassignment depend on
# hash order — the same project would come back with different speakers on different runs.
# `tests/test_domain.py` holds these equal to `models.lock.json`, which is the provenance record.
VOICE_SETS: dict[str, tuple[str, ...]] = {
    "qwen_tts": (
        "Vivian",
        "Serena",
        "Uncle_Fu",
        "Dylan",
        "Eric",
        "Ryan",
        "Aiden",
        "Ono_Anna",
        "Sohee",
    ),
    "parler_tts": ("Nicole", "Christopher", "Megan", "Michelle"),
}


class Brief(BaseModel):
    source_text: str = ""
    level: Literal["A1", "A2", "B1", "B2"] = "A2"
    vocabulary: list[str] = Field(default_factory=list)
    grammar_target: str = ""
    focus: str | None = None
    scenario: str
    duration_seconds: int = Field(default=45, ge=5, le=600)
    speaker_count: int = Field(default=2, ge=1, le=4)
    topic: str
    outcomes: list[str] = Field(min_length=1)


class PronunciationOverride(BaseModel):
    display: str
    synthesis: str


class ContextSound(BaseModel):
    """Reference to a manually reviewed, locally imported Freesound artifact."""

    source_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    sound_id: int = Field(gt=0)
    start_ms: int = Field(default=0, ge=0)
    duration_ms: int = Field(gt=0, le=120_000)
    delay_ms: int = Field(default=0, ge=0, le=600_000)
    gain_db: float = Field(default=-18.0, ge=-40.0, le=-12.0)


class Line(BaseModel):
    id: str
    speaker: str
    display_text: str
    synthesis_text: str | None = None
    voice: str = "Ryan"
    pace: float = Field(default=1.0, ge=0.7, le=1.15)
    pause_after_ms: int = Field(default=350, ge=0, le=5000)
    seed: int = 0
    pronunciation_overrides: list[PronunciationOverride] = Field(default_factory=list)

    def spoken_text(self) -> str:
        text = self.synthesis_text or self.display_text
        for override in self.pronunciation_overrides:
            text = text.replace(override.display, override.synthesis)
        return text


def reassign_voices(lines: list[Line], adapter: str) -> list[Line]:
    """Give every speaker a voice the named adapter actually offers.

    Switching the synthesis model leaves each line carrying the previous model's preset voice,
    and the Studio's script form submits those old voices in the same request as the new adapter —
    so the editor has no way to fix it by hand before the payload is validated. Reassigning per
    **speaker** rather than per line preserves the one property that matters editorially: two
    speakers still sound like two people. Which voice each speaker lands on is arbitrary and
    meant to be adjusted afterwards. A voice the new adapter already offers is left alone.
    """

    voices = VOICE_SETS.get(adapter)
    if not voices:
        return lines
    assigned: dict[str, str] = {}
    for line in lines:
        if line.voice in voices:
            assigned.setdefault(line.speaker, line.voice)
    for line in lines:
        if line.speaker in assigned:
            continue
        taken = set(assigned.values())
        assigned[line.speaker] = next((v for v in voices if v not in taken), voices[0])
    return [line.model_copy(update={"voice": assigned[line.speaker]}) for line in lines]


class SingleChoice(BaseModel):
    kind: Literal["single-choice"]
    prompt: str
    options: list[str] = Field(min_length=2)
    correct: int = Field(ge=0)

    @model_validator(mode="after")
    def valid_correct(self) -> SingleChoice:
        if self.correct >= len(self.options):
            raise ValueError("correct option is out of range")
        return self


# ---------------------------------------------------------------------------
# Legacy response shapes — readable, never exportable
# ---------------------------------------------------------------------------
#
# These five fed the `listening` item type, which was removed on 2026-08-02 because each
# duplicated an item type the app already had (`mc`, `order`, `listen`). A reviewed recording
# now feeds `audio-comprehension`, which is single-choice, so nothing below can ship.
#
# They stay parseable because deleting them from the model did not delete them from anyone's
# database: the first attempt narrowed `Question.response` outright and made 12 of 13 drafted
# projects unloadable — every action answered a wall of pydantic errors, and real authored
# German sat behind it. A store that cannot read its own history is a worse failure than a
# shape that cannot be exported.
#
# `exercise_yaml` refuses them with a readable message, and `normalize-questions` rewrites
# them into single-choice drafts that keep the authored text. Do not author new ones.


class MultiSelect(BaseModel):
    kind: Literal["multi-select"]
    prompt: str
    options: list[str] = Field(min_length=2)
    correct: list[int] = Field(min_length=1)


class TrueFalse(BaseModel):
    kind: Literal["true-false"]
    statement: str
    correct: bool


class Ordering(BaseModel):
    kind: Literal["ordering"]
    prompt: str
    units: list[str] = Field(min_length=2)


class ShortAnswer(BaseModel):
    kind: Literal["short-answer"]
    prompt: str
    answers: list[str] = Field(min_length=1)


class Dictation(BaseModel):
    kind: Literal["dictation"]
    line_id: str
    accept: list[str] = Field(default_factory=list)


LegacyResponse = MultiSelect | TrueFalse | Ordering | ShortAnswer | Dictation
Response = Annotated[SingleChoice | LegacyResponse, Field(discriminator="kind")]


class Question(BaseModel):
    id: str
    instruction: Bilingual
    response: Response
    explain: Bilingual
    translation: Bilingual | None = None
    focus: str | None = None


class RevisionPayload(BaseModel):
    title: Bilingual
    brief: Brief
    speakers: list[str]
    lines: list[Line] = Field(min_length=1)
    questions: list[Question] = Field(min_length=1)
    tts_adapter: Literal["qwen_tts", "parler_tts", "fake"] = "qwen_tts"
    context_sounds: list[ContextSound] = Field(default_factory=list, max_length=4)
    max_replays: int = Field(default=3, ge=1, le=10)
    # How this script came to exist, and — when a model drafted it — the exact prompt that
    # was submitted, captured at generation time and carried through every later revision.
    #
    # The bundle used to rebuild an "Exact prompt" from the *final* payload. After the
    # editorial revision that every draft receives, that string is not what any model was
    # ever given; for a hand-written project no prompt was submitted at all. Published
    # provenance then stated a generation history that had not happened, which is the one
    # thing docs/product-protection.md requires the manifest to get right. Defaults make old
    # rows read as what they are: manually authored, no prompt.
    authoring: Literal["manual", "generated"] = "manual"
    generation_prompt: str | None = None

    @model_validator(mode="after")
    def consistent(self) -> RevisionPayload:
        if len(self.speakers) != self.brief.speaker_count:
            raise ValueError("speaker_count must equal the speakers list")
        allowed = set(self.speakers)
        if any(line.speaker not in allowed for line in self.lines):
            raise ValueError("every line speaker must be declared")
        line_ids = {line.id for line in self.lines}
        if len(line_ids) != len(self.lines):
            raise ValueError("line ids must be unique")
        allowed_voices = VOICE_SETS.get(self.tts_adapter)
        if allowed_voices and any(line.voice not in allowed_voices for line in self.lines):
            raise ValueError(f"{self.tts_adapter} permits only publisher-documented preset voices")
        return self

    def canonical_json(self) -> str:
        return json.dumps(
            self.model_dump(mode="json"), ensure_ascii=False, sort_keys=True, separators=(",", ":")
        )

    def sha256(self) -> str:
        return hashlib.sha256(self.canonical_json().encode()).hexdigest()


class LineQA(BaseModel):
    line_id: str
    expected: str
    transcript: str
    wer: float
    passed: bool
    missing_protected: list[str] = Field(default_factory=list)


class QAReport(BaseModel):
    created_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    full_transcript: str
    full_wer: float
    lines: list[LineQA]
    failures: list[str]
    warnings: list[str]
    passed: bool


WORD = re.compile(r"[\wäöüßÄÖÜ]+", re.UNICODE)
# Keys are casefolded on construction: `"dreißig".casefold()` is `"dreissig"`, so a literal
# "dreißig" key would never be hit by a lookup on casefolded input — silently, and only for the
# entries containing ß.
GERMAN_NUMBER_WORDS = {
    word.casefold(): digits
    for word, digits in {
        "null": "0",
        "eins": "1",
        "zwei": "2",
        "drei": "3",
        "vier": "4",
        "fünf": "5",
        "sechs": "6",
        "sieben": "7",
        "acht": "8",
        "neun": "9",
        "zehn": "10",
        "elf": "11",
        "zwölf": "12",
        "dreizehn": "13",
        "vierzehn": "14",
        "fünfzehn": "15",
        "sechzehn": "16",
        "siebzehn": "17",
        "achtzehn": "18",
        "neunzehn": "19",
        "zwanzig": "20",
        "dreißig": "30",
        "vierzig": "40",
        "fünfzig": "50",
        "sechzig": "60",
        "siebzig": "70",
        "achtzig": "80",
        "neunzig": "90",
        "hundert": "100",
    }.items()
}


def normalized_words(text: str) -> list[str]:
    """Script words and ASR output reduced to one comparable sequence.

    The digit split is the load-bearing part. `listen` and `audio-comprehension` scripts must
    spell numbers out ("null eins fünf sieben"), while Whisper writes the same speech as one
    numeral ("0157") — so a flawless A1 telephone-number take scored WER 0.70 and every numeric
    scenario in `data/listening-plan.yaml` would have failed QA on spelling rather than on
    speech. Splitting a multi-digit token into single digits makes both spellings the same
    sequence. It costs a little precision (spoken "zwei null" no longer differs from "zwanzig"),
    which is the right trade for a screen whose job is to catch defects before a human listens.
    """

    words = [word.casefold() for word in WORD.findall(text)]
    out: list[str] = []
    for word in words:
        mapped = GERMAN_NUMBER_WORDS.get(word, word)
        out.extend(mapped if mapped.isdigit() and len(mapped) > 1 else [mapped])
    return out


def edit_distance(a: list[str], b: list[str]) -> int:
    previous = list(range(len(b) + 1))
    for i, left in enumerate(a, 1):
        current = [i]
        for j, right in enumerate(b, 1):
            current.append(min(current[-1] + 1, previous[j] + 1, previous[j - 1] + (left != right)))
        previous = current
    return previous[-1]


def word_error_rate(expected: str, actual: str) -> float:
    words = normalized_words(expected)
    return edit_distance(words, normalized_words(actual)) / max(1, len(words))


def line_cache_key(line: Line, adapter_revision: str, processor_version: str = "2") -> str:
    value = {
        "text": line.spoken_text(),
        "voice": line.voice,
        "pace": line.pace,
        "pause": line.pause_after_ms,
        "seed": line.seed,
        "adapter": adapter_revision,
        "processor": processor_version,
    }
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()
