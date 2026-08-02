# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "huggingface-hub>=0.34,<2",
# ]
# ///

"""Download a Qwen3-TTS 0.6B checkpoint for later offline use."""

from __future__ import annotations

import argparse
from pathlib import Path

from huggingface_hub import snapshot_download


MODEL_IDS = {
    "custom-voice": "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice",
    "base": "Qwen/Qwen3-TTS-12Hz-0.6B-Base",
}
PROJECT_ROOT = Path(__file__).resolve().parent.parent


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Download Qwen3-TTS 0.6B weights into a local directory."
    )
    parser.add_argument(
        "--variant",
        choices=MODEL_IDS,
        default="custom-voice",
        help="custom-voice uses built-in speakers; base supports voice cloning",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        help="destination (default: .models/<Hugging Face repository name>)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    model_id = MODEL_IDS[args.variant]
    output_dir = (
        args.output_dir.expanduser().resolve()
        if args.output_dir
        else PROJECT_ROOT / ".models" / model_id.rsplit("/", 1)[1]
    )
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"Downloading {model_id}")
    print(f"Destination: {output_dir}")
    snapshot_download(repo_id=model_id, local_dir=output_dir)
    print(f"Ready for offline use: {output_dir}")


if __name__ == "__main__":
    main()
