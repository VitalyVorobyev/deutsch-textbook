from __future__ import annotations

import json
from pathlib import Path

import pytest

from listening_studio.generative.locks import set_models_root
from listening_studio.human_voice_experiment import (
    load_consent,
    sha256,
    validate_private_paths,
)


def consent_payload(reference_hash: str) -> dict[str, object]:
    return {
        "version": 1,
        "recorded_at": "2026-08-03T00:00:00Z",
        "subject": {"identifier": "fixture", "minor": True},
        "guardian_consent": {
            "confirmed": True,
            "guardian": "Fixture Guardian",
            "attestation": "Guardian permits this local research fixture.",
        },
        "child_assent": {
            "confirmed": True,
            "attested_by_guardian": True,
            "attestation": "The child understands and agrees to the fixture experiment.",
        },
        "authorized_purpose": "Local non-publishing voice-cloning evaluation fixture.",
        "prohibited_uses": ["upload", "publication", "git tracking"],
        "retention": {
            "policy": "retain until the guardian requests deletion",
            "automatic_deletion": False,
        },
        "distribution": "none",
        "reference": {"path": "reference.wav", "sha256": reference_hash},
    }


def test_consent_binds_the_exact_reference_bytes(tmp_path: Path) -> None:
    reference = tmp_path / "reference.wav"
    reference.write_bytes(b"not real audio")
    record = tmp_path / "consent.json"
    record.write_text(json.dumps(consent_payload(sha256(reference))))
    assert load_consent(record, reference).child_assent.confirmed
    reference.write_bytes(b"changed")
    with pytest.raises(ValueError, match="consented SHA-256"):
        load_consent(record, reference)


def test_minor_experiment_refuses_missing_child_assent(tmp_path: Path) -> None:
    reference = tmp_path / "reference.wav"
    reference.write_bytes(b"fixture")
    payload = consent_payload(sha256(reference))
    child = dict(payload["child_assent"])  # type: ignore[arg-type]
    child["confirmed"] = False
    payload["child_assent"] = child
    record = tmp_path / "consent.json"
    record.write_text(json.dumps(payload))
    with pytest.raises(ValueError, match="child's assent"):
        load_consent(record, reference)


def test_all_sensitive_paths_must_stay_in_private_root(tmp_path: Path) -> None:
    # `.private/` hangs off the repository the run was started against, so the root is what
    # this test overrides — the same lever `--repo` pulls.
    private = tmp_path / ".private"
    private.mkdir()
    reference = private / "reference.wav"
    consent = private / "consent.json"
    output = private / "run"
    try:
        set_models_root(tmp_path)
        validate_private_paths(reference, consent, output)
        with pytest.raises(ValueError, match="must stay"):
            validate_private_paths(tmp_path / "outside.wav", consent, output)
        output.mkdir()
        with pytest.raises(FileExistsError, match="overwrite"):
            validate_private_paths(reference, consent, output)
    finally:
        set_models_root(None)
