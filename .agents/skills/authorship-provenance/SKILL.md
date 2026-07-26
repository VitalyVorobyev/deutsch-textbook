---
name: authorship-provenance
description: Preserve honest evidence of human creative direction and AI assistance in Deutsch-Atlas. Use when drafting or reviewing B1.4+ topics, generating or adding illustrations and simulated documents, changing authorship or licence claims, completing human editorial review, or handing content authoring to another agent.
---

# Authorship provenance

Treat provenance as evidence of process, never as a promise of copyrightability. Read
`docs/product-protection.md`, the relevant frozen curriculum section and the matching record in
`data/authorship-provenance.yaml` or `data/asset-provenance.yaml` before editing.

## Topic workflow

1. Start from the human-approved curriculum and creative brief. If the record is absent, create a
   `pending` record with at least three concrete expressive or structural choices before drafting.
2. Use AI output as a draft. Preserve the provider/tool name and describe its role accurately.
3. Offer alternatives when a meaningful expressive decision is still open; do not silently make
   every creative choice on the human editor's behalf.
4. Preserve sources and tool provenance while working.
5. Leave `humanReview.status: pending` until Vitaly explicitly reviews the result. An agent may
   record proposed contributions but must not invent selections, rewrites, arrangements, dates or
   sign-off.
6. After explicit review, record concrete human selection, rewriting or arrangement decisions and
   the real review date before changing a topic to `status: reviewed`.
7. Never describe AI-assisted output as copyrighted, original or human-authored. Describe only the
   known process.

Legacy B1.1–B1.3 records intentionally omit unavailable history. Never reconstruct prompts or
review decisions after the fact.

## Visual and document workflow

1. Follow the visual-admission test in the learning-science skill. Generated pixels must have a
   named semantic job and contain no load-bearing language, arrows or answer cues.
2. Do not imitate a named artist, studio, franchise, character or brand. Do not reproduce an
   existing document or artwork exactly.
3. Before generation, save the exact prompt or approved visual brief under
   `data/prompts/<yyyy-mm-dd>-<asset-slug>.md`.
4. Generate alternatives where practical. Record the tool, candidate count and Vitaly's actual
   selection reason. Do not invent a candidate count or selection.
5. Keep the generated base and human-authored HTML/SVG overlays as separate provenance entries
   when both exist. Record subsequent composition, cropping, labelling and semantic corrections.
6. Add the asset and SHA-256 to `data/asset-provenance.yaml`; record the CC BY-SA/source review.
   `sourceClass: simulated` only means course-created.
7. Never give a new asset the legacy exemption. `legacy: true` and `promptUnavailable: true` are
   reserved for the frozen pre-2026-07-26 allowlist.
8. When changing an allowlisted legacy asset, preserve its frozen baseline and add a `changes`
   entry for the new SHA-256 with the real tool, saved brief and human edit/direction. The legacy
   exemption covers missing creation history only.

Run `bun run validate` and `bun test` after changing either manifest.
