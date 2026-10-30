"""What this machine can do: the toolchain, the model runtimes and the pinned weights.

One report for two readers. `atlas-listening doctor` prints it, and `GET /api/doctor` hands it to
Tonwerk, which shows a missing piece where the operator is looking instead of in a terminal the
desktop app never opened.

Every check carries the command that fixes it. **Required** means the engine cannot render at all
without it (ffmpeg and ffprobe are the render pipeline). The runtimes and the weights are needed
only by the stage that uses them, so the studio is browsable without any of them — and a `uv sync`
silently removes the speech runtime, which is the failure this report exists to make visible.
"""

from __future__ import annotations

import importlib.util
import shutil
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

from .generative.locks import locked_snapshot, model_lock, models_root

PACKAGE_ROOT = Path(__file__).resolve().parents[2]

#: Each pinned model a render or a check loads, and how it gets onto the disk. The two Qwen
#: checkpoints and Stable Audio come with their installers; the other two are plain `models fetch`
#: downloads into the Hub cache. A lock row outside this table is a pin the engine no longer
#: loads, and reporting it missing would be noise.
MODELS = {
    "qwen_tts": "uv run scripts/download-qwen3-tts.py",
    "qwen_tts_base": "uv run scripts/download-qwen3-tts.py --variant base",
    "stable_audio_sfx": "cd apps/tonwerk/engine && ./install-stable-audio.sh",
    "asr": "cd apps/tonwerk/engine && uv run atlas-listening models fetch asr",
    "speaker_qa": "cd apps/tonwerk/engine && uv run atlas-listening models fetch speaker_qa",
}

#: The importable runtime each stage needs, with its installer. `uv sync` keeps only what
#: `pyproject.toml` declares, and neither Qwen nor Stable Audio is declared there.
RUNTIMES = (
    ("qwen_tts", "Sprache (Qwen3-TTS)", "cd apps/tonwerk/engine && ./install-qwen.sh"),
    ("torch", "PyTorch", "cd apps/tonwerk/engine && ./install-qwen.sh"),
    (
        "mlx_whisper",
        "Spracherkennung (mlx-whisper)",
        "cd apps/tonwerk/engine && uv sync --extra test --extra mlx && ./install-qwen.sh",
    ),
    (
        "sentencepiece",
        "Klang (Stable Audio)",
        "cd apps/tonwerk/engine && ./install-stable-audio.sh",
    ),
)


@dataclass(frozen=True)
class Check:
    name: str
    group: str
    ok: bool
    detail: str
    fix: str | None
    required: bool


def _tool(name: str, fix: str, required: bool) -> Check:
    found = shutil.which(name)
    return Check(name, "werkzeug", found is not None, found or "nicht gefunden", fix, required)


def _runtime(module: str, label: str, fix: str) -> Check:
    # `find_spec` and not an import: importing torch costs seconds and the report is read on
    # every Übersicht load.
    found = importlib.util.find_spec(module) is not None
    return Check(module, "laufzeit", found, label if found else f"{label} fehlt", fix, False)


def _model(name: str, spec: dict[str, object]) -> Check:
    files = spec.get("files")
    try:
        path = locked_snapshot(
            str(spec["id"]),
            str(spec["revision"]),
            [str(value) for value in files] if isinstance(files, list) else None,
        )
    except RuntimeError:
        return Check(
            name,
            "modell",
            False,
            f"{spec['id']}@{str(spec['revision'])[:12]} fehlt",
            MODELS[name],
            False,
        )
    return Check(name, "modell", True, path, None, False)


def doctor_report() -> dict[str, object]:
    """Every check, and whether the required ones all pass.

    Weights are looked for under the repository `set_models_root` named, so the report agrees
    with what a render would find.
    """

    checks = [
        _tool("ffmpeg", "brew install ffmpeg", True),
        _tool("ffprobe", "brew install ffmpeg", True),
        _tool("git", "xcode-select --install", False),
        Check("python", "werkzeug", True, sys.version.split()[0], None, True),
    ]
    checks += [_runtime(module, label, fix) for module, label, fix in RUNTIMES]
    locked = model_lock(PACKAGE_ROOT / "models.lock.json")["models"]
    if isinstance(locked, dict):
        checks += [
            _model(name, spec)
            for name, spec in locked.items()
            if name in MODELS and isinstance(spec, dict)
        ]
    return {
        "ok": all(check.ok for check in checks if check.required),
        "models_root": str(models_root()),
        "checks": [asdict(check) for check in checks],
    }
