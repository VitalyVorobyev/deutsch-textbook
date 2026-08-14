# Handlungslisten — the external anchor for what the learner can *do*

`data/strukturenlisten/` measures `data/grammar-inventory.yaml` against a published list of
structures. This directory does the same for a different claim: the **179 `outcomes`** in
`content/atlas.yaml` — the can-do statements every topic declares, in up to four languages, each
required to be measured by a practice or drill item.

Until 2026-08-14 those outcomes had no outside at all. `bun run validate` checks that an outcome is
*exercised*; nothing checked whether the set of can-dos this course teaches is the set an adult
learner is actually expected to perform. A self-authored list of communicative goals drifts exactly
the way the self-authored grammar list drifted — silently, and toward whatever was convenient to
write.

**A course can teach every structure the exam tests and never ask the learner to refuse an offer.**
That is the whole argument for a second denominator rather than more rows in the first: grammar
coverage cannot see that gap by construction.

| file | level | audience | mode | entries | free |
| --- | --- | --- | --- | --- | --- |
| `goethe-dtz.yaml` | A2 + B1 | Erwachsene | production | 41 | yes |

Everything else about the format — `mode`, `cumulative`, `printed`, `pdf_pages`, the labels-only
boundary, `bun scripts/anchor-check.ts` — is shared, and documented once in
[`../strukturenlisten/README.md`](../strukturenlisten/README.md). The mechanism is
`packages/content/src/anchors.ts`, parameterised by dimension.

## How an outcome cites one

```yaml
# content/atlas.yaml
- id: essen-bestellen
  mode: spoken-interaction
  de: "Ich kann im Café oder Restaurant einfach bestellen."
  claims: [goethe-dtz-handlungen:bestellen]
```

```
bun scripts/handlungen.ts [A1|A2|B1] [--unclaimed-only] [--beyond]
```

## What the first run found

**26 of 41 claimed (63%), and nine of the fifteen holes are one block.** The whole of §8.3
*Redeorganisation* is untaught: opening and closing a turn, taking the floor, signalling that you
are listening, inviting someone else to speak, giving an example to clarify, changing the subject,
hedging a claim. This course teaches a learner to build sentences and never teaches them to manage
a conversation — a gap no grammar instrument can express, found in the first hour the second
dimension existed.

The other six: *Gefühle ausdrücken* (no outcome anywhere is about expressing feelings), *Wissen
oder Nichtwissen ausdrücken*, *etwas bestätigen*, *Umgang mit der interkulturellen Begegnung*, and
*Umgang mit Wissensdivergenz*.

## `beyond` is expected here, and means something different

41 A2 outcomes and 12 B1 outcomes cite nothing, and that is not a defect. Most of them are
grammatical rather than communicative — "Ich kann die Artikel im Dativ bilden" realises no language
function, and forcing it to claim one would be the flattery this whole layer exists to prevent. The
DTZ list is scoped to one exam; this is a course. Read `beyond` as *the course teaches more than the
exam tests*, and `unclaimed` as *the exam tests more than the course teaches*. Only the second is a
gap.
