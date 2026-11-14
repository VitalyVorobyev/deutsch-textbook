# ADR 0020: A topic's exercises are one path, shown a set at a time

Status: accepted · 2026-11-14

## Context

[ADR 0019](0019-a-topics-exercises-are-three-steps.md) gave every topic the same steps — Üben,
Anwenden, Aufgaben, then the drills — and showed them as headings over every set of the topic,
each set open. A topic has three to nine sets (list `exercises:` per topic manifest), so the
section was still a long column of panels, and the owner read it as a flat list. Only the
Grundübung finishes a lesson, and nothing on the page said so: eight open panels look like eight
obligations.

The daily session already answers the same problem with a step header and one piece of work on
screen.

## Decision

1. **The Übungen section is one path.** Its steps stand in a header across the top, in the order of
   ADR 0019; the open step lists its sets by title; one set is on screen. This supersedes ADR
   0019's "each always open" and "folded" and nothing else in it: the steps, their order, the
   order within a step and one kind of work per set stand.
2. **The header is navigation, never a gate.** Every step and every set can be opened at any time,
   in any order.
3. **The path opens on the first set the learner has not worked through,** and a finished set
   offers the next one. A set is worked through when each of its items has an attempt. The drills
   are offered as a last step and never opened on or led into: each exists for one confusion.
4. **The page says what finishes the lesson.** The Grundübung is marked as the set that counts;
   every other step is marked optional. Lesson completion and the measured tier are unchanged and
   are not read from the path.

## Consequences

- A learner sees one task and where it sits, on every topic, in the shape the daily session uses.
- The path's ticks are a second, weaker reading of the attempt log beside the topic's badge:
  "every item tried", right or wrong. They must never be shown as mastery, and no path surface
  outside the topic page may be derived from them.
- A set is no longer visible until its step is opened, so a learner who never leaves Üben never
  sees a task's title. The optional mark is what tells them the rest exists.
- A set cannot be linked to by scrolling to it. Nothing links to one today.
- This ADR does not change what counts for completion, and does not decide whether Anwenden or
  Aufgaben should count.
