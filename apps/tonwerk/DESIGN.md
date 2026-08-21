# Tonwerk — Gestaltung

The design direction, so the next person to build a surface here continues one language instead of
starting a second. Current truth only: this describes what the app looks like now and why, not what
it used to.

## What this is

A control room for **one person**: the course owner, doing long QA sessions over audio that will go
into a German textbook. Scenes are authored, rendered by a local Python engine, measured by machine,
approved by hand, published. The app's job is to make the state of ~130 artifacts legible at a
glance, to make one scene fully reviewable on one page — and, since the editor, to make it
**editable on that same page**, so that reviewing and fixing are not two tools.

Its language is **German**, with no switcher — the Redaktion precedent. The engine's own vocabulary
is English (`awaiting_approval`, `stale`); it is translated at the edge and kept in `data-` attributes
underneath, so styling and tests key on the engine's word and the reader sees German.

## The thesis, and the colour system that carries it

The product's central argument is the **line between what a machine measured and what a person
vouched for**. QA is automatic; approval is not; and `stale` exists precisely because an approval can
stop covering the bytes it was given for.

So hue is spent on exactly that and on nothing else:

| Hue | Token | Means |
| --- | --- | --- |
| grey | `--ton-ruhe` | nobody has acted |
| instrument cyan | `--ton-messung` / `--ton-messung-ab` | **the machine**: rendered, measured, verdict given |
| brass | `--ton-signal` / `--ton-signal-ab` | **a person**: approved, published |
| red | `--ton-alarm` | over: a failed check, or an approval that no longer covers the bytes |

Everything else is achromatic: cold graphite surfaces, engraved-white type. The interface is nearly
colourless on purpose — **the colour is the reading**, the way a meter's is. That is the risk this
direction takes, and it only pays off if nothing else is allowed to be coloured. Do not introduce a
fifth hue, and do not use these four decoratively.

**An unsaved draft is brass**, and that is not a fifth meaning but the same one: a person has acted
and nothing has recorded it yet. So the editor's Save button, its `ungespeichert` mark and the
active side of a two-state control all wear `--ton-signal`, and the moment a save lands they stop.

The rendered timeline is where the rule was hardest to keep and the reason it is worth keeping.
**Its lanes are drawn in shape, not in new colour**: a turn is a lit cyan bar, a bed is a dim
graphite band at two thirds the height, an event is a two-pixel tick with a cap. The only hue that
enters is red, on the outline of a turn whose transcript check failed — a verdict, which is what
hue is for. A palette per lane type would have been easier to read at a glance and would have cost
the app the thing it uses colour to say.

Brass and not amber, deliberately: the learner site is warm stone and amber, and Tonwerk should not
look related to it. Brass reads as metal on a cold panel, not as honey on paper.

### Surfaces

`--ton-raum` (page) → `--ton-platte` (panel) → `--ton-platte-hoch` (table head, hover, inputs), with
`--ton-kante` for engraved hairlines and `--ton-kante-hell` where a rule must actually be seen.

**One theme, dark.** No light mode and no toggle: a colour system whose job is to be read like an
instrument would need two calibrations, and this is a single-operator tool used in long sessions.
`color-scheme: dark` is declared on `:root` and in the document head.

## Type: three faces, and the face tells you what kind of thing you are looking at

| Role | Token | Used for |
| --- | --- | --- |
| **Apparatus** — mono, uppercase, `0.18em` tracked | `--ton-fassung-tafel` | wordmark, nav, panel legends, column heads, ids, shas, all numbers |
| **Interface prose** — system humanist sans | `--ton-fassung-text` | the app talking about the work |
| **Script** — Charter serif | `--ton-fassung-skript` | the German being *manufactured*: utterances, titles, personas, demo phrases, expected/heard transcripts |

The third row is the rule worth keeping. **The German content is the product; everything around it
is apparatus, and it does not wear the apparatus's face.** In `Szene`, an utterance is set in Charter
and its timing in mono, and the difference is legible from across the room. **This binds inputs as
much as paragraphs**: `SkriptFeld` is the script face in a `<textarea>`, and it is what an utterance,
a delivery instruction, a scene title and a sound prompt are typed into, while an id, a seed, a gain
and a millisecond count stay mono in `Feld`/`ZahlFeld`. A form where every field looked the same
would make the German one value among ninety.

Setting *headings* in a tracked mono is the second deliberate move — it is rack silkscreen and
engraved scale plates, and it is why the app does not need a display serif to have a voice.

No web fonts. Every face is a system stack (Charter ships on macOS and most Linux desktops; Georgia
is the fallback). **Tonwerk makes no request that does not go to the local engine** — including its
favicon, which is an inline SVG data URI.

## Der Pegel — the signature

`src/components/Pegel.tsx`, on Übersicht.

The registry's statuses are a **pipeline**, so they are drawn as one: a segmented level bar whose
segment widths are the counts, with a printed legend beneath. Segments are discrete ticks (a CSS
mask, not a fill) because a level bar is LEDs, not a progress bar.

`stale` is what earns the design. It is not a later position on the scale — it is a regression *out*
of the last one — so it sits **past the end of the bar behind a gap**, exactly where a peak-programme
meter puts its over indicator.

Two rules the component encodes:

- **A status with zero rows keeps its place** as an unlit sliver. A meter whose marks move is not a
  meter.
- **The legend is the filter.** Clicking a tick scopes the table; clicking the active one clears it.
  There is therefore no separate status dropdown, and there should not be one.

### Die Statuslampe — the Pegel at row scale

`src/components/Statuslampe.tsx`. Two dimensions, each carrying a fact:

- **The ring says whose move it is next.**
- **The core says what verdict has been recorded.** Empty means none yet.

Which produces the three readings the system exists for: `awaiting_approval` is a brass ring around
a cyan core (machine done, human next); `published` is brass on brass with a halo, the only lit
state; `stale` is a brass ring around a **red** core — an approval that no longer covers the bytes.

The wordmark repeats the same mark in miniature: four ticks, one brass, one red past a gap.

## Layout

A fixed left rail (`--ton-schiene`, 15rem) carrying the wordmark, the four live sections, the two
that have not arrived — listed, disabled, marked *Folgt*, because the shape of the tool is part of
what the tool says about itself — and **Tasten**, the two-line key legend. There are two shortcuts
(⌘/Strg + S saves, Space plays) and they are the two things this tool does all day, so they are
silkscreened on the desk rather than filed in a help page. Content is a single `--ton-bahn` (82rem)
column of panels.

A **Platte** is a rack unit: hairline border, `3px` radius (not zero, not a pill), legend silkscreened
on the top rule with its count opposite. Tables are dense — 13px, tabular numerals, sticky heads,
`--ton-mass-2/3` cells.

**Die Werkbank** is the editor's own strip above the panels: the three modes, the state, and the two
controls that write. It is the only sticky element in the app, because the Save button and the
unsaved mark have to stay reachable twelve utterances down a script. The mode selector is a bank of
channel keys — a hairline frame, one lit segment with a brass underline — and not a pill group.

**A hint that is the same on every row belongs to the panel, not to the row.** A repeated sentence
under a repeated control is read once and then becomes texture; the panel's `erklaerung` says it
once and the control keeps only what reads its own value (`gebunden an Version 1`, `0,7 bis 1,3`,
`Leer: der Seed der Rolle`). The same logic retires a control nobody asked for: a difficulty
override exists as a row only where a departure was decided, with a picker to add one, because five
disabled fields make four decisions that were never made look like four settings.

Below 56rem the rail becomes a strip across the top. That is a floor, not a mobile design: this is a
desktop tool.

## Motion

Almost none, and all of it under `prefers-reduced-motion`. The Pegel's segments animate their width
(`--ton-regung-pegel`, 420ms) — a meter settling. Everything else is a 140ms colour/border change on
hover and focus. Do not add more.

**A long run is told in seconds, not in an animation.** A cold render is ~30 s of local synthesis
and a warm one is a cache walk under 3 s; a spinner says the same thing about both. So a running
button carries its elapsed second in tabular mono and refuses re-entry, and the answer prints
`nodes_evaluated` against `nodes_cached` — the incremental graph is a feature, and it is invisible
unless it is shown.

## Writing what an edit costs

The editor's one genuinely surprising rule is that **saving retires the QA report and the
approval** — a revision is immutable, and a new one returns the project to `draft`. That is the
stage machine working, and a reviewer who learns it from a green tick that disappeared learns it as
a bug. So the page says it *before* Save is pressed, in the strip under the toolbar, and says it
again in the past tense afterwards. The same discipline covers the other two refusals the editor
owns: a drifted document is readable and not editable (a lenient read has already lost what it did
not recognise), and an explicitly-timed scene will not be reordered (an `at_ms` is somebody's
deliberate overlap).

## Quality floor

- Focus is never removed: one brass `:focus-visible` track, offset, for the whole app.
- An empty value renders `–` (`.leer`), never an empty cell — an empty cell reads as a bug.
- An error says **which of four failures** it was (`src/views/fehler.ts`): the engine is not running,
  it refused the token, it said no, or it answered something this build cannot read. Errors do not
  apologise and are never vague.
- An empty screen is an invitation or a fact, not a shrug: "Jede geplante Aufnahme wird von
  mindestens einer Aufgabe benutzt."

## Writing

Sentence case. Active voice. Name things by what the operator controls. A control keeps its name
through the flow. Two habits specific to this app:

- **Say what a state means, not just what it is called.** Every status carries a one-line
  `STATUS_MEANING` used as the legend's tooltip.
- **Never let a check that could not run look like a check that passed.** The speaker QA section
  prints `Nicht gemessen: weights-missing` rather than folding it into a verdict.

## Technical choices behind the look

- **Hand-rolled CSS with custom properties**, three files: `tokens.css` (the whole vocabulary),
  `base.css` (reset + primitives), `app.css` (shell, Pegel, views). No Tailwind and no `@da/ui` — a
  separate identity, and no exposure to the scan-path hazard that made `@da/ui`'s padding compute to
  `0px` in Redaktion.
- **Hash router, hand-rolled** (`src/router.ts`). Filter state lives in the hash, so "every stale B1
  row" is a link — and so is one mode of one scene (`#/szene/<slug>?modus=mischung`). The dirty
  guard runs *after* the hash changes and restores it with `replaceState`: the links here are
  ordinary anchors, which is what makes them shareable and leaves no click to intercept.
- **No state library.** One typed fetch layer (`src/api.ts`), one read hook, React state for the rest.
  The editor's model is three values — the stored document, the draft, and a sorted-key encoding of
  each to compare them by. Key order is not a document, so the comparison is canonical, the way the
  engine's own scene hash is.
- **No id is written down in the frontend.** Rooms, devices and difficulty presets come from
  `GET /api/acoustics`, which reads the same two data files the renderer resolves against. A
  hardcoded list keeps offering a room after it is renamed, and the render that refuses is the
  first anybody hears about it.
- **Audio is fetched on the first press, never on mount.** A blob URL only exists after a full
  `fetch`, so `preload="none"` buys nothing: a mounted player has already downloaded its file, and a
  hundred-row library would pull a hundred WAVs over the socket that is also running the model.
