# ADR 0017: The first four cast members are the Lena serial's own people: Lena, Mira, Timo and Frau Kern

Status: accepted · 2026-11-07 · its voiceless Frau Kern superseded by [0018](0018-the-twelve-roster-voices-are-the-whole-pool.md) · 2026-11-07

## Context

[ADR 0016](0016-lessons-are-tasks-and-a-cast-carries-them.md) named the first four cast members
as Lena, Mira, Jonas and one older adult. Those names were picked from how often the roster
names appear in the corpus, before the Lena serial was read. The serial already has a recurring
cast of its own, in shipped episodes:

- **Lena** is in all seven episodes.
- **Mira**, her colleague from the bakery, is in two episodes.
- **Timo**, the goalkeeper of SV Nord, is in three.
- **Frau Kern**, her seventy-year-old neighbour, is in five.

Jonas, by contrast, is a name used for unrelated people across seven intensive texts
(`grep -rl Jonas content/reading`). Inventing a Jonas would add a person no text knows, and it
would leave Timo and Frau Kern outside the cast while the serial goes on using them.

## Decision

**The first four cast members are Lena, Mira, Timo and Frau Kern.** This replaces the names in
ADR 0016's fourth decision. The rest of ADR 0016 stands.

- **A voice is casting, not a name.** Timo speaks through the roster voice catalogued as `jonas`.
  Lena and Mira keep the voices of their names.
- **Frau Kern is the older adult.** She carries the official and everyday domains a neighbour of
  seventy brings. She is cast without a voice: the roster has no older woman's voice, so one is
  designed with the walk-on pool.
- Every fact in the four records is taken from the serial and names the episode that states it.

## Consequences

- Frau Kern's lines in recordings speak in borrowed voices until her voice exists. They wait for
  a recast, like every other casting that breaks a cast member's voice.
- Jonas stays a roster voice with no person behind it, and the texts that say "Jonas" keep the
  name as a legacy speaker until each one is recast or renamed.
- The first serial episode at B1 continues with these four, so the cast grows from people the
  learner already knows.
