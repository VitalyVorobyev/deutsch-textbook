---
name: create-listening-scene
description: Create a complete Deutsch-Atlas listening dialogue with a CEFR-valid script, stable catalog cast, reviewed environmental sounds, Qwen synthesis and automatic QA. Use when adding a listening scene, drafting a listening-plan artifact, recasting a dialogue, or preparing audio for human review in Listening Studio.
---

# Create a listening scene

Create the first complete version with the existing local Studio. Stop before human approval or publication.

## Workflow

1. Read `CLAUDE.md`, `docs/design.md`, the matching unit in `data/listening-plan.yaml`, `data/listening-characters.yaml`, and the available source list from `atlas-listening sources list`.
2. Preserve the planned level, outcomes, vocabulary, duration window, register and speaker count. Keep every German turn inside that CEFR level.
3. Select versioned characters by role, register and usage balance. Reject every pair named in `incompatible_with`; never use a Research/private voice.
4. Write a complete structured draft. Use one identity profile per character; vary only delivery, pronunciation, pace and pause per line.
5. Select a reviewed `bed` and any necessary `event`. Store `placement_authoring: ai-assisted` and a concrete editorial reason. A context sound must not reveal a correct answer.
6. Import through the Studio CLI/API, validate, synthesize with Qwen CustomVoice and run dry/final Whisper, protected-token, pace/silence, soundscape and WavLM QA.
7. Repair pronunciation through synthesis text or pronunciation overrides. Do not reroll one line's seed. If a profile seed changes, regenerate every line belonging to that character.
8. Finish at `automatically_checked`. Return the local Studio link, cast, sources, QA warnings and anything the editor must hear closely.

## Hard boundaries

- Never mark a human checklist, approval or publication complete.
- Never upload source, generated or private audio.
- Never use voice cloning, VoiceDesign or reference audio on the production path.
- Never overwrite a published artifact directly; use the guarded republish workflow after exact-byte approval.
- Keep the private child clone outside casting. Use only the fictional synthetic child profile when a child is pedagogically necessary.

Read [references/handoff.md](references/handoff.md) before handing the scene to the editor.

