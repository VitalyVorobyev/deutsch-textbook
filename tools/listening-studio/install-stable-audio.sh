#!/bin/sh
set -eu

# Stable Audio 3 Small-SFX is the sound engine for generated context audio and ambience.
#
# Three installs, in dependency order: the Python runtime, the adapter code, the weights. Each is
# pinned, and the engine checks all three before it will generate — the two downloads come from
# two hosts, and an install that got one of them is exactly the state a single "is it installed"
# check would report as ready.

CODE_REVISION="a0b57f5483c4588f827f3552b7d5c6ca2a9687be"
WEIGHTS_ID="stabilityai/stable-audio-3-optimized"
WEIGHTS_REVISION="2204d5086475bd5b7e6e2bd720772dd8e8160513"

STUDIO="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$STUDIO/../.." && pwd)"
ADAPTER="$REPO/.models/stable-audio-3-mlx"
WEIGHTS="$REPO/.models/$(basename "$WEIGHTS_ID")"

# 1. Runtime. Into the studio's own venv, not a second one: the only package this adds is
# sentencepiece — mlx is already here for mlx-lm and mlx-whisper — and nothing it pins moves a
# version the Qwen runtime depends on. The engine runs `sys.executable`, so this is the
# interpreter that has to be able to import mlx.
cd "$STUDIO"
uv pip install --constraint model-constraints.txt --requirement requirements-stable-audio.txt

# 2. Adapter code. Upstream publishes no package for `optimized/mlx`, so the pinned commit is
# unpacked from the GitHub source tarball — the sha is in the URL, which is what makes the
# extracted tree provably that commit. The stamp is written last, so an interrupted download
# leaves an unstamped directory the engine refuses rather than a half tree it would run.
rm -rf "$ADAPTER"
mkdir -p "$ADAPTER"
curl -fsSL "https://codeload.github.com/Stability-AI/stable-audio-3/tar.gz/$CODE_REVISION" \
  | tar -xz -C "$ADAPTER" --strip-components=3 "stable-audio-3-$CODE_REVISION/optimized/mlx"
printf 'Stability-AI/stable-audio-3@%s\n' "$CODE_REVISION" > "$ADAPTER/revision.txt"

# 3. Weights, at the pinned revision, into <repo>/.models/ where `locks.local_checkout` verifies
# the commit from the download metadata before any generation.
uv run --no-project --with 'huggingface-hub>=0.34,<2' \
  python "$REPO/scripts/download-stable-audio-3.py"

# 4. Link them where upstream expects to find them. Symlinks, so one copy of 1.8 GB sits on disk
# and `weights.ensure_local` short-circuits instead of downloading `main` over a pinned file.
mkdir -p "$ADAPTER/models/mlx"
for npz in dit_sm-sfx_f16.npz same_s_decoder_f32.npz same_s_encoder_f32.npz t5gemma_f16.npz; do
  ln -sf "$WEIGHTS/MLX/$npz" "$ADAPTER/models/mlx/$npz"
done

uv run python -c "
from pathlib import Path
from listening_studio.generative.locks import set_models_root
from listening_studio.generative.stable_audio_mlx import StableAudioSfx
set_models_root(Path('$REPO'))
print(f'sound engine ready: {StableAudioSfx().entry_point()}')
"
