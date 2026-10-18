from __future__ import annotations

import json
from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel, Field, model_validator

from .domain import VOICE_SETS


class CatalogVoiceProfile(BaseModel):
    voice: str
    seed: int = Field(ge=0)
    style: str = Field(min_length=1)
    pace: float = Field(ge=0.7, le=1.15)


class CharacterDefinition(BaseModel):
    id: str = Field(pattern=r"^[a-z0-9-]+$")
    version: int = Field(ge=1)
    display_name: str = Field(min_length=1)
    age_band: Literal["child", "young-adult", "adult", "older-adult"]
    persona: str = Field(min_length=1)
    registers: list[Literal["informal", "neutral", "formal"]] = Field(min_length=1)
    roles: list[str] = Field(min_length=1)
    casting_tags: list[str] = Field(min_length=1)
    narration_capable: bool = False
    incompatible_with: list[str] = Field(default_factory=list)
    status: Literal[
        "draft-profile", "reviewed-profile", "provisional-shared-preset", "retired"
    ]
    voice_profile: CatalogVoiceProfile
    portrait_path: str | None = None
    demo_phrases: list[str] = Field(min_length=3, max_length=3)
    demo_hashes: list[str] = Field(default_factory=list, max_length=3)


class CharacterCatalog(BaseModel):
    version: int = Field(ge=1)
    characters: list[CharacterDefinition] = Field(min_length=1)

    @model_validator(mode="after")
    def consistent(self) -> CharacterCatalog:
        ids = [character.id for character in self.characters]
        if len(ids) != len(set(ids)):
            raise ValueError("character ids must be unique")
        known = set(ids)
        for character in self.characters:
            if character.voice_profile.voice not in VOICE_SETS["qwen_tts"]:
                raise ValueError(f"unknown Qwen preset for {character.id}")
            missing = set(character.incompatible_with) - known
            if missing:
                raise ValueError(f"{character.id} references unknown incompatible characters")
            for other_id in character.incompatible_with:
                other = next(row for row in self.characters if row.id == other_id)
                if character.id not in other.incompatible_with:
                    raise ValueError("casting incompatibility must be symmetric")
        return self


class NarrationProfile(BaseModel):
    id: str = Field(pattern=r"^[a-z0-9-]+$")
    version: int = Field(ge=1)
    character_id: str
    label: str
    description: str
    allowed_kinds: list[Literal["intensive", "extensive"]] = Field(min_length=1)
    pace_by_level: dict[Literal["A1", "A2", "B1"], float]
    paragraph_pause_ms: int = Field(ge=250, le=2000)
    instruction: str = Field(min_length=1)


class NarrationCatalog(BaseModel):
    version: int = Field(ge=1)
    profiles: list[NarrationProfile] = Field(min_length=1)


class SourceEditorial(BaseModel):
    category: str = "uncategorized"
    scene_tags: list[str] = Field(default_factory=list)
    allowed_roles: list[Literal["bed", "event"]] = Field(default_factory=list, min_length=1)
    default_gain_db: float = Field(default=-24.0, ge=-40, le=-12)
    loop_quality: Literal["good", "usable", "event-only", "unreviewed"] = "unreviewed"
    review_status: Literal["pending", "reviewed", "rejected"] = "pending"
    notes: str = ""


def load_character_catalog(repo: Path) -> CharacterCatalog:
    return CharacterCatalog.model_validate(
        yaml.safe_load((repo / "data" / "listening-characters.yaml").read_text())
    )


def load_narration_catalog(repo: Path) -> NarrationCatalog:
    catalog = NarrationCatalog.model_validate(
        yaml.safe_load((repo / "data" / "listening-narration-profiles.yaml").read_text())
    )
    characters = load_character_catalog(repo)
    by_id = {character.id: character for character in characters.characters}
    for profile in catalog.profiles:
        character = by_id.get(profile.character_id)
        if character is None or not character.narration_capable:
            raise ValueError(f"narration profile {profile.id} needs a narration-capable character")
    return catalog


def editorial_path(root: Path, source_hash: str) -> Path:
    return root / "sources" / source_hash / "editorial.json"


def load_source_editorial(root: Path, source_hash: str) -> SourceEditorial:
    path = editorial_path(root, source_hash)
    return (
        SourceEditorial.model_validate_json(path.read_text())
        if path.exists()
        else SourceEditorial(allowed_roles=["event"])
    )


def suggested_source_editorial(title: str, description: str) -> SourceEditorial:
    """Useful draft metadata derived from non-semantic source descriptions, never a review."""

    text = f"{title} {description}".casefold()
    loop: Literal["good", "usable", "event-only", "unreviewed"]
    if any(token in text for token in ("room tone", "raumton", "ambience", "stadtraum", "straßenraum", "city", "bahnsteig")):
        category = "ambience"
        roles: list[Literal["bed", "event"]] = ["bed"]
        loop = "usable"
    elif any(token in text for token in ("tone", "beep", "signalton", "freizeichen", "rufton")):
        category, roles, loop = "signal", ["event"], "event-only"
    elif any(token in text for token in ("door", "tür", "bottle", "glas")):
        category, roles, loop = "object", ["event"], "event-only"
    elif any(token in text for token in ("drip", "tropfen", "water")):
        category, roles, loop = "water", ["bed", "event"], "usable"
    else:
        category, roles, loop = "uncategorized", ["event"], "unreviewed"
    tags = sorted(
        token
        for token in ("office", "home", "street", "station", "hallway", "phone", "water")
        if token in text
    )
    return SourceEditorial(
        category=category,
        scene_tags=tags,
        allowed_roles=roles,
        loop_quality=loop,
        review_status="pending",
        notes="Agent-suggested metadata; human sound review pending.",
    )


def save_source_editorial(root: Path, source_hash: str, metadata: SourceEditorial) -> None:
    path = editorial_path(root, source_hash)
    if not path.parent.exists():
        raise ValueError("source must be imported before editorial metadata is saved")
    path.write_text(json.dumps(metadata.model_dump(mode="json"), indent=2, sort_keys=True) + "\n")
