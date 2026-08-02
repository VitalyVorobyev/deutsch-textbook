#!/bin/sh
set -eu

# Qwen3-TTS is the generation engine for the reviewed listening corpus.
#
# It needs transformers >= 4.48 (`ALL_ATTENTION_FUNCTIONS`), while parler-tts is pinned to
# 4.46.1 — the two genuinely cannot share a virtualenv. Running this therefore ENDS Parler
# generation in this environment; ./install-parler.sh puts it back.
#
# `--no-deps` on the upstream package is not an optimisation. Its declared dependency set pulls
# gradio, which would move fastapi 0.116 -> 0.141 and starlette 0.47 -> 1.3, past the pins the
# Studio's own web layer is built on. The demo UI is never imported on the generation path.
uv pip install --constraint model-constraints.txt --no-deps --requirement requirements-qwen.txt
uv pip install --constraint model-constraints.txt --requirement requirements-qwen-runtime.txt

# Weights: scripts/download-qwen3-tts.py puts them in <repo>/.models/, which the Hub cache does
# not index — `adapters.local_checkout` finds them there and verifies the pinned revision from
# the download metadata before use.
uv run python -c "
from listening_studio.adapters import QwenTTS, local_checkout
found = local_checkout('Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice', QwenTTS.revision)
print(f'checkpoint {QwenTTS.revision[:12]}: {found or \"NOT FOUND — run scripts/download-qwen3-tts.py\"}')
"
