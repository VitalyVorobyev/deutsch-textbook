# packages/ — the shared workspace packages

Claude Code loads this file when you work in this directory; the root [`CLAUDE.md`](../CLAUDE.md) applies too.

**Where the code lives.** A Bun workspace. `content/` and `data/` stay at the root because they
belong to no single app, and the learner app is the **root package** — Astro requires its content
collections under the project root (the reason is recorded beside `workspaces` in `package.json`).
Four packages, divided by what may be imported where:

| Package | What it is | May it touch `node:fs`? |
| --- | --- | --- |
| `@da/schema` | content shapes (Zod), gloss markup, letter-set checks, item-type classification | **no** — imported by React islands |
| `@da/grading` | does this answer count: `cloze`, `production`, `worddiff` | **no** |
| `@da/content` | reads the corpus: the graph, elements, all measurements, the payload | yes |
| `@da/ui` | Tailwind tokens + shared React primitives | **no** |

`@da/content` exports **per module, never a barrel** — `@da/content/focus-tags` must cost a browser
importer nothing. A pure value in an fs-opening module leaks the filesystem into the client bundle
and Vite externalises it silently; that is why `PRODUCTION_TYPES` lives in `@da/schema`.

**`contentGraph()` (`packages/content/src/graph.ts`) is the one pass over the corpus.** It is
memoised per root and **degrades a malformed file to a `note` rather than throwing**, because it is
the model an editor reads *while* authoring. Every artifact becomes an **`Element`** with its lesson
`stage`, pedagogical `activity`, derived delivery `medium` and the `touches` it delivers ([ADR
0002](../docs/adrs/0002-topic-manifests-and-learning-activities.md)): purpose (`core`, `extension`,
`application`, `remediation`) is never confused with media or with a file count.
`packages/content/src/profile.ts` turns that into per-topic checks and a ranked problem list,
**with no composite score**.
