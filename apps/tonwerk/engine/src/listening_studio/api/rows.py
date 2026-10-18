"""The derived project tables the dashboard and the projects list both read.

Moved verbatim out of `studio_api.py` when that module was split into `api/`. They live in a
module of their own rather than in either router because both routers need them and neither owns
them: `/api/dashboard` publishes them with issues and a summary, `/api/projects` publishes them
flat. Every figure here is **derived on read**, never stored — a status column kept in step with
the filesystem by hand drifts the first time anything is regenerated outside the UI.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
import soundfile as sf
import yaml

from ..adapters import wav_duration
from ..reading_audio import default_profile_id, load_reading_sources
from ..storage import Store


def dialogue_rows(store: Store, repo: Path) -> list[dict[str, Any]]:
    plan = yaml.safe_load((repo / "data" / "listening-plan.yaml").read_text())
    projects = {project.slug: project for project in store.projects()}
    rows: list[dict[str, Any]] = []
    for unit in plan["units"]:
        for artifact in unit["artifacts"]:
            project = projects.get(artifact["id"])
            row: dict[str, Any] = {
                "kind": "dialogue",
                "id": artifact["id"],
                "level": unit["level"],
                "wave": artifact["wave"],
                "scenario": artifact["scenario"],
                "state": "planned",
                "project_id": None,
                "speaker_count": int(artifact.get("speakers", {}).get("min", 0)),
                "line_count": 0,
                "duration_seconds": None,
                "target_min": artifact["duration_seconds"]["min"],
                "target_max": artifact["duration_seconds"]["max"],
                "within_similarity_min": None,
                "cross_similarity_max": None,
                "worst_line_id": None,
                "ambience_rms_dbfs": None,
                "bed_count": 0,
                "event_count": 0,
                "approved": False,
                "published": (
                    repo
                    / "content"
                    / "listening"
                    / unit["level"].lower()
                    / f"{artifact['id']}.mp3"
                ).exists(),
            }
            if project:
                _, revision, payload = store.get(project.id)
                row.update(
                    project_id=project.id,
                    state=project.stage,
                    speaker_count=len(payload.speakers),
                    line_count=len(payload.lines),
                    bed_count=sum(sound.role == "bed" for sound in payload.context_sounds),
                    event_count=sum(sound.role == "event" for sound in payload.context_sounds),
                    duration_seconds=wav_duration(
                        store.root / "projects" / str(project.id) / "final.wav"
                    ),
                    approved=revision.approval_json is not None,
                )
                if revision.qa_json:
                    qa = json.loads(revision.qa_json)
                    speaker = qa.get("speaker_consistency", {})
                    characters = speaker.get("characters", []) if isinstance(speaker, dict) else []
                    pairs = (
                        speaker.get("different_characters", [])
                        if isinstance(speaker, dict)
                        else []
                    )
                    within = [
                        float(value)
                        for item in characters
                        if isinstance(item, dict)
                        and (value := item.get("minimum_similarity")) is not None
                    ]
                    cross = [
                        float(value)
                        for item in pairs
                        if isinstance(item, dict) and (value := item.get("similarity")) is not None
                    ]
                    row["within_similarity_min"] = min(within) if within else None
                    row["cross_similarity_max"] = max(cross) if cross else None
                    line_scores = (
                        [
                            item
                            for item in speaker.get("lines", [])
                            if isinstance(item, dict)
                            and item.get("similarity_to_character") is not None
                        ]
                        if isinstance(speaker, dict)
                        else []
                    )
                    if line_scores:
                        row["worst_line_id"] = min(
                            line_scores, key=lambda item: item["similarity_to_character"]
                        )["line_id"]
                    soundscape = qa.get("soundscape", {})
                    if isinstance(soundscape, dict):
                        row["ambience_rms_dbfs"] = soundscape.get("measured_ambience_rms_dbfs")
                    row["wer"] = qa.get("final", {}).get("full_wer")
            rows.append(row)
    return rows


def reading_rows(store: Store, repo: Path) -> list[dict[str, Any]]:
    existing = {project.reading_id: project for project in store.reading_projects()}
    rows: list[dict[str, Any]] = []
    for source in load_reading_sources(repo):
        project = existing.get(source.id)
        row: dict[str, Any] = {
            "kind": "reading",
            "id": source.id,
            "level": source.level,
            "title": source.title_de,
            "reading_kind": source.kind,
            "word_count": source.word_count,
            "paragraph_count": len(source.paragraphs),
            "source_sha256": source.source_sha256,
            "project_id": None,
            "state": "planned",
            "profile_id": default_profile_id(source),
            "duration_seconds": None,
            "voiced_pace": None,
            "wer": None,
            "cue_coverage": 0,
            "stale": False,
            "approved": False,
            "published": (
                repo
                / "content"
                / "reading-audio"
                / source.level.lower()
                / f"{Path(source.id).name}.mp3"
            ).exists(),
            "worst_paragraph_index": None,
        }
        if project:
            _, revision, payload = store.get_reading(project.id)
            work = store.root / "readings" / str(project.id)
            row.update(
                project_id=project.id,
                state=project.stage,
                profile_id=payload.narration_profile_id,
                stale=payload.source_sha256 != source.source_sha256,
                cue_coverage=len(payload.cues) / len(payload.paragraphs),
                duration_seconds=wav_duration(work / "final.wav"),
                approved=revision.approval_json is not None,
            )
            if revision.qa_json:
                qa = json.loads(revision.qa_json)
                row["wer"] = qa.get("full_wer")
                row["voiced_pace"] = qa.get("voiced_words_per_second")
                paragraph_rows = qa.get("paragraphs", [])
                if paragraph_rows:
                    row["worst_paragraph_index"] = max(
                        paragraph_rows, key=lambda item: item.get("wer", 0)
                    ).get("index")
        rows.append(row)
    return rows


def issues(dialogues: list[dict[str, Any]], readings: list[dict[str, Any]]) -> list[dict[str, Any]]:
    found: list[dict[str, Any]] = []
    # Until a fully re-reviewed corpus provides calibrated warning bounds, similarity is a
    # ranking aid rather than a pass/fail fact. Surface the weakest tails without baking the
    # WavLM example threshold into Deutsch-Atlas policy.
    identity_rank = sorted(
        (row for row in dialogues if row["within_similarity_min"] is not None),
        key=lambda row: row["within_similarity_min"],
    )[:5]
    separation_rank = sorted(
        (row for row in dialogues if row["cross_similarity_max"] is not None),
        key=lambda row: row["cross_similarity_max"],
        reverse=True,
    )[:5]
    for row in identity_rank:
        found.append({"severity": "warning", "code": "identity-review-rank", "artifact": row["id"], "kind": "dialogue", "value": row["within_similarity_min"], "project_id": row["project_id"]})
    for row in separation_rank:
        found.append({"severity": "warning", "code": "separation-review-rank", "artifact": row["id"], "kind": "dialogue", "value": row["cross_similarity_max"], "project_id": row["project_id"]})
    for row in dialogues:
        duration = row.get("duration_seconds")
        if duration is not None and not (row["target_min"] <= duration <= row["target_max"]):
            found.append({"severity": "info", "code": "duration", "artifact": row["id"], "kind": "dialogue", "value": duration, "project_id": row["project_id"]})
        if not row["approved"]:
            found.append({"severity": "pending", "code": "approval", "artifact": row["id"], "kind": "dialogue", "value": None, "project_id": row["project_id"]})
    for row in readings:
        if row["stale"]:
            found.append({"severity": "warning", "code": "source-drift", "artifact": row["id"], "kind": "reading", "value": None, "project_id": row["project_id"]})
        if not row["approved"]:
            found.append({"severity": "pending", "code": "narration", "artifact": row["id"], "kind": "reading", "value": None, "project_id": row["project_id"]})
    order = {"warning": 0, "pending": 1, "info": 2}
    return sorted(found, key=lambda row: (order[row["severity"]], row["artifact"]))


@lru_cache(maxsize=256)
def peaks(path: Path, bins: int = 96) -> list[float]:
    audio, _ = sf.read(path, dtype="float32", always_2d=True)
    mono = np.max(np.abs(audio), axis=1)
    if len(mono) == 0:
        return []
    chunks = np.array_split(mono, min(bins, len(mono)))
    maximum = max(float(np.max(chunk)) for chunk in chunks) or 1.0
    return [round(float(np.max(chunk)) / maximum, 4) for chunk in chunks]
