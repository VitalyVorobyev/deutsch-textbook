"""Objective checks on a finished take, so a human review is a spot check and not a search.

Four things have gone wrong in this corpus and each was found by a different measurement, so
each has a check here. Whisper QA proves the words are the right words; none of this is about
words — but the stored QA verdict is reprinted anyway, because nothing else does.
`Store.transition` advances a project to AUTOMATICALLY_CHECKED whether the report passed or
failed (approval is what refuses a failed one), `bun run listening:inventory` derives its status
from `content/listening/` and so calls every unpublished artifact `planned`, and the reviewer's
own eye is the thing this file exists to spare. Three artifacts sat red for a day because the
only surface that named them was a run log nobody re-read.

1. **Voice drift** — median F0 per line for one speaker spanning more than ~60 Hz inside one
   dialogue. Below that it reads as intonation; above it, the character changes age and energy
   mid-scene. Caused by seeding per line instead of per speaker.
2. **Halting delivery** — three or more internal silences of 0.28 s or more in a single
   utterance, i.e. a pause between nearly every word.
3. **A slow line** — articulation below ~2.0 words per second *of voiced audio*. Wall-clock
   words per second cannot be used: short utterances are dominated by fixed lead-in and trail,
   so it ranks "Und heute?" as the slowest line in the corpus when it is perfectly normal.
4. **Length against the plan** — `data/listening-plan.yaml` states a window per artifact and
   nothing else reads it (P22-10).

Usage: `uv run python authoring/audio_report.py [slug ...]` (default: every artifact).
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np
import yaml

from listening_studio.adapters import engine_revision, wav_duration
from listening_studio.storage import Store

REPO = Path("../..").resolve()
DRIFT_HZ = 60.0
MIN_ARTICULATION = 2.0
HALT_GAPS = 3


def median_f0(path: Path) -> float:
    """Median fundamental over voiced frames, by autocorrelation with octave correction.

    **The correction is the whole point.** Taking the largest autocorrelation peak reports the
    octave *above* the true pitch whenever the second harmonic is strong, which for a male
    speaker means ~250 Hz instead of ~125. Without it this function claimed a 107 Hz spread on
    a speaker whose real spread is 15.6 Hz, and that false reading is what sent nineteen
    artifacts back for re-synthesis. If the lag at 2x or 3x is nearly as periodic, the longer
    lag is the true period.
    """

    raw = subprocess.run(
        ["ffmpeg", "-v", "quiet", "-i", str(path), "-ac", "1", "-ar", "16000", "-f", "s16le", "-"],
        capture_output=True,
    ).stdout
    x = np.frombuffer(raw, dtype="<i2").astype(np.float64) / 32768
    sr, win, hop = 16000, 640, 320
    lo, hi = sr // 320, sr // 65
    vals = []
    for i in range(0, len(x) - win, hop):
        frame = x[i : i + win]
        if np.sqrt((frame**2).mean()) < 0.02:
            continue
        frame = frame - frame.mean()
        ac = np.correlate(frame, frame, "full")[win - 1 :]
        if ac[0] <= 0:
            continue
        seg = ac[lo:hi]
        if not len(seg):
            continue
        lag = lo + int(np.argmax(seg))
        best = ac[lag]
        if best / ac[0] < 0.3:
            continue
        for multiple in (2, 3):
            candidate = lag * multiple
            if candidate < hi and ac[candidate] > 0.80 * best:
                lag, best = candidate, ac[candidate]
        vals.append(sr / lag)
    return float(np.median(vals)) if vals else 0.0


def silence_split(path: Path) -> tuple[float, float, float, float]:
    """(total, leading, internal, trailing) seconds of silence in one take."""

    total = wav_duration(path) or 0.0
    out = subprocess.run(
        ["ffmpeg", "-v", "info", "-i", str(path), "-af",
         "silencedetect=noise=-45dB:d=0.12", "-f", "null", "-"],
        capture_output=True, text=True,
    ).stderr
    starts = [float(m) for m in re.findall(r"silence_start: ([\d.]+)", out)]
    durs = [float(m) for m in re.findall(r"silence_duration: ([\d.]+)", out)]
    lead = trail = internal = 0.0
    for start, dur in zip(starts, durs):
        if start <= 0.05:
            lead = dur
        elif start + dur >= total - 0.05:
            trail = dur
        else:
            internal += dur
    return total, lead, internal, trail


def internal_gaps(path: Path, floor: float = 0.28) -> int:
    total = wav_duration(path) or 0.0
    out = subprocess.run(
        ["ffmpeg", "-v", "info", "-i", str(path), "-af",
         f"silencedetect=noise=-45dB:d={floor}", "-f", "null", "-"],
        capture_output=True, text=True,
    ).stderr
    starts = [float(m) for m in re.findall(r"silence_start: ([\d.]+)", out)]
    durs = [float(m) for m in re.findall(r"silence_duration: ([\d.]+)", out)]
    return sum(1 for a, b in zip(starts, durs) if a > 0.05 and a + b < total - 0.05)


def qa_notes(qa_json: str | None) -> list[str]:
    """What the stored Whisper report says, in the same voice as the acoustic findings.

    A missing report is its own finding: `Store.revise` clears `qa_json` and drops the project
    back to DRAFT, so a revision made after a passing run leaves an artifact that looks finished
    in every listing and cannot be approved.
    """

    if not qa_json:
        return ["no QA report on this revision — it cannot be approved"]
    qa = json.loads(qa_json)
    if qa.get("passed") is True:
        return []
    failures = set(qa.get("dry", {}).get("failures", [])) | set(
        qa.get("final", {}).get("failures", [])
    )
    return [f"QA failed — {failure}" for failure in sorted(failures)] or ["QA failed"]


def plan_windows() -> dict[str, tuple[float, float]]:
    plan = yaml.safe_load((REPO / "data" / "listening-plan.yaml").read_text())
    out: dict[str, tuple[float, float]] = {}
    for unit in plan.get("units", []):
        for artifact in unit.get("artifacts", []):
            window = artifact.get("duration_seconds") or {}
            if "min" in window and "max" in window:
                out[artifact["id"]] = (float(window["min"]), float(window["max"]))
    return out


def main() -> None:
    store = Store()
    windows = plan_windows()
    wanted = set(sys.argv[1:])
    problems = 0

    for project in sorted(store.projects(), key=lambda p: p.id):
        if project.id == 1 or (wanted and project.slug not in wanted):
            continue
        _, stored, payload = store.get(project.id)
        revision = engine_revision(payload.tts_adapter)
        cache = store.root / "projects" / str(project.id) / "cache"
        notes: list[str] = []

        pitches: dict[str, list[float]] = {}
        for line in payload.lines:
            take = cache / f"{payload.cache_key(line, revision)}.wav"
            if not take.exists():
                notes.append(f"{line.id}: no take on disk")
                continue
            pitch = median_f0(take)
            if pitch:
                pitches.setdefault(line.speaker, []).append(pitch)

            total, lead, internal, trail = silence_split(take)
            voiced = total - lead - internal - trail
            words = len(line.display_text.split())
            if voiced > 0.3 and words / voiced < MIN_ARTICULATION:
                notes.append(f"{line.id}: {words / voiced:.2f} words/s of speech (floor {MIN_ARTICULATION})")
            if internal_gaps(take) >= HALT_GAPS:
                notes.append(f"{line.id}: halting — {internal_gaps(take)} internal gaps")

        for speaker, values in pitches.items():
            if len(values) >= 3 and max(values) - min(values) > DRIFT_HZ:
                notes.append(
                    f"{speaker}: pitch spans {max(values) - min(values):.1f} Hz "
                    f"({min(values):.0f}-{max(values):.0f}) over {len(values)} lines"
                )

        notes.extend(qa_notes(stored.qa_json))

        final = store.root / "projects" / str(project.id) / "final.wav"
        length = wav_duration(final) or 0.0
        window = windows.get(project.slug)
        if window and not (window[0] <= length <= window[1]):
            notes.append(f"length {length:.1f}s outside the plan's {window[0]:.0f}-{window[1]:.0f}s")

        status = "ok " if not notes else "!! "
        problems += bool(notes)
        print(f"{status}{project.slug:32s} {length:5.1f}s  [{project.stage}]")
        for note in notes:
            print(f"      {note}")

    print(f"\n{problems} artifact(s) with a finding")


if __name__ == "__main__":
    main()
