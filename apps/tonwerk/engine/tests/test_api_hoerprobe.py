"""`/api/hoerprobe` — the published dialogues, and a verdict filed into the shared queue.

The fixture is a small course repository: one dialogue on preset voices (an older manifest that
names voices per line), one on roster characters (a scene manifest with its cast), and one
announcement with a single speaker, which the view does not list. The queue is a stand-in bridge
that records what it was asked, except in the last test, which runs the real `queue-bridge.ts` on
the temporary repository and reads the entry back through it.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any

import pytest
import yaml
from fastapi.testclient import TestClient

from listening_studio.api.hoerprobe import entry_text, verdicts_in
from listening_studio.storage import Store
from listening_studio.web import app

AUTH = {"Authorization": "Bearer test"}


def publish(
    repo: Path, level: str, slug: str, speakers: list[str], manifest: dict[str, Any]
) -> None:
    listening = repo / "content" / "listening" / level
    listening.mkdir(parents=True, exist_ok=True)
    record = {
        "id": slug,
        "level": level.upper(),
        "title": {"en": f"Title {slug}", "ru": "Заголовок"},
        "scenario": f"Szenario {slug}",
        "duration_seconds": 31,
        "speakers": speakers,
    }
    (listening / f"{slug}.yaml").write_text(yaml.safe_dump(record, allow_unicode=True))
    (listening / f"{slug}.mp3").write_bytes(b"ID3fake-" + slug.encode())
    provenance = repo / "data" / "audio-provenance" / level
    provenance.mkdir(parents=True, exist_ok=True)
    (provenance / f"{slug}.json").write_text(json.dumps(manifest))


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    root = tmp_path / "repo"
    publish(
        root,
        "a1",
        "ls-preset-01",
        ["Kellner", "Gast"],
        {
            "version": 1,
            "published_audio_sha256": "a" * 64,
            "settings": {
                "lines": [
                    {"speaker": "Kellner", "voice": "Ryan"},
                    {"speaker": "Gast", "voice": "Ono_Anna"},
                    {"speaker": "Kellner", "voice": "Ryan"},
                ]
            },
        },
    )
    publish(
        root,
        "b1",
        "ls-figuren-01",
        ["Lena", "Frau Kern"],
        {
            "version": 2,
            "published_audio_sha256": "b" * 64,
            "scene": {
                "cast": [
                    {
                        "role": "Lena",
                        "character": {"id": "lena-berger", "version": 2},
                        "voice": {"engine": "qwen_tts_designed", "voice": "c" * 64},
                    },
                    {
                        "role": "Frau Kern",
                        "character": None,
                        "voice": {"engine": "qwen_tts", "voice": "Serena"},
                    },
                ]
            },
        },
    )
    publish(root, "a2", "ls-durchsage-01", ["Sprecher"], {"version": 2, "scene": {"cast": []}})
    (root / "data").mkdir(exist_ok=True)
    return root


class FakeQueue:
    """The bridge's two answers, and every request it was handed."""

    def __init__(self, entries: list[dict[str, Any]]) -> None:
        self.entries = entries
        self.requests: list[dict[str, Any]] = []

    def __call__(self, request: dict[str, Any]) -> dict[str, Any]:
        self.requests.append(request)
        if request["action"] == "list":
            return {"ok": True, "entries": self.entries}
        entry = {
            "id": "q-0042",
            "type": request["type"],
            "target": request["target"],
            "waiting": "claude",
            "thread": [{"from": "owner", "at": "2026-11-13", "text": request["text"]}],
        }
        return {"ok": True, "entry": entry}


def client(store_dir: Path, repo: Path, queue: Any) -> TestClient:
    return TestClient(app(Store(store_dir / "db.sqlite3"), repo, token="test", queue_bridge=queue))


def test_lists_dialogues_with_their_voices_and_filed_verdicts(tmp_path: Path, repo: Path) -> None:
    queue = FakeQueue(
        [
            {
                "id": "q-0007",
                "type": "finding",
                "target": {"file": "content/listening/b1/ls-figuren-01.yaml"},
                "waiting": "claude",
                "thread": [{"from": "owner", "at": "2026-11-12", "text": "Hörprobe: Stimme. zu ähnlich"}],
            },
            {
                "id": "q-0008",
                "type": "question",
                "target": {"topic": "wohnen"},
                "waiting": "owner",
                "thread": [{"from": "claude", "at": "2026-11-12", "text": "Andere Frage"}],
            },
        ]
    )
    body = client(tmp_path, repo, queue).get("/api/hoerprobe", headers=AUTH).json()

    assert body["queue_error"] is None
    assert body["verdicts"] == ["Tempo", "Pausen", "Stimme", "Aussprache", "Text"]
    # The single-speaker announcement is not a dialogue, so it is not listed.
    assert [row["id"] for row in body["rows"]] == ["ls-preset-01", "ls-figuren-01"]
    preset, figuren = body["rows"]
    assert preset["file"] == "content/listening/a1/ls-preset-01.yaml"
    assert preset["audio_sha256"] == "a" * 64
    assert preset["voices"] == [
        {"role": "Kellner", "character": None, "preset": "Ryan"},
        {"role": "Gast", "character": None, "preset": "Ono_Anna"},
    ]
    assert preset["entries"] == []
    assert figuren["voices"] == [
        {"role": "Lena", "character": "lena-berger", "preset": None},
        {"role": "Frau Kern", "character": None, "preset": "Serena"},
    ]
    assert [entry["id"] for entry in figuren["entries"]] == ["q-0007"]
    assert figuren["entries"][0]["verdicts"] == ["Stimme"]


def test_a_verdict_is_filed_as_the_owners_finding_on_the_record(
    tmp_path: Path, repo: Path
) -> None:
    queue = FakeQueue([])
    response = client(tmp_path, repo, queue).post(
        "/api/hoerprobe/a1/ls-preset-01/verdict",
        headers=AUTH,
        json={"verdicts": ["Stimme", "Pausen"], "note": "  Kellner und Gast klingen gleich "},
    )

    assert response.status_code == 200, response.text
    assert queue.requests == [
        {
            "action": "file",
            "type": "finding",
            "target": {"file": "content/listening/a1/ls-preset-01.yaml"},
            # The view's order, whatever order the keys were pressed in; the note trimmed.
            "text": "Hörprobe: Pausen, Stimme. Kellner und Gast klingen gleich",
        }
    ]
    assert response.json()["entry"]["verdicts"] == ["Pausen", "Stimme"]


@pytest.mark.parametrize("verdicts", [[], ["gut"], ["Stimme", "Lautstärke"]])
def test_gut_and_unknown_verdicts_file_nothing(
    tmp_path: Path, repo: Path, verdicts: list[str]
) -> None:
    queue = FakeQueue([])
    response = client(tmp_path, repo, queue).post(
        "/api/hoerprobe/a1/ls-preset-01/verdict", headers=AUTH, json={"verdicts": verdicts}
    )

    assert response.status_code == 422
    assert queue.requests == []


def test_plays_the_published_audio_and_nothing_beside_it(tmp_path: Path, repo: Path) -> None:
    http = client(tmp_path, repo, FakeQueue([]))

    played = http.get("/api/hoerprobe/a1/ls-preset-01/audio", headers=AUTH)
    assert played.status_code == 200
    assert played.content == b"ID3fake-ls-preset-01"
    assert http.get("/api/hoerprobe/a1/..%2F..%2Fdata/audio", headers=AUTH).status_code == 404
    assert http.get("/api/hoerprobe/x9/ls-preset-01/audio", headers=AUTH).status_code == 404


def test_entry_text_round_trips_its_verdicts() -> None:
    assert entry_text(["Text"], "") == "Hörprobe: Text."
    assert verdicts_in(entry_text(["Aussprache", "Tempo"], "„Bahnhof“. Zweimal.")) == [
        "Tempo",
        "Aussprache",
    ]
    assert verdicts_in("Stimme klingt seltsam") == []


@pytest.mark.skipif(shutil.which("bun") is None, reason="needs Bun for queue-bridge.ts")
def test_the_real_bridge_files_an_entry_the_queue_reader_parses(
    tmp_path: Path, repo: Path
) -> None:
    http = TestClient(app(Store(tmp_path / "db.sqlite3"), repo, token="test"))

    filed = http.post(
        "/api/hoerprobe/b1/ls-figuren-01/verdict",
        headers=AUTH,
        json={"verdicts": ["Tempo"], "note": "zu schnell"},
    )
    assert filed.status_code == 200, filed.text
    assert filed.json()["entry"]["id"] == "q-0001"

    # Read back through the same module that wrote it: the listing asks the bridge to `list`.
    body = http.get("/api/hoerprobe", headers=AUTH).json()
    assert body["queue_error"] is None
    figuren = next(row for row in body["rows"] if row["id"] == "ls-figuren-01")
    assert [(e["id"], e["from"], e["waiting"], e["verdicts"]) for e in figuren["entries"]] == [
        ("q-0001", "owner", "claude", ["Tempo"])
    ]
    assert "zu schnell" in (repo / "data" / "redaktion-queue.yaml").read_text()
