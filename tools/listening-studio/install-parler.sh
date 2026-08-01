#!/bin/sh
set -eu

# The pinned upstream projects declare librosa 0.6.2, which cannot build on Python 3.12.
# Install the reviewed modern runtime first, then immutable upstream code without stale deps.
uv pip install --constraint model-constraints.txt --requirement requirements-parler.txt
uv pip install --no-deps descript-audio-codec==1.0.0
uv pip install --no-deps \
  'descript-audiotools @ git+https://github.com/descriptinc/audiotools@348ebf2034ce24e2a91a553e3171cb00c0c71678'
uv pip install --no-deps \
  'parler-tts @ git+https://github.com/huggingface/parler-tts.git@d108732cd57788ec86bc857d99a6cabd66663d68'
