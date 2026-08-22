# Deutsch-Atlas roadmap: durable A1–B1 learning

Status: active product direction. The [curriculum blueprint](curriculum/a2-b1.md) owns frozen
content identities; the [backlog](backlog.md) owns executable work. The completed A1–A2 roadmap is
[archived](archive/2026-07-roadmap-a1-a2.md).

## Product direction

Deutsch-Atlas is a local-first German course whose success criterion is delayed retention and
fresh-context transfer, not content volume or page views. The A1–B1 corpus is fully authored but
is now being requalified against explicit internal, external, depth and lexical contracts; an
authored level is not called complete while those gates remain open.

The course keeps five boundaries:

- recommendations are soft and never lock deliberate exploration;
- input, retrieval, interaction and production are distinct learning touches;
- optional documents, references and illustrations create no mastery or review debt;
- progress claims come from current instruments and reproducible commands;
- content quality and CEFR discipline outrank feature count.

## Current sequence

**The source-led A1–B1 completeness program comes first.**

The direction tracks are open in parallel with it, by owner decision, and content PRs interleave
between track PRs rather than blocking them. Track order: accounts and sync first, then mobile,
then the extensive-reading corpus, then cross-links and Referenz.

1. **Complete the source-led A1–B1 quality program.** “Complete” always names a denominator:
   internal grammar, an external structure inventory, the Goethe Wortliste and teaching depth are
   four separate questions and none stands in for another. The German-medium edition is outside this
   gate. Where they stand: internal grammar A1 28/28, A2 46/46, B1 32/32; external DTZ A1 93/93,
   A2 300/300, B1 164/164; lexical 673/673, 1449/1449, 3416/3416; Themen 70/70; Sprachhandlungen
   38/41.

   What is left is **P27-3g topic-quality waves**: every topic receives a bounded article, exercise,
   reading, audio and vocabulary pass under the shared
   [content-quality contract](authoring/content-quality-audit.md). A1 and A2 are done and logged in
   the [topic ledger](curriculum/topic-quality-audit.md); B1 remains. The derived findings queue
   being empty is not the stop condition — every A1 and A2 wave found substantive defects the queue
   could not see. B1 may be called `100% des DTZ-Inventars` at 164/164, and is never labelled all
   conceivable B1 grammar.

2. **Read the cadence between the windows, not on top of them.** Drain the grading queue to zero,
   rerun `bun run progress:audit --profile vitaly`, and only then read the weak-focus table. This is
   P5-11 and it is not optional: a drill authored from a pre-triage table targets a confusion the
   scorer invented.
3. **Treat the A2 checkpoint read as the next revision trigger.** The A1 cohort read has fired;
   its verdict is under *Retention gate* below.
4. **Then the five direction tracks below**, in the order the owner sets. Each names its ADR and its
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

**A miss opens revision work; it does not stop authoring.** Applied literally the rule would halt
the curriculum on evidence covering under half of a level, so revision runs alongside authoring
rather than in place of it.

**Current reading: A1 retention is weak on what has been measured**, and roughly half of A1 has
never been measured at all, because those lessons were never opened. The action that follows is the
learner taking those lessons and their due probes — not authoring work. Rerun both commands above
before treating any of this as current.

## Direction tracks

Five named tracks. Each has an ADR that holds the reasoning and backlog entries that hold the work,
so a track can be picked up without re-deciding it. They run in parallel with the quality program,
in the order the owner sets.

### Redaktion · P27

Redaktion is being rebuilt as a local repository-backed editorial workstation, independently of
learner features. The delivery sequence is intentionally vertical: each milestone must leave one
complete editorial path usable rather than adding another disconnected report.

**Standing:** ADR 0013 and the A1–C2 grammar contract; the checkout picker and restricted Bun
sidecar; the Grammatikatlas with navigation from a point through focus, topic and material; the
shared non-executable preview, editor mode, revision conflicts and atomic Save.

**Open, in order:**

1. **P27-3 · Themen workspaces** — readiness dimensions, curriculum relations, outcomes, lesson
   stages, materials, standards and a complete rejection explanation for the reviewed gate.
2. **P27-4 · Materialien index** — load all graph chunks, full-text and faceted search,
   URL-persisted filters, preview drawer and playback of committed audio without studio functions.
3. **P27-5 · Qualität and Referenzen** — one severity-based diagnostic model, keeping inventory
   coverage, external alignment, teaching depth and unknown source territory visibly distinct.
4. **P27-6 · hardening and macOS delivery** — dependency-aware invalidation, background jobs,
   security/integration/accessibility suites, `.app`/`.dmg` and a CI smoke build. Windows and Linux
   remain build-target preparation only.

Renderer parity is the one piece of P27-2 still owed: nine image and reference figures use named
semantic editor representations and must migrate to the same React implementations the learner
sees before pixel parity can be claimed.

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

**The studio is the track.** Scenes are the one artifact model, Tonwerk is its only interface,
the Lesetexte narration queue and the human approval queue are both live, and consent-gated voice
cloning is a publishable production path. What the track owes next is in
[the backlog](backlog.md#tonwerk-audio-studio): per-variant QA reports, a render reaper and a disk
figure, the missing reverb tail, and the corpus validator's pre-consent cloning rule.

A recurring **character ensemble** is a separate and later question, recorded as **proposed**
rather than accepted — the pro-argument that survives scrutiny is
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
grading queue is empty; and delayed evidence has been reviewed honestly. The catalog and the
coverage commands are there. What is not yet there is the B1 topic-quality wave and an honest read
of the delayed evidence — and shipping the catalog was never a claim that a competence was retained.
