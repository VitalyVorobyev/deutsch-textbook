# ADR 0012: A topic declares itself in one file

Status: accepted · 2026-08-14

## Context

A topic's identity was stored up to four times.

`level` lived in the directory path (`content/topics/a2/…`), in the article's frontmatter, in the
`content/atlas.yaml` node, and again in the unit entry that listed the topic. `kind` and
`prerequisites` lived twice each — frontmatter and node. None of the copies was authoritative, so
`scripts/validate.ts` carried a block whose only job was to keep them equal:

```
if (node.level !== t.data.level) fail(…)
if (node.kind !== t.data.kind) fail(…)
if (a !== b) fail(AT, `node "${node.id}" prerequisites ≠ topic frontmatter`)
```

That is the classic shape of storing something twice and then writing a check to reconcile it. The
check works; the storage is the defect.

The second half was worse, because it was not stored at all. **A topic's element list was half
convention.** Exercise sets and readings were declared from the topic; the probe family was found
by scanning `content/exercises/**` for `role: probe`; `primaryPractice` — the set whose completion
advances the Lernpfad — was derived as "the first `role: practice` set in the `exercises:` array";
the `probe-<id>.yaml` and `drill-*.yaml` filename patterns were enforced nowhere; and a vocab deck
had no back-pointer to its topic at all. So *"what is this topic made of?"* had twelve partial
answers and no complete one, and two of them were rules written in prose that no file expressed:

- reordering a topic's page silently moved `primaryPractice`, changing what completing the step
  means and which item list must never grow;
- a probe attached itself to a topic **by existing**, so nothing could report a probe family that
  named a topic the topic had never heard of.

## Decision

**Each topic is one manifest, `content/topics/<level>/<id>.topic.yaml`, beside its article.** It
carries the identity, the taxonomy, the outcomes, and an `elements:` block naming every part.

The article keeps **prose only** — no frontmatter at all. `content/atlas.yaml` keeps what is
genuinely a property of the whole graph: the `groups:` taxonomy and the ordered `units:` spine.

Three consequences of the shape, each of which fixes one of the conventions above:

1. **`elements.primary_practice` is declared**, not derived from array position.
2. **`elements.probes` is declared**, not scanned for.
3. **`elements` is closed.** Every artifact still carries its own `topic:` back-pointer — open a
   drill file and it tells you what it belongs to — and `scripts/validate.ts` now holds the two
   directions equal in *both* senses: a listed id must resolve, and a set naming a topic that does
   not list it is an error rather than an invisibility.

`elements.exercises` stays **one ordered list** rather than splitting into `practice:` and `drill:`.
This was measured before it was decided: **14 of the 49 topics interleave the two on purpose** —
`dativ` runs practice → drill → drill → practice → practice → drill → drill → practice — which is
the scaffold→fade arc written down. Bucketing by role would have silently reordered those pages.

Titles stay flat (`title_de`, `title_en`, …) rather than nesting under `title:`. Every other content
file spells them that way, `langcheck.ts` detects a translation wave by the presence of any `*_uk`
field, and a second title convention in the same repo would be the duplication this ADR removes.

## Consequences

**The reconciliation checks are gone**, and so is the class of bug they guarded: two copies of
`level` cannot disagree when there is one.

**A topic is now two files, and they are one parity scope.** `title_uk` in the manifest still
demands a `<Uk>` half in every `<Bilingual>` block of the article beside it, and a `<Uk>` block in
the article still demands `*_uk` parity in the manifest — the bridge that used to span frontmatter
and body now spans two files. Only the file a finding is *reported against* differs: a prose defect
names the prose.

**`contentGraph()` lost a map.** `graph.nodes` was a second index of the same 49 things, read from
`atlas.yaml`; the manifest *is* the node, so `graph.topics` is the only one.

**The article is no longer self-describing.** Opening `perfekt-haben-sein.mdx` tells you nothing
about its level or title. That is the accepted cost: the manifest has the same basename and sits
in the same directory, and the alternative was keeping a copy of the identity to read while
editing — which is where this started.

**The migration is provable, and was proved.** `scripts/verify-topic-manifests.ts` re-derives every
article's old frontmatter and the old `nodes:` array from the manifests alone and diffs them
against the previous commit, byte for byte, including each article body. 99 files and 2 100 lines
of `atlas.yaml` moved; the verifier reports zero differences. A diff that large cannot be reviewed
by reading it, so a claim about it has to be executable.

**What this ADR does not do**: it does not add `documents:` or `reference:` to `elements`. A
document is named by the set or item that uses it as a stimulus, and the topic → reference-page
link is *derived* from focus tags (ADR 0007) with only its route table hard-coded — turning either
into a hand-maintained per-topic list would trade a derived edge for 49 copies, which is the thing
this ADR is against. The route table's own move into `content/reference-data/` is open work.
