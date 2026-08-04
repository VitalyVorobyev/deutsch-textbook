# ADR 0008: A recurring character ensemble, and productizing the audio studio

Status: **proposed** · 2026-08-04 — explicitly not the next priority. Recorded now so that the
direction exists in writing and can be argued with; nothing in it is authorized to start.

## Context

Two things arrived at the same time and are easy to confuse, so this ADR separates them.

**The audio studio is real, shipped once, and mid-second-wave.** The unit listening corpus is
published: 41 artifacts, one per live unit, 29.5 minutes of speech, every one carrying named human
approval of the exact bytes ([`../roadmap.md`](../roadmap.md), "Audio: shipped"). PR #133 —
*"Narrate the Lesetexte, give the Studio a web UI, and put voice identity under QA"*, open and not
a draft as of 2026-08-04 — extends that pipeline to the 59 Lesetexte as a second bounded corpus,
adds a React Studio frontend, and puts voice identity under QA. **That work is not this ADR's to
decide, redirect, or block.** It proceeds through its own review.

**The proposal this ADR exists for** is different: introduce a small recurring **character
ensemble** — named people with bios, relationships and appearance — whose stories develop alongside
the course content, and let the studio give them voices. It is attractive, it is a well-known
pattern in published courses, and Vitaly asked explicitly for a critical check rather than
advocacy. This section is that check, run through
[the learning-science lens](../../.agents/skills/learning-science/SKILL.md).

### What genuinely argues for it

- **Cognitive load (§8, strong evidence).** Every self-contained text spends part of the learner's
  working memory establishing who these people are and where this is happening. A stable cast pays
  that cost once. The capacity freed goes to the German — which is the whole argument, and it is
  the only pro-argument here that rests on a strong-evidence lever.
- **Comprehensible input (§11, conditional).** Extensive reading needs very high known-word
  coverage to work at all. A recurring setting recycles its own vocabulary by construction, which
  is a cheaper way to reach that coverage than glossing.
- **Situational interest (§16, moderate).** Wanting to know what happens next is intrinsic
  interest, and is categorically different from a badge. This distinction is what keeps the
  proposal compatible with the not-gamified rule — and it survives only if nothing gates the next
  episode behind an achievement.
- **Listening continuity.** A familiar voice is easier to parse, so the ear can spend its effort on
  the sentence rather than on the speaker.

### What argues against it, and the four things that would make it a defect

1. **The in-repo "evidence" is weaker than it will be quoted as.** The seven *Lena in Bremen*
   episodes are cited — including in the plan that produced this ADR — as evidence that serial
   characters work here. They are evidence that the **production pattern is sustainable**: seven
   episodes were authored, validated and shipped. They are **not** evidence of a learning effect,
   and by contract they never can be: extensive readings create no mastery, no cards and no
   evidence, so no instrument in this repo will ever report what Lena did for retention or
   transfer. Any acceptance of this ADR must say so in those words rather than borrowing Lena's
   credibility.
2. **Seductive details (moderate, and the failure mode is precisely this shape).** Interesting but
   irrelevant detail added to instructional material *depresses* learning from that material. Bios,
   relationships and appearance are the textbook example: a paragraph about a character's brother
   is more memorable than the subjunctive it was carrying, and the learner remembers the brother.
3. **The listening argument cuts both ways, and the counter-argument is the stronger one.** Talker
   variability is what makes L2 speech perception *generalize*; a learner trained on one voice
   becomes good at understanding that voice. A fixed ensemble is a fixed, small voice set. If it
   becomes the listening corpus, continuity has been bought with the exact property listening
   practice exists to build.
4. **Continuity is a defect class no gate can see.** Once a bio ships, every later text can
   contradict it, and nothing in `bun run validate`, `bun test` or the build knows a character's
   sister's name. This repo has a standing lesson about exactly this shape — the gates cannot see
   item semantics — and the maintenance cost compounds per character, per wave, forever.

Three further constraints are already binding rules rather than open questions:

- **Decorative character art is already rejected.** The artifact table in
  [`../authoring/future-content-directions.md`](../authoring/future-content-directions.md) lists
  "Decorative character art" in the *Do not use* column (`:24`), the admission test rejects
  decorative media and authenticity theatre (`:16`), and generated raster artwork may contain no
  load-bearing words, arrows, article forms or case labels (`:34`). An ensemble with faces is the
  most likely way that rule gets quietly broken.
- **Not gamified, by owner preference and by design (§16).** No unlockable episodes, no relationship
  meters, no XP, no streaks, no achievements. A cast is a reason to read; it is not a reward
  schedule.
- **A recorded voice is a provenance object.** Every one of the 41 shipped artifacts carries named
  human approval of the exact bytes, and generated assets go through the
  [`authorship-provenance`](../../.agents/skills/authorship-provenance/SKILL.md) skill. Giving a
  character a voice does not lower that bar — it multiplies the number of takes that have to clear
  it.

## Decision (proposed)

1. **Sequencing: the studio first, and separately.** Productizing the listening studio continues
   through PR #133 and its successors, on its own merits. No character work starts before that
   corpus and its tooling are settled, and no part of this ADR is a requirement on #133.
2. **Characters are admitted only as a means to language tasks.** A character fact ships if and
   only if a task uses it: a relationship exists because a dialogue needs the *du/Sie* choice a
   relationship decides; a job exists because a text needs its vocabulary field; an appearance is
   described only where description *is* the language exercise. A fact that serves no task is a
   seductive detail and does not ship, however good it is.
3. **Every character asset passes the Entdecken admission test**, unchanged — including the
   rejection of decorative art and authenticity theatre, and including the fifth question: it stays
   optional, with no completion state, no mastery evidence and no review debt.
4. **No game mechanics.** Stated as a rule rather than a preference so that a later session cannot
   reintroduce them as "motivation work".
5. **Voice variability is a design requirement, not a residue.** The ensemble may not become the
   only voices in the listening corpus. Whatever share of listening is character-voiced, unfamiliar
   voices remain a deliberate, maintained part of the corpus.
6. **Character-specific proper nouns earn nothing.** Names, places and invented institutions create
   no cards, count toward no Wortliste coverage, and never earn a `~` exclusion.

## Consequences

- **Status stays `proposed` until someone can state what would falsify it.** This ADR does not have
  a measurement behind it and says so; accepting it on the strength of the arguments above would be
  the kind of asserted claim this repo has repeatedly had to retract. The honest bar for promotion
  is a named, cheap read — for instance, whether recurring-cast texts sustain more *reading volume*
  than self-contained ones, which is at least countable, unlike "engagement".
- **If accepted, the per-wave cost is not the bios; it is the continuity checking**, which is
  manual and unbounded. Sizing that honestly is part of any acceptance, and a small cast (three or
  four people) is the only version whose cost is plausibly containable.
- **The risk that actually materializes first is scope**: characters are more fun to author than
  items, and this ADR is what a later session gets pointed at when the ensemble starts growing
  faster than the language tasks that justify it.
- **Nothing here changes what already ships.** The listening corpus, its approval bar, the Lena
  strand and the classics strand ([ADR 0006](0006-public-domain-classics-as-extensive-reading-corpus.md))
  are all unaffected, and none of them depends on this decision going either way.
- **Superseding this ADR is expected, not exceptional.** If the ensemble is accepted, it will be a
  new ADR that supersedes this one and records the decision date and the reasoning that moved it;
  if it is rejected, likewise. This file is not edited into an acceptance.
