# B1 unit authoring handoff

Status: active handoff prompt for the current two-unit window. B1.1–B1.7 have shipped; the window
below names the next two. **Rename the two units in the prompt when a window closes** — the rest of
this file is unit-agnostic and does not change.

## Prompt for Claude

Author B1.8 `reisen-probleme` and B1.9 `lernen-zukunft` from their frozen contracts in
`docs/curriculum/a2-b1.md`. Read `CLAUDE.md`, `docs/design.md`,
`docs/authoring/authoring-checklists.md`, `.agents/skills/learning-science/SKILL.md` and
`.agents/skills/authorship-provenance/SKILL.md` before editing.

Maintain the matching records in `data/authorship-provenance.yaml`. Treat every AI-produced
passage as a draft. Preserve tool and source provenance, and offer alternatives for meaningful
expressive decisions that are not already fixed by the approved brief.

Leave `humanReview.status: pending`. Do not invent Vitaly's review, selection, rewriting,
arrangement decisions or review date. Do not describe the resulting content as copyrighted,
original or human-authored. Do not change a topic to `status: reviewed`, and do not merge the
authoring PR, until Vitaly supplies explicit final editorial sign-off and the completed provenance
record passes validation.
