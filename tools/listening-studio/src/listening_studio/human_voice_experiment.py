from __future__ import annotations

import gc
import hashlib
import json
import os
import random
import resource
import shutil
import subprocess
import time
from pathlib import Path
from typing import Any

import numpy as np
import numpy.typing as npt
from pydantic import BaseModel, Field, model_validator

from .adapters import locked_snapshot, transcribe, wav_duration, write_with_pace
from .domain import normalized_words, word_error_rate
from .speaker_qa import MODEL_ID as SPEAKER_MODEL_ID
from .speaker_qa import MODEL_REVISION as SPEAKER_MODEL_REVISION
from .speaker_qa import WavLMSpeakerEmbedder
from .voice_benchmark import VOICE_CLONE_ID, VOICE_CLONE_REVISION


COURSE_REPO = Path(__file__).resolve().parents[4]
PRIVATE_ROOT = COURSE_REPO / ".private"
ASR_ID = "mlx-community/whisper-large-v3-turbo"
ASR_REVISION = "a4aaeec0636e6fef84abdcbe3544cb2bf7e9f6fb"
TEST_LINES = (
    "Hallo! Ich komme gleich nach Hause.",
    "Darf ich heute mit meinen Freunden auf den Spielplatz gehen?",
    "Ich habe meine Hausaufgaben schon gemacht.",
    "Keine Sorge, ich bin um sechs Uhr zurück.",
    "Warte kurz, ich suche noch meine blaue Jacke.",
    "Das war wirklich lustig. Morgen erzähle ich dir alles.",
)
MAX_NEW_TOKENS = 240  # 20 seconds at the 12 Hz codec; stops rare runaway generations.


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


class Confirmation(BaseModel):
    confirmed: bool
    attestation: str = Field(min_length=10)


class GuardianConfirmation(Confirmation):
    guardian: str = Field(min_length=2)


class ChildAssent(Confirmation):
    attested_by_guardian: bool


class RetentionPolicy(BaseModel):
    policy: str = Field(min_length=10)
    automatic_deletion: bool


class ReferenceRecord(BaseModel):
    path: str
    sha256: str = Field(pattern=r"^[0-9a-f]{64}$")


class HumanVoiceConsent(BaseModel):
    version: int = 1
    recorded_at: str
    subject: dict[str, object]
    guardian_consent: GuardianConfirmation
    child_assent: ChildAssent
    authorized_purpose: str = Field(min_length=20)
    prohibited_uses: list[str]
    retention: RetentionPolicy
    distribution: str
    reference: ReferenceRecord

    @model_validator(mode="after")
    def consent_is_specific_and_complete(self) -> HumanVoiceConsent:
        if not self.guardian_consent.confirmed:
            raise ValueError("guardian consent is required")
        if not self.child_assent.confirmed or not self.child_assent.attested_by_guardian:
            raise ValueError("the child's assent must be confirmed and attested by the guardian")
        if self.distribution.casefold() != "none":
            raise ValueError("this experiment permits no distribution")
        prohibited = " ".join(self.prohibited_uses).casefold()
        for required in ("upload", "publication", "git"):
            if required not in prohibited:
                raise ValueError(f"the consent record must explicitly prohibit {required}")
        return self


def load_consent(path: Path, reference: Path) -> HumanVoiceConsent:
    consent = HumanVoiceConsent.model_validate_json(path.read_text())
    if sha256(reference) != consent.reference.sha256:
        raise ValueError("the reference recording does not match the consented SHA-256")
    return consent


def validate_private_paths(reference: Path, consent: Path, output: Path) -> None:
    private = PRIVATE_ROOT.resolve()
    for label, path in (("reference", reference), ("consent", consent), ("output", output)):
        if not path.resolve().is_relative_to(private):
            raise ValueError(f"{label} must stay under the gitignored {private}")
    if output.exists():
        raise FileExistsError(f"refusing to overwrite experiment output: {output}")


def _canonical_reference(source: Path, target: Path) -> None:
    subprocess.run(
        [
            "ffmpeg",
            "-v",
            "error",
            "-i",
            str(source),
            "-vn",
            "-ar",
            "16000",
            "-ac",
            "1",
            "-c:a",
            "pcm_s16le",
            "-y",
            str(target),
        ],
        check=True,
    )


def _transcribe_reference(path: Path) -> tuple[str, str | None]:
    try:
        import mlx_whisper
    except ImportError as exc:
        raise RuntimeError("install the pinned local MLX Whisper runtime") from exc
    result = mlx_whisper.transcribe(
        str(path),
        path_or_hf_repo=locked_snapshot(ASR_ID, ASR_REVISION),
        condition_on_previous_text=False,
    )
    return str(result.get("text", "")).strip(), (
        str(result["language"]) if result.get("language") else None
    )


def _read_trimmed(path: Path) -> tuple[npt.NDArray[np.float32], int]:
    import soundfile as sf

    samples, rate = sf.read(path, dtype="float32", always_2d=False)
    audio = np.asarray(samples, dtype=np.float32)
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    active = np.flatnonzero(np.abs(audio) >= 10 ** (-45 / 20))
    if active.size:
        audio = audio[int(active[0]) : int(active[-1]) + 1]
    return audio, int(rate)


def _normalize(vector: npt.NDArray[np.float64]) -> npt.NDArray[np.float64]:
    return vector / max(float(np.linalg.norm(vector)), 1e-12)


def _speaker_metrics(reference: Path, lines: list[Path]) -> dict[str, object]:
    embedder = WavLMSpeakerEmbedder()
    reference_audio, rate = _read_trimmed(reference)
    reference_vector = _normalize(embedder.embed(reference_audio, rate))
    vectors: list[npt.NDArray[np.float64]] = []
    reference_similarities: list[float] = []
    for path in lines:
        audio, line_rate = _read_trimmed(path)
        vector = _normalize(embedder.embed(audio, line_rate))
        vectors.append(vector)
        reference_similarities.append(float(np.dot(reference_vector, vector)))
    centroid = _normalize(np.mean(vectors, axis=0))
    within = [float(np.dot(vector, centroid)) for vector in vectors]
    return {
        "model_id": SPEAKER_MODEL_ID,
        "model_revision": SPEAKER_MODEL_REVISION,
        "reference_similarity_by_line": reference_similarities,
        "reference_similarity_min": min(reference_similarities),
        "reference_similarity_mean": float(np.mean(reference_similarities)),
        "within_arm_similarity_min": min(within),
        "within_arm_similarity_mean": float(np.mean(within)),
        "interpretation": "uncalibrated warning/ranking evidence; human listening is authoritative",
    }


def _assemble(lines: list[Path], target: Path) -> None:
    import soundfile as sf

    pieces: list[npt.NDArray[np.float32]] = []
    rate: int | None = None
    for path in lines:
        audio, current_rate = sf.read(path, dtype="float32", always_2d=False)
        current = np.asarray(audio, dtype=np.float32)
        rate = rate or int(current_rate)
        if current_rate != rate:
            raise ValueError("generated lines use different sample rates")
        pieces.extend([current, np.zeros(round(rate * 0.45), dtype=np.float32)])
    assert rate is not None
    sf.write(target, np.concatenate(pieces), rate)


def _peak_rss_bytes() -> int:
    value = int(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)
    system = subprocess.run(["uname", "-s"], capture_output=True, text=True).stdout.strip()
    return value if system == "Darwin" else value * 1024


def _review_page(root: Path, arms: list[str]) -> None:
    blocks = "".join(
        f"<section><h2>{arm}</h2><audio controls preload=metadata src='{arm}/dialogue.wav'></audio>"
        "<p>Listen first without reading. Rate identity match, consistency, German "
        "pronunciation, naturalness, and child-like delivery.</p></section>"
        for arm in arms
    )
    (root / "listen.html").write_text(
        "<!doctype html><meta charset=utf-8><title>Private voice clone review</title>"
        "<style>body{font:16px/1.5 system-ui;max-width:760px;margin:2rem auto;padding:1rem}"
        "section{padding:1rem;border:1px solid #ddd;border-radius:12px;margin:1rem 0}"
        "audio{width:100%}</style><h1>Private local voice-clone experiment</h1>"
        "<p>Sensitive minor voice data. No distribution or publication.</p>" + blocks
    )
    shuffled = list(arms)
    random.Random(20260803).shuffle(shuffled)
    key = {"A": shuffled[0], "B": shuffled[1]}
    blind = root / "blind"
    blind.mkdir()
    for label, arm in key.items():
        shutil.copy2(root / arm / "dialogue.wav", blind / f"{label}.wav")
    (root / "blind-review.html").write_text(
        "<!doctype html><meta charset=utf-8><title>Blind private clone review</title>"
        "<style>body{font:16px/1.5 system-ui;max-width:760px;margin:2rem auto;padding:1rem}"
        "audio{display:block;width:100%;margin:.5rem 0 1.5rem}</style>"
        "<h1>Blind A/B</h1><p>Listen without the transcript. Compare identity match, "
        "consistency, German pronunciation, naturalness, and child-like delivery.</p>"
        "<h2>A</h2><audio controls preload=metadata src='blind/A.wav'></audio>"
        "<h2>B</h2><audio controls preload=metadata src='blind/B.wav'></audio>"
    )
    (root / "answer-key.json").write_text(json.dumps(key, indent=2, sort_keys=True))


def run_human_voice_experiment(
    reference: Path,
    consent_path: Path,
    output: Path,
    test_lines: tuple[str, ...] = TEST_LINES,
) -> Path:
    """Clone a consented human reference in a gitignored, non-publishing local workspace."""

    validate_private_paths(reference, consent_path, output)
    consent = load_consent(consent_path, reference)
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["TRANSFORMERS_OFFLINE"] = "1"
    output.mkdir(parents=True)
    canonical = output / "reference-16khz.wav"
    _canonical_reference(reference, canonical)
    transcript, detected_language = _transcribe_reference(canonical)
    if not transcript:
        raise RuntimeError("the local ASR produced no reference transcript")

    try:
        import soundfile as sf
        import torch
        from qwen_tts import Qwen3TTSModel
    except ImportError as exc:
        raise RuntimeError("install the pinned Qwen Base cloning runtime") from exc

    started = time.monotonic()
    model = Qwen3TTSModel.from_pretrained(
        locked_snapshot(VOICE_CLONE_ID, VOICE_CLONE_REVISION)
    )
    prompts = {
        "full_reference": model.create_voice_clone_prompt(
            ref_audio=str(canonical), ref_text=transcript, x_vector_only_mode=False
        ),
        "x_vector_only": model.create_voice_clone_prompt(
            ref_audio=str(canonical), x_vector_only_mode=True
        ),
    }
    manifest_arms: dict[str, Any] = {}
    for arm, prompt in prompts.items():
        arm_root = output / arm
        lines_root = arm_root / "lines"
        lines_root.mkdir(parents=True)
        paths: list[Path] = []
        line_rows: list[dict[str, object]] = []
        arm_started = time.monotonic()
        for index, text in enumerate(test_lines, 1):
            torch.manual_seed(100)
            wavs, rate = model.generate_voice_clone(
                text=text,
                language="German",
                voice_clone_prompt=prompt,
                max_new_tokens=MAX_NEW_TOKENS,
            )
            target = lines_root / f"line-{index:02d}.wav"
            write_with_pace(target, wavs[0], rate, 1.0, sf)
            heard = transcribe(target)
            duration = wav_duration(target)
            line_rows.append(
                {
                    "id": f"line-{index:02d}",
                    "expected": text,
                    "transcript": heard,
                    "wer": word_error_rate(text, heard),
                    "expected_words": normalized_words(text),
                    "sha256": sha256(target),
                    "duration_seconds": duration,
                    "generation_cap_warning": bool(
                        duration is not None and duration >= MAX_NEW_TOKENS / 12 * 0.9
                    ),
                }
            )
            paths.append(target)
        dialogue = arm_root / "dialogue.wav"
        _assemble(paths, dialogue)
        manifest_arms[arm] = {
            "runtime_seconds": time.monotonic() - arm_started,
            "seed": 100,
            "lines": line_rows,
            "dialogue_sha256": sha256(dialogue),
            "dialogue_duration_seconds": wav_duration(dialogue),
            "speaker_similarity": _speaker_metrics(canonical, paths),
            "warnings": [
                f"{row['id']}: output approached the 20-second generation cap; listen for runaway continuation"
                for row in line_rows
                if row["generation_cap_warning"]
            ],
        }
    del model
    gc.collect()

    consent_hash = sha256(consent_path)
    manifest = {
        "version": 1,
        "scope": "consented human-reference research; local-only; non-publishing",
        "sensitive_minor_voice_data": True,
        "consent": {
            "record_sha256": consent_hash,
            "guardian_confirmed": consent.guardian_consent.confirmed,
            "child_assent_confirmed": consent.child_assent.confirmed,
            "retention": consent.retention.model_dump(mode="json"),
            "distribution": consent.distribution,
        },
        "offline": True,
        "models": {
            "voice_clone": {
                "id": VOICE_CLONE_ID,
                "revision": VOICE_CLONE_REVISION,
            },
            "asr": {"id": ASR_ID, "revision": ASR_REVISION},
            "speaker_qa": {
                "id": SPEAKER_MODEL_ID,
                "revision": SPEAKER_MODEL_REVISION,
            },
        },
        "reference": {
            "original_sha256": sha256(reference),
            "canonical_sha256": sha256(canonical),
            "duration_seconds": wav_duration(canonical),
            "detected_language": detected_language,
            "local_asr_transcript": transcript,
        },
        "test_lines": list(test_lines),
        "generation_limit": {
            "max_new_tokens": MAX_NEW_TOKENS,
            "maximum_audio_seconds": MAX_NEW_TOKENS / 12,
            "reason": "bounded per-line generation after an observed 2048-token runaway",
        },
        "arms": manifest_arms,
        "resources": {
            "total_runtime_seconds": time.monotonic() - started,
            "peak_rss_bytes": _peak_rss_bytes(),
        },
        "review": {
            "status": "pending-human-listening",
            "note": "No identity, naturalness, or publication approval is inferred from metrics.",
        },
    }
    (output / "experiment.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True)
    )
    _review_page(output, list(prompts))
    return output
