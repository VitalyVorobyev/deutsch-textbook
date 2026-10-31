# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "huggingface-hub>=0.34,<2",
# ]
# ///

"""Download a Qwen3-TTS checkpoint, at its pinned revision, for later offline use.

The revision comes from the engine's `models.lock.json` — the same row the engine loads and a
published manifest names. `listening_studio.generative.locks.local_checkout` accepts a
`.models/<repository name>/` directory only when its download metadata states exactly that
commit, so a download of `main` would look complete and be refused.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from huggingface_hub import snapshot_download


#: The command-line variant, and the `models.lock.json` row that pins it.
LOCK_KEYS = {
    "custom-voice": "qwen_tts",
    "base": "qwen_tts_base",
    # The designed voices: the checkpoint every roster character is cloned on, and the one that
    # speaks a new designed reference.
    "base-1.7b": "qwen_tts_designed",
    "voice-design": "qwen_tts_voice_design",
    # A candidate of `atlas-listening evaluate voices` only, pinned with `"scope": "evaluation"`.
    "custom-voice-1.7b": "qwen_tts_1_7b",
}
PROJECT_ROOT = Path(__file__).resolve().parent.parent
MODEL_LOCK = PROJECT_ROOT / "apps" / "tonwerk" / "engine" / "models.lock.json"


def pinned(variant: str) -> tuple[str, str]:
    """`(repository id, revision)` for one variant, read from the engine's model lock."""

    spec = json.loads(MODEL_LOCK.read_text())["models"][LOCK_KEYS[variant]]
    return str(spec["id"]), str(spec["revision"])


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Download pinned Qwen3-TTS weights into a local directory."
    )
    parser.add_argument(
        "--variant",
        choices=LOCK_KEYS,
        default="custom-voice",
        help="custom-voice uses built-in speakers; base clones a consented voice; base-1.7b "
        "speaks the roster's designed voices and voice-design makes their references; "
        "custom-voice-1.7b is an evaluation candidate",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        help="destination (default: .models/<Hugging Face repository name>)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    model_id, revision = pinned(args.variant)
    output_dir = (
        args.output_dir.expanduser().resolve()
        if args.output_dir
        else PROJECT_ROOT / ".models" / model_id.rsplit("/", 1)[1]
    )
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"Downloading {model_id}@{revision}")
    print(f"Destination: {output_dir}")
    snapshot_download(repo_id=model_id, revision=revision, local_dir=output_dir)
    print(f"Ready for offline use: {output_dir}")


if __name__ == "__main__":
    main()
