# The content graph, the packages, and Redaktion

*Written 2026-08-14, when the editorial console stopped being a generated file and became an app.*

`CLAUDE.md` carries the rules. This carries the reasoning, and the measurements behind it.

## Why a graph at all

Eight modules walked `content/` independently: `scripts/validate.ts`, `coverage.ts`,
`grammar-coverage.ts`, `grammar-depth.ts`, `structures.ts`, `comprehensibility.ts`,
`authorship-provenance.ts`, and the console's own `model.ts`. Each re-parsed 336 YAML sets, 49 MDX
files and 129 decks, and each built the fraction of the graph it needed. There was no shared model;
there were eight partial ones — and a question spanning two of them had nowhere to be asked.

`contentGraph(root?)` builds it once. Three properties are load-bearing:

- **Memoised per root**, so every instrument in one `bun run validate` or one editorial page load
  reads the same object.
- **Never throws on a bad file.** A schema mismatch becomes a `note` and the graph still builds,
  because this is the model an editor reads *while* authoring; a tool that goes blank on the file
  you are editing is the one that is useless. `bun run validate` remains the gate.
- **It represents absences.** A model that can only hold what exists cannot report what is missing,
  and missing is what this repo keeps failing to notice — A1 published 100 % for months against a
  list that was itself incomplete.

## The Element, and the two properties nothing recorded

*Since [ADR 0012](../adrs/0012-topic-manifests.md) a topic answers half of this itself: its
manifest's `elements:` block names every part it owns, and the validator holds that list closed
against every artifact's `topic:` back-pointer. What follows is why the Element layer is still
needed on top of it — the manifest says **which** files a topic owns, and the Element says **what
each one does***.

Ask "what is this topic made of?" and the corpus gives four answers: a set says `role`, a reading
says `kind`, a listening artifact says `purpose`, an article says nothing. Some links are declared
both ways (topic ↔ set), some only from the far side (a document names its topic; the topic does not
name the document), and some exist only as a filename convention nothing checks (`probe-<topic>.yaml`)
or as a rule in prose (`primaryPractice` is "the first practice set in the array").

An `Element` is one row per artifact, whatever file it came from, carrying:

**`stage`** — position on the lesson cycle `CLAUDE.md` requires: pretest → model → scaffold → fade →
transfer → delayed-check. Derived from role and type, declarable as an exception. The cycle had been
an authoring convention with no representation in the data, so nothing could say what it said on the
first run: **3 elements at the transfer stage in the whole corpus** — all three the exam-practice
sets — against 151 at scaffold and 113 at delayed check. 48 of 49 topics ask for transfer never.

**`touches`** — input · retrieval · interaction · production. A topic can pass every gate in the
repo while feeding two of the four.

Neither is a score. Both exist so a profile can be *shown* against the level median.

## The metrics rule

`profile.ts` produces a **count** (14 yes/no checks), a **profile** (arc, touches, modes, depth) and
a **problem list**. Deliberately **no composite score**: a single number invites optimising the
number, which is the self-certifying-metric failure this repo already keeps a memory about. Every
distributional figure is read against the level median the report computes — the
`grammar-depth.ts` / `comprehensibility.ts` discipline.

What it found on the shipping tree, none of it visible to any gate:

| n | class | note |
| --- | --- | --- |
| 86 | `praxis`-Set under 8 items | `CLAUDE.md` says 8–15 |
| 50 | `praxis`-Set under 3 item types | |
| 48 | no transfer task | of 49 topics |
| 20 | `## Erklärung` with no `###` subsections | |
| 19 | focus tag with no probe | drilled, never re-asked |
| 17 | intensive reading outside 90–130 words | of 60, spread 78–152 |
| 9 | `translate` without `key_tokens` | 16 corpus-wide |
| 6 | inventory row no topic teaches | |
| 2 | outcome mode never exercised | |

**None of these is a validator failure, on purpose.** Making one a hard error today stops work on
eighty-six sets at once. They belong in an inbox that can be worked down deliberately, and the count
is the argument for doing it. Median teaching items per topic: A1 26 · A2 26.5 · B1 19.5; checks met
10 · 9 · 10.5 of 14.

## The package boundary, and the leak it is there to stop

`@da/content` exports **per module, never a barrel**. The reason is not tidiness. `PRODUCTION_TYPES`
— a `Set` of seven strings — lived in `grammar-depth.ts`, which opens `node:fs`. Importing the
item-type classification from a React view therefore pulled `node:fs`, `node:path`, `repo-root` and
`grammar-coverage` into the client bundle. **Vite externalised them silently and the page kept
working**, which is the worst way for a layering mistake to behave: no error, no symptom, until
something on that path actually runs. The Sets are facts about item types and now live in
`@da/schema`, which has no filesystem access at all.

The same class of silence: `Coverage.ownedBy` and `TagDepth.byType` are `Map`s, and
`JSON.stringify` turns a `Map` into `{}` without complaint. A view reading either would have found
an empty object and reported "nothing" rather than failed. `payload.ts` converts them.

## Why the learner app is not under `apps/`

Astro requires its content collections to live under the project root. With content at
`../../content` the globs resolve and the build then dies in "Rearranging server assets"
(`Received protocol 'astro:'`) on every MDX outside the root that imports a component; redirecting
`root` back at the repo produced a build with **zero pages** where there are 222. `content/` is
shared with the editorial app and belongs at the repo root, so the learner app stays there as the
workspace root package. Tried and reverted on 2026-08-14; recorded beside the `workspaces` field.

The attempt was not wasted: declaring workspaces switches Bun from hoisted to isolated linking, and
two dependencies this repo *uses and never declared* stopped resolving —
`@typescript-eslint/parser` (without which `astro-eslint-parser` cannot read a `.astro` frontmatter
at all, so every `.astro` file would have become silently unlinted while `eslint .` stayed green)
and `vite` (a direct `import type` in `progress-writer.ts`).

## Redaktion

`apps/redaktion` is a React SPA on a Vite dev server, not another Astro app: it is a single-page
tool with a client router, no SEO and no static pages, and it can never leak into the learner build
by construction. `plugin/corpus.ts` serves `/__graph` (~1.4 MB — structure, profiles, problems, all
four coverage reports) and `/__chunk/{items,vocab,texts}` (~8 MB, on demand), and re-reads the
corpus when a watched file changes. Same mechanism as `src/integrations/progress-writer.ts`, which
already writes snapshots into the repo during `astro dev`.

Two operational notes that cost time to find:

- It must run **under Bun** (`bunx --bun vite`). Vite loads its config through Node's strict ESM
  resolution, which rejects the extensionless relative imports inside `@da/content`.
- The **payload is memoised on the graph object** (`WeakMap`). Without it every request took ~7 s:
  the graph is memoised but the four coverage measurements it calls are not, and each walks the
  corpus again. That is the eight-passes problem one layer up — building the graph did not remove
  it, it moved where it has to be paid. 7.8 s cold, 6 ms after.

Verification is a headless browser walk over all eleven routes asserting zero console errors, not
"it compiled".

## Writing back: two fields, five rules, and one measurement that decided the design

`content/` is the source of truth and `git diff` on a topic is the editorial process. Both survive
exactly as long as it takes one tool to reserialise a file. So Redaktion can write **two fields** —
an exercise set's `stage:` and a topic manifest's `status:` — and `@da/content/write` is where every
rule about that lives. The UI holds none of them: it fetches the allowlist from `/__writable`, so a
control can only appear after the controller would accept it.

**Why a splice and not `YAML.parseDocument` → `set` → `toString`.** Measured on the shipping corpus:
under the best options (`lineWidth: 0, flowCollectionPadding: false`) only **247 of 385** exercise
sets and topic manifests round-trip byte-for-byte; under the library defaults, **18**. A writer
built on `toString` would silently reformat a third of the files it touched — which already happened
once here, when 166 added citations to `grammar-inventory.yaml` arrived as 697 insertions and 300
deletions. The controller instead splices the new scalar into the source text at the node's own
`range`, so every byte outside the value is identical by construction, comments and quoting
included. A real write is `1 file changed, 1 insertion(+)`.

Five checks, each broken on purpose once in `tests/write-controller.test.ts`: containment (resolved,
not string-prefixed), file class, field-and-value allowlist, Zod re-validation of the resulting text,
and a structural post-condition that **no second key moved**.

**And the corpus check is not optional.** A per-file schema check cannot see a corpus-level rule, and
one of the two writable fields reaches one: marking a **B1** topic `reviewed` makes
`authorshipProvenanceProblems` demand records it may not have, so a write that is valid as a manifest
turns `bun run validate` red. The caller injects a `verify` hook; when it reports anything the
original bytes go back and the write is refused.

**Unreachable from a build, by construction.** The plugin is `apply: 'serve'`, so a `vite build`
contains no endpoint at all — verified: `GET /__write` on the built bundle is a 404 and the view
renders zero controls, falling back to the read-only chips. Not a flag, not an environment check.

The costs are stated rather than hidden: a write is followed by a full graph rebuild (~6.6 s) and a
full validator run (~6 s), and the control shows the value it wrote rather than snapping back to the
stale one while that happens. Backlog **P26-16** holds the per-file invalidation that makes this
cheap enough to widen.

