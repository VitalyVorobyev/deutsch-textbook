"""Carrying a voice evaluation's designed references into production.

`atlas-listening voices adopt-designed <run>` is the one step between a blind listen and the
roster speaking in the voices it chose (ADR 0013). For every catalog character it

1. copies the run's accepted designed reference — the **raw model output** the clone candidates
   were conditioned on (`Reference.model_path`), not the 16 kHz copy Whisper checked — into the
   studio's app data under its digest, with a sidecar naming its description, seed, both model
   pins and the run (`generative.designed`);
2. writes the character's catalog profile as a designed one — `engine: qwen_tts_designed`, the
   digest as `voice`, the seed it had, no style — with a pace that brings the clone to the corpus
   rate, and bumps the character's version.

**The pace.** The run measured words per second of voiced audio for every take of the adopted
candidate. Those takes were already conformed at the character's pace of that day (`run.json`
`characters[].pace`), and `atempo` scales the rate linearly, so the pace that lands a character's
median on the target is `target × pace_then / measured`, rounded to two places and held inside the
catalog's bounds. The default target is the rate learners hear today: the median of the same run's
`preset-0.6b` takes, the production voice the designed ones replace, measured by the same rule
on the same lines (2.921 for `voices-2026-10-31`; `evaluate reveal` reads the same `run.json`).

**It changes nothing the second time.** A reference already stored with the same record is left
alone, and a character whose profile already says what the run says keeps its version.

The catalog is edited as text, one `version:` line and one `voice_profile:` line per character,
so the file keeps its order and layout; the result is validated as a whole before it is written.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import statistics
import tempfile
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import yaml

from .catalogs import (
    CATALOG_PACE_MAX,
    CATALOG_PACE_MIN,
    DESIGNED_ENGINE,
    CharacterCatalog,
    CharacterDefinition,
)
from .generative.designed import DesignedRecord, ModelPin, store_designed
from .generative.locks import model_lock
from .generative.qwen_designed import QwenDesignedClone

#: The candidate whose references and measurements are adopted: the one the owner chose.
ADOPTED_CANDIDATE = "design-clone-1.7b"

#: The lock row of the checkpoint that speaks a designed reference.
DESIGN_LOCK_KEY = "qwen_tts_voice_design"

#: The candidate whose measured rate is the default target: the production voice being replaced.
BASELINE_CANDIDATE = "preset-0.6b"


def baseline_words_per_second(run: dict[str, Any]) -> float:
    """The median words per second of the run's baseline takes — what learners hear today."""

    rates = [
        float(take["words_per_second"])
        for take in run.get("takes", [])
        if take.get("candidate") == BASELINE_CANDIDATE and take.get("words_per_second")
    ]
    if not rates:
        raise ValueError(f"run {run.get('run')} measured no {BASELINE_CANDIDATE} take to pace against")
    return float(statistics.median(rates))

CATALOG_FILE = Path("data") / "listening-characters.yaml"
PACKAGE_ROOT = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class AdoptedVoice:
    character: str
    version: int
    reference_sha256: str
    seed: int
    pace: float
    #: The median words per second the run measured, and the catalog pace it was measured at.
    measured_words_per_second: float
    measured_at_pace: float
    reference_written: bool
    catalog_changed: bool


def pace_for(measured: float, measured_at_pace: float, target: float) -> float:
    """The catalog pace that brings a measured rate to the target, inside the catalog's bounds."""

    if measured <= 0:
        raise ValueError("a words-per-second measurement must be positive")
    pace = round(target * measured_at_pace / measured, 2)
    return min(CATALOG_PACE_MAX, max(CATALOG_PACE_MIN, pace))


def _profile_line(voice: str, seed: int, pace: float) -> str:
    return (
        f"    voice_profile: {{engine: {DESIGNED_ENGINE}, voice: {voice}, seed: {seed}, "
        f"style: null, pace: {pace}}}"
    )


def _block_span(lines: list[str], character_id: str) -> tuple[int, int]:
    """The line range of one `  - id: <id>` entry of the catalog."""

    start = next(
        (index for index, line in enumerate(lines) if line.rstrip() == f"  - id: {character_id}"),
        None,
    )
    if start is None:
        raise ValueError(f"{CATALOG_FILE} has no entry `  - id: {character_id}`")
    end = next(
        (index for index in range(start + 1, len(lines)) if lines[index].startswith("  - id: ")),
        len(lines),
    )
    return start, end


def _replace_in_block(
    lines: list[str], span: tuple[int, int], pattern: str, replacement: str, what: str
) -> None:
    matches = [index for index in range(*span) if re.match(pattern, lines[index])]
    if len(matches) != 1:
        raise ValueError(f"expected one {what} line in {lines[span[0]].strip()}, found {len(matches)}")
    lines[matches[0]] = replacement


def _write_atomically(target: Path, text: str) -> None:
    handle, temporary = tempfile.mkstemp(prefix=f".{target.name}.", dir=target.parent)
    try:
        with os.fdopen(handle, "w") as out:
            out.write(text)
        os.replace(temporary, target)
    except BaseException:
        Path(temporary).unlink(missing_ok=True)
        raise


def _accepted_attempt(reference: dict[str, Any], character: str) -> dict[str, Any]:
    if not reference.get("accepted") or not reference.get("model_path"):
        raise ValueError(f"the run has no accepted designed reference for {character}")
    passed = [row for row in reference.get("attempts", []) if row.get("passed") is True]
    if not passed:
        raise ValueError(f"the run records no passing design attempt for {character}")
    # The runner stops at the first passing seed, so the accepted reference is the last attempt
    # that passed; its model_sha256 is the digest of `model_path`.
    accepted: dict[str, Any] = passed[-1]
    return accepted


def adopt_designed(
    run_dir: Path,
    store_root: Path,
    repo: Path,
    *,
    target: float | None = None,
    lock_path: Path | None = None,
) -> list[AdoptedVoice]:
    """Adopt one evaluation run's designed references for every catalog character."""

    repo = repo.resolve()
    store_root = store_root.resolve()
    if store_root == repo or repo in store_root.parents:
        raise ValueError(
            f"the studio's app data ({store_root}) is inside the repository; a designed "
            "reference is never written into the repository"
        )
    manifest_path = run_dir / "run.json"
    if not manifest_path.exists():
        raise ValueError(f"{run_dir} holds no evaluation run (no run.json)")
    run: dict[str, Any] = json.loads(manifest_path.read_text())
    if run.get("kind") != "voice-evaluation":
        raise ValueError(f"{manifest_path} is not a voice evaluation")
    if target is None:
        target = baseline_words_per_second(run)

    candidate = next(
        (row for row in run.get("candidates", []) if row.get("id") == ADOPTED_CANDIDATE), None
    )
    if candidate is None:
        raise ValueError(f"run {run.get('run')} did not evaluate {ADOPTED_CANDIDATE}")
    models: dict[str, Any] = run.get("models") or {}
    clone = models.get(str(candidate.get("lock_key")))
    if not clone or (clone.get("id"), clone.get("revision")) != (
        QwenDesignedClone.model_id,
        QwenDesignedClone.revision,
    ):
        raise ValueError(
            f"run {run.get('run')} cloned on {clone}, not on the production checkpoint "
            f"{QwenDesignedClone.model_id}@{QwenDesignedClone.revision}; its takes measured "
            "another model"
        )
    locked = model_lock(lock_path or PACKAGE_ROOT / "models.lock.json")["models"]
    design_lock = locked.get(DESIGN_LOCK_KEY) if isinstance(locked, dict) else None
    design = models.get(DESIGN_LOCK_KEY)
    if not design or not isinstance(design_lock, dict) or (
        design.get("id"),
        design.get("revision"),
    ) != (design_lock.get("id"), design_lock.get("revision")):
        raise ValueError(
            f"run {run.get('run')} designed its references on {design}, not on the pinned "
            f"{DESIGN_LOCK_KEY} row of models.lock.json"
        )

    designs: dict[str, Any] = run.get("designs") or {}
    reference_text = str(designs.get("reference_text") or "")
    references: dict[str, Any] = designs.get("references") or {}
    paces_then = {str(row["id"]): float(row["pace"]) for row in run.get("characters", [])}

    catalog_file = repo / CATALOG_FILE
    text = catalog_file.read_text()
    catalog = CharacterCatalog.model_validate(yaml.safe_load(text))
    lines = text.split("\n")

    adopted: list[AdoptedVoice] = []
    staged: list[tuple[bytes, str, DesignedRecord]] = []
    for character in catalog.characters:
        reference = references.get(character.id)
        if reference is None:
            raise ValueError(f"run {run.get('run')} has no designed reference for {character.id}")
        attempt = _accepted_attempt(reference, character.id)
        digest = str(attempt["model_sha256"])
        audio = (run_dir / str(reference["model_path"])).read_bytes()
        if hashlib.sha256(audio).hexdigest() != digest:
            # Checked for every character before anything is written, so a run whose files
            # changed after it was measured adopts nothing rather than half the roster.
            raise ValueError(
                f"{reference['model_path']} no longer hashes to the {digest[:12]} the run "
                "recorded for it"
            )
        record = DesignedRecord(
            character=character.id,
            instruct=str(reference["instruct"]),
            reference_text=reference_text,
            seed=int(attempt["seed"]),
            design_model=ModelPin(id=str(design["id"]), revision=str(design["revision"])),
            clone_model=ModelPin(id=str(clone["id"]), revision=str(clone["revision"])),
            source_run=str(run.get("run") or run_dir.name),
            transcript=str(attempt.get("transcript") or ""),
            wer=float(attempt.get("wer") or 0.0),
        )
        staged.append((audio, digest, record))

        rates = [
            float(take["words_per_second"])
            for take in run.get("takes", [])
            if take.get("candidate") == ADOPTED_CANDIDATE
            and take.get("character") == character.id
            and take.get("words_per_second")
        ]
        if not rates:
            raise ValueError(f"run {run.get('run')} measured no {ADOPTED_CANDIDATE} take of {character.id}")
        measured = float(statistics.median(rates))
        then = paces_then.get(character.id, character.voice_profile.pace)
        pace = pace_for(measured, then, target)
        changed = _adopt_into_catalog(lines, character, digest, pace)
        adopted.append(
            AdoptedVoice(
                character=character.id,
                version=character.version + (1 if changed else 0),
                reference_sha256=digest,
                seed=character.voice_profile.seed,
                pace=pace,
                measured_words_per_second=round(measured, 3),
                measured_at_pace=then,
                reference_written=False,
                catalog_changed=changed,
            )
        )

    edited = "\n".join(lines)
    # The whole edited catalog has to be a valid catalog before anything is written.
    CharacterCatalog.model_validate(yaml.safe_load(edited))
    written = [store_designed(store_root, audio, digest, record) for audio, digest, record in staged]
    if edited != text:
        _write_atomically(catalog_file, edited)
    return [
        AdoptedVoice(**(asdict(row) | {"reference_written": wrote}))
        for row, wrote in zip(adopted, written)
    ]


def _adopt_into_catalog(
    lines: list[str], character: CharacterDefinition, digest: str, pace: float
) -> bool:
    """Write one character's designed profile into the catalog text; return whether it changed."""

    profile = character.voice_profile
    if (profile.engine, profile.voice, profile.style, profile.pace) == (
        DESIGNED_ENGINE,
        digest,
        None,
        pace,
    ):
        return False
    span = _block_span(lines, character.id)
    _replace_in_block(
        lines,
        span,
        r"^    version: \d+\s*$",
        f"    version: {character.version + 1}",
        "version",
    )
    _replace_in_block(
        lines,
        span,
        r"^    voice_profile: \{.*\}\s*$",
        _profile_line(digest, profile.seed, pace),
        "voice_profile",
    )
    return True
