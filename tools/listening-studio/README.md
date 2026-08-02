# Deutsch-Atlas Listening Studio

Local-first authoring for reviewed, committed listening exercises. The CLI starts a private
FastAPI editor on `127.0.0.1`; projects and immutable revisions live in SQLite under the macOS
application-data directory. No learner state or audio is uploaded.

## Start

```sh
cd tools/listening-studio
uv sync --extra test
uv run atlas-listening doctor
uv run atlas-listening import-project examples/a2-zwei-sprecher/project.json a2-zwei-sprecher
uv run atlas-listening serve --repo ../..
```

The editor accepts an Atlas brief, edits structured lines/questions, caches each line, assembles
WAV audio, checks it with Whisper, and requires a real six-point human review before `bundle` or
`publish` succeeds. Saving an edit creates a new revision and returns the project to `draft`.
`publish` refuses every existing target and requires `--yes` after reviewing the bundle.

Model weights are never downloaded implicitly by the editor. Use `models list` and
`models fetch <generator|qwen_tts|parler_tts|parler_text_tokenizer|asr>`. Voice cloning,
reference audio, VoiceDesign and music have no API or UI surface.

## Synthesis engine

**Qwen3-TTS is the engine.** `./install-qwen.sh` installs it; `./install-parler.sh` puts Parler
back. They cannot be installed at the same time — `qwen_tts` needs `transformers >= 4.48`
(`ALL_ATTENTION_FUNCTIONS`) and `parler-tts` is pinned to 4.46.1 — so switching engines is a
reinstall, not a setting. Parler produced Wave 1 and stays in the code and in `models.lock.json`
because the manifests of that audio name it; new projects are seeded on Qwen (`cli.ENGINE`).

The upstream package is installed with `--no-deps` on purpose: its declared dependencies pull
gradio, which would move `fastapi` and `starlette` past the pins the Studio's own web layer uses.
`requirements-qwen-runtime.txt` lists what the generation path actually loads, derived from
`sys.modules` after a real `generate_custom_voice()` call rather than from the package metadata.

Weights downloaded by `scripts/download-qwen3-tts.py` land in `<repo>/.models/`, which the Hub
cache does not index. `adapters.local_checkout` finds them there and **verifies the pinned
revision** from the per-file download metadata before use — a directory is never accepted on its
name alone, because the published manifest states that revision as fact.

`atlas-listening switch-adapter <adapter> [--dry-run]` moves every existing project at once,
reassigning voices per speaker and revalidating each payload before it is stored. The assignment
only keeps speakers apart; pick the actual voices per line in the editor.

## Context sounds

Freesound is supported only as a manual, reviewed source; the studio never calls its API. Download
the original from its public sound page, complete the metadata template, then import it locally:

```sh
uv run atlas-listening sources import ~/Downloads/room-tone.wav \
  --metadata examples/freesound-source.example.json
uv run atlas-listening sources list
```

Only CC0 1.0 and CC BY 4.0 are accepted. Originals over 10 MB, music, intelligible speech,
brands, personal data and uncertain uploads are rejected. A project references an imported SHA-256
and may mix at most four short excerpts, each at -12 dB or quieter. QA runs on both the dry speech
and the final mix; approval gains an additional context-sound check. Publishing carries the exact
source, metadata and attribution alongside the audio provenance.

The curriculum-wide production specification is `data/listening-plan.yaml`; run
`bun run listening:inventory` at the repository root to see derived status without maintaining a
second status field.

On Python 3.12, install the Parler compatibility set with `./install-parler.sh`; it avoids the
upstream resolver's Python-incompatible `librosa` choice while retaining immutable Parler,
DAC and audiotools code revisions.

## Measured M4 Pro notes (2026-08-01)

Machine: MacBook Pro M4 Pro, 12 CPU cores, 24 GB unified memory, macOS 26.5.2.

- Qwen3-TTS 0.6B CustomVoice, official code `022e286…`, PyTorch 2.13 MPS: model load
  **3.455 s**, maximum resident memory **2.98 GB**, no swap. The German smoke line failed after
  **53.16 s** with `torch.AcceleratorError` (`inf`/`nan` probabilities). The pinned official
  repository exposes no MLX extra, so Qwen is recorded as unreliable on this machine.
- Parler-TTS fallback, exact revision `11b27d5…`: immutable 3.75 GB fetch **291 s**. The four-line
  sample synthesized in approximately **170 s** to **21.444 s** of audio (observed RTF ≈ **7.9**);
  cached reassembly took **0.088 s**. Post-QA server RSS was **1.84 GB**; this run did not capture
  a trustworthy peak-RSS or swap delta, so neither is claimed.
- MLX Whisper QA normalized spoken number words against digits. Full-audio WER was **6.98%**, but
  only **2/4 lines passed**: line 3 omitted the protected token *können* and line 4 had **37.5%**
  WER. The fallback therefore fails the fixed 90% line-pass gate on this sample. The checked WAV,
  QA record and non-approved provenance are retained in `examples/a2-zwei-sprecher/`; they are not
  publishable curriculum audio.
- The fake adapter is only for automated workflow tests. Production generation, QA and approval
  reject it.

## Validation

```sh
uv run ruff check .
uv run mypy
uv run pytest
```

The A2 sample remains an editable fixture, not curriculum content. No agent or test marks its real
output human-approved.
