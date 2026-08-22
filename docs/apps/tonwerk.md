# Tonwerk: the audio studio

Tonwerk is where the course's listening audio is made: scenes are written, rendered by a local
model, measured by machine, approved by a person, and published into `content/`. It is the **only**
interface to the studio — the server-rendered forms it grew up beside were deleted.

Two processes are involved and it helps to hold them apart from the first minute:

- **the engine** — a Python program (`atlas-listening`) that owns the database, the models, the
  renders and the publish path. It runs on `127.0.0.1:8765` and nothing else may reach it.
- **Tonwerk** — a React app that talks to that engine over HTTP with a bearer token. It opens no
  files, knows no host and no port, and imports nothing from the repository except the Scene
  contract.

Everything you do as an operator happens in Tonwerk. The engine's command line is for installing
it, starting it, and two jobs Tonwerk deliberately does not carry.

## Before you start

- **Bun**, and `bun install` run once at the repository root.
- **Python 3.12** and [`uv`](https://docs.astral.sh/uv/).
- **`ffmpeg` and `ffprobe` on the PATH.** `doctor` checks for them; the render pipeline is built on
  them and fails late without them.
- **Apple Silicon**, for the real synthesis and sound engines — both run through MLX.

You can start the engine and browse Übersicht, Szenen, Prüfung, Klangbibliothek and Figuren with no
model weights installed at all. You need the models only to **render**.

## Start it

```sh
bun install
bun run tonwerk:build                      # once, and after any change to apps/tonwerk

cd tools/listening-studio
uv sync --extra test
uv run atlas-listening doctor              # ffmpeg, ffprobe, git, python
uv run atlas-listening serve --repo ../..  # opens http://127.0.0.1:8765/
```

`serve` prints three lines. The second is the one you need:

```text
Tonwerk: http://127.0.0.1:8765/
API bearer token: <a long random string>
  curl -H "Authorization: Bearer …" http://127.0.0.1:8765/api/registry
```

Paste that token into Tonwerk's *Mit der Engine verbinden* screen. If `apps/tonwerk/dist` has not
been built, `serve` says so and `/` answers a plain-text hint instead of the app — the API keeps
working, so this is a build you forgot, not a broken install.

### While working on Tonwerk itself

Leave `serve` running and start the Vite dev server in a second shell:

```sh
bun run tonwerk       # http://localhost:4340
```

Vite proxies `/api` to `127.0.0.1:8765`, which is what makes the bearer token travel same-origin
with no CORS configuration on the Python side. `TONWERK_ENGINE` points it somewhere else.

## The token

It is minted per run and **never written to disk** — the line `serve` prints is the only copy. So it
goes stale every time you restart the engine, and Tonwerk returning you to the token screen is the
ordinary end of a session rather than a failure. The screen carries the engine's own reason for the
refusal. Copy the current token out of the running `serve` output.

## The six sections

The rail lists them in the order the work runs.

| Section | What it answers |
| --- | --- |
| **Übersicht** | the registry: what was commissioned, what is published, what the studio is working on, and what the exercises actually use — joined, so the disagreements are visible. Three panels are only findable in that join: `stale` published audio, recordings nothing asks a question about, and `audio-comprehension` items that fall back to browser TTS. |
| **Szenen** | every scene project, newest edit first. Dialogue and narration are two kinds of one document, so they are one list. |
| **Lesetexte** | the narration queue: one row per Lesetext, keyboard-driven, your position kept in the address. |
| **Prüfung** | the approval queue — every scene the machine has measured and nobody has judged, longest wait first. |
| **Klangbibliothek** | every sound that can be placed, imported or generated, and the one place to make a new one. |
| **Figuren** | the casting roster, its demo takes, and the consented cloned voices under it. |

On Übersicht the level meter's legend **is** the status filter: click a tick to scope the table,
click it again to clear. Filters live in the URL, so "every stale B1 row" is a link rather than a
set of instructions.

## Walkthrough: narrate a Lesetext

1. Open **Lesetexte**. Filter to a level; `J`/`K` walk the rows and the position is kept in the
   address, so closing the tab does not lose your place.
2. Press **Szene anlegen** on a row that has no scene yet. The profile picker's first option sends
   nothing and lets the engine's own rule choose from the text's id, level and kind — take it unless
   you have a reason not to. `Enter` deliberately does **not** create: the engine cannot delete a
   scene project, so an accidental repeat in a queue this long is irreversible work.
3. The row now opens its scene. The editor has three modes, which are three questions in the order
   they are answered:
   - **Skript** — the cast and the words. Cast first: a line's `role` is a join key into the cast
     and nothing else relates them. An utterance's id can be edited only while it is new, because
     the timing table, the QA report and any attached exercise all name a line by it.
   - **Szene** — everything that is not the words: the room, the device, the difficulty preset and
     the background. Every picker is filled from the engine, so a renamed room disappears here
     rather than failing at render time.
   - **Mischung** — what the render actually produced, and the two buttons that produce it.
4. **Save.** `⌘/Strg + S`, and nothing autosaves. Saving creates a new immutable revision and
   returns the project to `draft`; the previous QA report and any previous approval described the
   audio of the previous text and do not follow it forward.
5. In **Mischung**, press ***<Variante>* rendern**. A cold render synthesises every line through the
   local model and takes about 30 seconds; a warm one is a cache walk and takes under three. The
   button carries its elapsed second, and the answer says how many nodes came out of the cache.
6. Press **Automatisch prüfen**. It transcribes the master and holds it against the script. The
   timeline that appears is *measured* — where each turn, bed and event actually landed after pace,
   overlap and the difficulty deltas — not what the document asked for.
7. Read the report. A turn whose transcript check failed is outlined in red; that is the only place
   this app spends a colour on a verdict.
8. The scene is now `automatically_checked` and appears in **Prüfung**. Approving is not done here:
   a *freigeben* button beside the render button would put a signature one click away from the thing
   that invalidates it.

## Walkthrough: approve a scene

Open **Prüfung** and take the head of the queue. The page runs in a fixed order — *hören · prüfen ·
entschieden* — and the order is part of what it produces.

1. **Listen, with the script collapsed.** Reading along makes a listener hear words that were never
   spoken, which is exactly what the intelligibility check exists to catch. The disclosure says so.
2. Read the QA report in full.
3. Work the checklist: **eight** separate toggles, each a full sentence, none pre-checked, with no
   "confirm all". Two of the eight are hidden when the scene has nothing for them to be about —
   `questions` needs an attached exercise, `context` needs non-speech material. The engine refuses
   an approval that omits a required one, so the toggles are the record, not a ritual in front of it.
4. **Freigeben**, with your name. The signature is bound to the sha256 of the master you actually
   played. If a re-render landed mid-review the engine answers 409 and the page tells you to listen
   again rather than silently re-signing.
5. Or **Ablehnen**, with a reason. That returns the scene to `draft` and leaves the render and the
   report where they are. A scene whose automatic check *failed* can only be declined here — the
   reason travels to the next version.

## Publishing

Publishing is the engine's, not Tonwerk's, and it takes a deliberate confirmation:

```sh
uv run atlas-listening scene publish-approved --repo ../.. --yes
```

It refuses unapproved revisions, approvals that vouch for no bytes, and existing targets.

## Keyboard

| Key | Does |
| --- | --- |
| `⌘/Strg + S` | save the scene |
| `Space` | play / pause, inside a player region |
| `J` / `K` | next / previous row, in Lesetexte and Prüfung |
| `Enter` | open the row |

They are printed on the rail rather than in a help page, and each one says where it is live.

## Models

**Nothing is ever downloaded implicitly.** `HF_HUB_OFFLINE=1` on the child process makes that
enforcement rather than a promise.

```sh
uv run atlas-listening models list
uv run atlas-listening models fetch <generator|qwen_tts|asr|speaker_qa>
./install-qwen.sh           # Qwen3-TTS, the speech engine
./install-stable-audio.sh   # Stable Audio 3 Small-SFX, the sound engine (~1.8 GB)
```

Both installers pin a revision, and both pins are checked before a generation runs.

## Which CLI commands you actually type

`atlas-listening` exposes about thirty-five commands and a `scene` sub-app, which is the main
reason the tool looks harder than it is. The short answer:

> **`doctor`, `models`, `serve`, and `scene publish-approved`. Everything else happens in Tonwerk.**

The rest — `recast-corpus`, `lock-voice-profiles`, `regenerate-voice-profile-corpus`,
`benchmark-voice-consistency`, `experiment-human-voice-clone`, the pre-scene `*-reading` verbs — are
corpus-migration and research tooling, run once under supervision. They are documented in
[`../../tools/listening-studio/README.md`](../../tools/listening-studio/README.md).

## When something is wrong

| Symptom | Cause |
| --- | --- |
| `/` shows plain text naming a build command | `apps/tonwerk/dist` is missing. `bun run tonwerk:build`. |
| Back at the token screen, with a reason | The engine restarted and minted a new token. Copy the current one. |
| The render button is disabled | The scene declares no variant, or a run is already going. |
| **Automatisch prüfen** is disabled | There is no master yet — render first. |
| The editor is read-only and reports drift | The stored document does not parse against the current Scene contract. A lenient read has already lost what it did not recognise, so writing it back would delete a field; the engine has moved ahead of the committed schema. |
| `doctor` exits non-zero | `ffmpeg`, `ffprobe`, `git` or `python` is missing from the PATH. |

## What Tonwerk deliberately does not do

It never records a person's voice in the browser (a re-encode would silently break the consent
document's binding to exact bytes), never deletes a scene project, never signs audio on the page
that produced it, and never computes a consent verdict itself — it prints the rules and lets the
engine rule.

## Further

- [`../../apps/tonwerk/DESIGN.md`](../../apps/tonwerk/DESIGN.md) — the visual language, and why the
  app spends colour on exactly one distinction.
- [ADR 0008](../adrs/0008-character-ensemble-and-audio-studio.md) — the character ensemble and the
  audio studio as a product.
- [`../authoring/product-protection.md`](../authoring/product-protection.md) — the consent and
  licensing policy behind cloned voices and imported sound.
- [`../../tools/listening-studio/README.md`](../../tools/listening-studio/README.md) — the engine:
  synthesis, DSP, model locks and the corpus migrations.
