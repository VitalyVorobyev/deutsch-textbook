from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
from datetime import date
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field, model_validator

MAX_SOURCE_BYTES = 10 * 1024 * 1024


class FreesoundSource(BaseModel):
    sound_id: int = Field(gt=0)
    page_url: str
    title: str = Field(min_length=1)
    uploader: str = Field(min_length=1)
    retrieved_at: date
    license: Literal["CC0-1.0", "CC-BY-4.0"]
    license_url: str
    description: str = Field(min_length=1)
    rights_risk_note: str = Field(min_length=1)
    original_filename: str = Field(min_length=1)
    original_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    original_bytes: int = Field(gt=0, le=MAX_SOURCE_BYTES)
    duration_seconds: float = Field(gt=0, le=120)
    contains_speech: bool = False
    contains_music: bool = False
    contains_brands: bool = False
    contains_personal_data: bool = False

    @model_validator(mode="after")
    def safe_source(self) -> FreesoundSource:
        expected = f"https://freesound.org/s/{self.sound_id}"
        if not self.page_url.startswith(expected):
            raise ValueError(f"page_url must start with {expected}")
        if not self.license_url.startswith("https://creativecommons.org/"):
            raise ValueError("license_url must be an official Creative Commons URL")
        if any(
            [self.contains_speech, self.contains_music, self.contains_brands, self.contains_personal_data]
        ):
            raise ValueError("speech, music, brands, and personal data are not permitted")
        return self


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def probe_duration(path: Path) -> float:
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return float(result.stdout.strip())


def import_source(file: Path, metadata_file: Path, root: Path) -> FreesoundSource:
    if not file.is_file():
        raise ValueError(f"source file does not exist: {file}")
    size = file.stat().st_size
    if size > MAX_SOURCE_BYTES:
        raise ValueError("Freesound originals larger than 10 MB are not accepted")
    raw = json.loads(metadata_file.read_text())
    raw.update(
        {
            "original_filename": file.name,
            "original_sha256": sha256(file),
            "original_bytes": size,
            "duration_seconds": probe_duration(file),
        }
    )
    source = FreesoundSource.model_validate(raw)
    target = root / "sources" / source.original_sha256
    target.mkdir(parents=True, exist_ok=True)
    suffix = file.suffix.lower()
    shutil.copy2(file, target / f"original{suffix}")
    (target / "source.json").write_text(
        json.dumps(source.model_dump(mode="json"), ensure_ascii=False, indent=2, sort_keys=True)
    )
    return source


def load_source(root: Path, source_sha256: str) -> tuple[FreesoundSource, Path]:
    directory = root / "sources" / source_sha256
    metadata = directory / "source.json"
    if not metadata.exists():
        raise ValueError(f"context source {source_sha256} is not imported")
    source = FreesoundSource.model_validate_json(metadata.read_text())
    originals = sorted(directory.glob("original.*"))
    if len(originals) != 1 or sha256(originals[0]) != source.original_sha256:
        raise ValueError(f"context source {source_sha256} is missing or changed")
    return source, originals[0]


def list_sources(root: Path) -> list[FreesoundSource]:
    sources = []
    for metadata in sorted((root / "sources").glob("*/source.json")):
        sources.append(FreesoundSource.model_validate_json(metadata.read_text()))
    return sources
