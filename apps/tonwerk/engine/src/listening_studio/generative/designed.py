"""Designed synthetic voices: the reference clips the roster is cloned from, and their records.

A designed reference is a clip the VoiceDesign checkpoint spoke from a written description of a
fictional person. It is nobody's voice, so it needs no consent record — and it is still kept in the
studio's app data and never in the repository, because the clip is a model output the course does
not ship (`docs/authoring/product-protection.md`).

Layout, under the app-data root: `voices/designed/<sha256>.wav` beside `<sha256>.json`. The digest
is the identity: the character catalog pins it, a cast member names it in `VoiceSpec.voice`, and so
a synth node's hash covers the reference bytes. The sidecar is the provenance a published manifest
copies — the description, the design seed, both model pins and the run the clip was chosen in.

**Nothing here loads a model and nothing here is read by an engine directly.** The caller resolves
the digests a cast names (`resolve_designed`) and hands the result to the engine, the same
separation `generative.voices` keeps for consented clones.
"""

from __future__ import annotations

import hashlib
import json
import os
import tempfile
from pathlib import Path
from typing import Iterable, Literal

from pydantic import BaseModel, ConfigDict, Field

from .gateway import DesignedVoice

#: A designed reference's identity: a lowercase SHA-256.
SHA256 = r"^[0-9a-f]{64}$"


class ModelPin(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1)
    revision: str = Field(min_length=1)


class DesignedRecord(BaseModel):
    """The sidecar beside a designed reference clip. Every field is published with the voice."""

    model_config = ConfigDict(extra="forbid")

    character: str = Field(pattern=r"^[a-z0-9-]+$")
    #: The written description the VoiceDesign checkpoint spoke from.
    instruct: str = Field(min_length=1)
    #: What the clip says, and so what the clone is conditioned on.
    reference_text: str = Field(min_length=1)
    #: The seed the design ran at.
    seed: int = Field(ge=0)
    design_model: ModelPin
    clone_model: ModelPin
    #: The evaluation run the clip was accepted in.
    source_run: str = Field(min_length=1)
    #: Whisper's transcript of the clip and its word error rate against `reference_text`.
    transcript: str
    wer: float = Field(ge=0)
    synthetic: Literal[True] = True

    def canonical_json(self) -> str:
        return json.dumps(
            self.model_dump(mode="json"), ensure_ascii=False, sort_keys=True, indent=2
        ) + "\n"


def designed_root(root: Path) -> Path:
    return root / "voices" / "designed"


def designed_path(root: Path, reference_sha256: str) -> Path:
    return designed_root(root) / f"{reference_sha256}.wav"


def record_path(root: Path, reference_sha256: str) -> Path:
    return designed_root(root) / f"{reference_sha256}.json"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _atomic_write(target: Path, body: bytes) -> None:
    """Write beside the target, then rename: a reader never sees half a clip or half a record."""

    target.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary = tempfile.mkstemp(prefix=f".{target.name}.", dir=target.parent)
    try:
        with os.fdopen(handle, "wb") as out:
            out.write(body)
        os.replace(temporary, target)
    except BaseException:
        Path(temporary).unlink(missing_ok=True)
        raise


def store_designed(
    root: Path, audio: bytes, reference_sha256: str, record: DesignedRecord
) -> bool:
    """Write one designed reference and its sidecar; return whether anything was written.

    Refused, before a byte is written, when the audio does not hash to the digest it is being
    stored under, or when a different record is already stored for these bytes: a sidecar that
    changed under a published digest would rewrite the provenance of audio already shipped. The
    same clip and the same record a second time change nothing.
    """

    digest = hashlib.sha256(audio).hexdigest()
    if digest != reference_sha256:
        raise ValueError(
            f"the designed reference for {record.character} hashes to {digest}, not the "
            f"{reference_sha256} it was recorded under"
        )
    clip = designed_path(root, digest)
    sidecar = record_path(root, digest)
    body = record.canonical_json().encode()
    if sidecar.exists():
        stored = DesignedRecord.model_validate_json(sidecar.read_text())
        if stored != record:
            raise ValueError(
                f"designed reference {digest[:12]} is already stored with a different record "
                f"(character {stored.character}, run {stored.source_run}); a stored record is "
                "never rewritten"
            )
    wrote = False
    if not clip.exists() or sha256_file(clip) != digest:
        _atomic_write(clip, audio)
        wrote = True
    if not sidecar.exists() or sidecar.read_bytes() != body:
        _atomic_write(sidecar, body)
        wrote = True
    return wrote


def load_designed(root: Path, reference_sha256: str) -> DesignedVoice:
    """One stored designed voice, its bytes verified against its digest.

    Refused by name when the digest is malformed, when the clip or its record is not on this
    machine (references never travel with a checkout), or when the clip no longer hashes to its
    name. A refusal here is what stops a cast from being spoken in some other voice.
    """

    if not isinstance(reference_sha256, str) or len(reference_sha256) != 64 or any(
        char not in "0123456789abcdef" for char in reference_sha256
    ):
        raise ValueError(
            f"{reference_sha256!r} is not a designed reference digest; a designed voice is "
            "named by the SHA-256 of its reference clip"
        )
    clip = designed_path(root, reference_sha256)
    sidecar = record_path(root, reference_sha256)
    if not clip.exists() or not sidecar.exists():
        raise ValueError(
            f"designed reference {reference_sha256[:12]} is not in this studio's app data "
            f"({designed_root(root)}); references never travel with a checkout — run "
            "`atlas-listening voices adopt-designed <run>` on this machine"
        )
    actual = sha256_file(clip)
    if actual != reference_sha256:
        raise ValueError(
            f"designed reference {reference_sha256[:12]} now hashes to {actual[:12]}; the clip "
            "changed after it was stored and is not spoken through"
        )
    record = DesignedRecord.model_validate_json(sidecar.read_text())
    return DesignedVoice(
        reference_sha256=reference_sha256,
        reference_path=clip,
        reference_text=record.reference_text,
        record=record.model_dump(mode="json"),
    )


def resolve_designed(root: Path, digests: Iterable[str]) -> dict[str, DesignedVoice]:
    """Every designed reference a cast names, verified, keyed by digest."""

    return {digest: load_designed(root, digest) for digest in dict.fromkeys(digests)}


def stored_designed(root: Path) -> dict[str, DesignedVoice]:
    """Every designed reference in app data, verified. For a run that renders many scenes."""

    directory = designed_root(root)
    if not directory.is_dir():
        return {}
    return resolve_designed(root, sorted(path.stem for path in directory.glob("*.json")))
