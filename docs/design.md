# Deutsch-Atlas technical design

This document is the stable map of the implemented system. It explains where contracts live and
how data moves through the product. It deliberately does not repeat the authoring rules in
[`CLAUDE.md`](../CLAUDE.md), which remains authoritative for language, pedagogy and content
quality.

## System boundary

Deutsch-Atlas is a local-first Astro application whose source content is part of the repository.
Astro renders the textbook and reference surfaces; React islands provide stateful exercises,
sessions, flashcards and progress views. A thin Tauri shell adds desktop filesystem integration
without changing the learning model.

Redaktion is a separate React/Tauri workbench for that same repository. Its webview has no direct
filesystem or shell authority: a compiled Bun sidecar loads `@da/content`, watches the selected
checkout and accepts the narrow read, revision-checked save and validation contract in
[ADR 0013](adrs/0013-redaction-repository-workbench.md). Browser development implements the same
`CorpusClient` through Vite middleware. Neither transport creates a second content store.

Editorial MDX preview crosses that boundary as data, never executable code. `@da/content/preview`
parses the in-memory buffer into a serializable allowlisted tree, selects exactly one authored
`En`/`Ru`/`Uk`/`De` half and turns expressions, raw HTML and unknown components into visible
diagnostics. Known figure imports are recognised by spelling but never resolved or executed.
`@da/renderers` renders the tree and disclosed exercise metadata without learner storage or
progress effects. Both Vite and the Bun sidecar expose the same `renderSource` request.

Tonwerk is the third application and the only one that is not a repository reader. It is a React app
served by, and talking exclusively to, a local Python engine (`atlas-listening`) on `127.0.0.1:8765`,
authenticated by a bearer token minted per run and never written to disk. It opens no files and
imports nothing from the workspace except the Scene v1 contract in `@da/schema`; the engine owns the
database, the models, the renders and the publish path. It is the studio's only interface.

There is no server-side learner model. Content is build-time data; learner state belongs to a local
profile and can be exported as a backward-compatible snapshot. An optional account adds a cloud copy
of that snapshot and nothing else — the server has never parsed one.

## Content pipeline

```text
content YAML / MDX
        │
        ├── src/content.config.ts ── Astro collections ── pages and components
        │
        └── scripts/validate.ts ─── schemas + cross-file invariants
                         │
                         └── bun run validate / test / check / build
```

`packages/schema/src/index.ts` is the source of truth for content shapes. Astro collection loading proves
that individual records conform; `scripts/validate.ts` enforces relationships that schemas cannot
see, including identity/filename parity, curriculum ownership, unresolved references, language
parity, outcome measurement and canonical relation uniqueness.

The principal sources are:

- `content/topics/`: curriculum articles and their owned artifact references;
- `content/vocab/`: canonical flashcard entries;
- `content/exercises/`: pretests, practice, drills, checkpoints, delayed probes, level
  placement tests and non-trainable exam-practice sets;
- `content/reading/` and `content/documents/`: comprehensible input and reusable stimuli;
- `content/listening/`: reviewed committed audio stimuli with exact transcripts and provenance;
- `content/atlas.yaml`: graph relationships, outcomes and ordered curriculum spine;
- `content/wortfelder/`: topical lexical overlays;
- `content/wortnetze/`: cross-topic word families and meaning contrasts;
- `content/reference-data/` and `content/discovery/`: canonical lookup data and optional editorial
  material.

## Stable identities

Persisted identities are contracts, not display text:

- a topic is identified by its topic `id`;
- an outcome by its atlas outcome `id`;
- an exercise attempt by `(set-id, item-id, revision)`;
- a vocabulary card by its existing deck/headword/direction identity;
- a Wortnetz and its members by stable local ids.

Exercise `revision` changes only when the prompt, accepted answer, scoring contract, outcomes or
focus semantics change. Historical attempts retain their original result and revision. Wortnetze
may refer to an existing `{deck, de}` card but never create or rename cards automatically.
Receptive-only members have no mastery identity.

## Curriculum and learning flow

`packages/content/src/curriculum.ts` loads the atlas graph and ordered spine. Prerequisites block automatic
selection; `deepens` and shared focus tags reactivate earlier knowledge without duplicating a
lesson. Navigation is soft: the system recommends a next step but does not prevent deliberate
exploration.

The spine orders **topics**; `data/grammar-inventory.yaml` describes the **grammar** the topics
teach, and the two are deliberately separate dimensions. Each inventory row carries a `track`, a
`strand` (one of ten grammatical systems), a `level: {reception, production}` pair — the published standards are
reception standards and this is a production course, so one number could not hold both — `deepens:`
edges naming the rows it is the deeper pass over, and `claims:` citations into
`data/strukturenlisten/`, the external inventories the denominator is measured against
([ADR 0011](adrs/0011-external-grammar-anchors.md)). Grammar uses a dedicated A1–C2 CEFR contract;
this does not extend the levels the learner runtime publishes. The explicit track catalog supplies
the stable rows of Redaktion's Grammatikatlas. Nothing in the learner runtime reads any of it: the
fields exist so the curriculum can be audited along the language's own axes rather than only along
the spine, which is what Redaktion renders and what `scripts/structures.ts` and
`scripts/grammar-depth.ts` measure.

A normal learning cycle combines:

1. a pretest that samples prior knowledge without teaching credit;
2. an article and comprehensible input;
3. controlled retrieval and fresh-context production;
4. mixed training across eligible topics;
5. an optional level checkpoint;
6. novel 2/7/21-day probes of one competence per family.

A learner who does not start from zero may take the level's placement test first. It decides per
topic rather than per level, and a passed topic leaves the recommended path without being taught.
`src/lib/placement.ts` owns that rule; `getPlacements()` discovers the sets by role, so a new
level's entry test is content rather than code.

`src/lib/training.ts` builds interleaved sessions. `src/lib/decks.ts` owns the SRS queue rule and
daily new-card budget. `src/lib/probes.ts` derives delayed-probe state from attempts; probe state is
not stored separately. Every probe family authors exact `setId::itemId` arming keys; outcome,
topic, reading and pretest activity cannot arm it implicitly.

`/pruefung/a1` is a separate exam-practice surface. Its attempts are retained, but the role is
excluded from mixed training and does not grant mastery. Item-scoped `stimulus` references override
set-scoped documents, and the `form` item keeps stable field ids plus per-field scoring.

## Evidence model

Exercise roles and response modes prevent presentation from masquerading as evidence.
Automatically scored retrieval and comprehension can contribute verified evidence. Open writing
and speaking are logged as visible, unverified practice and never raise accuracy or mastery.
Self-assessed speech is therefore useful activity, not a correctness measurement.

`target_mode` records the CEFR skill an item practises independently of the actual response widget.
Focused free-typed tasks may carry `focus_evidence` response predicates. Where an item declares
them, the attempt carries an explicit `retained`, `failed` or `unknown` verdict and that verdict
decides attribution — an unmatched whole-sentence error is not guessed into the weakness signal.
Where an item declares none, the attempt carries no verdict and attribution stays as it was
(`key_tokens` for `translate`, `dictationSlip` for `listen`). Predicates are **additive on purpose**:
silencing every unmatched free-typed miss corpus-wide was measured against the learner's log and
inverts the signal rather than gapping it ([archive](archive/2026-08-doc-slimming.md), backlog
P12-6). Checkpoint scores exclude both open writing and speech while their attempts still count as
coverage.

`src/lib/mastery.ts` derives topic evidence and mastery. `src/lib/weakness.ts` aggregates
focus-tag errors. High recognition or ordering scores do not override weak productive evidence;
the progress audit is the decision surface for remediation.

Topic-owned teaching sets follow the learning-activity contract in [ADR
0014](adrs/0014-learning-activity-architecture.md). `role` controls runtime/evidence semantics;
`stage` states scaffold, fade or transfer intent; `activity` states purpose (`core`, `extension`,
`application`, `remediation`); and the graph derives medium (`mixed`, `listening`, `document`). Every
topic has exactly one 8–15-item core matching `primary_practice` and at least one productive
application. The learner page groups sources by purpose rather than rendering one equal card per
file. `bun run activity:audit` is the inventory; item-mix validation remains per topic.

A passed placement is a third evidence class. It is real evidence and it removes a topic from the
recommended path, but it is not a measurement of mastery and never raises the measured tier — a
placement set belongs to no topic, so topic tier derivation cannot observe it at all. Navigation
and the badge deliberately answer different questions.

Opening a reading, reference page, Wortfeld or Wortnetz creates neither mastery nor review debt.
Opening or replaying a listening artifact likewise creates no evidence; only its independently
identified exercise question can write a verified attempt. The published MP3 lives beside its record
in `content/listening/`, never under `public/` — the WAV master stays in the studio, because it is
what QA ran on and what the editor approved, not what a learner downloads.
`PUBLIC_ATLAS_AUDIO_BUNDLE=1` copies the MP3s into a build, and **both shipping builds set it** —
`bun run build:desktop` (in-process rather than as a shell prefix, so the Windows release build can
run the same command) and the Cloudflare build. The flag therefore distinguishes a shipping build
from a lean one with no binaries, not the desktop from the web
([archive](archive/2026-08-doc-slimming.md)). TTS remains the live fallback for a recording that is
absent or fails to load (`src/integrations/audio-bundle.ts`, `src/lib/audio.ts`).

## Listening authoring boundary

`tools/listening-studio/` is a local Python editorial service, not a learner service. SQLite keeps
immutable revisions outside the repository, and [Tonwerk](apps/tonwerk.md) is the only interface to
it.

**A scene is the one artifact model.** Dialogue and narration are two kinds of one document
(`@da/schema/audio-scene`, Scene v1): a cast, utterances, an acoustic setting and a soundscape.
Rendering is a graph over that document — synthesis per line, then pace, placement, difficulty
deltas and mixing in a separate stage — so a take can be re-paced or re-placed without asking the
model again, and a warm render is a cache walk. Every render is keyed by the scene's own sha256 and
is therefore true of exactly one revision; saving an edit creates a new revision and returns the
project to `draft`.

**The line the whole subsystem is built on is between what a machine measured and what a person
vouched for.** QA is automatic: transcription against the script, speaker-embedding drift, pause and
bed loudness. Approval is not. An approval is a named person, a checklist the engine refuses to
accept incomplete, and the sha256 of the master they listened to — so a re-render invalidates it
rather than inheriting it, which is what `stale` names. Automatic scores are warnings whose bounds
can only be derived from an already-reviewed corpus; transcription and embedding similarity are
never proof of natural pronunciation or of human approval.

A committed listening artifact has a published MP3, a canonical `content/listening/` record, an
exercise set referenced by its topic, and a `data/audio-provenance/` manifest pinning both the
approved master and the published derivative. Publishing refuses unapproved revisions, approvals
that vouch for no bytes, existing targets, and topics with nowhere to reference the set from.
Guarded republishing checks the existing slug and hash, retains the previous bundle, stages the full
replacement and rolls back a partial failure. Model licences and training-data provenance remain
separate claims from any of this.

A character owns one versioned voice profile — voice, fixed seed and baseline style — and a line's
cache identity includes that resolved profile, so a new variant for one character invalidates all
and only that character's lines. Sound is a second registry beside speech, because the two protocols
take different requests; a scene's sound is either a reference to bytes that exist, by digest, or a
prompt and a seed for bytes that do not.

High-quality reading narration is a second bounded corpus on the same model. The Lesetexte are
narrated as scenes, assembly derives exact cue points, approved MP3s live in
`content/reading-audio/` with provenance under `data/audio-provenance/readings/`, and the learner
gets one full-text player with paragraph seek, with browser TTS only as a load or missing-artifact
fallback. Changing one paragraph reuses every other paragraph's cache entry but invalidates the
master and its approval.

Vocabulary is deliberately a different boundary. Generating every headword, example, direction and
speed variant would multiply review and invalidation cost past what the review can carry, so word
cards keep browser TTS. A later canonical headword cache may be added for listening-mode cards, but
only with stable card and audio identity and the same exact-byte review and provenance rules — not
by treating dynamic examples as listening artifacts.

**Voice cloning is consent-gated, and consent is bound to bytes.** A consent document names the
exact SHA-256 of one reference recording and one scope: `evaluation` permits local work only, while
`publication` additionally requires a permitted use that explicitly allows publishing in this
course, a retention statement, and — for a minor — guardian consent and guardian-attested assent. A
cloned voice may be cast in published course audio only under a `publication` scope; a withdrawal is
recorded with its date rather than deleted, because a provenance record that edited itself on
withdrawal would be a false one. Nothing is recorded in the browser: a re-encode on the way in would
silently break the binding to exact bytes. The policy is
[product-protection.md](authoring/product-protection.md); this is the mechanism.

The research benchmark is a separate boundary again. It has its own model lock, writes only beneath
local application data, refuses course-repository output, never imports the publisher, and its
results cannot be exported into the course. Any later adoption is a separate product, policy,
provenance, model-lock and export-safeguard decision.

## Progress and storage

`src/lib/profile.ts` resolves local profiles. Each profile owns an IndexedDB database managed by
`src/lib/store.ts`; same-day UI resume state lives separately in localStorage. Snapshot validation
and explicit v1–v7 migrations live in `src/lib/snapshot-schema.ts`, with deterministic merge
semantics in `src/lib/snapshot-merge.ts`. Snapshot v7 relocates the A1 Wortliste card identities
through the committed old-id → new-id inventory; collision merging preserves the most advanced
FSRS record and never duplicates a direction.

The web app exports snapshots. Development middleware and the Tauri filesystem path can
automatically write them to `progress/<profile>/`. `bun run progress:audit` reads the latest
snapshot, grading rulings and current content contract to produce the evidence table used for
drill decisions.

An optional account adds a third destination: `src/lib/sync-remote.ts` uploads a gzipped snapshot
to `/api/sync/snapshot` and pulls the other device's before merging it locally. Local-first is
unchanged by it — with no account every call is a no-op. `bun run progress:pull` brings the cloud
copy back to `progress/<profile>/` so the personalization loop is unaffected. The reasoning is
[ADR 0003](adrs/0003-opaque-snapshot-sync-and-approval-accounts.md); the operations are
[`cloud-sync.md`](architecture/cloud-sync.md).

## Delivery and offline

The site is a static build served at `deutsch.vitavision.dev` from a Cloudflare Worker's static
assets (`wrangler.toml`), deployed by the Cloudflare Git integration watching `main`. The Worker's
`main` entry exists for `/api/*` alone — accounts and snapshot sync (`worker/`, D1 + R2); every
other path is handed straight back to the asset server. **There is deliberately no GitHub Actions
deploy**: two paths watching one branch race each other on every push, and `ci.yml` already gates
`main`. The site is served at the root — `withBase` (`src/lib/url.ts`) remains the one helper, so a
subpath mirror and the Tauri shell stay possible. `public/_headers` carries the response headers, of
which one is load-bearing: a cached `sw.js` strands an installed learner on an old build
permanently. The same build is an installable PWA: `src/integrations/pwa.ts` emits the manifest and
the service worker at `astro:build:done`, pinning a build id that is the content hash of everything
precached, so a no-op rebuild does not invalidate a learner's cache.

Three caches on three lifecycles. The **shell** is precached and versioned — content-hashed
`_astro/` assets, the icons and the offline page. **Documents** are network-first and versioned,
because each page inlines its content at build time and stale HTML is stale course material.
**Media** is cache-first and deliberately *unversioned*, because reviewed recordings are immutable
and re-downloading the whole MP3 corpus on every deploy would be the most expensive thing the worker
could do. Both budgeted caches evict oldest-first against a byte budget rather than an entry count,
because page weight in this build spans two orders of magnitude (backlog P23-1).

Two behaviours carry the offline promise and are covered by `tests/service-worker.test.ts`, which
evaluates the substituted template rather than a re-implementation: Range requests are sliced out
of the cached body into real 206s (Safari sends `Range` for every `<audio>` element, and a cached
200 is why offline audio silently fails on iOS), and eviction moves a re-visited entry to the back
of the order. Updates are never applied silently — `sw.js` waits and the learner presses the
button, because reloading mid-exercise discards the attempt about to be logged.

## Multilingual rendering

English and Russian are the core explanation halves; Ukrainian is an independently authored half —
written from the German, never from a sibling half — required wherever a scope has entered a
Ukrainian authoring wave (a wave is a scope of files, not a mode of writing). German-medium
explanation halves ship with B1 content and are never backfilled to A1/A2. `src/lib/prefs.ts`
selects the requested half and defines fallback behavior; `packages/schema/src/langcheck.ts` and the validator
enforce parity and alphabet discipline.

Vocabulary keeps a complete standalone `en` gloss and may add `en_compact` for the dual-language
card surface. The compact form is used only when `pickSecond` resolves an actual RU/UK half;
EN/DE modes and a missing-UK fallback continue to show full English.

German examples are source language, not proof that a record has a German-medium explanation.
This distinction matters in reference data and Wortnetze.

Redaktion derives per-topic language coverage from authored `<Bilingual>` blocks. A language is
`complete` only when every block carries its half, `partial` when some do, and `unsupported` when
none do. The count is editorial visibility, not a request to backfill German.

## Reference and discovery extensions

Reference pages are read-only projections of canonical content. Wortfelder organize words by
topic; Wortnetze organize them by family or meaning contrast. A Wortnetz relation states both its
type and its basis:

- `current-meaning` for a synchronically useful relation;
- `historical` for an etymological claim, requiring an authoring source note;
- `mnemonic` for a visibly labelled memory bridge that must not be taught as a productive prefix
  rule.

The flashcard back may show at most two compact relations from the same canonical network data.
Adding such context must not change card ids, SRS scheduling or snapshot state.

## Change boundaries

- Change a content shape in `packages/schema/src/index.ts`, collection wiring and validator/tests together.
- Change persisted state only with an explicit migration and old-snapshot tests.
- Change curriculum identities only before learner data exists, or with a documented migration.
- Change evidence semantics only with production-scoring, mastery and audit tests.
- Add a reference/discovery surface without completion state unless it becomes an intentional
  learning activity with a separately designed evidence contract.

The active product sequence is maintained in [`roadmap.md`](roadmap.md) and executable tasks in
[`backlog.md`](backlog.md).
