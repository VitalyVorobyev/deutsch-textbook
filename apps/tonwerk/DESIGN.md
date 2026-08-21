# Tonwerk — Gestaltung

The design direction, so the next person to build a surface here continues one language instead of
starting a second. Current truth only: this describes what the app looks like now and why, not what
it used to.

## What this is

A control room for **one person**: the course owner, doing long QA sessions over audio that will go
into a German textbook. Scenes are authored, rendered by a local Python engine, measured by machine,
approved by hand, published. The app's job is to make the state of ~130 artifacts legible at a
glance, to make one scene fully reviewable on one page, to make it **editable on that same page** so
that reviewing and fixing are not two tools — and, since Prüfung and Lesetexte, to make the two jobs
that are done *in bulk* feel like one pass rather than two hundred visits.

It is now the studio's **only** interface. The server-rendered forms it grew up beside are deleted,
and `atlas-listening serve` hands out this bundle and a bearer token.

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

### Die Warteschlange — the mark at queue scale

`src/components/Warteschlange.tsx` with `src/warteschlange.ts`. Prüfung and Lesetexte are the same
job with different columns: a list worked through from the top, driven from the keyboard, sometimes
eighty-five rows long.

- **The selected row wears a brass left edge** — the same mark an active nav item and a chosen
  variant wear. That is not a fourth meaning for the colour. Brass is *a person has acted and
  nothing has recorded it yet*, and where the reviewer is standing in a queue is exactly that.
- **The region takes focus, the rows do not.** `role="grid"` with `aria-activedescendant`: one tab
  stop instead of eighty-five, and the selection is a value the app owns rather than wherever the
  browser last left the ring. When a row is selected the region draws **no ring of its own** — the
  selected row *is* the focus indicator, and a brass box around the table beside a brass mark on
  one row spends the colour twice on one fact. An unselected or empty queue keeps the ring.
- **The keys stop at both ends.** A `j` on the last row that lands on the first is a reviewer who
  has silently started again, which is the one mistake a batch surface must not make.
- **The position is in the hash**, beside the filters, so a queue survives a reload and "where I am
  in B1" is a link.
- **A click selects; it never opens.** In a queue the pointer is how you aim.

### Die Statuslampe — the Pegel at row scale

`src/components/Statuslampe.tsx`. Two dimensions, each carrying a fact:

- **The ring says whose move it is next.**
- **The core says what verdict has been recorded.** Empty means none yet.

Which produces the three readings the system exists for: `awaiting_approval` is a brass ring around
a cyan core (machine done, human next); `published` is brass on brass with a halo, the only lit
state; `stale` is a brass ring around a **red** core — an approval that no longer covers the bytes.

The wordmark repeats the same mark in miniature: four ticks, one brass, one red past a gap.

## Layout

A fixed left rail (`--ton-schiene`, 15rem) carrying the wordmark, the six sections and **Tasten**,
the key legend. It used to carry a *Folgt* group naming Lesetexte and Prüfung — the shape of the
tool being part of what the tool says about itself — and both have arrived, so the group is gone
rather than kept as a heading over nothing. Four shortcuts now (⌘/Strg + S saves, Space plays, J/K
walks a queue, Enter opens a row) and every one is something this tool does all day, so they are
silkscreened on the desk rather than filed in a help page — and each legend row says *what* the key
does, not which screen it works on, because a silkscreen that changes per screen is not one.
Content is a single `--ton-bahn` (82rem) column of panels.

A **Platte** is a rack unit: hairline border, `3px` radius (not zero, not a pill), legend silkscreened
on the top rule with its count opposite. Tables are dense — 13px, tabular numerals, sticky heads,
`--ton-mass-2/3` cells.

**Die Werkbank** is the editor's own strip above the panels: the three modes, the state, and the two
controls that write. The mode selector is a bank of channel keys — a hairline frame, one lit segment
with a brass underline — and not a pill group.

**Der Prüfstand** is the same device for the review page, and the same argument makes it sticky: the
two buttons that record a verdict have to stay reachable while the reviewer is scrolling a QA table.
Between them sits the **sha of the master** the signature will name, because that is the one fact
the whole page exists to bind. These two strips are the only sticky elements in the app.

Left of it is **die Kette**: `HÖREN → BERICHT → URTEIL`, three words in the apparatus face with the
current one lit brass, the past ones dimmed brass and the future ones grey. It is deliberately *not*
a bank of channel keys, because it is not a selector — the order is the discipline, and a reviewer
cannot choose to be at the end of it. Nor is it numbered `01 / 02 / 03`: the arrow already says
sequence, and the numerals would be decoration on a three-item list.

**A hint that is the same on every row belongs to the panel, not to the row.** A repeated sentence
under a repeated control is read once and then becomes texture; the panel's `erklaerung` says it
once and the control keeps only what reads its own value (`gebunden an Version 1`, `0,7 bis 1,3`,
`Leer: der Seed der Rolle`). The same logic retires a control nobody asked for: a difficulty
override exists as a row only where a departure was decided, with a picker to add one, because five
disabled fields make four decisions that were never made look like four settings.

Below 56rem the rail becomes a strip across the top. That is a floor, not a mobile design: this is a
desktop tool.

## The signature, and the two rules its layout is made of

`src/views/Freigabe.tsx` is the only page in Tonwerk that writes a claim about published material,
so it is the only page whose *order* is part of what it produces. Both rules are inherited from the
deleted HTML form and neither is decoration.

**Listen first.** The master is the first panel and the script is behind a disclosure whose reason
is printed **on the summary**, not inside it — a reason you only see after opening arrives after the
damage. Reading along makes a listener hear words that were never spoken, which is precisely what
the `intelligibility` point is supposed to catch. The report and the checklist are not on the page
at all until the reviewer leaves the listen stage on purpose; the panel that will hold them says so
in its own words rather than rendering greyed-out controls.

The step is **explicit and not measured**. Gating on the player having reached the end was the other
option and is worse: someone who listened in another application would be locked out of a decision
they are entitled to make, and a gate you defeat by pressing play and walking away measures nothing.
What the explicit step buys is that skipping it is a thing the reviewer did.

**Eight deliberate toggles, and no way to tick them all at once.** The form this replaces made the
opposite trade — one button over eight printed sentences — on the argument that eight checkboxes are
eight clicks and never eight decisions. That argument was right about ceremony and is no longer
available: the engine takes the certified keys as data and refuses an approval that omits a required
one, so the toggles *are* the record rather than a ritual in front of it. Everything that made
ticking cheap is kept out anyway: no bulk confirm, nothing pre-checked, the full sentence on every
row, and **two of the eight are not shown at all** when the scene has nothing for them to be about —
a point nobody can answer honestly is the fastest way to teach ticking without reading.

A toggle is drawn as the Statuslampe's vocabulary at control scale: an empty ring means nobody has
said anything, a filled brass core with a halo means a person has. The whole row is the target,
because a sentence you have to read should also be the thing you hit.

**A refusal is drawn like a refusal.** When the engine answers 409 because the master changed
mid-review, the page does not offer to retry — it says the master changed, that nothing was
recorded, and offers to reload and listen again. That 409 is the entire reason the request carries a
sha, so the one place it surfaces has to read as the instruction it is.

## Der Klon-Assistent, and printing a rule instead of ticking it

`src/views/Stimmen.tsx`, under Figuren. A consented cloned voice is cast beside the twelve roster
characters, so it is auditioned on the roster's own three phrases, on the roster's own page — a
separate section would have hidden the one comparison the demos exist for. It is still a different
*kind* of thing from a catalogue row, and the panel says so rather than blending them: a character
is an entry, a voice reference is a **permission**, so both digests are printed, a scope badge is on
every row, and a withdrawal is struck through with its date instead of leaving the list.

The assistant reuses **die Kette** — `AUFNAHME → TEXT → EINWILLIGUNG → HÖRPROBE` — for the reason
Freigabe has one: the order is the discipline and nobody may choose to be at the end of it. You
cannot audition a voice before the consent that permits it exists. It is not a bank of channel keys,
because it is not a selector; the current step is derived from what the draft actually contains.

**The consent rules are printed and never evaluated here.** The engine owns them, publishes them
through `GET /api/voices`, and gives the verdict; this page renders the ones that apply — filtered
by the engine's own `applies`/`minors_only`, never by a rule re-implemented in TypeScript — and a
row turns red only because a refusal named it. A green tick this form computed itself would be a
check that could not run looking like a check that passed, and the second implementation behind it
would be free to disagree with the first. For the same reason a rule id this build has no German for
still appears, in the engine's own English: a rule added on the Python side must show up in the
form, not vanish from it.

Two refusals are written down rather than designed around. **The document is readable before it is
sent** — the form assembles the consent JSON and prints it behind a disclosure whose summary says
what it is, the Freigabe page's listen-first argument applied to a record somebody is vouching for.
And **there is no in-browser recording**: MediaRecorder yields WebM/Opus, the clone path wants PCM,
and a consent is bound to the SHA-256 of exact bytes, so a re-encode on the way in would break that
binding silently.

In the cast panel a role is a preset voice **or** a consented clone, the `Klangquelle` two-state
control unchanged, and switching replaces the value rather than merging. Any scope is castable and
the copy says plainly that whether a scene may be *published* with an evaluation-scope voice is the
publisher's decision and not this build's — a disabled option would imply a gate that does not exist
yet. A cast referencing a revoked voice is an alarm on the row, not a removal: the scene still names
it, and a render that failed with nothing on the page to explain why is the worse outcome.

## Die stille Rücknahme — the danger affordance, and why it is the quietest control on the row

`Loeschen` in `src/views/Lesetexte.tsx`, `.ruecknahme` in `app.css`. Two waves create in bulk — 85
Lesetexte and 40 dialogues — and until the engine grew `DELETE /api/scenes/{slug}` every creation
was permanent, which is why the queue's `Enter` deliberately refuses to create.

The obvious design is a red button, and it is wrong here for the reason the whole palette exists:
**red is a verdict, not a category of control.** A failed check and an approval that no longer
covers its bytes are red because something has been found; an *offer* to delete has found nothing.
Making it red would be the fifth meaning the colour system spends its whole argument on refusing,
and it would put an alarm on every deletable row in a queue that is mostly deletable rows.

So the control is the quietest thing in its cell — apparatus face, no border, `--ton-schrift-weg`,
visibly less like a button than the two links beside it — and it wears `--ton-alarm` only in the
**armed** state, where the label has stopped being an offer (*Löschen*) and become the consequence
(*Szene wirklich löschen*). That is the Statuslampe's own move at control scale: the hue arrives
when there is something to read.

Three rules follow, and each one is a way the affordance could be wrong instead:

- **Two presses, no dialogue.** A `confirm()` is a modal in a queue driven from the keyboard, and a
  dialogue you dismiss without reading is the checkbox nobody ticks honestly. The second press is
  on a *different sentence*, which is what makes it a decision rather than a repeat.
- **It appears only where the engine would accept it.** The row carries `deletable`, the engine's
  own answer; two of its three conditions are visible on the row and the third — a provenance
  manifest in the course repository naming this slug — is not. A control that is offered and then
  refused teaches that the offers are decoration.
- **A refusal prints the engine's words and reloads the queue.** All three refusals are about state
  this list is a snapshot of, so a 409 means the snapshot was stale; re-deriving the rule here would
  be a second implementation free to disagree with the first. The Klon-Assistent's rule again.

The Lesetexte queue also gained a **Profil** column, because a narration profile resolves into a
composed style string that cannot be taken apart again — so until the engine recorded `profile_id`,
"which profile narrated this" was unanswerable and the queue could only ever offer a picker. An
unrecorded profile renders `–` and **never the picker's default**: a default printed as a fact is
how a reviewer comes to believe a choice was made. An id this build has no label for is printed as
itself, for the reason an unknown consent rule is.

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
  Exactly one player on one page is `gross` — the master under review, where the transport is not a
  control beside the work but the work itself, and it is sized and coloured to be pressed first.
- **A transcript comparison is computed here, because only the two strings arrive.** The engine
  reports a WER and the expected and heard text; a percentage says a turn is wrong and a marked word
  says what to listen for. `wortDiff` is a plain LCS over lowercased, punctuation-stripped tokens.
  Hue rules still apply — a word the model dropped is red, a word it invented is cyan, and an
  identical pair is drawn with no marks at all. The panel states that the marks are the *raw*
  comparison and the WER is measured after the engine's normalisation, so a marked word beside 0 %
  is a number or a spelling the check treats as equal rather than a contradiction.
- **The engine's address is read, not written down.** The rail's footer prints
  `window.location.host`: requests are same-origin either way — Vite proxies `/api` in development
  and the engine serves this bundle itself in production — and a hardcoded `8765` was wrong on every
  other `--port`.
