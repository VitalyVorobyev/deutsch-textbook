# ADR 0001: The repository is the content database

Status: accepted · 2026-10-18

## Context

Deutsch-Atlas has one author-editor, many agents and three applications reading the same course:
the learner app, Redaktion and Tonwerk's publish path. Every content defect this project has found
came from two artifacts that were supposed to say the same thing and drifted: a link list that
named a topic which had moved, a frontmatter field the manifest also carried, or a count typed into
a page by hand. A CMS or a second content store would add one more copy to drift.

## Decision

**The checked-out repository is the only content store.** `content/` holds what learners see,
`data/` holds the instruments and external anchors, and both are plain text that Git diffs. No
application keeps an editorial database, an import step or a cache that outlives a rebuild.

- **Zod schemas in `@da/schema` are the single contract** for every content shape. The Astro
  collections, the validator, Redaktion and Tonwerk's Scene contract all import them; nobody
  restates a shape.
- **`contentGraph()` (`@da/content`) is the one pass over the corpus.** Every measurement, profile
  and editorial view is computed from it. A malformed file degrades to a `note` instead of
  throwing, because the graph is what an editor reads *while* authoring.
- **A relation that matters is data, never a hand-written link.** Topic ↔ Referenz, topic ↔ topic
  and "see also" edges come from focus tags, `deepens` and reference keys. Where an editorial
  relation has no datum behind it, the curriculum gains the datum. That also makes the relation
  visible to training, drills and the coverage instruments, which a link list never is.
- **Every published figure is computed from content at build time** (`/about`, coverage, Redaktion
  dashboards). A number typed by hand is a claim nobody re-checks.
- **Identities are contracts.** Topic, item, outcome, deck and card ids are persisted in learner
  history. Renaming one is a migration, never an edit.

## Consequences

- `bun run validate` is the gate for every content change, and it can see only what the schema
  and the graph can see. Item semantics stay a review job; that is the price of text files.
- A browser module never imports a filesystem module: `@da/content` exports per module, and pure
  values live in `@da/schema`.
- Redaktion and Tonwerk write files the learner build will read. Their write paths are part of
  this contract ([ADR 0010](0010-editorial-tools-are-separate-apps.md)).
