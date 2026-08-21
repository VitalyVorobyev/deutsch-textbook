from __future__ import annotations

import hashlib
import json
import shutil
import tempfile
from datetime import UTC, datetime
from pathlib import Path

import yaml

from .adapters import wav_duration
from .export import encode_mp3, sha256
from .reading_audio import ReadingAudioArtifact, ReadingRevisionPayload


def reading_provenance(
    payload: ReadingRevisionPayload,
    wav: Path,
    qa: dict[str, object],
    approval: dict[str, object],
) -> dict[str, object]:
    approved_hash = approval.get("audio_sha256")
    actual_hash = sha256(wav)
    if approved_hash != actual_hash:
        raise ValueError("reading master has changed since human approval")
    return {
        "version": 1,
        "artifact_kind": "reading",
        "id": payload.reading_id,
        "created_at": approval.get("reviewed_at", datetime.now(UTC).isoformat()),
        "source_sha256": payload.source_sha256,
        "master_audio_sha256": actual_hash,
        "narration_profile": {
            "id": payload.narration_profile_id,
            "version": payload.narration_profile_version,
        },
        "narrator": {
            "id": payload.character_id,
            "version": payload.character_version,
            "voice": payload.voice,
            "seed": payload.seed,
            "style": payload.style,
            "pace": payload.pace,
        },
        "paragraphs": [
            {
                "index": paragraph.index,
                "text_sha256": hashlib.sha256(paragraph.display_text.encode()).hexdigest(),
                "cue": payload.cues[index].model_dump(mode="json"),
            }
            for index, paragraph in enumerate(payload.paragraphs)
        ],
        "qa": qa,
        "approval": approval,
    }


def publish_reading(
    repo: Path,
    local_root: Path,
    payload: ReadingRevisionPayload,
    wav: Path,
    qa: dict[str, object],
    approval: dict[str, object],
) -> tuple[Path, Path, Path]:
    """Stage and atomically replace one exact, approved reading narration."""

    if not payload.cues:
        raise ValueError("reading has no paragraph cues")
    if qa.get("passed") is not True:
        raise ValueError("reading QA has not passed")
    provenance = reading_provenance(payload, wav, qa, approval)
    level = payload.level.lower()
    slug = Path(payload.reading_id).name
    audio_target = repo / "content" / "reading-audio" / level / f"{slug}.mp3"
    record_target = repo / "content" / "reading-audio" / level / f"{slug}.yaml"
    provenance_target = repo / "data" / "audio-provenance" / "readings" / level / f"{slug}.json"

    with tempfile.TemporaryDirectory(prefix="atlas-reading-publish-") as temp:
        stage = Path(temp)
        staged_audio = encode_mp3(wav, stage / audio_target.name)
        provenance["published_audio_sha256"] = sha256(staged_audio)
        duration = wav_duration(wav)
        if duration is None:
            raise ValueError("cannot measure reading master")
        artifact = ReadingAudioArtifact(
            id=slug,
            reading_id=payload.reading_id,
            level=payload.level,
            style_id=payload.narration_profile_id,
            style_version=payload.narration_profile_version,
            narrator_id=payload.character_id,
            narrator_version=payload.character_version,
            duration_seconds=duration,
            paragraphs=payload.cues,
            provenance=str(provenance_target.relative_to(repo)),
        )
        staged_record = stage / record_target.name
        staged_record.write_text(
            yaml.safe_dump(
                artifact.model_dump(mode="json"), allow_unicode=True, sort_keys=False
            )
        )
        staged_provenance = stage / provenance_target.name
        staged_provenance.write_text(
            json.dumps(provenance, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
        )

        backups = local_root / "published-readings" / datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
        targets = (audio_target, record_target, provenance_target)
        existing = [path for path in targets if path.exists()]
        if existing and len(existing) != len(targets):
            raise ValueError("refusing a partial existing reading publication")
        if existing:
            existing_record = yaml.safe_load(record_target.read_text())
            if (
                existing_record.get("id") != slug
                or existing_record.get("reading_id") != payload.reading_id
            ):
                raise ValueError("existing reading target belongs to a different source identity")
            existing_provenance = json.loads(provenance_target.read_text())
            if (
                existing_provenance.get("id") != payload.reading_id
                or existing_provenance.get("published_audio_sha256") != sha256(audio_target)
            ):
                raise ValueError("existing reading target no longer matches its recorded hash")
            backups.mkdir(parents=True, exist_ok=False)
            for path in existing:
                relative = path.relative_to(repo)
                target = backups / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(path, target)

        for target, source in (
            (audio_target, staged_audio),
            (record_target, staged_record),
            (provenance_target, staged_provenance),
        ):
            target.parent.mkdir(parents=True, exist_ok=True)
            source.replace(target)
    return audio_target, record_target, provenance_target
