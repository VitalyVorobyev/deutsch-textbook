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
WAV audio, checks it with Whisper and speaker embeddings, and requires a real eight-point human review before `bundle` or
`publish` succeeds. Saving an edit creates a new revision and returns the project to `draft`.
`publish` refuses every existing target and requires `--yes` after reviewing the bundle.

The approval page shows everything those six checks are about, above the signature: both takes,
the questions as the learner meets them with the key marked, the QA table, the measured length
against the plan's `duration_seconds` window, and the script — collapsed, because reading along
makes a reviewer hear words that were never spoken. Declining is a button, not closing the tab.

Model weights are never downloaded implicitly by the editor. Use `models list` and
`models fetch <generator|qwen_tts|parler_tts|parler_text_tokenizer|asr|speaker_qa>`. Voice cloning,
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
reassigning voices per character and revalidating each payload before it is stored. Voice, fixed
seed and baseline style belong to the character profile. Lines expose only text/pronunciation,
delivery, pace and pause. “Neue Variante für diese Figur” changes the profile seed and invalidates
all and only that character's cached lines.

## Corpus voice-consistency repair

The migration is additive: immutable legacy revisions remain readable, while a new revision gets
deterministic character profiles (`100`, `105`, `110`, … by first-speaking order). It takes a
consistent database backup first and targets exactly the IDs in `data/listening-plan.yaml`:

```sh
uv run atlas-listening lock-voice-profiles --repo ../.. --dry-run
uv run atlas-listening lock-voice-profiles --repo ../.. --yes
uv run atlas-listening regenerate-voice-profile-corpus --repo ../.. --yes
uv run atlas-listening models fetch speaker_qa
uv run atlas-listening qa-voice-profile-corpus --repo ../.. --yes
```

WavLM is pinned to an immutable revision and loaded locally. It compares each measurable dry line
with the other lines of the same character and reports character centroids, different-character
similarity, and pitch spread as secondary evidence. Clips shorter than 0.5 seconds remain explicit
manual-review items. Scores are warnings, not verdicts. Only after all 41 new WAVs have the
expanded identity checklist may `calibrate-speaker-qa --yes` derive warning bounds from that
reviewed corpus. No example threshold is treated as course evidence.

Old approvals certify old bytes and do not transfer. Listen to each replacement without reading
the transcript first, then approve it in the Studio. `republish PROJECT_ID --repo ../.. --yes`
verifies the old slug/hash, retains the previous bundle under local application data, stages all
outputs, and atomically replaces the complete set or rolls back.

## Research-only voice benchmark

The six-dialogue CustomVoice versus synthetic VoiceDesign→Base-clone benchmark has a separate
model lock and writes only beneath local application data. The runner refuses course-repository
output and never imports the publisher. Its references use fictional non-imitation prompts and
record exact prompts, seeds, hashes, immutable model revisions, and the claim “synthetic
reference; no human recording.” It retains both dry arms, Whisper and speaker QA, runtime, peak
RSS, swap delta, randomized blind copies, a private answer key, and an empty review record.

```sh
uv run atlas-listening models fetch-benchmark voice_design
uv run atlas-listening models fetch-benchmark voice_clone
uv run atlas-listening benchmark-voice-consistency --yes
```

Benchmark output cannot be exported into the course. Any later adoption is a separate product,
policy, provenance, model-lock and export-safeguard decision.

### Consented human-reference experiment

An identifiable reference is never accepted by the synthetic benchmark or production Studio. A
separate command exists for explicitly consented, local technology evaluation. Reference, consent
and output must all live under the repository's gitignored `.private/` directory; the consent JSON
binds the exact reference SHA-256, purpose, retention and no-distribution rule. For a minor it must
also affirm guardian consent and child assent. The runner uses only pinned local weights, refuses
overwrite and cannot publish:

```sh
HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 uv run atlas-listening \
  experiment-human-voice-clone \
  --reference ../../.private/audio-research/subject/input/reference.m4a \
  --consent ../../.private/audio-research/subject/consent.json \
  --output ../../.private/audio-research/subject/output/run-id \
  --yes
```

The experiment compares full-reference and x-vector-only Qwen Base cloning, runs local Whisper and
WavLM diagnostics, retains exact hashes and produces a local `listen.html`. Metrics are review aids,
not identity, naturalness or publication approval.

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
and may mix at most four sources, each at -12 dB or quieter. Every placement is either a continuous
`bed` or a finite `event`. Beds loop with short fades until the dialogue ends; events play once.
New AI-assisted placements retain their concrete editorial reason and are never described as human
review. QA runs on both the dry speech and the final mix, reports bed/event counts, full-scene
coverage and measured pause-bed loudness, and approval includes a context-sound check. Publishing
carries the exact source, metadata, placement authorship and attribution in audio provenance.

The corpus repair is reviewable before mutation and creates a database backup:

```sh
uv run atlas-listening complete-soundscapes --repo ../.. --dry-run
uv run atlas-listening complete-soundscapes --repo ../.. --yes
uv run atlas-listening regenerate-voice-profile-corpus --repo ../.. --yes
uv run atlas-listening qa-voice-profile-corpus --repo ../.. --yes
```

The Studio home page is a dense React dashboard: A1/A2/B1 pipeline charts, dialogue
identity/separation scatter, reading pace/WER scatter, distributions and a ranked issue queue all
deep-link to exact projects. Recordings, Lesetexte, characters, environmental sources, agent drafts
and private research have separate navigation surfaces; FastAPI remains the workflow authority.

## Lesetext narration and roster

The 59 current Lesetexte (197 paragraphs) seed deterministically into four versioned narration
profiles. Synthesis caches paragraphs, assembles a master and exact cue points, then stops after
automatic QA. Pilot/level/all runs resume safely and never infer approval:

```sh
uv run atlas-listening seed-reading-corpus --repo ../.. --yes
uv run atlas-listening process-reading-corpus --repo ../.. --pilot --yes
uv run atlas-listening process-reading-corpus --repo ../.. --level A1 --yes
```

The reading review page asks the named editor to listen without the transcript first and binds the
checklist to the master SHA-256. Only then may `publish-reading PROJECT_ID --repo ../..` atomically
write the MP3, content record and provenance, backing up any previous local bundle. Learner pages
use the reviewed master as one seekable recording, highlight the active paragraph and keep system
TTS solely as a missing/error fallback.

`data/listening-characters.yaml` defines the 12-character roster, stable profiles, compatibility,
three comparison phrases and four narration-capable voices. Generate local pending demos with
`generate-character-demos --repo ../..`; portrait prompts are retained under `data/prompts/` and
catalog portrait paths remain empty until a human selects a candidate.

The curriculum-wide production specification is `data/listening-plan.yaml`; run
`bun run listening:inventory` at the repository root to see derived status without maintaining a
second status field.

On Python 3.12, install the Parler compatibility set with `./install-parler.sh`; it avoids the
upstream resolver's Python-incompatible `librosa` choice while retaining immutable Parler,
DAC and audiotools code revisions.

## Measured reliability

Qwen3-TTS on this machine (M4 Pro): MPS + explicit `dtype=torch.float32`, 86 float32 generations
with zero failures at warm RTF ≈ 1.0 and 3.3 GB resident. The 2026-08-01 "unreliable on this
machine" verdict was a dtype accident — `from_pretrained` without arguments never stated a device
or dtype, and float16 on MPS fails deterministically with the recorded error. Full record,
per-config numbers and the probe that reproduces them:
[`docs/quality/tts-reliability.md`](../../docs/quality/tts-reliability.md).

The fake adapter is only for automated workflow tests. Production generation, QA and approval
reject it.

## Validation

```sh
uv run ruff check .
uv run mypy
uv run pytest
```

The A2 sample remains an editable fixture, not curriculum content. No agent or test marks its real
output human-approved.
