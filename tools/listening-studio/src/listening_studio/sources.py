"""The sound library: what this repository imported, and what it generated.

Two origins under one roof and **two schemas**, never one. A Freesound original is somebody
else's recording with a reviewed licence record, an uploader and a page URL; a generated sound is
a prompt, a seed and a model revision. Forcing either into the other's shape would put a value in
a field that means something else — a `sound_id` a generated file does not have, an `uploader`
that is a checkpoint — so the listing rows carry an `origin` and each keeps its own fields.
"""

from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
from datetime import date
from pathlib import Path
from typing import Any, Literal

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
    #: Which file from the sound page was imported. Downloading the uploader's own master needs a
    #: Freesound account, so a course-produced import is normally the site's public preview
    #: transcode. That is a different file from the one the uploader published, and the manifest
    #: has to say so: `original_sha256` pins what this repository committed — its integrity — and
    #: this field says what that file actually is. Defaulted for records written before it existed.
    source_file: Literal["original", "preview-hq", "preview-lq"] = "original"
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


class GeneratedSound(BaseModel):
    """One generated sound, as its asset-store provenance sidecar records it.

    Read, never written: the sidecar is written once by the render graph and is the only copy,
    exactly as `source.json` is the only copy of an import's licence record. Nothing here is
    editable — a prompt is not metadata about the bytes, it is what made them, and changing it
    would describe a file it no longer produced.
    """

    asset_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    engine: str
    model_id: str
    model_revision: str
    adapter_code_revision: str
    #: The model's licence, carried per asset. An import's licence is in its reviewed
    #: `source.json`; a generated file has no such record and would otherwise have none.
    license: str
    prompt: str
    negative_prompt: str | None = None
    seed: int
    duration_seconds: float
    #: The engine parameters as they were **resolved**, defaults included — what the model was
    #: given, not what the scene happened to state.
    params: dict[str, Any] = Field(default_factory=dict)


def _generated_sound(sha: str, sidecar: dict[str, Any]) -> GeneratedSound | None:
    """One sidecar as a library row, or None if it is not a complete generated-sound record.

    Tolerant on purpose. The asset store holds every intermediate a render produced — paced
    takes, positioned stems, impulse responses — and it is also where a fixture's hand-written
    provenance lands. A listing that raised on the first sidecar it did not recognise would take
    the whole library down over one file nobody meant to list.
    """

    request = sidecar.get("request")
    if sidecar.get("kind") != "generated-sound" or not isinstance(request, dict):
        return None
    try:
        return GeneratedSound.model_validate(
            {
                "asset_sha256": sha,
                "prompt": request.get("prompt"),
                "negative_prompt": request.get("negative_prompt"),
                "seed": request.get("seed"),
                "duration_seconds": request.get("duration_seconds"),
                "engine": sidecar.get("engine"),
                "model_id": sidecar.get("model_id"),
                "model_revision": sidecar.get("model_revision"),
                "adapter_code_revision": sidecar.get("adapter_code_revision"),
                "license": sidecar.get("license"),
                "params": sidecar.get("params") or {},
            }
        )
    except ValueError:
        return None


def list_generated_sounds(root: Path) -> list[GeneratedSound]:
    """Every generated sound in the asset store, newest last by digest for a stable order."""

    rows = []
    for sidecar in sorted((root / "assets").glob("*.json")):
        try:
            loaded = json.loads(sidecar.read_text())
        except (OSError, ValueError):
            continue
        if not isinstance(loaded, dict):
            continue
        row = _generated_sound(sidecar.stem, loaded)
        if row is not None:
            rows.append(row)
    return rows


def generated_sound_path(root: Path, asset_sha256: str) -> Path | None:
    """The audio for one generated sound, checked against the digest that names it.

    The same bar `load_source` holds an import to: a file whose bytes stopped matching its name
    is not the file the provenance describes, and serving it would make the sidecar a claim about
    something else.
    """

    for candidate in sorted((root / "assets").glob(f"{asset_sha256}.*")):
        if candidate.suffix == ".json":
            continue
        if sha256(candidate) == asset_sha256:
            return candidate
    return None
