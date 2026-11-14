# ADR 0019: A topic's exercises are three steps: Üben, Anwenden, Aufgaben

Status: accepted · 2026-11-07 (its "each always open" presentation superseded by [0020](0020-a-topics-exercises-are-one-path.md) · 2026-11-14)

## Context

A topic page grouped its sets by `activity` ([ADR 0002](0002-topic-manifests-and-learning-activities.md)):
an open Grundübung, then folded Vertiefen, Anwenden and Gezielt üben. Anwenden held a mix. 47 of
the 57 `-produktion` sets hold four to seven item types, among them translation, speaking, writing,
cloze, dictation and listening questions (count the distinct `type:` values per file). Beside them sat per-point `-transfer` sets, two-question `-hoeren`
sets, `-diktat` sets, `-dokument` missions and the recording task sets of
[ADR 0016](0016-lessons-are-tasks-and-a-cast-carries-them.md). Of the 70 `-produktion` and
`-transfer` sets, 54 mixed listening, speaking or a document into written practice (empty the
pending list of decision 5 and run `bun run validate`). The owner reads the section as an
unstructured mess. A set's job had to be read off its items.

Moving an item into a set where it belongs was forbidden: ADR 0016 froze set ids, item ids and
revisions, so a conversion could only add identities. Splitting `-produktion` that way would orphan
the learner's history on every item it touched.

## Decision

1. **Every topic page shows its exercises in the same steps,** each always open, with a heading and
   a one-line purpose:
   - **Üben** practises the forms: the `core` Grundübung first, then `extension` sets.
   - **Anwenden** uses the same points in new sentences: `application`.
   - **Aufgaben** gives one situation per skill, around one stimulus: `task`.
   - **Gezielt wiederholen** holds the `remediation` drills, folded, at the end.

   A step with no sets is not shown. Within a step the manifest order stands. Aufgaben lists its
   sets by skill: Hören, Lesen, Schreiben, Sprechen.
2. **`task` is a learning activity, and a task set names its `skill`:** `hoeren`, `lesen`,
   `schreiben` or `sprechen`. A task set is `role: practice`, `stage: transfer`. The skill is
   required on a task set and forbidden on every other. A recording set of ADR 0016 is a Hören task.
3. **One kind of work per set.**
   - An application set holds no listening item (`listen`, `audio-comprehension`), no `speak` item
     and no document.
   - A task set's items fit its skill. Hören is a recording or listening items, and a recording
     set's `form` and `reply` rungs stay allowed. Lesen is a document. Schreiben is `write` items.
     Sprechen is `speak` items.
4. **An item may move between sets and keep its history.** A move map beside the set rename map
   names each item's old location and its new set. Every reader of attempts applies it, so an
   attempt logged in the old set counts in the new one. A data file that names an item's location
   names the current one, or is read through the map. A moved-out location is never reused. This
   supersedes ADR 0016's "a conversion adds identities, never renames them" for moves only. Item
   ids, set ids and revisions stay frozen.
5. **The rollout drains a pending list.** The application sets that still mix kinds of work are
   listed. The list only shrinks: a new mixed set fails validation, and so does a listed set that
   no longer mixes.

## Consequences

- One page shape on every topic, so a learner learns where to look once. A set's title no longer
  needs to say what kind of set it is.
- The completion meaning of `primary_practice` is untouched: the Grundübung stays first in Üben, and
  its item list still never grows.
- A topic still needs a productive application, so splitting a `-produktion` set leaves its
  written production in Anwenden and moves listening and speaking into tasks.
- The move map is permanent, like the rename map. Each move costs one entry and one
  validator-checked location in every file that names the item.
- The pending list is the rollout's measure of what is left. It is not a quality score.
- This ADR does not retitle sets, convert recordings to the ladder, or decide how many tasks a
  topic needs. Those are rollout work.
