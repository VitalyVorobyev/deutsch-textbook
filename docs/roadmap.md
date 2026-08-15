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

*Amended 2026-08-05 (owner decision):* the direction tracks open now, with the B1 Wortliste tail
(lexis waves 2–4) still owed — the remaining waves interleave as content PRs between the track PRs
rather than blocking them. Track order: accounts/sync surface first, then mobile, then the
extensive-reading corpus, then cross-links/Referenz.

1. **Complete the source-led A1–B1 quality program.** “Complete” always names a denominator:
   internal grammar, an external structure inventory, the Goethe Wortliste and teaching depth remain
   separate. The German-medium edition is outside this gate.

   - ~~P27-2a trustworthy Redaktion preview~~ — shipped: safe one-language rendering and language
     visibility make source review possible.
   - ~~P27-2b denominator contract~~ — shipped: DTZ is the cumulative A2–B1 external anchor, with
     alignment separated from internal coverage and learner mastery.
   - ~~P27-3a A1 grammar wave~~ — shipped: internal 28/28, external 93/93, lexical 673/673, no A1
     structure without a delayed probe, depth medians 13 teaching / 9 production / 4 files.
   - ~~P27-3b A2 grammar wave~~ — shipped: internal 38/38, lexical 1449/1449, all thirteen A2
     article-section findings cleared and the eight A2 structure-level probe gaps closed.
   - ~~P27-3c DTZ tail~~ — shipped: eight exact teaching slices close internal A2 at 46/46 and the
     cumulative external denominator at A2 300/300 and B1 164/164, while preserving A2 depth at
     8 teaching / 6 production / 3 files.
   - ~~P27-3d A2 findings~~ — shipped: nine intensive texts manually reviewed, arithmetic length
     findings retired, three open document tasks corrected to `write`, all claimed spoken modes
     delivered and the last two A2 tag-level probe gaps closed.
   - ~~P27-3e residual findings~~ — shipped: the six deterministic A1 translations declare an
     honest graded surface, both remaining B1 tags have independent delayed families, all 17 former
     reading-length signals have been read by hand, and the live profile queue is empty.
   - ~~P27-3f B1 lexical tail~~ — shipped: all 73 rows classified one by one; 12 recognition cards,
     six productive cards and 55 genuinely taught grammar/word-formation rows close B1 at
     3416/3416 with 0 missing and 0 late.
   - **P27-3g topic-quality waves are in progress:** A1's 11 original topics plus the new
     `wortbildung`, and all 24 A2 topics, have completed the bounded corpus pass; B1 remains. Each wave records
     substantive language, task, reading, audio and vocabulary decisions under one shared contract;
     it does not impersonate the separate human `reviewed` gate. B1 may be called 100% des
     DTZ-Inventars only at 164/164; it is never labelled all conceivable B1 grammar.
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

### Redaktion · P27

Redaktion is being rebuilt as a local repository-backed editorial workstation, independently of
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

The first post-merge slice is **P27-1a · navigation trust and queue semantics**. Its outcome is a
closed editorial loop rather than another report: every source action opens the in-app editor;
Back/Forward traverse app history; a dirty source buffer must consent before any link, filter,
search or history traversal discards it; empty focus details offer recovery actions; and advisory
profile findings are no longer presented as validator blockers. Validation is one browser scenario
from topic → article source → Back → Forward → dirty-buffer refusal/consent, repeated at
1440/1024/768, plus link-semantics and diagnostic-severity tests. The slice exits only when that
scenario passes without opening a new window or losing a draft.

**P27-1b · learning-activity architecture shipped 2026-08-14.** Every topic-owned teaching set now
has an explicit purpose, stage and German title. The migration replaced file-count arithmetic with
topic-wide evidence and activity-contract checks, moved 21 productive items out of six overloaded
cores, added four missing application activities, and made the learner page and Redaktion present
the same four-function model. [ADR 0014](adrs/0014-learning-activity-architecture.md) owns the
contract; [the activity audit](curriculum/learning-activity-audit.md) records all 172 sets and the
five intentionally dense topics.

**P27-2a · trustworthy preview foundation shipped 2026-08-14.** The regex preview is gone. A
non-executable MDX projection selects one authored language half, renders Markdown through shared
pure React components, reports unsupported syntax, exposes topic language coverage and gives every
exercise an answer-disclosed editor view with no progress writer. Every current topic parses in a
corpus fixture and the browser audit exercises the source route at 1440/1024/768. The remaining
renderer-parity work is migration of the nine image/reference learning figures from named semantic
editor representations to the same React implementations used by the learner.

**P27-2b · external grammar denominator is classified.** [ADR 0015](adrs/0015-provable-course-completeness.md)
separates external alignment, internal catalog coverage, teaching depth and learner mastery. The
23-row DTZ tail is grouped into coherent teaching slices in the
[A1–B1 audit ledger](curriculum/a1-b1-completeness-audit.md); `mod-wie` was the one exact existing
match, leaving 22 rows open at classification time. P27-3a then closed the four A1 internal gaps
and the full new A1 `wortbildung` topic removed DTZ `-chen`; the A2 wave then closed all three
internal gaps without changing the still-open external tail.

**P27-3a · A1 grammar quality wave shipped 2026-08-14.** Internal A1 grammar is now 28/28,
external alignment remains 93/93 and the DTZ tail is 21 after the complete `-chen` slice. The new
`wortbildung` topic and the coordination/demonstrative expansions have explicit scaffold,
fade/transfer and delayed probes. Four older A1 confusions without probes now have three variants
each; all A1 explanation articles have named decision-level sections. A1 depth rose to medians of
13 teaching items, 9 productive items and 4 files, with zero taught structures lacking a probe.
**P27-3b · A2 grammar quality wave shipped 2026-08-14.** Internal A2 grammar is 38/38 and lexical
coverage remains 1449/1449. Reciprocal pronouns, interrogative determiners and duration with
*über* now have named owner sections, scaffolded practice, transfer and parallel delayed probes.
The thirteen A2 no-subsection warnings and all eight structure-level no-probe gaps are closed;
touched topics remain `draft`.

**P27-3c · A2 DTZ-tail wave shipped 2026-08-15.** The 21 external rows are now represented by
eight exact points with owner sections, scaffold, productive transfer and three-variant probes.
Internal A2 is 46/46; A2 is 300/300 and cumulative B1 is 164/164 against DTZ. Twelve extra
productive transfer items preserve the existing A2 depth ratchet at 8 / 6 / 3 after the denominator
grew. The result is explicitly `100% des DTZ-Inventars`, not completeness of every conceivable B1
grammar catalog.

**P27-3d · A2 findings wave shipped 2026-08-15.** The eight length findings covered nine intensive
texts, all read by hand; word count remains visible but no longer creates a defect. One real causal
flaw in the apprentice story was corrected. Three underdetermined document translations became
functional `write` tasks, three missing spoken modes received genuine scenarios, and the last two
A2 tag-level probe gaps received parallel delayed families. A2 now contributes no open profile
findings.

**P27-3e · residual findings wave shipped 2026-08-15.** Six deterministic A1 translations now
declare the smallest meaningful graded surface without inventing grammar tags for formulaic
language. `pronomen-stellung` and `relativ-praeposition` each have a fresh, homogeneous,
three-variant delayed family with exact arming. The five A1 and four B1 texts behind the remaining
historical length signals were read for purpose, coherence, load, glosses and questions; none had a
content defect worth changing. Together with P27-3d, all 17 have now received human editorial
review. The derived A1–B1 topic-profile queue is empty; P27-3f owns the B1 lexical tail and the
remaining topic-by-topic audit, so zero findings is a milestone rather than proof that the entire
course has finished human review.

**P27-3f · B1 lexical tail shipped 2026-08-15.** The 73-row remainder was re-audited rather than
blanket-marked as grammar. Twelve written labels and official long forms now have recognition cards,
six frequent independent forms have productive cards, and 55 true bound pieces/frames are backed by
addressable teaching and a B1 decoding extension. Coverage is 3416/3416: 3297 card rows, 119 grammar
rows, no missing or late entries. The [audit ledger](curriculum/a1-b1-completeness-audit.md) records
every disposition. P27-3g now owns the remaining human topic-by-topic content audit.

**P27-3g · A1 topic-quality wave shipped 2026-08-15.** All 12 current A1 topics (11 of the
original 49 plus the new `wortbildung`) were read as complete profiles under the shared
[audit contract](authoring/content-quality-audit.md). The pass confirmed that dense topics split
sets by function and learning stage rather than arbitrary item counts. It also found a defect that
the derived queue could not: `freizeit-koennen` treated an availability question as an invitation
and modelled *Hast du Zeit? — Ja, gern!*; the article now distinguishes the speech acts in all
three support languages. The associated reading's singular *Kuchen* gloss and feedback were also
corrected. The [topic ledger](curriculum/topic-quality-audit.md) records decisions per topic; draft
statuses remain pending human approval.

**P27-3g · A2 topic-quality wave shipped 2026-08-15.** All 24 A2 profiles were read across article,
114 teaching/remediation sets, 42 readings, listening flows, documents and 271 entries in 19 owned
decks. The empty diagnostics queue missed five substantive defect clusters: a Bürgeramt recording
mixed Anmeldung with Personalausweis, the course invented a closed list of dative verbs, register
guidance banned `du` with every stranger, past-tense/auxiliary advice used false absolutes, and the
habitual/specific evening contrast was overstated. These contracts are corrected; the obsolete
recording is retired until a human approves an exact replacement, and the substantively changed
`verben-mit-kasus` topic returned to `draft`. Ten dense profiles were retained only where every set
owns a distinct decision, stage or medium. The [topic ledger](curriculum/topic-quality-audit.md)
records all 24 decisions.

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
