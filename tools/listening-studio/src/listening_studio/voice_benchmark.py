from __future__ import annotations

import gc
import hashlib
import json
import random
import resource
import shutil
import subprocess
import time
from pathlib import Path
from typing import Any

from .adapters import (
    QwenTTS,
    assemble,
    generate_lines,
    locked_snapshot,
    transcribe,
    wav_duration,
    write_with_pace,
)
from .domain import RevisionPayload, lock_voice_profiles
from .qa import check_transcripts
from .speaker_qa import check_speaker_consistency


BENCHMARK_SLUGS = (
    "ls-menschen-familie-01",
    "ls-wohnen-01",
    "ls-verben-mit-praepositionen-01",
    "ls-gesundheit-wohlbefinden-01",
    "ls-reisen-probleme-01",
    "ls-regeln-verantwortung-01",
)
SYNTHETIC_REFERENCE_CLAIM = "synthetic reference; no human recording"
REFERENCE_TEXT = (
    "Heute bespreche ich in ruhigem Tempo einen ganz normalen Alltag. "
    "Meine Stimme bleibt dabei klar, natürlich und gleichmäßig."
)
FICTIONAL_VOICE_PROMPTS = (
    "A fictional adult German voice with a warm mid range, calm baseline energy, clear "
    "articulation, and natural conversational rhythm. Keep age, timbre, pitch range, and "
    "energy stable. Clean dry studio sound; no imitation of any known person or character.",
    "A fictional adult German voice with a bright upper-mid range, alert but restrained "
    "baseline energy, clear articulation, and natural conversational rhythm. Keep age, "
    "timbre, pitch range, and energy stable. Clean dry studio sound; no imitation of any "
    "known person or character.",
    "A fictional mature German voice with a low-mid range, measured baseline energy, crisp "
    "articulation, and natural conversational rhythm. Keep age, timbre, pitch range, and "
    "energy stable. Clean dry studio sound; no imitation of any known person or character.",
    "A fictional young-adult German voice with a light mid range, friendly restrained "
    "baseline energy, clear articulation, and natural conversational rhythm. Keep age, "
    "timbre, pitch range, and energy stable. Clean dry studio sound; no imitation of any "
    "known person or character.",
)
VOICE_DESIGN_ID = "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign"
VOICE_DESIGN_REVISION = "5ecdb67327fd37bb2e042aab12ff7391903235d3"
VOICE_CLONE_ID = "Qwen/Qwen3-TTS-12Hz-0.6B-Base"
VOICE_CLONE_REVISION = "5d83992436eae1d760afd27aff78a71d676296fc"
COURSE_REPO = Path(__file__).resolve().parents[4]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _swap_bytes() -> int | None:
    try:
        output = subprocess.check_output(["sysctl", "-n", "vm.swapusage"], text=True)
    except (OSError, subprocess.SubprocessError):
        return None
    # macOS: "total = ...M  used = 123.45M ..."
    try:
        used = output.split("used =", 1)[1].strip().split()[0]
        suffix = used[-1].upper()
        scale = {"K": 1024, "M": 1024**2, "G": 1024**3}[suffix]
        return int(float(used[:-1]) * scale)
    except (IndexError, KeyError, ValueError):
        return None


def _peak_rss_bytes() -> int:
    value = int(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)
    # ru_maxrss is bytes on macOS and KiB on Linux.
    system = subprocess.run(["uname", "-s"], capture_output=True, text=True).stdout.strip()
    return value if system == "Darwin" else value * 1024


def _qa(payload: RevisionPayload, paths: dict[str, Path], full: Path) -> dict[str, Any]:
    transcripts = {line.id: transcribe(paths[line.id]) for line in payload.lines}
    whisper = check_transcripts(payload, transcripts, transcribe(full))
    speaker = check_speaker_consistency(payload, paths)
    return {
        "whisper": whisper.model_dump(mode="json"),
        "speaker_consistency": speaker.model_dump(mode="json"),
    }


def _write_blind_review(root: Path, slugs: list[str]) -> None:
    rng = random.Random(20260802)
    key: dict[str, dict[str, str]] = {}
    rows: list[str] = []
    for slug in slugs:
        arms = ["custom_voice", "voice_design_clone"]
        rng.shuffle(arms)
        key[slug] = {"A": arms[0], "B": arms[1]}
        rows.append(
            f"<section><h2>{slug}</h2>"
            f"<p>A<br><audio controls preload=none src='{slug}/blind/A.wav'></audio></p>"
            f"<p>B<br><audio controls preload=none src='{slug}/blind/B.wav'></audio></p>"
            "<p>Score A and B for identity consistency, pronunciation, naturalness, and "
            "character separation. Listen without a transcript first.</p></section>"
        )
        blind = root / slug / "blind"
        blind.mkdir(parents=True, exist_ok=True)
        for label, arm in key[slug].items():
            source = root / slug / arm / "dry.wav"
            shutil.copy2(source, blind / f"{label}.wav")
    (root / "blind-review.html").write_text(
        "<!doctype html><meta charset=utf-8><title>Blind voice review</title>" + "".join(rows)
    )
    (root / "answer-key.json").write_text(json.dumps(key, indent=2, sort_keys=True))
    review = {
        slug: {
            label: {
                criterion: None
                for criterion in (
                    "identity_consistency",
                    "pronunciation",
                    "naturalness",
                    "character_separation",
                )
            }
            for label in ("A", "B")
        }
        for slug in slugs
    }
    (root / "blind-review.json").write_text(json.dumps(review, indent=2, sort_keys=True))


def run_benchmark(
    projects: list[tuple[str, RevisionPayload]], root: Path
) -> Path:
    """Run both dry-audio arms in an app-data workspace; no publisher is imported or called."""

    resolved_root = root.resolve()
    if resolved_root == COURSE_REPO or resolved_root.is_relative_to(COURSE_REPO):
        raise ValueError("benchmark output must stay outside the course repository")
    unexpected = sorted({slug for slug, _ in projects} - set(BENCHMARK_SLUGS))
    if unexpected:
        raise ValueError("benchmark is allowlisted to six projects: " + ", ".join(unexpected))
    missing = sorted(set(BENCHMARK_SLUGS) - {slug for slug, _ in projects})
    if missing:
        raise ValueError("benchmark requires all six projects: " + ", ".join(missing))
    root.mkdir(parents=True, exist_ok=False)
    locks = json.loads((Path(__file__).resolve().parents[2] / "benchmark-models.lock.json").read_text())
    run_manifest: dict[str, Any] = {
        "scope": "research-only; non-publishing",
        "synthetic_reference_claim": SYNTHETIC_REFERENCE_CLAIM,
        "reference_text": REFERENCE_TEXT,
        "models": locks["models"],
        "projects": {},
    }
    swap_start = _swap_bytes()

    # Arm 1: the production model, but every output remains under this benchmark root.
    custom = QwenTTS()
    for slug, original in projects:
        payload = lock_voice_profiles(original)
        work = root / slug / "custom_voice"
        started = time.monotonic()
        custom_paths = generate_lines(payload, work, custom)
        assemble(payload, custom_paths, work / "dry.wav")
        synthesis_runtime = time.monotonic() - started
        run_manifest["projects"].setdefault(slug, {})["custom_voice"] = {
            "synthesis_runtime_seconds": synthesis_runtime,
            "audio_duration_seconds": wav_duration(work / "dry.wav"),
            "peak_rss_after_arm_bytes": _peak_rss_bytes(),
            "swap_after_arm_bytes": _swap_bytes(),
            "audio_sha256": sha256(work / "dry.wav"),
            "qa": _qa(payload, custom_paths, work / "dry.wav"),
        }
    del custom
    gc.collect()

    try:
        import soundfile as sf
        import torch
        from qwen_tts import Qwen3TTSModel
    except ImportError as exc:
        raise RuntimeError("install the pinned Qwen benchmark runtime") from exc

    # References are generated once per declared character, then hashed and retained.
    design = Qwen3TTSModel.from_pretrained(locked_snapshot(VOICE_DESIGN_ID, VOICE_DESIGN_REVISION))
    for slug, original in projects:
        payload = lock_voice_profiles(original)
        references = root / slug / "voice_design_clone" / "references"
        references.mkdir(parents=True, exist_ok=True)
        reference_rows: list[dict[str, Any]] = []
        for index, profile in enumerate(payload.voice_profiles or []):
            prompt = FICTIONAL_VOICE_PROMPTS[index]
            torch.manual_seed(profile.seed)
            wavs, rate = design.generate_voice_design(
                text=REFERENCE_TEXT, instruct=prompt, language="German"
            )
            path = references / f"character-{index + 1}.wav"
            sf.write(path, wavs[0], rate)
            reference_rows.append(
                {
                    "speaker": profile.speaker,
                    "prompt": prompt,
                    "seed": profile.seed,
                    "sha256": sha256(path),
                    "claim": SYNTHETIC_REFERENCE_CLAIM,
                }
            )
        run_manifest["projects"].setdefault(slug, {})["synthetic_references"] = reference_rows
    del design
    gc.collect()

    clone = Qwen3TTSModel.from_pretrained(locked_snapshot(VOICE_CLONE_ID, VOICE_CLONE_REVISION))
    for slug, original in projects:
        payload = lock_voice_profiles(original)
        work = root / slug / "voice_design_clone"
        started = time.monotonic()
        prompts: dict[str, Any] = {}
        for index, profile in enumerate(payload.voice_profiles or []):
            reference = work / "references" / f"character-{index + 1}.wav"
            prompts[profile.speaker] = clone.create_voice_clone_prompt(
                ref_audio=str(reference), ref_text=REFERENCE_TEXT, x_vector_only_mode=False
            )
        clone_paths: dict[str, Path] = {}
        for line in payload.lines:
            line_profile = payload.profile_for(line.speaker)
            assert line_profile is not None
            torch.manual_seed(line_profile.seed)
            wavs, rate = clone.generate_voice_clone(
                text=line.spoken_text(),
                language="German",
                voice_clone_prompt=prompts[line.speaker],
            )
            target = work / "lines" / f"{line.id}.wav"
            write_with_pace(target, wavs[0], rate, line.pace, sf)
            clone_paths[line.id] = target
        assemble(payload, clone_paths, work / "dry.wav")
        synthesis_runtime = time.monotonic() - started
        run_manifest["projects"].setdefault(slug, {})["voice_design_clone"] = {
            "synthesis_runtime_seconds": synthesis_runtime,
            "audio_duration_seconds": wav_duration(work / "dry.wav"),
            "peak_rss_after_arm_bytes": _peak_rss_bytes(),
            "swap_after_arm_bytes": _swap_bytes(),
            "audio_sha256": sha256(work / "dry.wav"),
            "qa": _qa(payload, clone_paths, work / "dry.wav"),
        }
    del clone
    gc.collect()
    swap_end = _swap_bytes()
    run_manifest["resources"] = {
        "peak_rss_bytes": _peak_rss_bytes(),
        "swap_start_bytes": swap_start,
        "swap_end_bytes": swap_end,
        "swap_delta_bytes": (
            swap_end - swap_start if swap_start is not None and swap_end is not None else None
        ),
    }
    clone_qa_failures = [
        slug
        for slug, rows in run_manifest["projects"].items()
        if not rows["voice_design_clone"]["qa"]["whisper"]["passed"]
    ]
    run_manifest["adoption_gate"] = {
        "eligible": False,
        "objective_qa_passed_all_six": not clone_qa_failures,
        "clone_qa_failures": clone_qa_failures,
        "blind_review_status": "pending-human-review",
        "note": (
            "Adoption cannot be eligible until blind review is complete; any clone QA failure "
            "already blocks the stated gate. Swap pressure remains a human-reviewed resource gate."
        ),
    }
    (root / "benchmark.json").write_text(
        json.dumps(run_manifest, ensure_ascii=False, indent=2, sort_keys=True)
    )
    _write_blind_review(root, [slug for slug, _ in projects])
    return root
