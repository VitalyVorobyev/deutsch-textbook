from __future__ import annotations

import json
import hashlib
from io import BytesIO
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
import soundfile as sf
import yaml
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, Response
from PIL import Image
from pydantic import BaseModel, Field

from .adapters import wav_duration
from .domain import CastAssignment, ContextSound, RevisionPayload, VoiceProfile
from .catalogs import (
    SourceEditorial,
    load_character_catalog,
    load_narration_catalog,
    load_source_editorial,
    save_source_editorial,
    suggested_source_editorial,
)
from .reading_audio import (
    ReadingParagraph,
    ReadingRevisionPayload,
    default_profile_id,
    load_reading_sources,
)
from .sources import generated_sound_path, list_generated_sounds, list_sources, load_source
from .storage import Store


class PortraitSelectionRequest(BaseModel):
    candidate_id: str = Field(pattern=r"^[A-Z]$")
    editor: str = Field(min_length=1)
    reason: str = Field(min_length=8)


def _portrait_crop(source: Path, index: int) -> bytes:
    with Image.open(source) as sheet:
        cell_width = sheet.width // 4
        cell_height = sheet.height // 3
        column, row = index % 4, index // 4
        crop = sheet.crop(
            (
                column * cell_width,
                row * cell_height,
                (column + 1) * cell_width,
                (row + 1) * cell_height,
            )
        )
        output = BytesIO()
        crop.save(output, format="PNG")
    return output.getvalue()


def _dialogue_rows(store: Store, repo: Path) -> list[dict[str, Any]]:
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
                    pairs = speaker.get("different_characters", []) if isinstance(speaker, dict) else []
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
                    line_scores = [
                        item for item in speaker.get("lines", [])
                        if isinstance(item, dict) and item.get("similarity_to_character") is not None
                    ] if isinstance(speaker, dict) else []
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


def _reading_rows(store: Store, repo: Path) -> list[dict[str, Any]]:
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
                repo / "content" / "reading-audio" / source.level.lower() / f"{Path(source.id).name}.mp3"
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


def _issues(dialogues: list[dict[str, Any]], readings: list[dict[str, Any]]) -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = []
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
        issues.append({"severity": "warning", "code": "identity-review-rank", "artifact": row["id"], "kind": "dialogue", "value": row["within_similarity_min"], "project_id": row["project_id"]})
    for row in separation_rank:
        issues.append({"severity": "warning", "code": "separation-review-rank", "artifact": row["id"], "kind": "dialogue", "value": row["cross_similarity_max"], "project_id": row["project_id"]})
    for row in dialogues:
        duration = row.get("duration_seconds")
        if duration is not None and not (row["target_min"] <= duration <= row["target_max"]):
            issues.append({"severity": "info", "code": "duration", "artifact": row["id"], "kind": "dialogue", "value": duration, "project_id": row["project_id"]})
        if not row["approved"]:
            issues.append({"severity": "pending", "code": "approval", "artifact": row["id"], "kind": "dialogue", "value": None, "project_id": row["project_id"]})
    for row in readings:
        if row["stale"]:
            issues.append({"severity": "warning", "code": "source-drift", "artifact": row["id"], "kind": "reading", "value": None, "project_id": row["project_id"]})
        if not row["approved"]:
            issues.append({"severity": "pending", "code": "narration", "artifact": row["id"], "kind": "reading", "value": None, "project_id": row["project_id"]})
    order = {"warning": 0, "pending": 1, "info": 2}
    return sorted(issues, key=lambda row: (order[row["severity"]], row["artifact"]))


@lru_cache(maxsize=256)
def _peaks(path: Path, bins: int = 96) -> list[float]:
    audio, _ = sf.read(path, dtype="float32", always_2d=True)
    mono = np.max(np.abs(audio), axis=1)
    if len(mono) == 0:
        return []
    chunks = np.array_split(mono, min(bins, len(mono)))
    maximum = max(float(np.max(chunk)) for chunk in chunks) or 1.0
    return [round(float(np.max(chunk)) / maximum, 4) for chunk in chunks]


def router(store: Store, repo: Path) -> APIRouter:
    api = APIRouter(prefix="/api")

    @api.get("/dashboard")
    def dashboard() -> dict[str, Any]:
        dialogues = _dialogue_rows(store, repo)
        readings = _reading_rows(store, repo)
        return {
            "dialogues": dialogues,
            "readings": readings,
            "issues": _issues(dialogues, readings),
            "summary": {
                "dialogues": len(dialogues),
                "dialogues_approved": sum(row["approved"] for row in dialogues),
                "readings": len(readings),
                "readings_approved": sum(row["approved"] for row in readings),
                "paragraphs": sum(row["paragraph_count"] for row in readings),
                "characters": len(load_character_catalog(repo).characters),
                "sounds": len(list_sources(store.root)),
            },
        }

    @api.get("/projects")
    def projects() -> list[dict[str, Any]]:
        return _dialogue_rows(store, repo) + _reading_rows(store, repo)

    @api.get("/projects/{project_id}")
    def project(project_id: int, kind: str = "dialogue") -> dict[str, Any]:
        try:
            if kind == "reading":
                state = store.reading_state(project_id)
                previews = store.root / "readings" / str(project_id) / "previews"
                return state.model_dump(mode="json") | {
                    "kind": "reading",
                    "history": store.reading_history(project_id),
                    "narration_profiles": [
                        profile.model_dump(mode="json")
                        for profile in load_narration_catalog(repo).profiles
                    ],
                    "preview_urls": {
                        profile.id: f"/api/readings/{project_id}/previews/{profile.id}/audio"
                        for profile in load_narration_catalog(repo).profiles
                        if (previews / f"{profile.id}.wav").exists()
                    },
                }
            current, revision, payload = store.get(project_id)
        except KeyError:
            raise HTTPException(404) from None
        return {
            "kind": "dialogue",
            "id": current.id,
            "slug": current.slug,
            "stage": current.stage,
            "revision": revision.number,
            "payload": payload.model_dump(mode="json"),
            "qa": json.loads(revision.qa_json) if revision.qa_json else None,
            "approval": json.loads(revision.approval_json) if revision.approval_json else None,
            "history": store.revision_history(project_id),
        }

    @api.get("/characters")
    def characters() -> dict[str, Any]:
        catalog = load_character_catalog(repo)
        usage: dict[str, int] = {row.id: 0 for row in catalog.characters}
        for project in store.projects():
            _, _, payload = store.get(project.id)
            for cast in getattr(payload, "cast", []) or []:
                character_id = getattr(cast, "character_id", None)
                if character_id in usage:
                    usage[character_id] += 1
        candidate_manifest = store.root / "characters" / "portrait-candidates.json"
        candidate_ids = [
            str(item["id"])
            for item in json.loads(candidate_manifest.read_text()).get("candidates", [])
        ] if candidate_manifest.exists() else []
        return {"version": catalog.version, "characters": [row.model_dump(mode="json") | {"usage_count": usage[row.id], "demo_urls": [f"/api/characters/{row.id}/demos/{index}" for index in range(3) if (store.root / "characters" / row.id / f"demo-{index + 1}.wav").exists()], "portrait_candidate_urls": [f"/api/characters/{row.id}/portrait-candidates/{candidate_id}" for candidate_id in candidate_ids], "selected_portrait_url": f"/api/characters/{row.id}/portrait" if (store.root / "characters" / row.id / "portrait.png").exists() else None} for row in catalog.characters]}

    @api.get("/characters/{character_id}/portrait")
    def selected_character_portrait(character_id: str) -> FileResponse:
        target = store.root / "characters" / character_id / "portrait.png"
        if not target.exists():
            raise HTTPException(404, "no portrait has been selected")
        return FileResponse(target, media_type="image/png")

    @api.get("/characters/{character_id}/portrait-candidates/{candidate_id}")
    def character_portrait_candidate(character_id: str, candidate_id: str) -> Response:
        catalog = load_character_catalog(repo)
        ids = [row.id for row in catalog.characters]
        if character_id not in ids:
            raise HTTPException(404, "character does not exist")
        manifest_path = store.root / "characters" / "portrait-candidates.json"
        if not manifest_path.exists():
            raise HTTPException(404, "portrait candidates have not been generated")
        manifest = json.loads(manifest_path.read_text())
        candidate = next(
            (row for row in manifest.get("candidates", []) if row.get("id") == candidate_id),
            None,
        )
        if candidate is None:
            raise HTTPException(404, "portrait candidate does not exist")
        source = Path(str(candidate["path"]))
        if not source.exists():
            raise HTTPException(404, "portrait candidate file is missing")
        return Response(_portrait_crop(source, ids.index(character_id)), media_type="image/png")

    @api.put("/characters/{character_id}/portrait-selection")
    def select_character_portrait(
        character_id: str, selection: PortraitSelectionRequest
    ) -> dict[str, Any]:
        catalog = load_character_catalog(repo)
        ids = [row.id for row in catalog.characters]
        if character_id not in ids:
            raise HTTPException(404, "character does not exist")
        manifest_path = store.root / "characters" / "portrait-candidates.json"
        if not manifest_path.exists():
            raise HTTPException(409, "portrait candidates have not been generated")
        manifest = json.loads(manifest_path.read_text())
        candidate = next(
            (row for row in manifest.get("candidates", []) if row.get("id") == selection.candidate_id),
            None,
        )
        if candidate is None:
            raise HTTPException(409, "unknown portrait candidate")
        source = Path(str(candidate["path"]))
        if not source.exists():
            raise HTTPException(409, "portrait candidate file is missing")
        if hashlib.sha256(source.read_bytes()).hexdigest() != candidate["sha256"]:
            raise HTTPException(409, "portrait candidate bytes changed after generation")
        crop = _portrait_crop(source, ids.index(character_id))
        target = store.root / "characters" / character_id
        target.mkdir(parents=True, exist_ok=True)
        (target / "portrait.png").write_bytes(crop)
        record = {
            "character_id": character_id,
            "character_version": next(row.version for row in catalog.characters if row.id == character_id),
            "candidate_id": selection.candidate_id,
            "candidate_count": len(manifest.get("candidates", [])),
            "selection_reason": selection.reason,
            "selected_by": selection.editor,
            "source_sha256": candidate["sha256"],
            "portrait_sha256": hashlib.sha256(crop).hexdigest(),
            "prompt_source": manifest["prompt_source"],
            "status": "selected-pending-catalog-publication",
        }
        (target / "portrait-selection.json").write_text(
            json.dumps(record, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
        )
        return record

    @api.get("/characters/{character_id}/demos/{demo_index}")
    def character_demo(character_id: str, demo_index: int) -> FileResponse:
        if demo_index not in range(3):
            raise HTTPException(404, "demo does not exist")
        catalog = load_character_catalog(repo)
        if character_id not in {row.id for row in catalog.characters}:
            raise HTTPException(404, "character does not exist")
        target = store.root / "characters" / character_id / f"demo-{demo_index + 1}.wav"
        if not target.exists():
            raise HTTPException(404, "demo has not been generated")
        return FileResponse(target, media_type="audio/wav")

    @api.put("/projects/{project_id}/cast")
    def update_cast(
        project_id: int, assignments: list[CastAssignment], revision_number: int
    ) -> dict[str, Any]:
        try:
            _, current_revision, payload = store.get(project_id)
        except KeyError:
            raise HTTPException(404) from None
        if current_revision.number != revision_number:
            raise HTTPException(409, "project revision changed; reload before editing cast")
        if [row.speaker for row in assignments] != payload.speakers:
            raise HTTPException(409, "cast must cover every speaker in order")
        catalog = load_character_catalog(repo)
        by_id = {row.id: row for row in catalog.characters}
        try:
            selected = [by_id[row.character_id] for row in assignments]
        except KeyError as error:
            raise HTTPException(409, f"unknown character {error.args[0]}") from error
        for assignment, character in zip(assignments, selected, strict=True):
            if assignment.character_version != character.version or character.status == "retired":
                raise HTTPException(409, f"character {character.id} version is unavailable")
        ids = {row.id for row in selected}
        for character in selected:
            if ids.intersection(character.incompatible_with):
                raise HTTPException(409, f"character {character.id} has an incompatible co-cast")
        profiles = [
            VoiceProfile(
                speaker=assignment.speaker,
                voice=character.voice_profile.voice,
                seed=character.voice_profile.seed,
                style=character.voice_profile.style,
            )
            for assignment, character in zip(assignments, selected, strict=True)
        ]
        updated = RevisionPayload.model_validate(
            payload.model_dump(mode="json")
            | {
                "cast": [row.model_dump(mode="json") for row in assignments],
                "voice_profiles": [row.model_dump(mode="json") for row in profiles],
            }
        )
        revision = store.revise(project_id, updated)
        return {"project_id": project_id, "revision": revision.number, "stage": "draft"}

    @api.put("/projects/{project_id}/soundscape")
    def update_soundscape(
        project_id: int, sounds: list[ContextSound], revision_number: int
    ) -> dict[str, Any]:
        try:
            _, current_revision, payload = store.get(project_id)
        except KeyError:
            raise HTTPException(404) from None
        if current_revision.number != revision_number:
            raise HTTPException(409, "project revision changed; reload before editing soundscape")
        for sound in sounds:
            try:
                source, _ = load_source(store.root, sound.source_sha256)
            except ValueError as error:
                raise HTTPException(409, str(error)) from error
            if source.sound_id != sound.sound_id:
                raise HTTPException(409, "sound id does not match the imported source hash")
            editorial_file = store.root / "sources" / sound.source_sha256 / "editorial.json"
            editorial = (
                load_source_editorial(store.root, sound.source_sha256)
                if editorial_file.exists()
                else suggested_source_editorial(source.title, source.description)
            )
            if sound.role not in editorial.allowed_roles:
                raise HTTPException(409, f"{sound.role} is not allowed for {source.title}")
        updated = RevisionPayload.model_validate(
            payload.model_dump(mode="json")
            | {"context_sounds": [row.model_dump(mode="json") for row in sounds]}
        )
        revision = store.revise(project_id, updated)
        return {"project_id": project_id, "revision": revision.number, "stage": "draft"}

    @api.get("/narration-profiles")
    def narration_profiles() -> dict[str, Any]:
        return load_narration_catalog(repo).model_dump(mode="json")

    @api.get("/readings")
    def readings() -> list[dict[str, Any]]:
        return _reading_rows(store, repo)

    @api.put("/readings/{project_id}/profile")
    def update_reading_profile(
        project_id: int, profile_id: str, revision_number: int
    ) -> dict[str, Any]:
        try:
            _, current_revision, payload = store.get_reading(project_id)
        except KeyError:
            raise HTTPException(404) from None
        if current_revision.number != revision_number:
            raise HTTPException(409, "reading revision changed; reload before selecting a profile")
        profile = next(
            (row for row in load_narration_catalog(repo).profiles if row.id == profile_id),
            None,
        )
        if profile is None or payload.kind not in profile.allowed_kinds:
            raise HTTPException(409, "profile is not valid for this reading kind")
        character = next(
            row
            for row in load_character_catalog(repo).characters
            if row.id == profile.character_id
        )
        updated = ReadingRevisionPayload.model_validate(
            payload.model_dump(mode="json")
            | {
                "narration_profile_id": profile.id,
                "narration_profile_version": profile.version,
                "character_id": character.id,
                "character_version": character.version,
                "voice": character.voice_profile.voice,
                "seed": character.voice_profile.seed,
                "style": f"{character.voice_profile.style} {profile.instruction}",
                "pace": profile.pace_by_level[payload.level],
                "paragraph_pause_ms": profile.paragraph_pause_ms,
                "cues": [],
            }
        )
        revision = store.revise_reading(project_id, updated)
        return {"project_id": project_id, "revision": revision.number, "stage": "draft"}

    @api.get("/readings/{project_id}/audio")
    def reading_audio(project_id: int) -> FileResponse:
        try:
            store.get_reading(project_id)
        except KeyError:
            raise HTTPException(404) from None
        target = store.root / "readings" / str(project_id) / "final.wav"
        if not target.exists():
            raise HTTPException(404, "reading audio has not been generated")
        return FileResponse(target, media_type="audio/wav")

    @api.post("/readings/{project_id}/previews")
    def generate_reading_previews(project_id: int, revision_number: int) -> dict[str, str]:
        try:
            _, current_revision, current = store.get_reading(project_id)
        except KeyError:
            raise HTTPException(404) from None
        if current_revision.number != revision_number:
            raise HTTPException(409, "reading revision changed; reload before generating previews")
        from .adapters import render_line
        from .generative.qwen import QwenSpeech
        from .reading_pipeline import paragraph_line

        profiles = load_narration_catalog(repo)
        characters = {row.id: row for row in load_character_catalog(repo).characters}
        source = next(row for row in load_reading_sources(repo) if row.id == current.reading_id)
        # The paragraph closest to median length is stable, substantial and not simply the lead.
        ordered = sorted(source.paragraphs, key=len)
        representative = source.paragraphs.index(ordered[len(ordered) // 2])
        engine = QwenSpeech()
        target = store.root / "readings" / str(project_id) / "previews"
        target.mkdir(parents=True, exist_ok=True)
        result: dict[str, str] = {}
        for profile in profiles.profiles:
            character = characters[profile.character_id]
            preview = ReadingRevisionPayload.model_validate(
                current.model_dump(mode="json")
                | {
                    "narration_profile_id": profile.id,
                    "narration_profile_version": profile.version,
                    "character_id": character.id,
                    "character_version": character.version,
                    "voice": character.voice_profile.voice,
                    "seed": character.voice_profile.seed,
                    "style": f"{character.voice_profile.style} {profile.instruction}",
                    "pace": profile.pace_by_level[source.level],
                    "paragraph_pause_ms": profile.paragraph_pause_ms,
                    "cues": [],
                }
            )
            path = target / f"{profile.id}.wav"
            render_line(engine, paragraph_line(preview, representative), path)
            result[profile.id] = f"/api/readings/{project_id}/previews/{profile.id}/audio"
        return result

    @api.get("/readings/{project_id}/previews/{profile_id}/audio")
    def reading_preview_audio(project_id: int, profile_id: str) -> FileResponse:
        target = store.root / "readings" / str(project_id) / "previews" / f"{profile_id}.wav"
        if not target.exists():
            raise HTTPException(404, "profile preview has not been generated")
        return FileResponse(target, media_type="audio/wav")

    @api.get("/readings/{project_id}/paragraphs/{paragraph_index}/audio")
    def reading_paragraph_audio(project_id: int, paragraph_index: int) -> FileResponse:
        try:
            _, _, payload = store.get_reading(project_id)
        except KeyError:
            raise HTTPException(404) from None
        if paragraph_index < 0 or paragraph_index >= len(payload.paragraphs):
            raise HTTPException(404, "paragraph does not exist")
        from .generative.qwen import QwenSpeech

        paragraph = payload.paragraphs[paragraph_index]
        target = store.root / "readings" / str(project_id) / "cache" / f"{payload.paragraph_cache_key(paragraph, QwenSpeech.revision)}.wav"
        if not target.exists():
            raise HTTPException(404, "paragraph audio has not been generated")
        return FileResponse(target, media_type="audio/wav")

    @api.post("/readings/{reading_id:path}/seed")
    def seed_reading(reading_id: str, profile_id: str | None = None) -> dict[str, Any]:
        source = next((row for row in load_reading_sources(repo) if row.id == reading_id), None)
        if source is None:
            raise HTTPException(404, "reading does not exist")
        if store.get_reading_by_source(reading_id):
            raise HTTPException(409, "reading project already exists")
        profiles = load_narration_catalog(repo)
        selected_id = profile_id or default_profile_id(source)
        profile = next((row for row in profiles.profiles if row.id == selected_id), None)
        if profile is None or source.kind not in profile.allowed_kinds:
            raise HTTPException(409, "narration profile is not valid for this reading")
        characters = load_character_catalog(repo)
        character = next(row for row in characters.characters if row.id == profile.character_id)
        payload = ReadingRevisionPayload(
            reading_id=source.id,
            level=source.level,
            title_de=source.title_de,
            kind=source.kind,
            source_sha256=source.source_sha256,
            narration_profile_id=profile.id,
            narration_profile_version=profile.version,
            character_id=character.id,
            character_version=character.version,
            voice=character.voice_profile.voice,
            seed=character.voice_profile.seed,
            style=f"{character.voice_profile.style} {profile.instruction}",
            pace=profile.pace_by_level[source.level],
            paragraph_pause_ms=profile.paragraph_pause_ms,
            paragraphs=[ReadingParagraph(index=index, display_text=text) for index, text in enumerate(source.paragraphs)],
        )
        project = store.create_reading(payload)
        return {"project_id": project.id, "reading_id": reading_id, "stage": project.stage}

    @api.get("/sounds")
    def sounds() -> list[dict[str, Any]]:
        """The whole sound library, imported and generated, each row saying which it is.

        `origin` is on every row and is what a caller filters on. The soundscape picker still
        wants Freesound rows only — a `ContextSound` names an imported `sound_id` and the
        soundscape endpoint refuses anything else — so the field is not decoration: it is how a
        second origin joins the list without the picker offering a sound it cannot place.
        """

        usage: dict[str, int] = {}
        for project in store.projects():
            _, _, payload = store.get(project.id)
            for sound in payload.context_sounds:
                usage[sound.source_sha256] = usage.get(sound.source_sha256, 0) + 1
        rows = []
        for source in list_sources(store.root):
            _, path = load_source(store.root, source.original_sha256)
            editorial_file = store.root / "sources" / source.original_sha256 / "editorial.json"
            editorial = (
                load_source_editorial(store.root, source.original_sha256)
                if editorial_file.exists()
                else suggested_source_editorial(source.title, source.description)
            )
            rows.append({"origin": "freesound"} | source.model_dump(mode="json") | {"editorial": editorial.model_dump(mode="json"), "usage_count": usage.get(source.original_sha256, 0), "peaks": _peaks(path)})
        for generated in list_generated_sounds(store.root):
            audio = generated_sound_path(store.root, generated.asset_sha256)
            if audio is None:
                # A sidecar whose audio is gone or no longer hashes to its name. Skipped rather
                # than listed with an empty waveform: the row would offer a play button for
                # bytes nobody can prove are the ones the provenance describes.
                continue
            rows.append(
                {"origin": "generated"}
                | generated.model_dump(mode="json")
                | {"peaks": _peaks(audio)}
            )
        return rows

    @api.put("/sounds/{source_hash}/editorial")
    def update_sound(source_hash: str, metadata: SourceEditorial) -> dict[str, Any]:
        try:
            load_source(store.root, source_hash)
        except ValueError as error:
            raise HTTPException(404, str(error)) from error
        save_source_editorial(store.root, source_hash, metadata)
        return metadata.model_dump(mode="json")

    @api.get("/sounds/{source_hash}/audio")
    def source_audio(source_hash: str) -> FileResponse:
        """Audition one library row, whichever origin it came from.

        The import is tried first because that is the older meaning of this path and the only
        one a stored `ContextSound` ever refers to; a generated asset is looked up by the same
        digest in the asset store. Both lookups verify the bytes against the hash before serving.
        """

        try:
            _, path = load_source(store.root, source_hash)
        except ValueError as error:
            generated = generated_sound_path(store.root, source_hash)
            if generated is None:
                raise HTTPException(404, str(error)) from error
            return FileResponse(generated)
        return FileResponse(path)

    @api.get("/projects/{project_id}/lines/{line_id}/audio")
    def line_audio(project_id: int, line_id: str) -> FileResponse:
        try:
            _, _, payload = store.get(project_id)
        except KeyError:
            raise HTTPException(404) from None
        line = next((row for row in payload.lines if row.id == line_id), None)
        if line is None:
            raise HTTPException(404, "line does not exist")
        cache = store.root / "projects" / str(project_id) / "cache"
        # Cache names are content hashes. Resolve the current line exactly when possible and
        # otherwise refuse rather than serve a different character's take.
        from .adapters import engine_revision

        revision = engine_revision(payload.tts_adapter)
        expected = cache / f"{payload.cache_key(line, revision)}.wav"
        if not expected.exists():
            raise HTTPException(404, "line audio has not been generated for this revision")
        return FileResponse(expected, media_type="audio/wav")

    return api
