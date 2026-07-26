# B1.4/B1.5 authoring handoff

Status: active handoff prompt. Use only after the pre-B1 authorship-hardening change is merged.

## Prompt for Claude

Author B1.4 `arbeit-bewerbung` and B1.5 `meinung-medien` from their frozen contracts in
`docs/curriculum-a2-b1.md`. Read `CLAUDE.md`, `docs/design.md`,
`docs/authoring-checklists.md`, `.agents/skills/learning-science/SKILL.md` and
`.agents/skills/authorship-provenance/SKILL.md` before editing.

Maintain the matching records in `data/authorship-provenance.yaml`. Treat every AI-produced
passage as a draft. Preserve tool and source provenance, and offer alternatives for meaningful
expressive decisions that are not already fixed by the approved brief.

Leave `humanReview.status: pending`. Do not invent Vitaly's review, selection, rewriting,
arrangement decisions or review date. Do not describe the resulting content as copyrighted,
original or human-authored. Do not change a topic to `status: reviewed`, and do not merge the
authoring PR, until Vitaly supplies explicit final editorial sign-off and the completed provenance
record passes validation.
