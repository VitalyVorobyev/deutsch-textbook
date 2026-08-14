# Deutsch-Atlas roadmap: durable A1–B1 learning

Status: active product direction. The [curriculum blueprint](curriculum/a2-b1.md) owns frozen
content identities; the [backlog](backlog.md) owns executable work. The completed A1–A2 roadmap is
[archived](archive/2026-07-roadmap-a1-a2.md).

## Product direction

Deutsch-Atlas is a local-first German course whose success criterion is delayed retention and
fresh-context transfer, not content volume or page views. A1 and A2 are complete. B1 is being
authored under its frozen fourteen-unit contract.

The course keeps five boundaries:

- recommendations are soft and never lock deliberate exploration;
- input, retrieval, interaction and production are distinct learning touches;
- optional documents, references and illustrations create no mastery or review debt;
- progress claims come from current instruments and reproducible commands;
- content quality and CEFR discipline outrank feature count.

## Current sequence

**Closing B1 comes first, and nothing in the tracks below starts before it does.**

*Amended 2026-08-05 (owner decision):* the direction tracks open now, with the B1 Wortliste tail
(lexis waves 2–4) still owed — the remaining waves interleave as content PRs between the track PRs
rather than blocking them. Track order: accounts/sync surface first, then mobile, then the
extensive-reading corpus, then cross-links/Referenz.

1. ~~**Finish the B1 units and wave-1 lexis**~~ — **shipped** (all fourteen units, the checkpoint,
   the placement and the Wortliste tail).

   **In its place: close the six reopened grammar rows, and buy B1 an anchor.** On 2026-08-14 the
   grammar denominator stopped measuring itself. The official Goethe *Prüfungsziele* inventories —
   free PDFs nobody had opened, though the inventory header had named them as its source for months
   — are ingested as `data/strukturenlisten/`, and diffing them against the course's own list found
   six structures the exams test and no row contained: the coordinating conjunctions, both
   Wortbildung sections, the demonstrative and interrogative determiners, and the reciprocal
   pronoun. A1 fell 23/23 → **24/28**, A2 32/32 → **35/37**, and that is progress: the figure stopped
   being flattering and started being true. Full finding:
   [grammar-structure-audit.md](curriculum/grammar-structure-audit.md) · [ADR 0011](adrs/0011-external-grammar-anchors.md).

   Three things follow, in order:

   - **Author the six rows' content** (backlog P26-1…P26-6). Each closes by lowering the number in
     `tests/grammar-coverage.test.ts` in the same commit, the discipline A2 already used ten times.
   - **Buy the two anchors B1 and B2 have none of** — the B1 *Prüfungsziele* (ISBN 978-3-19-031868-1)
     and *Profile deutsch* (ISBN 978-3-468-49410-9), the Council-of-Europe Reference Level
     Description for German and the only source that assigns grammar across A1–C2. **B1 currently
     reports 32/32 against no external list**, which is precisely the state A1 was in while missing
     four structures. Until then the B1 figure means "every row we wrote is taught", never "B1 is
     complete".
   - **Read the depth report before authoring anything else** (`bun scripts/grammar-depth.ts`).
     Median practice per confusion runs A1 12 · A2 8 · **B1 4**, production 6 · 6 · **3**, and 29% of
     B1 tags live in a single practice file. Breadth and depth are two numbers and neither
     substitutes for the other.
2. **Read the cadence between the windows, not on top of them.** Drain the grading queue to zero,
   rerun `bun run progress:audit --profile vitaly`, and only then read the weak-focus table. This is
   P5-11 and it is not optional: a drill authored from a pre-triage table targets a confusion the
   scorer invented.
3. ~~**Then the B1 checkpoint and placement**~~ — **shipped**: `content/exercises/b1/checkpoint-b1.yaml`
   (28 tasks, 23 of the 32 B1 manifest points) and `content/exercises/b1/placement-b1.yaml`
   (32 tasks over the 14 topics, two or three each), one of each per level, data rather than
   wiring, with the placement held to the seven stricter rules in
   [item-authoring.md](authoring/item-authoring.md).
4. Treat the approximately 2026-08-14 A2 checkpoint read as the next revision trigger; the
   2026-08-02 A1 cohort read has fired and its verdict is below.
5. **Then the five direction tracks below**, in the order the owner sets. Each names its ADR and its
   backlog ids, so a track can be picked up without re-deciding it.

Two standing constraints that outlive this sequence: add a semantic figure only when a named
relation is clearer spatially than in prose or a table, and keep the authentic-document and
extensive-reading streams growing without converting exploration into obligation.

## Retention gate

A competence is readable only after at least three delayed attempts. The A1 gate passes when at
least 80% of readable competences retain the graded target and the free-production channel reaches
70%. Run:

```sh
bun run progress:audit --profile vitaly --project <date>
bun run progress:audit --profile vitaly
```

The first command asks whether the gate can be read; the second reports what the evidence says.
Engagement, same-day accuracy and page viewing cannot substitute for either.

**A miss opens revision work and is recorded here. It no longer stops B1 authoring** — amended
2026-08-02 with the first result in hand, because applied literally the rule would have halted the
curriculum on evidence covering under half of A1. Revision work runs alongside authoring, not in
place of it.

**Read of 2026-08-02 — A1 missed both bars.** 1 of 8 readable competences at ≥80% retention
(12.5%); free production 60% against a 70% bar. But **half of A1 was not in that verdict**: eight
competences from the P19-1 backfill sat at zero attempts because their lessons had never been
opened. The honest statement is *A1 retention is weak on what has been measured*, and the action it
calls for is the learner taking those lessons and the due probes — not authoring work. Per-competence
figures: [archive](archive/2026-08-doc-slimming.md).

## Direction tracks

Five named tracks, decided 2026-08-04. Each has an ADR that holds the reasoning and backlog entries
that hold the work; a track can be picked up without re-deciding it. **They start after B1 closes.**

### Redaction · P27

Redaction is being rebuilt as a local repository-backed editorial workstation, independently of
learner features. The delivery sequence is intentionally vertical: each milestone must leave one
complete editorial path usable rather than adding another disconnected report.

1. **P27-0 · contracts and evidence baseline** — ADR 0013, stable design, A1–C2 grammar contract,
   explicit tracks, severity diagnostics and the existing audit figures retained as baselines.
2. **P27-1 · Grammatikatlas desktop slice** — checkout picker, restricted Bun sidecar, persistent
   graph cache, warm app shell, A1–C2 atlas, navigation from point through focus/topic/material and
   live source refresh on macOS.
3. **P27-2 · shared preview and source editor** — extract learner renderers from progress runtime;
   add editor mode, revision conflicts, atomic Save, local diagnostics, background corpus validation
   and fixtures for every material kind.
4. **P27-3 · Themen workspaces** — readiness dimensions, curriculum relations, outcomes, lesson
   stages, materials, standards and a complete rejection explanation for the reviewed gate.
5. **P27-4 · Materialien index** — load all graph chunks, full-text and faceted search, URL-persisted
   filters, preview drawer and playback of committed audio without Listening Studio functions.
6. **P27-5 · Qualität and Referenzen** — one severity-based diagnostic model while keeping inventory
   coverage, external alignment, teaching depth and unknown source territory visibly distinct.
7. **P27-6 · hardening and macOS delivery** — dependency-aware invalidation, background jobs,
   security/integration/accessibility suites, `.app`/`.dmg` and CI smoke build. Windows/Linux remain
   build-target preparation only.

[ADR 0013](adrs/0013-redaction-repository-workbench.md) owns the architecture; backlog P27 owns the
current implementation boundary. Completion is the full editor journey: locate a grammar line,
follow its course evidence, edit YAML/MDX with conflict protection, read local and corpus diagnostics,
and mark a topic reviewed only through the green gate.

### 1 · Accounts and sync ergonomics

Sync is already automatic — a 20-second debounce on all ten `src/lib/store.ts` write paths, one
cloud pull per page load, a `pagehide` flush — and none of that is visible to the learner, who is
never offered an account at first run. The work is to offer optional Google/GitHub sign-in in the
first-run gate (both providers are already implemented), state the pending-approval status without
blocking local-first use, make last-sync visible in the profile menu, and demote *Jetzt
synchronisieren* to the escape hatch it actually is.
[ADR 0004](adrs/0004-first-run-accounts-and-automatic-sync.md) ·
[ADR 0005](adrs/0005-one-surface-for-fortschritt-and-konto.md) · backlog P24-1 · P24-2 · P24-3.

### 2 · Mobile

The phone is where the daily loop actually runs, and three measured defects sit in its way. The top
navigation is seven links in a single `overflow-x-auto` row and horizontally scrolls below 640 px.
Only the flashcard input suppresses iOS autocorrect, so on Cloze, Listen, Translate and TableFill
the phone silently rewrites German answers. And six pages inline most of the corpus, which is what a
new learner waits for over mobile data — and those six are the pages the daily loop starts from. No
ADR: there is no settled design to record yet.
Backlog P24-6 (keyboard attributes, trivial and first) · P24-7 (nav redesign plus a full-surface
mobile audit) · P23-1 (page weight).

### 3 · Extensive-reading corpus

Extensive reading is the thinnest input channel in the course: seven *Lena* episodes against 60
reading files. `sources/klassiker/` adds ten didactic retellings of public-domain
classics — Grimm, Kopisch, Goethe, Hauff — with Wikisource sources and an A2→B1 progression. The
adaptation is real authoring work, not import, and it needs the reading schema to carry
`attribution`/`license` the way `content/documents/` already does, so per-text provenance is
enforced rather than conventional.
[ADR 0006](adrs/0006-public-domain-classics-as-extensive-reading-corpus.md) · backlog P24-4.

### 4 · Cross-links and Referenz IA

The Atlas has almost no cross-links, and the Referenz index is a flat grid of eight equal cards. The
rule that closes this is that every "see also" edge is **derived** from data the curriculum already
owns — `focusIntroducedBy`, `deepens`, reference-data keys — the way `/referenz/zeitformen` derives
its lesson chips today, because a hand-maintained link list drifts silently and no gate here can see
it. The written-genre practice surface (Bewerbung, Beschwerde, formal e-mail — grading structure and
register, never wording) and its Entdecken index ride in the same track.
[ADR 0007](adrs/0007-derived-cross-links-never-hand-maintained.md) · backlog P24-5 (subsumes P21-3)
· P21-1 · P21-2.

### 5 · Audio studio and characters

**Audio: shipped.** The corpus planned in `data/listening-plan.yaml` is published — one reviewed
artifact per live unit, each human-approved and hash-bound to the bytes that shipped, carried by
both shipping builds; an unflagged build reports `bundled: false` and falls back to browser TTS.
Retired and kept recordings are in [the retirement ledger](quality/audio-retirement-ledger.md); the
corpus figures at publication are in [the archive](archive/2026-08-doc-slimming.md). The terms it
stays publishable on: volume is not a substitute for intelligibility, and automatic transcription is
a defect detector, never proof of natural pronunciation. What remains on the content side is the A1
exam-style pack (P19-6).

The track's next step is **Lesetexte narration** — a Studio web UI and voice identity under QA —
which proceeds on its own merits. A recurring **character ensemble** is a separate and later
question, recorded as **proposed** rather than accepted — the pro-argument that survives scrutiny is
cognitive load, the in-repo Lena strand is evidence the production pattern is sustainable and not
evidence of a learning effect, and the named risks (seductive details, the ban on decorative
character art, voice-variability loss, unbounded continuity maintenance) are why it is not first.
[ADR 0008](adrs/0008-character-ensemble-and-audio-studio.md).

### Standing streams

Not tracks, and not scheduled: they continue at whatever rate the authoring windows allow.
Semantic learning visuals — responsive generated scenes only where physical context helps,
deterministic HTML/SVG for grammar, sentence topology and time. Entdecken and documents — authentic
tasks, explicit provenance, no completion state. Language quality — the Ukrainian calque review
(C6-1) and ongoing EN/RU/UK/DE parity checks.

## Definition of the next milestone

B1 is complete when all fourteen frozen units, their owned grammar points, outcome-valid practice,
readings, probes and vocabulary have shipped; the grammar and lexical coverage commands pass; the
grading queue is empty; and delayed evidence has been reviewed honestly. Shipping the catalog is
not a claim that every competence has been retained.

The five direction tracks above start once this milestone closes, not alongside it.
