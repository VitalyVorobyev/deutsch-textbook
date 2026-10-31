# Tonwerk: the audio studio

Tonwerk is where the course's listening audio is made: scenes are written, rendered by a local
model, measured by machine, approved by a person, and published into `content/`. It is the **only**
interface to the studio — the server-rendered forms it grew up beside were deleted.

Two programs are involved, and one command starts both:

- **the engine** — a Python program (`atlas-listening`) that owns the database, the models, the
  renders and the publish path. It listens on `127.0.0.1` only, and nothing else may reach it.
- **Tonwerk** — a React app that talks to that engine over HTTP with a bearer token. It opens no
  files, knows no host and no port, and imports nothing from the repository except the Scene
  contract.

Everything you do as an operator happens in Tonwerk. The engine's command line is for installing
it and for the jobs Tonwerk deliberately does not carry.

## Before you start

- **Bun**, and `bun install` run once at the repository root.
- **Python 3.12** and [`uv`](https://docs.astral.sh/uv/).
- **`ffmpeg` and `ffprobe` on the PATH.** `doctor` checks for them; the render pipeline is built on
  them and fails late without them.
- **Apple Silicon**, for the real synthesis and sound engines — both run through MLX.
- **Rust**, only to build the desktop app.

You can start the engine and browse Übersicht, Bibliothek, Prüfung, Klangbibliothek and Figuren with no
model weights installed at all. You need the models only to **render**.

## Install it once

```sh
bun install
cd apps/tonwerk/engine
uv sync --extra test --extra mlx
./install-qwen.sh                          # the speech runtime; again after every `uv sync`
```

`uv sync` removes the speech runtime, so `install-qwen.sh` comes after every sync. Übersicht shows a
**Werkzeugkette** panel whenever a tool, runtime or model is missing, with the command that fixes it;
`uv run atlas-listening doctor` prints the same report.

## Start it

As a desktop app:

```sh
bun run tonwerk:app     # builds apps/tonwerk/src-tauri/target/release/bundle/macos/Tonwerk.app
```

Open `Tonwerk.app`. It starts the engine of the checkout it was built in, opens the studio signed
in, and stops the engine when you quit. A first start that cannot find that checkout asks for the
folder and remembers it. The engine's output goes to
`~/Library/Logs/dev.nonvision.deutsch-atlas.tonwerk/engine.log`, and a failed start shows its last
lines in the window.

Or in a browser tab:

```sh
bun run tonwerk:start   # rebuilds the UI if it changed, then opens a signed-in tab
```

Both start the engine on a free port. `Ctrl-C` in that terminal stops it.

### While working on Tonwerk itself

Start the engine on the port the Vite dev server proxies to, and Vite in a second shell:

```sh
bun run tonwerk:start --port 8765 --no-browser
bun run tonwerk         # http://localhost:4340
```

Vite proxies `/api` to `127.0.0.1:8765`, which is what makes the bearer token travel same-origin
with no CORS configuration on the Python side. `TONWERK_ENGINE` points it somewhere else. To sign
in, open `http://localhost:4340/` with the `#code=…` of the link the engine printed.

## The token

The engine mints it per run and **never writes it to disk**. The desktop app hands it to its window
directly. In browser mode the engine opens the tab with a launch code that it trades for the token
**once**. The tab keeps the token until it closes. A second use of the same link is refused.

So the token screen, *Mit der Engine verbinden*, is a fallback. You land there when a tab outlived
an engine restart, or when a launch link was already spent. Start Tonwerk again, or paste the
`API bearer token` line the engine printed at start.

## The six sections

The rail lists them in the order the work runs.

| Section | What it answers |
| --- | --- |
| **Übersicht** | the registry: what was commissioned, what is published, what the studio is working on, and what the exercises actually use — joined, so the disagreements are visible. Three panels are only findable in that join: `stale` published audio, recordings nothing asks a question about, and `audio-comprehension` items that fall back to browser TTS. |
| **Bibliothek** | everything the studio has made or was asked to make, in one searchable table: planned recordings (owned by a unit, or by an exam practice set), Lesetext narrations, and studio scenes no plan owns, such as a fork. |
| **Lesetexte** | the narration queue: one row per Lesetext, keyboard-driven, your position kept in the address. |
| **Prüfung** | the approval queue — every scene the machine has measured and nobody has judged, longest wait first. |
| **Klangbibliothek** | every sound that can be placed, imported or generated, and the one place to make a new one. |
| **Figuren** | the casting roster, its demo takes, and the consented cloned voices under it. |

On Übersicht a tick on the level meter opens the Bibliothek filtered to that status. Every
Bibliothek filter lives in the URL, so "every stale B1 row" is a link rather than a set of
instructions.

### The Bibliothek

- **Search** reads what a row says: the published transcript, else the studio's script, else the
  script the exercise items were written with. Every word you type must occur. A hit in the text is
  shown under the row.
- **Sammlung** is what owns a row: a unit, an exam practice set (`pruefung-a2-1-hoeren`, …), a
  Lesetext's topic, or *Studio* for a scene no plan owns.
- **Länge** is the published length beside the window the plan asked for, marked *zu kurz* or *zu
  lang* when it misses. Fix the script, not the window.
- **Aufgaben** counts the items that play a recording. An exam recording that is not published yet
  shows *für N*: the items it is planned for.
- **Abzweigen** copies a scene's newest revision into a new draft project, for a variant or a
  rewrite. The copy starts unsigned and remembers where it came from.
- **Archivieren** puts a studio scene out of the default view and out of the Prüfung queue.
  Nothing is deleted; *Archiv zeigen* brings it back. Planned rows cannot be archived, because a
  plan entry is work still owed.
- **Speicher** shows what the studio holds on disk. *Alte Renders entfernen* removes the renders of
  older revisions. It keeps each project's two newest, every signed revision and every published
  one; the removed ones can be rendered again from their revision.

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
uv run atlas-listening scene publish-approved --repo ../../.. --yes
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

**Nothing is ever downloaded implicitly.** A running engine sets `HF_HUB_OFFLINE=1` for itself
and every process it starts, which makes that enforcement rather than a promise.

```sh
uv run atlas-listening models list
uv run atlas-listening models fetch <generator|qwen_tts|asr|speaker_qa>
./install-qwen.sh           # Qwen3-TTS, the speech engine
./install-stable-audio.sh   # Stable Audio 3 Small-SFX, the sound engine (~1.8 GB)
```

Both installers pin a revision, and both pins are checked before a generation runs.

## Which CLI commands you actually type

> **`bun run tonwerk:app` or `bun run tonwerk:start`, `models`, and `scene publish-approved`.
> Everything else happens in Tonwerk.**

The rest of `atlas-listening` serves the same scene pipeline from a shell:

- `sources import|list` brings in a licensed Freesound sound.
- `voices create|list|demo|revoke` manages consented cloned voices.
- `generate-character-demos` makes the demo takes Figuren plays.
- `evaluate voices` compares candidate voice checkpoints on the roster and writes a blind
  listening page; `evaluate reveal` unblinds your choices. Nothing it makes can be published.
- The `scene` sub-app validates, creates, renders, checks and publishes one scene.
  `scene regenerate-corpus` re-renders and checks the published dialogue corpus in one process,
  and it stops before approval. `scene archive`, `scene fork` and `scene reap` are the
  Bibliothek's three operations.

They are documented in [`../../apps/tonwerk/engine/README.md`](../../apps/tonwerk/engine/README.md).

## When something is wrong

| Symptom | Cause |
| --- | --- |
| `/` shows plain text naming a build command | `apps/tonwerk/ui/dist` is missing. `bun run tonwerk:build`. |
| Back at the token screen, with a reason | The engine restarted and minted a new token, or the launch link was already used. Start Tonwerk again. |
| The app window shows *Engine startet nicht* | The engine exited before its handshake. Its last lines are in the window; the usual cause is a missing install (above). |
| The render button is disabled | The scene declares no variant, or a run is already going. |
| **Automatisch prüfen** is disabled | There is no master yet — render first. |
| The editor is read-only and reports drift | The stored document does not parse against the current Scene contract. A lenient read has already lost what it did not recognise, so writing it back would delete a field; the engine has moved ahead of the committed schema. |
| `doctor` exits non-zero | `ffmpeg` or `ffprobe` is missing from the PATH. A missing runtime or model is reported without failing. |

## What Tonwerk deliberately does not do

It never records a person's voice in the browser (a re-encode would silently break the consent
document's binding to exact bytes), never deletes a scene project with history (archiving hides
one), never signs audio on the page
that produced it, and never computes a consent verdict itself — it prints the rules and lets the
engine rule.

## Further

- [`../../apps/tonwerk/ui/DESIGN.md`](../../apps/tonwerk/ui/DESIGN.md) — the visual language, and why the
  app spends colour on exactly one distinction.
- [the characters proposal](../proposals/characters-and-stories.md) — a recurring cast with voices
  and stories, still open.
- [`../authoring/product-protection.md`](../authoring/product-protection.md) — the consent and
  licensing policy behind cloned voices and imported sound.
- [`../../apps/tonwerk/engine/README.md`](../../apps/tonwerk/engine/README.md) — the engine:
  synthesis, DSP, model locks and the corpus migrations.
