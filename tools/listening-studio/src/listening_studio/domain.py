from __future__ import annotations

import hashlib
import json
import re
from datetime import UTC, datetime
from enum import StrEnum
from typing import Literal

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


# The five other response shapes — multi-select, true/false, ordering, short-answer and
# dictation — were removed on 2026-08-02 with the `listening` item type they existed to feed.
# Each duplicated an item type the app already had (`mc`, `order`, `listen`), and an editorial
# model that can author a task the catalog cannot render is a drafting trap, not a feature.
# A reviewed recording feeds `audio-comprehension`, which is single-choice.


class Question(BaseModel):
    id: str
    instruction: Bilingual
    response: SingleChoice
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
        voice_sets = {
            "qwen_tts": {
                "Vivian",
                "Serena",
                "Uncle_Fu",
                "Dylan",
                "Eric",
                "Ryan",
                "Aiden",
                "Ono_Anna",
                "Sohee",
            },
            "parler_tts": {"Nicole", "Christopher", "Megan", "Michelle"},
        }
        allowed_voices = voice_sets.get(self.tts_adapter)
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
GERMAN_NUMBER_WORDS = {
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
}


def normalized_words(text: str) -> list[str]:
    words = [word.casefold() for word in WORD.findall(text)]
    return [GERMAN_NUMBER_WORDS.get(word, word) for word in words]


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
