# ADR 0018: The twelve roster voices are the whole pool; Frau Kern speaks with the anna-keller voice

Status: accepted · 2026-11-07

## Context

[ADR 0016](0016-lessons-are-tasks-and-a-cast-carries-them.md) gave the unnamed roles a pool of
newly designed walk-on voices outside the cast.
[ADR 0017](0017-the-first-four-are-the-lena-serials-cast.md) left Frau Kern without a voice until
an older woman's voice was designed with that pool. The owner decided against designing any: the
course already has twelve designed voices (`data/listening-characters.yaml`), and those are the
voices it uses.

The roster has no older woman. Its women are Lena, Mira, Anna Keller, So-yeon Park and Klara, and
Noa is a child. Anna Keller's voice is the nearest to a neighbour of seventy. It is described as a
calm, medium-low voice, and it already speaks Frau Kern in `ls-relativsaetze-produktion-01`
(`data/audio-provenance/a2/ls-relativsaetze-produktion-01.json`). Giving the voice to Frau Kern
breaks the casting of 16 more recordings. So-yeon Park's voice would break 15 and Klara's 16
(each counted by setting the voice in `content/characters/frau-kern.yaml` and running the
validator).

## Decision

1. **No voice is designed for the cast or the walk-ons.** The twelve roster voices are the whole
   pool. A voice that belongs to a cast member speaks only that person, and every other voice
   speaks walk-on roles. The cast and the walk-on voices divide the roster between them.
2. **Frau Kern speaks through the voice catalogued as `anna-keller`.** A voice is casting, not a
   name, as for Timo in ADR 0017. Her age is told by the text, not by the timbre.
3. **The cast takes another roster voice only while every level keeps at least one third of its
   recorded listening time in walk-on voices** (`bun run listening:inventory`). When the
   remaining walk-on voices can no longer carry that floor, adding voices is decided again, with
   the inventory's figures.

This replaces ADR 0016's walk-on pool of new voices and ADR 0017's voiceless Frau Kern. The
rest of both stands.

## Consequences

- The 16 recordings join `recast_pending`, and `ls-relativsaetze-produktion-01` leaves it,
  which takes the list from 50 to 65.
- With four cast voices, eight voices are left for walk-ons. Two of them are adult women
  (So-yeon Park and Klara), so female walk-on roles have less variety than male ones (David,
  Emil Wagner, Amir, Herr Wu and Paul).
- The walk-on share counts a cast voice's time as cast even where it still speaks someone else.
  It is now A1 34%, A2 60% and B1 56%, and each recast raises it. A1 sits just above the
  floor, so the A1 recordings are recast before the cast takes a fifth voice.
