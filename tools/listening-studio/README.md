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
`models fetch <generator|qwen_tts|asr|speaker_qa>`. Voice cloning,
reference audio, VoiceDesign and music have no API or UI surface.

## Synthesis engine

**Qwen3-TTS is the engine**, and `./install-qwen.sh` installs it. New projects are seeded on it
(`cli.ENGINE`); `fake` is the deterministic-silence engine the workflow tests run on and cannot
produce approvable audio.

Every engine is reached through one contract — `generative/gateway.py`: an engine-neutral
`SpeechRequest`, an `AudioAsset` carrying the WAV's hash and its provenance, and the
`SpeechGenerator`/`SoundGenerator` protocols. Engines return the model's raw output; pace,
resampling and mixing happen afterwards in `adapters.py`, so one take can be re-paced or re-placed
without asking the model again. `QwenSpeech.supports_style` is `False`, and the synthesis path
warns once per run when a styled line meets it: the 0.6B checkpoint discards `instruct` upstream,
so a delivery note is stored, hashed and inaudible.

**Parler is gone** — the engine, its installer, its requirements and its lock entries. Git history
keeps it, published artifacts keep the provenance manifests naming it, and local projects created
in the Parler era are frozen data that this code no longer loads.

The upstream package is installed with `--no-deps` on purpose: its declared dependencies pull
gradio, which would move `fastapi` and `starlette` past the pins the Studio's own web layer uses.
`requirements-qwen-runtime.txt` lists what the generation path actually loads, derived from
`sys.modules` after a real `generate_custom_voice()` call rather than from the package metadata.

Weights downloaded by `scripts/download-qwen3-tts.py` land in `<repo>/.models/`, which the Hub
cache does not index. `generative.locks.local_checkout` finds them there and **verifies the pinned
revision** from the per-file download metadata before use — a directory is never accepted on its
name alone, because the published manifest states that revision as fact. Which repository is
searched is stated, not guessed: `--repo` sets it through `set_models_root`, and the derivation
from this package's own path is only the fallback for commands that take no `--repo`.

`atlas-listening switch-adapter <qwen_tts|fake> [--dry-run]` moves every existing project at once,
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

## Scene v1

`RevisionPayload` describes a dialogue and `ReadingRevisionPayload` describes a narration, and
both carry a voice identity, a per-turn pace, a pause and a pronunciation override list under
different names. A **scene** is the shape both are special cases of: a cast, a script, and one
timeline that speech, one-shot sound and ambience are all placed on
(`src/listening_studio/scene/`). It runs beside the two older models — nothing about the current
forms, export or QA changed — until later PRs reach parity.

The published contract is `packages/schema/schemas/audio-scene.v1.schema.json`, regenerated by
`scene schema` and held byte-identical by `tests/test_scene_schema.py`; two converted scenes sit
in `schemas/fixtures/` as the cross-language examples. Conversion from the shipped corpus is
total and lossless — all 40 published dialogues and all 85 Lesetexte — and is exercised over the
real corpus rather than over fixtures, because 25 of the 40 dialogues predate voice profiles and
carry a different seed on every line of one speaker, which is preserved as
`Utterance.seed_override` rather than flattened.

```sh
uv run atlas-listening scene from-dialogue a1/ls-erste-schritte-01 --repo ../.. --out scene.json
uv run atlas-listening scene from-reading a1/erste-schritte --repo ../.. --import --json
uv run atlas-listening scene validate scene.json --json
uv run atlas-listening scene validate scene.json --repo ../.. --json   # + acoustic-id warnings
uv run atlas-listening scene create --from scene.json --exercise scene.exercise.json --json
uv run atlas-listening scene show ls-erste-schritte-01 --json
uv run atlas-listening scene schema --repo ../.. --check
```

The store gained `scene_projects` and `scene_revisions` (Alembic 0003), and the reading tables
that had only ever been created by `Base.metadata.create_all` gained the migration they never
had (0002). `Store.__init__` now runs `alembic upgrade head`, stamping a pre-Alembic database at
0001 first, so an existing local corpus is adopted rather than rebuilt.

## The render graph

A scene is not rendered by a script that walks it; it is compiled to a graph of nodes and only
the nodes whose inputs changed are evaluated (`src/listening_studio/graph/`). Every node is
identified by

```text
node_hash = sha256(type + ":" + impl_version + ":" + canonical_json(params) + ":" + sorted(inputs))
```

and its output is stored by the hash of its own bytes under `assets/<sha256>.wav`, with a
provenance sidecar beside it. **Each node type carries its own `impl_version`** — bumping one
invalidates exactly that class of computation, which is what the single global
`processor_version` on the legacy line cache could not do: one DSP fix there threw away every
take. Imported Freesound originals are *referenced*, never copied: the sidecar names the source
sha and the licence id, and `sources/<sha>/source.json` stays the one reviewed record.

```sh
uv run atlas-listening scene render ls-wohnen-01 --repo ../.. --json
uv run atlas-listening scene qa ls-wohnen-01 --repo ../.. --json
```

Layout, under the studio work directory: `renders/<scene-sha256>/<variant>/` holds
`stems/<entry-id>.wav`, `master.wav`, `dry.wav`, `qa.wav`, `publish.mp3` and `render.json`. The
manifest carries every node hash and impl version, every asset sha and its provenance, the
`models.lock.json` rows for the engines that ran, the ffmpeg version captured at render time, and
the **timing table** — one `{utterance_id, start_ms, end_ms}` per turn, which is the
generalization of the narration `ParagraphCue` and the cue source for publishing. Stems and
masters are kept per scene sha forever; nothing here deletes a render.

Formats: the working master is stereo 48 kHz `pcm_s24le`. A 24 kHz model take upsampled to 48 kHz
is a resample and not new detail — 48 kHz is the rate the mix is *computed* at, so resampling
happens once before summing rather than once per bus. Two derivatives are always produced:
`qa.wav` (mono 16 kHz, the only format Whisper and WavLM are given here) and `publish.mp3`
(stereo 48 kHz at 128 kbps — the shipped corpus's 64 kbps *mono* per-channel rate, doubled for the
channel count).

Placement is constant-power panning (`cos`/`sin`), so a voice keeps its level as it moves. A
`SoundSpec` reached without a sound generator is refused with a `ValueError`, never warned about
and rendered anyway: production renders have no generator until the Stable Audio PR, and silence
where a sound was asked for is a defect nobody can hear.

## Acoustics: rooms, devices and difficulty

Everything else a scene can say about acoustics is **data**, in two files at the repository root,
interpreted by `src/listening_studio/dsp/`. No generative model is involved anywhere in this
layer, which is the split the concept document argues for in §2 and §15.

`data/acoustic-profiles.yaml` holds seven **rooms** (`studio`, `small-room`, `cafe`, `office`,
`station-hall`, `street`, `car`) and five **devices** (`telephone`, `mobile`, `pa`, `radio`,
`next-room`). A room is five numbers — seed, RT60, pre-delay, damping cutoff, early-reflection
count — from which `dsp/ir.py` synthesises a 48 kHz mono impulse response: seeded noise under an
exponential decay with a swept one-pole damping filter, deterministic to the byte and stored as a
content-addressed asset with the whole recipe in its provenance sidecar. It is normalised to
**unit energy** and convolved with `afir=irnorm=-1`, so the same `wet` figure returns the same
level in every room: measured against a 4 s noise stem, all seven land within 0.21 dB of each
other, where afir's default L1 normalisation put `car` and `station-hall` 12 dB apart. A device
is named acoustic parameters — band edges with a section count, compression in dB and ms, an
optional bit crush, a room-send level, a gain offset — never an ffmpeg string; `dsp/chains.py`
owns the translation, including dB to `acompressor`'s linear threshold and makeup.

`data/acoustic-difficulty.yaml` holds three **presets** (`clean`, `natural`, `challenging`), and
every field is a **delta against what the scene's author wrote**, never an absolute:
`ambience_gain_db`, `wet`, `distance`, `pace`, `overlap_ms`. `natural` is exactly the identity.
The concept document's §16 table is in absolutes, and the deltas reproduce it for a scene authored
at `AmbienceEntry.gain_db`'s default of -24 dB: clean −11 → −35 dB of background, challenging
+6 → −18 dB. A `DifficultyVariant.overrides` replaces individual deltas by the same key names, and
a key outside the vocabulary is refused with the vocabulary named.

In the graph: a device chain and the distance formula (−6 dB per doubling, a lowpass inversely
proportional to distance, and a larger send into the room) go into the **track** node's filter
chain; the room is a **send-return on the mix** — every dialogue and sfx stem is split, its send
gain applied, the sum convolved by a single `afir` and added to the master at the room's resolved
wet level. **The ambience bus is never sent**: a recorded room tone already is a room. One
convolution per render however many stems there are, and a distant speaker is still wetter than a
close one because the send is per stem.

Node identity carries all of it, and the rules are: a stem with no device and unit distance keeps
the hash it had before this layer existed (`fx` is omitted, not written as `""`); a `send_db` is
in the mix hash only when there is a room to send to; and each profile's editorial `version` is a
hashed parameter, so bumping a version retires the cached audio even when no number changed.
`render.json` gains an `acoustics` block: preset and room ids with their versions, every resolved
delta, the resolved wet level, and the sha of each impulse response convolved.

Unknown room, device and preset ids are **refused at render time with the path of the file that
would have to define them** — before any synthesis runs. Scene documents themselves stay valid
standalone (holding a published scene against a catalog it does not ship with would make it
invalid on any older checkout), so the same check is offered as a *warning* by
`scene validate <file> --repo ../..`.

The difficulty layer is measured rather than listened to. `tests/test_dsp_chains.py` pushes seeded
broadband noise through the real `telephone` chain and asserts by FFT that both stopbands are at
least 20 dB below the passband — measured −22.5 dB below 250 Hz and −27.9 dB above 4 kHz on
ffmpeg 9.0.1. Noise rather than a swept sine on purpose: a sweep presents the chain with one tone
at a time, and the compressor's gain modulation on a single tone generates harmonics that land in
the stopbands, so a sweep would measure the compressor's distortion rather than the channel's
band.

`scene qa` transcribes `qa.wav` whole and per utterance — the slices are cut from the **mix**
using the timing table, because a bed that buries a word is a defect of the scene and a
take-by-take check would pass it — then measures speaker consistency against the same slices and
reports the soundscape by comparing the master with `dry.wav`, the dialogue bus alone. The
transcript thresholds are `qa.check_units`, the one table the dialogue pipeline also uses. When
the pinned WavLM weights are absent the report says `"speaker_qa": "weights-missing"`; an omitted
field would read exactly like a report that passed identity. Whisper is MLX and macOS-local, so
in CI the verb fails fast with a readable message and the unit tests inject `transcribe_fn`.

The legacy `RevisionPayload` pipeline (`adapters.generate_lines`, `assemble`, `mix_context`) is
untouched and keeps rendering the published dialogues exactly as it did.

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
