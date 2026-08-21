from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Literal, cast

import yaml
from pydantic import BaseModel, Field, model_validator

from .domain import PronunciationOverride, Stage


GLOSS = re.compile(r"\[\[([^:\]]+)::[^\]]+\]\]")
WORD = re.compile(r"[A-Za-zÄÖÜäöüß'-]+")


def spoken_paragraph(text: str) -> str:
    return GLOSS.sub(lambda match: match.group(1), text).strip()


def text_sha256(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


class ReadingSource(BaseModel):
    id: str
    level: Literal["A1", "A2", "B1"]
    topic: str
    title_de: str
    kind: Literal["intensive", "extensive"] = "intensive"
    paragraphs: list[str] = Field(min_length=1)
    source_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")

    @property
    def word_count(self) -> int:
        return sum(len(WORD.findall(paragraph)) for paragraph in self.paragraphs)


class ReadingParagraph(BaseModel):
    index: int = Field(ge=0)
    display_text: str
    synthesis_text: str | None = None
    pronunciation_overrides: list[PronunciationOverride] = Field(default_factory=list)

    def spoken_text(self) -> str:
        text = self.synthesis_text or self.display_text
        for override in self.pronunciation_overrides:
            text = text.replace(override.display, override.synthesis)
        return text


class ParagraphCue(BaseModel):
    paragraph_index: int = Field(ge=0)
    start_ms: int = Field(ge=0)
    end_ms: int = Field(gt=0)
    text_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")

    @model_validator(mode="after")
    def ordered(self) -> ParagraphCue:
        if self.end_ms <= self.start_ms:
            raise ValueError("cue end must follow cue start")
        return self


class ReadingRevisionPayload(BaseModel):
    artifact_kind: Literal["reading"] = "reading"
    reading_id: str
    level: Literal["A1", "A2", "B1"]
    title_de: str
    kind: Literal["intensive", "extensive"]
    source_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    narration_profile_id: str
    narration_profile_version: int = Field(ge=1)
    character_id: str
    character_version: int = Field(ge=1)
    voice: str
    seed: int = Field(ge=0)
    style: str
    pace: float = Field(ge=0.7, le=1.15)
    paragraph_pause_ms: int = Field(ge=250, le=2000)
    paragraphs: list[ReadingParagraph] = Field(min_length=1)
    cues: list[ParagraphCue] = Field(default_factory=list)
    authoring: Literal["manual", "generated"] = "generated"

    @model_validator(mode="after")
    def consistent(self) -> ReadingRevisionPayload:
        indexes = [paragraph.index for paragraph in self.paragraphs]
        if indexes != list(range(len(self.paragraphs))):
            raise ValueError("reading paragraphs must be contiguous and ordered")
        if self.cues:
            if [cue.paragraph_index for cue in self.cues] != indexes:
                raise ValueError("cues must cover every paragraph in order")
            previous_end = 0
            for paragraph, cue in zip(self.paragraphs, self.cues, strict=True):
                if cue.start_ms < previous_end:
                    raise ValueError("paragraph cues must not overlap")
                if cue.text_sha256 != text_sha256(paragraph.display_text):
                    raise ValueError("paragraph cue text hash has drifted")
                previous_end = cue.end_ms
        return self

    def paragraph_cache_key(self, paragraph: ReadingParagraph, adapter_revision: str) -> str:
        material = {
            "processor": "reading-paragraph-v1-16khz",
            "adapter_revision": adapter_revision,
            "profile": [self.narration_profile_id, self.narration_profile_version],
            "character": [self.character_id, self.character_version],
            "voice": self.voice,
            "seed": self.seed,
            "style": self.style,
            "pace": self.pace,
            "paragraph": paragraph.model_dump(mode="json"),
        }
        canonical = json.dumps(material, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(canonical.encode()).hexdigest()


class ReadingAudioArtifact(BaseModel):
    id: str
    reading_id: str
    level: Literal["A1", "A2", "B1"]
    style_id: str
    style_version: int = Field(ge=1)
    narrator_id: str
    narrator_version: int = Field(ge=1)
    duration_seconds: float = Field(gt=0)
    paragraphs: list[ParagraphCue] = Field(min_length=1)
    provenance: str


class ReadingProjectState(BaseModel):
    reading_id: str
    stage: Stage = Stage.DRAFT
    revision: int = Field(default=1, ge=1)
    payload: ReadingRevisionPayload
    qa: dict[str, object] | None = None
    approval: dict[str, object] | None = None


def load_reading_sources(repo: Path) -> list[ReadingSource]:
    sources: list[ReadingSource] = []
    root = repo / "content" / "reading"
    for path in sorted(root.glob("*/*.yaml")):
        raw = yaml.safe_load(path.read_text())
        paragraphs = [spoken_paragraph(str(row)) for row in raw["text"]]
        identifier = str(path.relative_to(root).with_suffix(""))
        level = cast(Literal["A1", "A2", "B1"], path.parent.name.upper())
        canonical = json.dumps(paragraphs, ensure_ascii=False, separators=(",", ":"))
        sources.append(
            ReadingSource(
                id=identifier,
                level=level,
                topic=raw["topic"],
                title_de=raw["title_de"],
                kind=raw.get("kind", "intensive"),
                paragraphs=paragraphs,
                source_sha256=hashlib.sha256(canonical.encode()).hexdigest(),
            )
        )
    return sources


def default_profile_id(source: ReadingSource) -> str:
    if source.id.startswith(("a1/lena-", "a2/lena-")):
        return "warm-narrative"
    if any(token in source.id for token in ("aemter", "regeln", "bewerbung", "pruefung")):
        return "formal-informational"
    if source.level == "A1" and source.kind == "intensive":
        return "didactic-clear"
    return "neutral-editorial"
