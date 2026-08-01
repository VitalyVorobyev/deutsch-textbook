import hashlib
import json
from pathlib import Path

from listening_studio.adapters import FakeTTS, assemble, generate_lines
from listening_studio.export import write_bundle
from test_domain import payload


def test_bundle_is_deterministic_and_records_provenance(tmp_path: Path) -> None:
    project = payload()
    work = tmp_path / "project"
    lines = generate_lines(project, work, FakeTTS())
    wav = work / "final.wav"
    assemble(project, lines, wav)
    approval = {
        "status": "complete",
        "editor": "Synthetic test fixture",
        "reviewed_at": "2026-08-01T12:00:00+00:00",
        "checklist": ["accent", "naturalness", "intelligibility", "speakers", "pace", "questions"],
    }
    models = {
        "dependency_lock_sha256": "d" * 64,
        "model_lock_sha256": "m" * 64,
        "models": {
            "fake": {
                "revision": "fake-v1",
                "license": "test-only",
                "training_data_provenance": "no training data; synthetic silence fixture",
            }
        },
    }
    first = write_bundle(
        tmp_path / "bundle", "deterministic", project, wav, {"passed": True}, approval, models
    )
    first_hash = hashlib.sha256(first.read_bytes()).hexdigest()
    second = write_bundle(
        tmp_path / "bundle", "deterministic", project, wav, {"passed": True}, approval, models
    )
    assert hashlib.sha256(second.read_bytes()).hexdigest() == first_hash
    provenance = json.loads((tmp_path / "bundle" / "provenance.json").read_text())
    assert provenance["audio_sha256"] == hashlib.sha256(wav.read_bytes()).hexdigest()
    assert provenance["claims"]["voice_cloning_used"] is False
    assert all(line["cache_key"] for line in provenance["line_artifacts"])
