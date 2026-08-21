---
name: narrate-reading-text
description: Prepare high-quality narration for a Deutsch-Atlas Lesetext with a versioned narrator profile, paragraph-level synthesis, cue points, Whisper/WavLM QA and a human-review handoff. Use when creating, regenerating, previewing or diagnosing reading audio under content/reading.
---

# Narrate a reading text

Produce one reviewed-ready narration candidate. Stop before human approval or publication.

## Workflow

1. Read `CLAUDE.md`, `docs/design.md`, the source YAML, `data/listening-characters.yaml`, and `data/listening-narration-profiles.yaml`.
2. Strip gloss markers to their German surface. Never speak translations, questions or hidden gloss text. Bind the project to the normalized source hash.
3. Choose one profile:
   - `didactic-clear` for especially clear intensive A1/A2 input;
   - `neutral-editorial` for ordinary informational or everyday prose;
   - `warm-narrative` for stories and every Lena-series text;
   - `formal-informational` for rules, administration and professional texts.
4. If the choice is uncertain, generate only a representative paragraph preview. Do not create four full recordings.
5. Synthesize whole paragraphs with one stable narrator. Render direct speech with slight intonation only; do not cast additional speakers.
6. Assemble the master with the profile's paragraph pause and derive monotonic, non-overlapping cue points from actual boundaries.
7. Run per-paragraph/full-text Whisper, protected-token, voiced-pace, silence, loudness, clipping, cue and WavLM consistency QA.
8. Repair pronunciation through synthesis text or overrides. A profile change invalidates every paragraph; a text change invalidates that paragraph cache and the assembled master approval.
9. Finish before human approval. Return the local Studio link, selected profile, source hash, duration, QA warnings and cue coverage.

## Hard boundaries

- Publish only one selected narration per Lesetext.
- Never generate or claim a slow alternate recording; learner speed is playback behavior.
- Never mark prosody, naturalness or exact-byte approval as human-reviewed.
- Never upload text or audio. Keep WAV masters in Studio and publish only through the guarded exporter.

Read [references/handoff.md](references/handoff.md) before handing narration to the editor.

