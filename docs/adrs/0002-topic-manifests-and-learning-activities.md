# ADR 0002: A topic is one manifest, and its exercises are organised as learning activities

Status: accepted · 2026-10-18

## Context

A topic used to be declared in three places: article frontmatter, the atlas file and back-pointers
scattered over its exercise files. Which set was the "main" practice was decided by array position,
and probes were found by scanning. At the same time, one exercise file was doing two jobs: it is the
unit learner evidence is keyed to, and it is the thing a learner sees as "an exercise". Treating
"Hören" as a purpose because it is a medium was the visible symptom.

## Decision

**Each topic is one manifest, `content/topics/<level>/<id>.topic.yaml`, beside a prose-only
article.** The manifest holds identity, taxonomy, 2–5 learner-facing `outcomes` and a closed
`elements:` block naming every part. `content/atlas.yaml` holds only what belongs to the whole
graph: the `groups:` taxonomy and the ordered `units:` spine, whose file order *is* the recommended
path.

- **`elements` is closed in both directions.** A listed id must resolve, and a set naming a topic
  that does not list it is an error.
- **`primary_practice` and `probes` are declared**, never inferred.
- **`elements.exercises` is one ordered list.** The interleaving of practice and drill is the
  scaffold → fade arc, written down; bucketing by role would reorder it.

**An exercise file stays the storage and evidence unit; a learning activity is its learner-facing
purpose.** Every topic-owned teaching set declares four independent dimensions:

| Dimension | Says | Controls |
| --- | --- | --- |
| `role` | `pretest`, `practice`, `drill`, `checkpoint`, `probe`, `placement` | runtime and evidence semantics |
| `stage` | `geruest`, `ausblenden`, `transfer` | authored intent in the lesson cycle |
| `activity` | `core`, `extension`, `application`, `remediation` | purpose and grouping on the page |
| medium (derived) | `mixed`, `listening`, `document` | presentation only, never purpose |

Each topic has exactly one `core` activity, 8–15 items, named by `primary_practice`, and at least
one productive `application` in a fresh context. The page groups by purpose: Grundübung, Vertiefen,
Anwenden, Gezielt üben.

## Consequences

- The primary practice set's item list may not grow after shipping: completing it advances the
  Lernpfad, and a learner who completed it must stay completed.
- There is no universal item-count rule outside the core. The topic-wide item-mix and outcome
  checks stay authoritative, and editors judge an activity's coherence.
- This model is the starting point, not the end state, for the lesson task system the roadmap
  plans to redesign ([proposal](../proposals/lesson-task-system.md)). A redesign supersedes this
  ADR rather than editing it.
