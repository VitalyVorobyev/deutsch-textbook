# B1 authoring handoff

Status: the unit windows are closed — all fourteen contracted units (B1.1–B1.14) are authored, and
the level's checkpoint and placement sets have landed. What remains of B1 authoring is the
Wortliste completion pass, waves 2–4 (32 decks, ~1,212 headwords) — the partition and rules live in
the 2026-08-03 amendment at the end of [`a2-b1.md`](a2-b1.md), the running state in
[the backlog](../backlog.md).

## Prompt for Claude (lexis waves)

Author the next wave's decks from the frozen partition in `docs/curriculum/a2-b1.md`. Read
`CLAUDE.md` and `docs/authoring/item-authoring.md` (vocab section) before editing; run
`bun scripts/coverage.ts B1 --check-deck <file>` per deck before `bun run validate`; the manifest
gains its lines in the same change.

## Provenance rules — these outlive the unit windows

Maintain the matching records in `data/authorship-provenance.yaml`. Treat every AI-produced
passage as a draft. Preserve tool and source provenance, and offer alternatives for meaningful
expressive decisions that are not already fixed by the approved brief.

Leave `humanReview.status: pending`. Do not invent Vitaly's review, selection, rewriting,
arrangement decisions or review date. Do not describe the resulting content as copyrighted,
original or human-authored. Do not change a topic to `status: reviewed`, and do not merge the
authoring PR, until Vitaly supplies explicit final editorial sign-off and the completed provenance
record passes validation. As of 2026-08-05 that sign-off is outstanding for B1.11–B1.14.
