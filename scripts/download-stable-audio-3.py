# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "huggingface-hub>=0.34,<2",
# ]
# ///

"""Download the pinned Stable Audio 3 Small-SFX MLX weights for later offline use.

Sibling of `download-qwen3-tts.py` and deliberately the same shape: `snapshot_download` with
`local_dir=`, so the files land in `<repo>/.models/<repository name>/` where
`listening_studio.generative.locks.local_checkout` looks for them and can read the pinned commit
back out of the download metadata `huggingface_hub` writes beside them.

Two differences from the Qwen script, both load-bearing:

* **`revision=` is passed.** The Qwen download predates the check; here the engine refuses to run
  against a directory whose metadata does not say exactly this commit, so downloading `main`
  would produce an install that looks complete and is rejected.
* **`allow_patterns` is narrow.** `stabilityai/stable-audio-3-optimized` also carries the medium
  DiT, the music DiT, the SAME-L codec and the CPU-AMX shared objects — some 30 GB nothing here
  loads. The sm-sfx bundle plus the shared T5Gemma encoder is 1.8 GB.

The repository is **not gated**: it holds the pre-converted MLX bundles, while the PyTorch
checkpoint at `stabilityai/stable-audio-3-small-sfx` is the gated one and is not used here. A
Hugging Face token is therefore optional and only raises the anonymous download rate limit.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from huggingface_hub import snapshot_download

MODEL_ID = "stabilityai/stable-audio-3-optimized"
REVISION = "2204d5086475bd5b7e6e2bd720772dd8e8160513"
# The four bundles the sm-sfx text-to-audio path loads, plus the licence files, which are part of
# the download rather than an afterthought: the Community License is the reason this engine has a
# revenue condition, and it belongs on disk next to the weights it governs.
ALLOW_PATTERNS = [
    "MLX/dit_sm-sfx_f16.npz",
    "MLX/same_s_decoder_f32.npz",
    "MLX/same_s_encoder_f32.npz",
    "MLX/t5gemma_f16.npz",
    "LICENSE.md",
    "LICENSE_GEMMA.md",
    "NOTICE",
    "README.md",
]
PROJECT_ROOT = Path(__file__).resolve().parent.parent


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Download the pinned Stable Audio 3 MLX weights into a local directory."
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        help="destination (default: .models/<Hugging Face repository name>)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    output_dir = (
        args.output_dir.expanduser().resolve()
        if args.output_dir
        else PROJECT_ROOT / ".models" / MODEL_ID.rsplit("/", 1)[1]
    )
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"Downloading {MODEL_ID}@{REVISION[:12]}")
    print(f"Destination: {output_dir}")
    snapshot_download(
        repo_id=MODEL_ID,
        revision=REVISION,
        local_dir=output_dir,
        allow_patterns=ALLOW_PATTERNS,
    )
    print(f"Ready for offline use: {output_dir}")


if __name__ == "__main__":
    main()
