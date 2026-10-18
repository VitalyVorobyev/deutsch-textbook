"""Automatic QA for a rendered scene: is this take what the script says it is?

Three diagnostics, and each one answers a question the other two cannot.

* **Transcripts** — Whisper against `qa.wav`, per utterance and whole. The per-utterance slices
  are cut out of `qa.wav` using the render manifest's timing table rather than transcribed from
  the individual takes, because the mix is what a learner hears: a bed that buries a word is a
  defect of the *scene*, and a take-by-take check would pass it.
* **Speaker consistency** — WavLM over the same slices, when the pinned weights are on this
  machine. When they are not, the report says `"weights-missing"` in that field. Never nothing.
* **Soundscape** — the bed level in the final mix, measured against `dry.wav` (the dialogue bus
  alone, loudness-normalised the same way), plus the configured coverage the scene asked for.

Whisper here is MLX and macOS-local. `transcribe_fn` is injected so the unit tests can run in an
environment that has never seen torch; the CLI passes `adapters.transcribe` and fails fast with a
readable message when that import is not available.
"""

from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Callable, Mapping

from ..domain import QAReport
from ..qa import check_units
from ..scene.model import AmbienceEntry, Scene, SfxEntry
from ..soundscape import SoundscapeReport, ambience_rms_dbfs
from ..speaker_qa import EmbeddingBackend, check_unit_consistency, weights_available
from .nodes import QA_CHANNELS, QA_CODEC, QA_RATE

#: What the `speaker_qa` field says when the check did not run. A marker, not an omission: an
#: absent field reads as a report that passed identity, and this one has to read as a report that
#: never asked.
WEIGHTS_MISSING = "weights-missing"
RUNTIME_MISSING = "runtime-missing"

Transcriber = Callable[[Path], str]


def _slice(source: Path, target: Path, start_ms: int, end_ms: int) -> None:
    """One utterance cut out of the QA derivative, at the QA format.

    `atrim` rather than input seeking: `-ss` before `-i` seeks to the nearest packet, which for a
    16 kHz PCM file is exact but for anything else is not — and the cut boundaries here come from
    a timing table that is exact by construction.
    """

    subprocess.run(
        [
            "ffmpeg", "-v", "error", "-i", str(source),
            "-filter:a",
            f"atrim=start={start_ms / 1000:.3f}:end={end_ms / 1000:.3f},asetpts=PTS-STARTPTS",
            "-ar", str(QA_RATE), "-ac", str(QA_CHANNELS), "-c:a", QA_CODEC, "-y", str(target),
        ],
        check=True,
    )


def scene_soundscape(scene: Scene, render: Mapping[str, Any], directory: Path) -> SoundscapeReport:
    """The scene's own soundscape report, in the shape the dialogue pipeline already publishes.

    The numbers are read off the scene rather than off a `ContextSound` list: beds are ambience
    entries and events are sfx entries, which is the distinction the legacy manifests had to
    infer from a duration threshold (`scene.convert.EVENT_MAX_DURATION_MS`) because they had no
    word for it.
    """

    beds = [entry for entry in scene.timeline if isinstance(entry, AmbienceEntry)]
    events = [entry for entry in scene.timeline if isinstance(entry, SfxEntry)]
    duration_ms = int(render.get("duration_ms") or 0)
    spans = {row["entry_id"]: row for row in render.get("timeline", [])}
    event_ms = sum(
        int(row["end_ms"]) - int(row["start_ms"])
        for entry_id, row in spans.items()
        if row["type"] == "sfx"
    )
    coverage = 1.0 if beds else (min(1.0, event_ms / duration_ms) if duration_ms else 0.0)
    warnings: list[str] = []
    if not beds:
        warnings.append("no continuous environment bed; the scene falls silent between events")
    gains = [entry.gain_db for entry in beds] + [entry.gain_db for entry in events]
    # Lead-in is 0 here and that is not an oversight. The legacy mixer delayed the speech *at mix
    # time*, so its `dry` was un-delayed and the diagnostic had to compensate; a scene's speech
    # stems carry their own `adelay`, so `dry.wav` and `master.wav` already share a time origin.
    #
    # One caveat this figure carries, stated rather than hidden: the two files are loudness-
    # normalised independently, so the level it reports is the bed's level in the *master*, not
    # the bed-to-speech ratio. It ranks scenes against each other; it is not an absolute claim,
    # which is the same footing the dialogue pipeline's copy of this number stands on.
    measured = (
        ambience_rms_dbfs(directory / "dry.wav", directory / "master.wav", 0)
        if beds or events
        else None
    )
    return SoundscapeReport(
        bed_count=len(beds),
        event_count=len(events),
        continuous_ambience=bool(beds),
        configured_coverage_ratio=coverage,
        configured_gain_min_db=min(gains) if gains else None,
        configured_gain_max_db=max(gains) if gains else None,
        measured_ambience_rms_dbfs=measured,
        warnings=warnings,
    )


def scene_qa(
    scene: Scene,
    directory: Path,
    *,
    transcribe_fn: Transcriber,
    embedding_backend: EmbeddingBackend | None = None,
    speaker_qa: bool = True,
) -> dict[str, Any]:
    """Run every automatic check over one rendered scene directory."""

    manifest_path = directory / "render.json"
    if not manifest_path.exists():
        raise ValueError(f"{directory} holds no render.json; render the scene before QA")
    render: dict[str, Any] = json.loads(manifest_path.read_text())
    qa_wav = directory / "qa.wav"
    if not qa_wav.exists():
        raise ValueError(f"{directory} holds no qa.wav; re-render the scene")

    timing = render.get("timing") or []
    expected = [(scene.utterance(row["utterance_id"]).id, scene.utterance(row["utterance_id"]).spoken_text()) for row in timing]

    with tempfile.TemporaryDirectory(prefix="scene-qa-") as raw:
        work = Path(raw)
        slices: dict[str, Path] = {}
        for row in timing:
            target = work / f"{row['utterance_id']}.wav"
            _slice(qa_wav, target, int(row["start_ms"]), int(row["end_ms"]))
            slices[str(row["utterance_id"])] = target
        transcripts = {unit_id: transcribe_fn(path) for unit_id, path in slices.items()}
        full_transcript = transcribe_fn(qa_wav)
        report: QAReport = check_units(
            expected,
            transcripts,
            vocabulary=scene.brief.vocabulary if scene.brief else (),
            grammar_target=scene.brief.grammar_target if scene.brief else None,
            full_transcript=full_transcript,
        )
        identity = _speaker_section(scene, slices, embedding_backend, speaker_qa)

    soundscape = scene_soundscape(scene, render, directory)
    return {
        "passed": report.passed,
        "scene_sha256": render.get("scene_sha256"),
        "variant": render.get("variant"),
        "transcripts": report.model_dump(mode="json"),
        "speaker_qa": identity,
        "soundscape": soundscape.model_dump(mode="json"),
        "timing": timing,
    }


def _speaker_section(
    scene: Scene,
    slices: Mapping[str, Path],
    backend: EmbeddingBackend | None,
    enabled: bool,
) -> Any:
    if not enabled:
        return "not-requested"
    if backend is None and not weights_available():
        return WEIGHTS_MISSING
    units = [(utterance.id, utterance.role) for utterance in scene.script if utterance.id in slices]
    speakers = [member.role for member in scene.cast]
    try:
        return check_unit_consistency(
            units, speakers, dict(slices), backend=backend
        ).model_dump(mode="json")
    except RuntimeError:
        # The weights are on disk but the torch/transformers runtime that reads them is not.
        # A different absence from a missing checkout, and worth saying so separately.
        return RUNTIME_MISSING
