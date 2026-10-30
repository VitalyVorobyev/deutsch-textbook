"""A Lesetext as the narration path reads it: `content/reading/<level>/<id>.yaml`, gloss-stripped.

`scene.convert.scene_from_reading` turns one of these into a narration scene; the registry and the
Lesetexte queue list them; `default_profile_id` is the profile a new narration starts on.
"""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Literal, cast

import yaml
from pydantic import BaseModel, Field

GLOSS = re.compile(r"\[\[([^:\]]+)::[^\]]+\]\]")
WORD = re.compile(r"[A-Za-zÄÖÜäöüß'-]+")


def spoken_paragraph(text: str) -> str:
    """`[[Wort::word::слово]]` → `Wort`: what a narrator says, without the inline glosses."""

    return GLOSS.sub(lambda match: match.group(1), text).strip()


class ReadingSource(BaseModel):
    id: str
    level: Literal["A1", "A2", "B1"]
    topic: str
    title_de: str
    kind: Literal["intensive", "extensive"] = "intensive"
    paragraphs: list[str] = Field(min_length=1)
    #: The sha256 of the gloss-stripped paragraphs as a compact JSON array.
    source_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")

    @property
    def word_count(self) -> int:
        return sum(len(WORD.findall(paragraph)) for paragraph in self.paragraphs)


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
