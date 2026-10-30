"""The vocabulary every scene module shares: the stage machine, bilingual text, questions, QA.

Plus the word-level comparison transcript QA is scored with (`normalized_words`,
`word_error_rate`), which is the part of this module that carries the most measured decisions.
"""

from __future__ import annotations

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


# The preset voices each engine documents, in the publisher's own order. The character catalog
# may cast only these. `tests/test_domain.py` holds them equal to `models.lock.json`, which is the
# provenance record.
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
}


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


class Question(BaseModel):
    id: str
    instruction: Bilingual
    response: SingleChoice
    explain: Bilingual
    translation: Bilingual | None = None
    focus: str | None = None


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


#: Spellings Whisper prefers for things German says as words. Grown from observed ASR output,
#: never from guesswork: "Frau Doktor Weber" came back as "Frau Dr. Weber" and cost a clean take
#: one substitution in the full-audio comparison.
ASR_SPELLINGS = {"dr": "doktor"}

#: `sechzehn Uhr zehn` is transcribed `16.10 Uhr` — same time, but the unit word moves, which
#: reads as two edits and failed two otherwise flawless takes. Rewriting the ASR form back into
#: German word order compares the two spellings as the same sequence, and still requires the
#: recording to contain "Uhr" at all.
CLOCK = re.compile(r"\b(\d{1,2})[.:](\d{2})\s*Uhr\b", re.IGNORECASE)

#: The same reordering, for money. German says `zwei Euro fünfzig` and Whisper writes `2,50 Euro`,
#: which moves the unit word exactly as the clock case does — and it failed a flawless take of a
#: market-stall dialogue on two of its seven lines, the two carrying the prices the item asks
#: about. Rewriting the numeral form back into spoken order compares them as one sequence, and
#: still requires the recording to contain both halves of the amount.
PRICE = re.compile(r"\b(\d{1,3})[,.](\d{2})\s*Euro\b", re.IGNORECASE)


#: German says the units before the tens — `fünfundzwanzig` is "five-and-twenty" — and no map of
#: single words can hold 21-99. Whisper writes them as numerals, so a page number or a departure
#: minute came back as two edits on an otherwise exact line.
_UNITS = {
    "ein": 1,
    "eins": 1,
    "zwei": 2,
    "drei": 3,
    "vier": 4,
    "fünf": 5,
    "sechs": 6,
    "sieben": 7,
    "acht": 8,
    "neun": 9,
}
_TENS = {
    w.casefold(): n
    for w, n in {
        "zwanzig": 20,
        "dreißig": 30,
        "vierzig": 40,
        "fünfzig": 50,
        "sechzig": 60,
        "siebzig": 70,
        "achtzig": 80,
        "neunzig": 90,
    }.items()
}
_TEENS = {
    w.casefold(): n
    for w, n in {
        "zehn": 10,
        "elf": 11,
        "zwölf": 12,
        "dreizehn": 13,
        "vierzehn": 14,
        "fünfzehn": 15,
        "sechzehn": 16,
        "siebzehn": 17,
        "achtzehn": 18,
        "neunzehn": 19,
    }.items()
}
COMPOUND_NUMBER = re.compile(f"^({'|'.join(_UNITS)})und({'|'.join(_TENS)})$")


def _below_hundred(word: str) -> int | None:
    compound = COMPOUND_NUMBER.match(word)
    if compound:
        return _UNITS[compound[1]] + _TENS[compound[2]]
    for table in (_TEENS, _TENS, _UNITS):
        if word in table:
            return table[word]
    return None


def german_number(word: str) -> str | None:
    """A written-out German numeral 0-999 as digits, or None if the word is not one.

    Written German closes numerals up into a single word, so `sechshundertzwölf` is one token
    where Whisper writes `612`. A lookup table cannot hold that: it would need every value in the
    range. This parses the three pieces the language actually composes — hundreds, the
    units-before-tens compound, and the teens — which is what makes ICE 612, a 600-euro rent and
    a 300-kilometre delivery all comparable with the numerals the ASR returns.

    Bare `ein` is deliberately refused. It is the indefinite article far more often than it is
    the number, and `ein Kilo Äpfel` must not turn into `1 Kilo Äpfel` when Whisper heard the
    article and wrote the article. Inside a compound — `einundzwanzig`, `einhundert` — it counts.
    """

    # Casefolded here, not left to the caller: `dreißig`.casefold() is `dreissig`, so the tables
    # are keyed on the folded spelling and an unfolded `siebenunddreißig` would silently miss.
    word = word.casefold()
    if word == "ein":
        return None
    if word == "null":
        return "0"
    head, hundred, tail = word.partition("hundert")
    if hundred:
        hundreds = 1 if head == "" else _UNITS.get(head)
        if hundreds is None:
            return None
        if not tail:
            return str(hundreds * 100)
        rest = _below_hundred(tail)
        return None if rest is None else str(hundreds * 100 + rest)
    value = _below_hundred(word)
    return None if value is None else str(value)


#: Ordinals whose stem is not the cardinal: erst-, dritt-, siebt-, and acht- (which swallows the
#: -t). Everything else is regular — cardinal + -te below 20, cardinal + -ste from 20 up.
ORDINAL_IRREGULAR = {
    f"{stem}{ending}": value
    for stem, value in {"erst": "1", "dritt": "3", "siebt": "7", "acht": "8"}.items()
    for ending in ("e", "en", "er", "es", "em")
}
_ORDINAL_ENDINGS = ("sten", "ster", "stes", "stem", "ste", "ten", "ter", "tes", "tem", "te")


def ordinal_number(word: str) -> str | None:
    """A written-out German ordinal as its digits, or None.

    Dates are said as ordinals and written as numerals: `am zwanzigsten November` comes back from
    Whisper as `am 20. November`, and `den ersten August` as `den 1. August`. Both failed clean
    takes — a city-council date and a booked train — on notation rather than on speech.
    """

    word = word.casefold()
    if word in ORDINAL_IRREGULAR:
        return ORDINAL_IRREGULAR[word]
    for ending in _ORDINAL_ENDINGS:
        if not word.endswith(ending):
            continue
        stem = word[: -len(ending)]
        # The stem of a regular ordinal is the cardinal itself: zwanzig+sten, viert -> vier+ten.
        value = german_number(stem) if stem else None
        if value:
            return value
    return None


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

    spoken = PRICE.sub(r"\1 Euro \2", CLOCK.sub(r"\1 Uhr \2", text))
    words = [word.casefold() for word in WORD.findall(spoken)]
    out: list[str] = []
    for word in words:
        word = ASR_SPELLINGS.get(word, word)
        mapped = (
            german_number(word) or ordinal_number(word) or GERMAN_NUMBER_WORDS.get(word, word)
        )
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
    heard = normalized_words(actual)
    # A word boundary is the ASR's guess, not evidence about the speech. German writes compounds
    # closed up and Whisper does not always agree — `kaputtgegangen` came back as `kaputt
    # gegangen`, which is the same three syllables and scored 0.67 on a three-word line. If the
    # two sequences are identical once the spaces are gone, nothing was misheard.
    if words and "".join(words) == "".join(heard):
        return 0.0
    return edit_distance(words, heard) / max(1, len(words))
