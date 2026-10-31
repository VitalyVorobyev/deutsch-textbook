from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Final, Literal

import yaml
from pydantic import BaseModel, Field, model_validator

from .domain import VOICE_SETS


#: The engine a catalog profile without an `engine` field speaks on: a preset of the 0.6B
#: CustomVoice checkpoint, which is what every version-1 profile is.
PRESET_ENGINE: Final = "qwen_tts"

#: The engine a designed profile speaks on (ADR 0013): a designed synthetic reference, named by
#: its digest, cloned by the 1.7B Base checkpoint.
DESIGNED_ENGINE: Final = "qwen_tts_designed"

#: The bounds a catalog pace is held to. A designed voice's pace brings its clones back to the
#: corpus's speaking rate, and a preset's shades a preset speaker; neither is a delivery decision.
CATALOG_PACE_MIN, CATALOG_PACE_MAX = 0.7, 1.15


class CatalogVoiceProfile(BaseModel):
    """How a character sounds, on one of two engines.

    A **preset** profile (`engine: qwen_tts`, the default) names a CustomVoice speaker and a style
    sentence. A **designed** profile (`engine: qwen_tts_designed`) names the SHA-256 of a designed
    synthetic reference held in the studio's app data, and has no style: the Base checkpoint takes
    no instruction, and the delivery is the one the reference's description gave it. `pace`
    applies to every line the character speaks once a scene adopts the profile
    (`scene.casting.adopt_catalog_voice`).
    """

    engine: Literal["qwen_tts", "qwen_tts_designed"] = PRESET_ENGINE
    voice: str
    seed: int = Field(ge=0)
    style: str | None = Field(default=None, min_length=1)
    pace: float = Field(ge=CATALOG_PACE_MIN, le=CATALOG_PACE_MAX)

    @model_validator(mode="after")
    def fits_its_engine(self) -> CatalogVoiceProfile:
        if self.engine == DESIGNED_ENGINE:
            if not re.fullmatch(r"[0-9a-f]{64}", self.voice):
                raise ValueError(
                    "a designed profile's voice is the SHA-256 of its reference clip"
                )
            if self.style is not None:
                raise ValueError(
                    "a designed profile has no style; the Base checkpoint takes no instruction"
                )
            return self
        if self.voice not in VOICE_SETS[PRESET_ENGINE]:
            raise ValueError(f"unknown Qwen preset {self.voice}")
        if self.style is None:
            raise ValueError("a preset profile needs its style sentence")
        return self


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
