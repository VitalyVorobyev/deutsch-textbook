# ADR 0013: The course speaks in designed synthetic voices on one model, and its audio publishes on automatic QA

Status: accepted · 2026-10-31

## Context

The course's recordings were spoken by nine preset speakers of one small checkpoint. None of them
is German in timbre, the model ignores every delivery instruction, and three pairs of roster
characters had to share a speaker. A blind comparison put four candidates on the roster: the
presets on the small and the large checkpoint, and a voice *designed* from a written description
of a fictional person, then cloned for every line, at both sizes. The owner listened to 84 lines
with the candidates' names hidden. The designed voices on the large checkpoint won the most
lines and drew no rejection. The presets drew all twelve. The run, the choices and the tally are
in the studio's `evaluations/voices-2026-10-31/`, and `atlas-listening evaluate reveal` prints
them.

The owner also set how course audio is reviewed. It is treated like the lesson text: produced,
published, and corrected from use. Hours of per-scene listening before publication are not spent
on lessons, and they are not spent on audio either. A mix of models per character is complexity
the owner does not want.

## Decision

**Every roster character speaks through one designed voice on one checkpoint**, the large Base
model, cloning a reference that the VoiceDesign model spoke from a written description.

- A description names a fictional person and imitates nobody. The runner's imitation refusal
  applies to every design.
- The reference clip is synthetic. It is kept in the studio's app data, never in the repository.
  The character catalog pins its digest and seed. The description and both model revisions are in
  the record stored beside the clip and in every manifest that uses it. A new reference is a new
  catalog version.
- Human-voice cloning keeps its own consent rules unchanged
  ([product protection](../authoring/product-protection.md)). A designed reference is not a
  person's voice, needs no consent record, and says so in every manifest it enters.

**Publishing is gated by the automatic QA, not by a person's prior listen.** A scene whose render
passed transcript, pace and speaker QA may be published. A recorded human approval is no longer
required, and the review page stays for a scene the owner chooses to check. The owner's feedback
after use is the review. It arrives as a revision, a re-render and a republish, which keeps the
bytes it replaces. This replaces the approval clause of
[ADR 0012](0012-editorial-tools-and-the-tonwerk-studio.md). The rest of 0012 stands.

## Consequences

- One model is loaded for speech, and its pace is set per character in the catalog. In the
  comparison the clones spoke about a fifth faster than the preset voice they replace, and the
  catalog pace brings them back to its rate.
- Every published manifest states that its voices are designed and synthetic, and names the
  reference digests. `bun run validate` checks that record.
- A wrong word or a bad take can reach the learner before anyone hears it. Transcript QA catches
  most of that. The rest is caught in use and costs one republish, which is the trade the owner
  chose.
- The preset engine stays for existing scenes until they are recast. It is not offered for new
  ones.
