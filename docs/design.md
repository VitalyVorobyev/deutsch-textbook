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

There is no account service and no server-side learner model. Content is build-time data; learner
state belongs to a local profile and can be exported as a backward-compatible snapshot.

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

`src/lib/schemas.ts` is the source of truth for content shapes. Astro collection loading proves
that individual records conform; `scripts/validate.ts` enforces relationships that schemas cannot
see, including identity/filename parity, curriculum ownership, unresolved references, language
parity, outcome measurement and canonical relation uniqueness.

The principal sources are:

- `content/topics/`: curriculum articles and their owned artifact references;
- `content/vocab/`: canonical flashcard entries;
- `content/exercises/`: pretests, practice, drills, checkpoints and delayed probes;
- `content/reading/` and `content/documents/`: comprehensible input and reusable stimuli;
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

`src/lib/curriculum.ts` loads the atlas graph and ordered spine. Prerequisites block automatic
selection; `deepens` and shared focus tags reactivate earlier knowledge without duplicating a
lesson. Navigation is soft: the system recommends a next step but does not prevent deliberate
exploration.

A normal learning cycle combines:

1. a pretest that samples prior knowledge without teaching credit;
2. an article and comprehensible input;
3. controlled retrieval and fresh-context production;
4. mixed training across eligible topics;
5. an optional level checkpoint;
6. novel 2/7/21-day probes of one competence per family.

`src/lib/training.ts` builds interleaved sessions. `src/lib/decks.ts` owns the SRS queue rule and
daily new-card budget. `src/lib/probes.ts` derives delayed-probe state from attempts; probe state is
not stored separately.

## Evidence model

Exercise roles and response modes prevent presentation from masquerading as evidence.
Automatically scored retrieval and comprehension can contribute verified evidence. Open writing
and speaking are logged as visible, unverified practice and never raise accuracy or mastery.
Self-assessed speech is therefore useful activity, not a correctness measurement.

`src/lib/mastery.ts` derives topic evidence and mastery. `src/lib/weakness.ts` aggregates
focus-tag errors. High recognition or ordering scores do not override weak productive evidence;
the progress audit is the decision surface for remediation.

Opening a reading, reference page, Wortfeld or Wortnetz creates neither mastery nor review debt.

## Progress and storage

`src/lib/profile.ts` resolves local profiles. Each profile owns an IndexedDB database managed by
`src/lib/store.ts`; same-day UI resume state lives separately in localStorage. Snapshot validation
and explicit v1–v5 migrations live in `src/lib/snapshot-schema.ts`, with deterministic merge
semantics in `src/lib/snapshot-merge.ts`.

The web app exports snapshots. Development middleware and the Tauri filesystem path can
automatically write them to `progress/<profile>/`. `bun run progress:audit` reads the latest
snapshot, grading rulings and current content contract to produce the evidence table used for
drill decisions.

## Multilingual rendering

English and Russian are the core explanation halves; Ukrainian is required wherever a translated
scope has entered the Ukrainian wave. German-medium explanation halves begin with B1 content.
`src/lib/prefs.ts` selects the requested half and defines fallback behavior; `src/lib/langcheck.ts`
and the validator enforce parity and alphabet discipline.

German examples are source language, not proof that a record has a German-medium explanation.
This distinction matters in reference data and Wortnetze.

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

- Change a content shape in `src/lib/schemas.ts`, collection wiring and validator/tests together.
- Change persisted state only with an explicit migration and old-snapshot tests.
- Change curriculum identities only before learner data exists, or with a documented migration.
- Change evidence semantics only with production-scoring, mastery and audit tests.
- Add a reference/discovery surface without completion state unless it becomes an intentional
  learning activity with a separately designed evidence contract.

The active product sequence is maintained in [`roadmap.md`](roadmap.md) and executable tasks in
[`backlog.md`](backlog.md).
