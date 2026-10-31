# Tonwerk engine

> **Looking for how to *use* the studio?** A person's guide to the workbench — starting the engine, the six
> sections, narrating a Lesetext, publishing a scene — is [`docs/apps/tonwerk.md`](../../../docs/apps/tonwerk.md).
> What follows is the engine: the scene model, the render graph, QA, publishing, model locks, the
> designed voices and the consent mechanism.

The engine behind [Tonwerk](../ui): local-first authoring for checked, committed listening
exercises. Its CLI is `atlas-listening`, and its Python package keeps the older name
`listening_studio`; both are Tonwerk. The CLI starts a private FastAPI server on `127.0.0.1`; scene
projects and their immutable revisions live in SQLite under the macOS application-data directory.
No learner state or audio is uploaded.

**A scene project is the only thing the engine renders, checks, approves and publishes.** A
dialogue and a narration are both scenes (`kind: dialogue | narration | custom`); there is no
second project model and no second pipeline.

## Start

The studio is **a JSON API and one app in front of it**: `serve` publishes `/api`, and
[Tonwerk](../ui) — a React workbench living in this repository — is what a person uses.

```sh
cd apps/tonwerk/engine
uv sync --extra test --extra mlx
./install-qwen.sh                        # the speech runtime; again after every `uv sync`
uv run atlas-listening doctor
cd ../../.. && bun run tonwerk:start     # or `bun run tonwerk:app` for the desktop app
```

`uv sync` is exact: it removes every package the lock does not name, which includes the Qwen and
Stable Audio runtimes `install-qwen.sh` and `install-stable-audio.sh` add with `uv pip install`.
Re-run the installers after a sync, or synthesis and WavLM speaker QA report their runtime missing.

`serve` mints the bearer token per run and never writes it to disk. Started plainly, it prints the
token and opens a tab at `/#code=…`; the tab trades that single-use launch code for the token at
`POST /api/session`. Started by a shell with `--handshake`, it prints exactly one JSON line
(`{"tonwerk": 1, "url", "port", "token"}`), writes nothing else to stdout, and stops when its stdin
closes. `tonwerk:start` and the desktop shell run the venv's `atlas-listening` directly, never
`uv run`, which would sync the speech runtime away. If `apps/tonwerk/ui/dist` has not been built, `/` answers a plain-text
hint and the API keeps working.

Model weights are never downloaded implicitly. `models list` prints `models.lock.json`;
`models fetch <name>` downloads one row at its pinned revision.

## The command line

| Verb | What it does |
| --- | --- |
| `serve [--repo] [--port] [--no-browser] [--handshake]` | the API and the built Tonwerk bundle; `--port 0` binds a free port |
| `doctor [--repo]` | the toolchain, the model runtimes and the pinned weights, each with its fix (`doctor.py`, also `GET /api/doctor`) |
| `models list` · `models fetch <name>` | the model lock, and one pinned download |
| `sources import <file> --metadata <json>` · `sources list` | reviewed Freesound originals |
| `voices create` · `list` · `demo` · `revoke` | the consented voice store (mirrors `/api/voices`) |
| `voices adopt-designed <run> [--target-wps]` | an evaluation run's designed references become the roster's voices ([below](#designed-voices)) |
| `generate-character-demos [--repo] [--test-adapter]` | three audition takes per roster character |
| `evaluate voices [--candidates] [--characters] [--name]` · `evaluate reveal <run> --choices` | the voice-checkpoint comparison and its blind listen, outside the production path ([below](#voice-evaluation)) |
| `measure-cues [ids…] [--repo] [--redo]` | turn cues for recordings published before scenes: Whisper word times aligned to the transcript, then snapped to the nearest pause (`cues.py`). A scene publish writes exact cues from the render instead |
| `scene validate` · `create` · `from-dialogue` · `from-reading` · `show` | the scene document |
| `scene render` · `qa` · `regenerate-corpus` | audio and its automatic QA |
| `scene publish` · `publish-checked` · `delete` · `schema` | the repository side |
| `scene archive` · `fork` · `reap` | the library: hide a project, copy one into a new draft, report and remove old renders (`reap` without `--yes` only reports) |

Every verb that takes `--json` prints exactly one JSON document on stdout. The whole verb runs
under `scene.cli.json_verb`, which sends library output to stderr: the pinned Qwen adapter prints
a flash-attn banner to stdout when it loads, and a guard around one call leaves the next one
unguarded.

## Modules

| Module | What it is |
| --- | --- |
| `scene/` | the Scene v1 model, its exercise attachment, the JSON Schema export, the converters from the shipped corpus (`convert`, `reading_source`), repository checks, the publisher, the regeneration wave and the `scene` verbs |
| `graph/` | the render graph: the content-addressed asset store, the node types, `render_scene`, and the scene QA |
| `dsp/` | acoustic profiles as data, the impulse-response generator, the filter-chain builders, and `audio` (`wav_duration`, `conform`) |
| `generative/` | the engine contract (`gateway`), the engines, the engine registry (`registry`: `ENGINES`, `CLONING_ENGINES`, `DESIGNED_ENGINES`, `SOUND_ENGINES`), the model locks (`locks`), the consented voice store (`voices`) and the designed reference store (`designed`) |
| `qa.py` · `speaker_qa.py` · `soundscape.py` | transcript thresholds and the pinned Whisper; WavLM identity; the bed-level measurement |
| `domain.py` | the shared vocabulary: the stage machine, bilingual text, single-choice questions, the QA report and the WER comparison |
| `storage.py` | the SQLite store and its Alembic migrations |
| `library.py` | what the studio holds on disk, and the render reaper |
| `evaluation.py` | the voice evaluation runner and its blind listening page |
| `api/` · `web.py` | the JSON API, one module per concern, and the app factory |
| `catalogs.py` · `sources.py` | the character and narration catalogs; imported and generated sounds |
| `adoption.py` · `scene/casting.py` | an evaluation's designed references into app data and the catalog; a role cast from the catalog, pace included |

## Synthesis engine

**Qwen3-TTS is the engine**, and `./install-qwen.sh` installs it. Three checkpoints are engines:
`qwen_tts_designed` (1.7B Base) speaks every roster character through its designed voice
([below](#designed-voices)); `qwen_tts` (0.6B CustomVoice) speaks the nine presets the published
corpus was recorded in, and stays for those scenes until they are recast; `qwen_tts_base` (0.6B
Base) speaks a consented human clone. A scene cast from the catalog — a Lesetext narration, or a
role adopted with `scene.casting.adopt_catalog_voice` — takes the character's catalog engine and
voice. `fake`, `fake_clone` and `fake_designed` are the deterministic-silence engines the workflow
tests run on; they cannot produce publishable audio.

Every engine is reached through one contract — `generative/gateway.py`: an engine-neutral
`SpeechRequest`, an `AudioAsset` carrying the WAV's hash and its provenance, and the
`SpeechGenerator`/`SoundGenerator` protocols. Engines return the model's raw output; pace,
resampling and mixing happen afterwards in the render graph, so one take can be re-paced or
re-placed without asking the model again. `supports_style` is `False` on every Qwen engine, and a
render warns once per engine when a styled role meets it: the 0.6B CustomVoice checkpoint discards
`instruct` upstream and the Base checkpoints take none, so a delivery note is stored, hashed and
inaudible. A designed voice's delivery is the one its description gave the reference.

The upstream package is installed with `--no-deps` on purpose: its declared dependencies pull
gradio, which would move `fastapi` and `starlette` past the pins the engine's own web layer uses.
`requirements-qwen-runtime.txt` lists what the generation path actually loads, derived from
`sys.modules` after a real `generate_custom_voice()` call rather than from the package metadata.
It pins `soundfile` to the base dependency's version, so installing the runtime never moves it.

Weights downloaded by `scripts/download-qwen3-tts.py` land in `<repo>/.models/`, which the Hub
cache does not index. The script downloads the revision `models.lock.json` pins, and
`generative.locks.local_checkout` **verifies that revision** from the per-file download metadata
before use — a directory is never accepted on its name alone, because the published manifest
states that revision as fact. Which repository is searched is stated, not guessed: `--repo` sets it
through `set_models_root`, and the derivation from this package's own path is only the fallback.

Measured reliability on this machine (M4 Pro): MPS with an explicit `dtype=torch.float32`; the full
record is [`docs/architecture/tts-reliability.md`](../../../docs/architecture/tts-reliability.md).
Its figures come from `scripts/tts_reliability_probe.py` (`--help` lists the device, dtype and
mode switches), which loads the model directly and never touches the store.

## Sound engine

**Stable Audio 3 Small-SFX is the sound engine**, through Stability's own MLX implementation, and
`./install-stable-audio.sh` installs it: the runtime into this venv, the adapter code from the
pinned GitHub commit into `<repo>/.models/stable-audio-3-mlx/`, and 1.8 GB of `.npz` bundles at the
pinned Hugging Face revision beside them. Both pins are in `models.lock.json` and both are checked
before a generation; `HF_HUB_OFFLINE=1` on the child process is what makes "never downloaded
implicitly" enforcement rather than documentation. The weights come from the **ungated**
`stabilityai/stable-audio-3-optimized`, the same model and the same Stability AI Community License
as the gated PyTorch checkpoint, whose revenue condition and training-data claim are recorded in the
lock entry and in [`product-protection.md`](../../../docs/authoring/product-protection.md).

`scene render --sound-engine stable_audio_sfx` resolves a `SoundSpec`; `--sound-engine fake` rides
the same `--test-adapter` gate as the fake voice. `SOUND_ENGINES` is a second registry beside
`ENGINES` on purpose — the two protocols take different requests, and one merged table would let a
scene be cast on a tone generator by a typo.

The engine calls the pinned `scripts/sa3_mlx.py` as a **process**, because upstream ships no
library API and the whole generation flow lives in its `main()`. So this package never imports
`mlx`, and the CI environment stays free of an ML runtime by construction; the child's banner is
captured and re-emitted on stderr.

Measured on this machine (M4 Pro / 24 GB, MLX 0.32.1, fp16 DiT, 8 sampler steps): a 10 s clip
takes **0.9 s** warm (~11× realtime; 2.3 s on the first run, which pays the model load) at a peak
RSS of 1.5 GB, and generation is **byte-identical across runs at one seed** — through the ffmpeg
conform as well as out of the model. Output is 16-bit stereo at 44.1 kHz and is conformed inside
the engine to mono 48 kHz `pcm_s24le`, because `track_filters` takes one *mono* take and a stereo
one would lose a channel to `pan`. A `negative_prompt` is **refused at `cfg` 1.0** rather than
dropped — the sampler runs no unconditional branch there.

## Scene v1

A **scene** is a cast, a script, and one timeline that speech, one-shot sound and ambience are all
placed on (`src/listening_studio/scene/`). The published contract is
`packages/schema/schemas/audio-scene.v1.schema.json`, regenerated by `scene schema` and held
byte-identical by `tests/test_scene_schema.py`; two converted scenes sit in `schemas/fixtures/` as
the cross-language examples. Class docstrings of the scene models are part of that schema.

Conversion from the shipped corpus is total and lossless — all 40 published dialogues and all 85
Lesetexte — and is exercised over the real corpus in `tests/test_scene_convert.py`, because 25 of
the 40 dialogues carry a different seed on every line of one speaker, which is preserved as
`Utterance.seed_override` rather than flattened.

```sh
uv run atlas-listening scene from-dialogue a1/ls-erste-schritte-01 --repo ../../.. --out scene.json
uv run atlas-listening scene from-reading a1/erste-schritte --repo ../../.. --import --json
uv run atlas-listening scene validate scene.json --repo ../../.. --json   # + acoustic-id warnings
uv run atlas-listening scene create --from scene.json --exercise scene.exercise.json --json
uv run atlas-listening scene show ls-erste-schritte-01 --json
uv run atlas-listening scene schema --repo ../../.. --check
```

The exercise is a sibling of the scene, stored beside it and outside its hash: a question edit must
not change `scene_sha256`, because an approval vouches for audio. A question is single-choice, the
one shape `audio-comprehension` has.

## The store

`scene_projects`, `scene_revisions` (immutable bytes; a revision returns the project to `draft`),
`scene_qa_reports` and `voice_references`, migrated by Alembic: `Store.__init__` runs
`alembic upgrade head`, stamping a pre-Alembic database at 0001 first. Migration 0005 drops the
pre-scene `projects`/`revisions`/`reading_projects`/`reading_revisions` tables **only when all four
are empty**, and otherwise refuses with the row counts and changes nothing.

**A QA report belongs to one revision and one variant** (`scene_qa_reports`, migration 0006). A
render is per variant, so its report is too: the first report steps `audio_generated` →
`automatically_checked`, a later one (another variant, or the same one measured again) is stored at
`automatically_checked`, and none is accepted after approval. Approval and publishing read the
report of the variant they act on.

The stage machine is `draft → validated → audio_generated → automatically_checked →
[human_approved →] exported`, in `storage.STAGE_TRANSITIONS`: a checked scene is exported
directly, or after an optional approval.

## The JSON API

`src/listening_studio/api/` is the whole surface, one module per concern. `web.py` registers, in
order: `/health`, `POST /api/session`, `GET /api/doctor`, the API router, and the built Tonwerk
bundle mounted at `/` (last, because a static mount at `/` shadows everything beneath it).

```sh
bun run tonwerk:start --no-browser    # prints the launch link and the bearer token
curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:<port>/api/registry
```

**Auth.** One secret, one way to present it: `Authorization: Bearer <token>`, on `/api/**`. A wrong
one and a missing one are both **401 JSON** with `WWW-Authenticate`, never a redirect. The one
exception under `/api` is `POST /api/session`, which answers the token for the run's launch code
once and 401 to a reused or wrong one. `/health` and the workbench bundle are open: the bundle is the screen that *asks* for the token, and it carries
no studio data. The table is in `web.local_only`'s docstring and every row of it has a test in
`tests/test_api_auth.py`.

**Scenes** (`api/scenes.py`, `api/workflow.py`) — the same operations `atlas-listening scene` offers,
with the same gates, because two surfaces that disagree about when the fake engine is allowed is how
a test take reaches a learner.

| | |
| --- | --- |
| `GET /api/scenes` · `GET /api/scenes/{slug}` | list (with the `natural` render's QA verdict); one scene with its exercise, `qa_reports` by variant, approval and which variants are rendered *of these exact bytes* |
| `POST /api/scenes` · `PUT /api/scenes/{slug}` · `DELETE /api/scenes/{slug}` | create; revise — a new revision, back to `draft`, and the slug may not change; delete a draft at revision 1 that was never published |
| `POST /api/scenes/from-reading` | `{reading_id, profile?}` — one Lesetext converted and imported as a narration draft; no `profile` means `default_profile_id`. 409 when that slug is already a project |
| `POST /api/scenes/{slug}/validate` | re-validate the stored bytes, plus the acoustic ids this repository does not define |
| `POST /api/scenes/{slug}/render` | `{variant, sound_engine}`; the engine comes from the stored cast, never from the request |
| `POST /api/scenes/{slug}/qa` | `{variant}` — transcript, speaker and soundscape QA of that variant's render; **409 with a sentence** when the local MLX Whisper runtime is absent |
| `GET …/renders/{variant}/master` · `/qa-report` | the audio, and the machine's report on exactly that variant's render (404 when that variant was never checked) |
| `GET …/renders/{variant}/artifact/{path}` | any file the render **declared it wrote**; the allowlist is `render.json`'s `artifacts`, never the filesystem |
| `GET …/renders/{variant}/peaks?resolution_ms=` | the master's waveform and each timeline entry's over its measured span. Levels run 0..255 on a 60 dB scale, the window is 5–1000 ms, and the result is cached per window beside the render (`graph/peaks.py`) |
| `POST /api/scenes/{slug}/approve` | the eight-point checklist, the reviewer's name, **the sha256 of the master they listened to** and the variant; a mismatch or a variant with no passing report is 409 |
| `POST /api/scenes/{slug}/decline` · `/publish` | with a reason, back to `draft`; publish one checked or approved scene, or 409 naming the gate |
| `POST /api/scenes/{slug}/archive` · `/fork` | `{archived}` — out of the library's default view and the review queue, or back; `{slug}` — a new draft project from the head revision, recording `forked_from` as `<slug>@<revision>`, 409 when the slug is taken |

**Libraries** — `GET /api/characters` (the roster, how many scenes cast each character, demos and
portraits) and `GET /api/narration-profiles` (`api/characters.py`); `/api/voices` (`api/voices.py`);
`/api/acoustics` (`api/acoustics.py`); `/api/sounds` with each source's scene usage, and
`POST /api/sounds/generate` (`api/sounds.py`).

**Library** (`api/library.py`, `library.py`) — `GET /api/library/disk?keep=N` sizes the studio's
trees (`renders`, `assets`, `cache`, `replaced`) and counts the render trees the reaper may remove;
`POST /api/library/reap {keep}` removes them. A tree stays when its scene sha is one of a project's
newest `keep` revisions (default 2), a signed revision, or one a provenance manifest names as
published. `assets/` and `cache/` are never reaped: they are what makes a re-render cheap.

**Registry** (`api/registry.py`) — `GET /api/registry` is `scripts/listening-inventory.ts` joined
with the studio's scene projects and the exercise corpus. That script stays as it is, because CI and
the authoring loop need an answer with no studio installed; `tests/test_api_registry.py` holds the
two status vocabularies equal. The join buys three findings no single source can see: `stale` —
published audio whose scene has moved on since the version-2 manifest named its `scene_sha256` —
`recordings_without_exercises` and `exercises_without_recordings`. A narration row also reports
`source_drift` when its scene's script no longer says the Lesetext the repository holds. A planned
recording belongs to a unit (`unit`) or to an exercise set (`collection`, with the item ids it
`serves`); a collection recording is never reported as unused, since its items name it only once it
is published. Rows also carry the plan's duration `window`, the published `duration_seconds` and a
`text` to search. Scene projects no plan entry or Lesetext owns, such as forks, are rows of kind
`scene`. Against the real corpus and an empty store, `registry()` reports 93 planned recordings, 17
of them without an exercise item, and 115 `audio-comprehension` items without a recording
(measured with `api.registry.registry(Store(<tmp>), <repo>)`); `bun run listening:inventory` prints
`93 planned · 40 published · 52 planned · 1 drafted`.

## The render graph

A scene is compiled to a graph of nodes and only the nodes whose inputs changed are evaluated
(`src/listening_studio/graph/`). Every node is identified by

```text
node_hash = sha256(type + ":" + impl_version + ":" + canonical_json(params) + ":" + sorted(inputs))
```

and its output is stored by the hash of its own bytes under `assets/<sha256>.wav`, with a
provenance sidecar beside it. **Each node type carries its own `impl_version`** — bumping one
invalidates exactly that class of computation. Imported Freesound originals are *referenced*, never
copied: the sidecar names the source sha and the licence id, and `sources/<sha>/source.json` stays
the one reviewed record.

```sh
uv run atlas-listening scene render ls-wohnen-01 --repo ../../.. --json
uv run atlas-listening scene qa ls-wohnen-01 --repo ../../.. --json
```

Layout, under the studio work directory: `renders/<scene-sha256>/<variant>/` holds
`stems/<entry-id>.wav`, `master.wav`, `dry.wav`, `qa.wav`, `publish.mp3` and `render.json`. The
manifest carries every node hash and impl version, every asset sha and its provenance, the
`models.lock.json` rows for the engines that ran, the ffmpeg version, and the **timing table** — one
`{utterance_id, start_ms, end_ms}` per turn, which is the cue source for publishing. Stems and
masters are kept per scene sha until `scene reap` (or the Bibliothek's disk panel) removes the
trees of older revisions.

Formats: the working master is stereo 48 kHz `pcm_s24le`. Two derivatives are always produced:
`qa.wav` (mono 16 kHz, the only format Whisper and WavLM are given) and `publish.mp3` (stereo
48 kHz at 128 kbps). Placement is constant-power panning, so a voice keeps its level as it moves. A
`SoundSpec` reached without a sound generator is refused, never rendered as silence.

## Acoustics: rooms, devices and difficulty

Everything else a scene can say about acoustics is **data**, in two files at the repository root,
interpreted by `src/listening_studio/dsp/`. No generative model is involved anywhere in this layer.

`data/acoustic-profiles.yaml` holds seven **rooms** (`studio`, `small-room`, `cafe`, `office`,
`station-hall`, `street`, `car`) and five **devices** (`telephone`, `mobile`, `pa`, `radio`,
`next-room`). A room is five numbers — seed, RT60, pre-delay, damping cutoff, early-reflection
count — from which `dsp/ir.py` synthesises a 48 kHz mono impulse response, deterministic to the byte
and stored as a content-addressed asset. It is normalised to **unit energy** and convolved with
`afir=irnorm=-1`, so the same `wet` figure returns the same level in every room. A device is named
acoustic parameters — band edges with a section count, compression in dB and ms, an optional bit
crush, a room-send level, a gain offset — never an ffmpeg string; `dsp/chains.py` owns the
translation.

`data/acoustic-difficulty.yaml` holds three **presets** (`clean`, `natural`, `challenging`), and
every field is a **delta against what the scene's author wrote**: `ambience_gain_db`, `wet`,
`distance`, `pace`, `overlap_ms`. `natural` is exactly the identity. A `DifficultyVariant.overrides`
replaces individual deltas by the same key names, and a key outside the vocabulary is refused.

In the graph: a device chain and the distance formula go into the **track** node's filter chain; the
room is a **send-return on the mix** — every dialogue and sfx stem is split, its send gain applied,
the sum **padded by the impulse response's length** (pre-delay plus RT60) and convolved by a single
`afir`, and the return added to the master at the room's resolved wet level. The pad is what lets
the room ring out after the last word: `afir` produces exactly as many samples as its input, so an
unpadded send would cut the reverb off at the end of the scene. **The ambience bus is never sent**:
a recorded room tone already is a room.

A scene can also mix **within** those profiles:

| Field | What it does |
| --- | --- |
| `gain_db` on a speech entry (−24…+6) | moves one line against the others before loudness normalisation |
| `effects` on a speech or sfx entry | inserts a chain after the distance and the device: band edges, a three-band equalizer (200 Hz shelf, 1.5 kHz bell, 5 kHz shelf), crush, a compressor, in that fixed order, and a `room_send_db` |
| `duck_db` on a bed (−30…0) | lowers the bed by exactly that much while anyone speaks. The envelope comes from the resolved speech times, falls 150 ms before a turn, holds through gaps under 1 s, and recovers over 400 ms |
| `device_overrides` on a placement | replaces the named device's band edges, gain or room send |
| `room_overrides` on the acoustics | replaces the room's `wet`, RT60, pre-delay or damping. This produces a new impulse response and so a new IR node |

All five are left out of a scene's canonical form while they hold their neutral default. A scene
that uses none of them therefore keeps the `scene_sha256` its approval and render tree are bound
to, and renders to the same nodes. `tests/test_scene_mixing.py` pins the committed fixtures'
hashes. It also measures the rendered gain and duck depth on the stems, within 0.1 dB and 1 dB.

Node identity carries all of it: a stem with no device and unit distance has no `fx` parameter; a
`send_db` and the room's `tail_ms` are in the mix hash only when there is a room to send to; and
each profile's editorial `version` is a hashed parameter. `render.json` gains an `acoustics` block:
preset and room ids with their versions, every resolved delta, the resolved wet level, and the sha
of each impulse response convolved. Unknown room, device and preset ids are **refused at render time
with the path of the file that would have to define them**; `scene validate <file> --repo` offers
the same check as a warning.

The difficulty layer is measured rather than listened to: `tests/test_dsp_chains.py` pushes seeded
broadband noise through the real `telephone` chain and asserts by FFT that both stopbands are at
least 20 dB below the passband.

## Automatic QA

`scene qa` transcribes `qa.wav` whole and per utterance — the slices are cut from the **mix** using
the timing table, because a bed that buries a word is a defect of the scene — then measures speaker
consistency against the same slices and reports the soundscape by comparing the master with
`dry.wav`, the dialogue bus alone. The transcript thresholds are `qa.check_units`. When the pinned
WavLM weights are absent the report says `"speaker_qa": "weights-missing"`; an omitted field would
read exactly like a report that passed identity. Whisper is MLX and macOS-local, so in CI the verb
fails fast with a readable message and the unit tests inject `transcribe_fn`.

`scene regenerate-corpus` converts, renders and QAs the published dialogue corpus in one process,
so the Qwen warm-up is paid once; it stops before publishing, and a failure is a row, not an exit
(`scene/wave.py`).

## Publishing, and the optional approval

**A scene publishes on its automatic QA** ([ADR 0013](../../../docs/adrs/0013-designed-voices-and-automatic-publishing.md)).
A dialogue at `automatically_checked` whose `natural` report passed is ready, with no person's
prior listen, and its manifest says `cleared_by: automatic-qa`. An approval is optional: a named
person, the eight-point checklist (`api.workflow.APPROVAL_CHECKLIST`), the variant, and the sha256
of the master they listened to. A scene approved that way publishes from `human_approved` with
`cleared_by: human-approval` and the approval in its manifest, and an approval on record is still
held to the scene, the variant and the master it names, so a stale one refuses. A take a person
declined is not published on its QA alone, and a render made by a test engine is refused unless a
person approved it — the approve endpoint is where that is allowed, and only under the test gate.

Publishing is the engine's, never a button: `scene publish <slug> --yes` for one scene and
`scene publish-checked --yes` for every ready dialogue — `automatically_checked` with a passing
`natural` report, or `human_approved` — each with a `--dry-run` that runs every gate and stages
every byte. One batch verb rather than one per clearance, because "ready" is the single rule
`plan_publish` decides; a scene whose QA failed is not a candidate and is not reported. The gates
are listed in `scene/publish.py`; every refusal names its gate. Each publish stages into a fresh
temporary directory, backs up what it replaces under app-data, renames everything into place, and
rolls back on failure.

The published manifest is version 2: it names the `scene_sha256`, says what cleared it, and lists
every voice that is not a preset speaker under `voices`. A designed voice is
`{role, character, version, reference_sha256, instruct, seed, design_model, clone_model,
synthetic: true}`; a consented clone is its bound identity with `consent_sha256` and
`synthetic: false`. The claims are computed from that list: `voice_cloning_used` says whether a
consented clone is in it, `consent_sha256` lists their consents, and `reference_audio_used` says
whether any voice was cloned from a reference. `bun run validate` checks the same record
(`packages/schema/src/audio-provenance.ts`), for version 1 and version 2 alike.

## Designed voices

Every roster character speaks through **one designed synthetic voice on one checkpoint**: a
reference clip the 1.7B VoiceDesign checkpoint spoke from a written description of a fictional
person, cloned for every line by the 1.7B Base checkpoint (`generative/qwen_designed.py`, engine
`qwen_tts_designed`). Both checkpoints are production rows of `models.lock.json`;
`scripts/download-qwen3-tts.py --variant base-1.7b` fetches the one a render loads.

The clip is nobody's voice and needs no consent record, and it still never enters the repository:
it lives in app data at `voices/designed/<sha256>.wav`, beside `<sha256>.json` — the character,
the description, the reference text, the design seed, both model pins, the run it was chosen in,
Whisper's transcript and its WER, and `synthetic: true` (`generative/designed.py`). Writes are
atomic, a clip that does not hash to its name is refused, and a stored record is never rewritten.

A cast member names the voice by that digest: `VoiceSpec(engine="qwen_tts_designed",
voice=<sha256>, style=None)`, `voice_ref` null. The digest is in the synthesis request, so the synth
node's hash covers the reference bytes. **The engine never looks a reference up.** Every caller that
builds engines — `scene render`, the render endpoint, the wave, `generate-character-demos` —
resolves the digests the cast names from app data (`resolve_designed`, which verifies each clip)
and injects them through `registry.engine_for(name, designed=…)`; a digest that is not there is
refused by name before anything is synthesized. `render.json` records the reference under
`designed_voices` by role, and the publisher re-checks the clip against its digest.

`voices adopt-designed <run>` is how a voice evaluation's choice becomes the roster. For every
catalog character it copies the run's accepted reference — the raw model output the clone
candidates were conditioned on, not the 16 kHz copy Whisper checked — into app data, and rewrites
the character's `voice_profile` in `data/listening-characters.yaml` as
`{engine: qwen_tts_designed, voice: <sha256>, seed, style: null, pace}`, bumping its version. The
edit is textual, so the file keeps its order and layout; the result is validated before it is
written, and adopting the same run twice changes nothing.

**The catalog pace** brings each character's clones to the rate learners hear today: the median
words per second of voiced audio of the run's `preset-0.6b` takes, the production voice the
designed ones replace, measured by the same rule on the same lines. For `voices-2026-10-31` that is
2.92, against 3.47 for `design-clone-1.7b` (both medians over the run's 84 takes in `run.json`,
which `evaluate reveal` reads). The run's takes were already conformed at the character's old
pace, and `atempo` scales the rate linearly, so the pace is `target × old pace / measured median`,
rounded to two places and held to the catalog's 0.7–1.15. `--target-wps` sets another target. A role takes the pace on every line it speaks once a scene adopts the catalog voice
(`scene.casting.adopt_catalog_voice`); a narration composes it with its level's pace
(`catalog_pace`).

## Consent-gated voice cloning

A voice may be cloned from a consented recording and cast in published course audio. The policy is
`docs/authoring/product-protection.md`; this is the mechanism.

A consent document binds the **exact** reference SHA-256 and one scope. `evaluation` permits local
work only; `publication` additionally requires a permitted use that explicitly allows publishing in
this course, a retention statement, and — for a minor — guardian consent plus guardian-attested
child assent. The engine refuses a document that does not satisfy a rule and **names the rule**
(`publication-permits-course`), which is the same vocabulary `GET /api/voices` serves to Tonwerk's
Klon-Assistent.

The reference recording and its consent sidecar live under local application data
(`voices/<sha256>.wav`), never in the repository and never in a database column.

```sh
uv run atlas-listening models fetch qwen_tts_base
uv run atlas-listening voices create mara-h \
  --reference /path/outside/the/repo/reference.wav \
  --consent /path/outside/the/repo/consent.json \
  --ref-text "Wort für Wort, was in der Aufnahme gesagt wird."
uv run atlas-listening voices list --json
uv run atlas-listening voices demo mara-h --repo ../../..
uv run atlas-listening voices revoke mara-h
```

A scene casts one by setting `VoiceSpec.voice_ref`. The identity — voice id, reference digest,
consent digest — enters the synth node's hash and `render.json`'s top-level `voices` map, so a
published claim about consent is computed from the render rather than asserted beside it. `revoke`
marks the row revoked, deletes the recording and every audition made from it, and makes the render
path, the API and the CLI refuse further synthesis. Renders already produced keep their provenance.

## Voice evaluation

`evaluate voices` speaks every roster character's three demo phrases and the four shared lines of
[`evaluation/voice-designs.yaml`](evaluation/voice-designs.yaml) through each candidate, one
checkpoint in memory at a time:

| Candidate | Checkpoint | Voice |
| --- | --- | --- |
| `preset-0.6b` | 0.6B CustomVoice, the preset engine of the published corpus | the character's preset speaker; style discarded |
| `preset-1.7b` | 1.7B CustomVoice | the same preset and seed, with the character's style instruction |
| `design-clone-0.6b` · `design-clone-1.7b` | 0.6B or 1.7B Base | a clone of a reference the 1.7B VoiceDesign checkpoint read in a described, fictional voice |

A preset candidate speaks a character's preset speaker, so it refuses a roster whose profiles are
designed, as the catalog's now are; compare the design-clone candidates, or a fixture catalog.

It measures each take with the scene QA's line rule on Whisper's transcript, words per second of
voiced audio and the real-time factor, and each candidate with the `speaker_qa` identity report over
all characters. The run lands in a new directory under the studio's `evaluations/`. That directory
holds `run.json` (every prompt, seed, pinned revision and hash, the measures and the blind key) and
`listen/index.html`. The page plays the takes under letters that are shuffled per character, and
saves the listener's choices as `choices.json`, which `evaluate reveal <run> --choices` unblinds.

**It is not a production path.** A run never overwrites an earlier one, writes no store row and no
render-cache entry, and nothing reads it at publish; `voices adopt-designed` is the one step that
carries a run's references out, and it copies them. The 1.7B CustomVoice checkpoint is pinned in
`models.lock.json` with `"scope": "evaluation"` and is not an engine of `generative.registry`; the
VoiceDesign and 1.7B Base checkpoints became production rows when the designed voices did. All
three are downloaded with `scripts/download-qwen3-tts.py --variant custom-voice-1.7b|voice-design|base-1.7b`
(about 4.5 GB each). A description that asks for an imitation is refused
(`evaluation.IMITATION_MARKERS`). The policy is `docs/authoring/product-protection.md`.

```sh
.venv/bin/atlas-listening evaluate voices --repo ../../..                 # every candidate, the whole roster
.venv/bin/atlas-listening evaluate voices --repo ../../.. --test-adapter  # arithmetic speech, a dry run
.venv/bin/atlas-listening evaluate reveal voices-<time> --choices ~/Downloads/choices.json
```

## Context sounds and the roster

Freesound is supported only as a manual, reviewed source; the studio never calls its API. Download
the original from its public sound page, complete the metadata template, then import it locally:

```sh
uv run atlas-listening sources import ~/Downloads/room-tone.wav \
  --metadata examples/freesound-source.example.json
uv run atlas-listening sources list
```

Only CC0 1.0 and CC BY 4.0 are accepted. Originals over 10 MB, music, intelligible speech, brands,
personal data and uncertain uploads are rejected. A scene places an imported source by its SHA-256
(`AssetRef`) as an ambience bed or an sfx event; publishing carries the exact source, metadata and
attribution in the provenance manifest.

`data/listening-characters.yaml` defines the character roster, its designed voice profiles,
compatibility and three comparison phrases each; `data/listening-narration-profiles.yaml` the narration profiles cast from
it. `generate-character-demos --repo ../../..` writes three pending audition takes per character,
which Figuren plays; portrait prompts are retained under `data/prompts/` and catalog portrait paths
remain empty until a human selects a candidate.

## Validation

```sh
uv run ruff check .
uv run mypy
uv run pytest
```

The fake engines are only for automated workflow tests. Approval rejects a scene cast on one unless
the server was started with the test gate, publishing refuses a fake render that no person
approved, and no test marks real output human-approved.
