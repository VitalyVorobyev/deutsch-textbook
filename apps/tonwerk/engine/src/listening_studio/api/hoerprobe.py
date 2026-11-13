"""`/api/hoerprobe` — the published dialogues, played in a row and judged by ear.

Whether two voices can be told apart, or a pause is too long, is a judgement no measurement here
makes: the speaker-similarity figure separates men from women and little else. So the owner
listens, and a verdict other than *gut* becomes an entry in the shared queue
(`data/redaktion-queue.yaml`, ADR 0014) on the recording's published record.

**One writer.** The queue is written by `@da/content/queue` and by nothing else, so this module
writes no YAML. It runs `apps/tonwerk/scripts/queue-bridge.ts` with Bun, one JSON request on stdin
and one JSON answer on stdout — the same module Redaktion and `bun run queue` call, so ids, order
and bytes come out the same whoever files.

**What is listed.** Every published recording under `content/listening/` whose record names two
speakers or more, with each role's voice as the provenance states it, and the queue entries
already filed on its record, so a pass can be resumed. *gut* writes nothing: the queue holds
findings, requests and questions, and an owner's acceptance of a file is Redaktion's Prüfen
action, never this view's.
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
from collections.abc import Callable
from pathlib import Path
from typing import Any

import yaml
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from ..storage import Store

#: The problem verdicts, in the order the view offers them. *gut* is not one: it files nothing.
VERDICTS = ("Tempo", "Pausen", "Stimme", "Aussprache", "Text")
#: How a Hörprobe entry's text begins, so the view can read its verdicts back out of the queue.
PREFIX = "Hörprobe: "

LEVEL = re.compile(r"^[a-c][12]$")
SLUG = re.compile(r"^[a-z0-9][a-z0-9-]*$")
DESIGNED_ENGINES = {"qwen_tts_designed"}

#: One request to the queue, one answer: `{"action": "list"}` or `{"action": "file", …}`.
QueueBridge = Callable[[dict[str, Any]], dict[str, Any]]

BRIDGE_SCRIPT = Path(__file__).resolve().parents[4] / "scripts" / "queue-bridge.ts"


class QueueUnavailable(RuntimeError):
    """The bridge could not be run, or answered with something that is not its JSON."""


def bun_bridge(repo: Path) -> QueueBridge:
    """The queue under `repo`, through `queue-bridge.ts`.

    A Finder-launched desktop app hands the engine a bare PATH, and Bun's own installer puts it in
    `~/.bun/bin`, so that is where it is looked for when the PATH has none.
    """

    def call(request: dict[str, Any]) -> dict[str, Any]:
        bun = shutil.which("bun") or str(Path.home() / ".bun" / "bin" / "bun")
        try:
            run = subprocess.run(
                [bun, str(BRIDGE_SCRIPT), str(repo)],
                input=json.dumps(request),
                capture_output=True,
                text=True,
                timeout=120,
                check=False,
            )
        except (OSError, subprocess.TimeoutExpired) as error:
            raise QueueUnavailable(f"Die Warteschlange ist nicht erreichbar: {error}") from error
        if run.returncode != 0:
            last = (run.stderr.strip().splitlines() or ["ohne Meldung"])[-1]
            raise QueueUnavailable(f"queue-bridge.ts endete mit {run.returncode}: {last}")
        try:
            answer = json.loads(run.stdout)
        except ValueError as error:
            raise QueueUnavailable("queue-bridge.ts antwortete kein JSON") from error
        if not isinstance(answer, dict):
            raise QueueUnavailable("queue-bridge.ts antwortete kein Objekt")
        return answer

    return call


def entry_text(verdicts: list[str], note: str) -> str:
    """`Hörprobe: Pausen, Stimme. <note>` — the verdicts in the view's order, then the note."""

    ordered = [verdict for verdict in VERDICTS if verdict in verdicts]
    text = f"{PREFIX}{', '.join(ordered)}."
    return f"{text} {note.strip()}" if note.strip() else text


def verdicts_in(text: str) -> list[str]:
    """The verdicts a Hörprobe entry names; none for an entry filed any other way."""

    if not text.startswith(PREFIX):
        return []
    head = text[len(PREFIX) :].split(".", 1)[0]
    return [verdict for verdict in (part.strip() for part in head.split(",")) if verdict in VERDICTS]


def _record_path(level: str, slug: str) -> str:
    return f"content/listening/{level}/{slug}.yaml"


def _voices(manifest: dict[str, Any] | None) -> list[dict[str, Any]]:
    """Each role and what speaks it: a roster character, or a preset voice by name.

    A scene manifest carries its cast; an older manifest only its lines, each naming its speaker
    and preset voice, so the roles are taken there in the order they first speak.
    """

    if not manifest:
        return []
    scene = manifest.get("scene")
    if isinstance(scene, dict):
        rows = []
        for member in scene.get("cast") or []:
            if not isinstance(member, dict):
                continue
            voice = member.get("voice") or {}
            character = member.get("character") or {}
            designed = voice.get("engine") in DESIGNED_ENGINES
            rows.append(
                {
                    "role": str(member.get("role", "")),
                    "character": character.get("id") if isinstance(character, dict) else None,
                    "preset": None if designed else voice.get("voice"),
                }
            )
        return rows
    seen: dict[str, dict[str, Any]] = {}
    for line in (manifest.get("settings") or {}).get("lines") or []:
        if isinstance(line, dict) and line.get("speaker") not in seen:
            speaker = str(line.get("speaker", ""))
            seen[speaker] = {"role": speaker, "character": None, "preset": line.get("voice")}
    return list(seen.values())


def _entry(entry: dict[str, Any]) -> dict[str, Any]:
    thread = entry.get("thread") or [{}]
    first = thread[0] if isinstance(thread[0], dict) else {}
    text = str(first.get("text", ""))
    return {
        "id": entry.get("id"),
        "type": entry.get("type"),
        "waiting": entry.get("waiting"),
        "from": first.get("from"),
        "at": str(first.get("at", "")),
        "text": text,
        "verdicts": verdicts_in(text),
    }


def dialogue_rows(repo: Path, entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Every published recording with two speakers or more, by level and then id."""

    by_file: dict[str, list[dict[str, Any]]] = {}
    for entry in entries:
        target = entry.get("target") or {}
        if isinstance(target, dict) and target.get("file") and not target.get("item"):
            by_file.setdefault(str(target["file"]), []).append(_entry(entry))

    rows: list[dict[str, Any]] = []
    root = repo / "content" / "listening"
    for level_dir in sorted(path for path in root.iterdir() if path.is_dir()) if root.is_dir() else []:
        level = level_dir.name
        for record_path in sorted(level_dir.glob("*.yaml")):
            slug = record_path.stem
            try:
                record = yaml.safe_load(record_path.read_text())
            except (OSError, yaml.YAMLError):
                continue
            if not isinstance(record, dict) or len(record.get("speakers") or []) < 2:
                continue
            if not (level_dir / f"{slug}.mp3").is_file():
                continue
            manifest_path = repo / "data" / "audio-provenance" / level / f"{slug}.json"
            try:
                manifest = json.loads(manifest_path.read_text())
            except (OSError, ValueError):
                manifest = None
            title = record.get("title") or {}
            file = _record_path(level, slug)
            rows.append(
                {
                    "id": slug,
                    "level": str(record.get("level", level.upper())),
                    "file": file,
                    "title": title.get("en", "") if isinstance(title, dict) else "",
                    "scenario": record.get("scenario"),
                    "duration_seconds": record.get("duration_seconds"),
                    "speakers": [str(speaker) for speaker in record.get("speakers") or []],
                    "voices": _voices(manifest if isinstance(manifest, dict) else None),
                    "audio_sha256": (
                        manifest.get("published_audio_sha256")
                        if isinstance(manifest, dict)
                        else None
                    ),
                    "entries": by_file.get(file, []),
                }
            )
    return rows


class VerdictRequest(BaseModel):
    verdicts: list[str] = Field(min_length=1)
    note: str = Field(default="", max_length=2000)


def router(store: Store, repo: Path, queue: QueueBridge | None = None) -> APIRouter:
    del store  # the Hörprobe reads the repository and the queue, never the studio database
    api = APIRouter(prefix="/api/hoerprobe", tags=["hoerprobe"])
    bridge = queue or bun_bridge(repo)

    def record(level: str, slug: str) -> Path:
        if not LEVEL.match(level) or not SLUG.match(slug):
            raise HTTPException(404, f"{level}/{slug} ist keine veröffentlichte Aufnahme")
        return repo / "content" / "listening" / level / f"{slug}.yaml"

    @api.get("")
    def listing() -> dict[str, Any]:
        error: str | None = None
        entries: list[dict[str, Any]] = []
        try:
            answer = bridge({"action": "list"})
            entries = [entry for entry in answer.get("entries") or [] if isinstance(entry, dict)]
        except QueueUnavailable as failure:
            # The recordings still play; the view says it cannot see or file verdicts.
            error = str(failure)
        return {"verdicts": list(VERDICTS), "rows": dialogue_rows(repo, entries), "queue_error": error}

    @api.get("/{level}/{slug}/audio")
    def audio(level: str, slug: str) -> FileResponse:
        target = record(level, slug).with_suffix(".mp3")
        if not target.is_file():
            raise HTTPException(404, f"{level}/{slug} hat keine veröffentlichte Aufnahme")
        return FileResponse(target, media_type="audio/mpeg", filename=target.name)

    @api.post("/{level}/{slug}/verdict")
    def verdict(level: str, slug: str, request: VerdictRequest) -> dict[str, Any]:
        path = record(level, slug)
        if not path.is_file():
            raise HTTPException(404, f"{level}/{slug} ist keine veröffentlichte Aufnahme")
        unknown = [name for name in request.verdicts if name not in VERDICTS]
        if unknown:
            raise HTTPException(
                422, f"kein Urteil der Hörprobe: {', '.join(unknown)} (gut wird nicht eingetragen)"
            )
        try:
            answer = bridge(
                {
                    "action": "file",
                    "type": "finding",
                    "target": {"file": _record_path(level, slug)},
                    "text": entry_text(request.verdicts, request.note),
                }
            )
        except QueueUnavailable as failure:
            raise HTTPException(503, str(failure)) from failure
        if not answer.get("ok") or not isinstance(answer.get("entry"), dict):
            raise HTTPException(422, str(answer.get("error") or "nicht eingetragen"))
        return {"entry": _entry(answer["entry"])}

    return api
