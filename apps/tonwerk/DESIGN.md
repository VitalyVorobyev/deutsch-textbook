# Tonwerk — Gestaltung

The design direction, so the next person to build a surface here continues one language instead of
starting a second. Current truth only: this describes what the app looks like now and why, not what
it used to.

## What this is

A control room for **one person**: the course owner, doing long QA sessions over audio that will go
into a German textbook. Scenes are authored, rendered by a local Python engine, measured by machine,
approved by hand, published. The app's job is to make the state of ~130 artifacts legible at a
glance and to make one scene fully reviewable on one page.

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
and its timing in mono, and the difference is legible from across the room. Continue this in the
editor: a text field the author types German into should be set in the script face.

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

A fixed left rail (`--ton-schiene`, 15rem) carrying the wordmark, the three live sections and the
three that arrive with the editor — listed, disabled, marked *Folgt*, because the shape of the tool
is part of what the tool says about itself. Content is a single `--ton-bahn` (82rem) column of
panels.

A **Platte** is a rack unit: hairline border, `3px` radius (not zero, not a pill), legend silkscreened
on the top rule with its count opposite. Tables are dense — 13px, tabular numerals, sticky heads,
`--ton-mass-2/3` cells.

Below 56rem the rail becomes a strip across the top. That is a floor, not a mobile design: this is a
desktop tool.

## Motion

Almost none, and all of it under `prefers-reduced-motion`. The Pegel's segments animate their width
(`--ton-regung-pegel`, 420ms) — a meter settling. Everything else is a 140ms colour/border change on
hover and focus. Do not add more.

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
  row" is a link.
- **No state library.** One typed fetch layer (`src/api.ts`), one read hook, React state for the rest.
