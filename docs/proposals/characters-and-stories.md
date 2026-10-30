# Proposal: a recurring cast, with voices and stories, as part of the course

Status: open · 2026-10-30. Authorizes nothing. It carries forward the critical analysis first
recorded in August 2026, now that the owner wants characters to be integral rather than optional.

## The owner's direction

- **A stable cast carries the listening material through the course**, A1 to B2, with relations
  between its members.
- **Existing material may be rewritten** so that the cast and its relations run through it.
- **Learners see the characters**, portraits included.
- **The sequence is fixed: tracks first.** High-quality recordings, and a dependable process that
  makes them, come before any character enters a lesson. That work is the Tonwerk studio
  ([ADR 0012](../adrs/0012-editorial-tools-and-the-tonwerk-studio.md),
  [backlog](../backlog/tonwerk.md)). This proposal is decided only after it, with the evidence it
  produces about voice stability.

## Where things stand

- **Voices exist, people do not.** `data/listening-characters.yaml` has 12 casting profiles:
  persona, register, roles and a synthesis voice. They are Tonwerk's casting roster, not
  characters. No profile has a story, and no content file refers to one as a person.
- **One serial strand exists.** The seven *Lena* extensive readings (`content/reading/*/lena-*.yaml`)
  show that the authoring pattern is sustainable. They are **not** evidence of a learning effect,
  and they cannot be: extensive readings create no evidence by contract
  ([ADR 0003](../adrs/0003-the-evidence-model.md)).

## What argues for it

- **Cognitive load** (strong evidence). A stable cast and setting pays the "who is this, where are
  we" cost once, and frees working memory for the German.
- **Comprehensible input** (conditional). A recurring setting recycles its own vocabulary, which is
  a cheaper way to reach high known-word coverage than glossing.
- **Situational interest** (moderate). Wanting to know what happens next is intrinsic motivation,
  as long as nothing gates the next episode.
- **Listening continuity.** A familiar voice is easier to parse.

## Constraints any design must keep

1. **A character fact ships only if a task uses it.** A relationship exists because a dialogue
   needs the *du*/*Sie* choice; a job exists because a text needs its word field. A detail that
   serves no task is a *seductive detail*, which measurably depresses learning from the material
   around it.
2. **Voice variability is a requirement.** Talker variability is what makes L2 listening
   generalize. Unfamiliar voices remain a deliberate, maintained share of the listening corpus.
3. **Continuity is a defect class no gate sees today.** Once a bio ships, every later text can
   contradict it. Any acceptance must say what checks continuity: data the validator can read, or
   a named manual pass with its cost stated.
4. **No game mechanics.** No unlockable episodes, relationship meters, XP or streaks.
5. **Character proper nouns earn nothing.** No cards, no Wortliste coverage, no `~` exclusions.
6. **A portrait needs a semantic job.** Decorative art stays rejected
   ([future-content-directions](../authoring/future-content-directions.md)). The owner wants
   learners to see portraits, so the design must name the job: telling speakers apart in a
   speaker-attribution task, for instance. Generated pixels carry no load-bearing words.
7. **Every recorded voice is a provenance object.** Exact-byte approval and consented cloning only
   ([ADR 0012](../adrs/0012-editorial-tools-and-the-tonwerk-studio.md)).

## Open decisions

1. **Where a character lives.** A content-level identity (`content/characters/`, schema in
   `@da/schema`) that readings, listening scenes, exercises and Tonwerk's casting all reference.
   Today the casting profile is the only record, and it is Tonwerk-private in practice.
2. **How large the cast is.** Three or four people is the only size whose continuity cost looks
   containable.
3. **What stories do inside a lesson.** Model input, a transfer context, or both? This is the same
   question as the [lesson task system](lesson-task-system.md), and the two should be decided
   together.
4. **What would falsify it.** It needs a cheap, countable read: for instance, whether cast-carried
   texts sustain more reading or listening volume than self-contained ones.
5. **Which material is rewritten, and in what order.** The candidates are the 40 recorded
   dialogues, the 85 Lesetexte and the 36 A2 Hören scripts (`bun run listening:inventory`,
   `content/reading/`, `content/exercises/a2/pruefung-a2-*-hoeren.yaml`). A rewrite re-records,
   and every re-recording needs a fresh approval. The cost has to be stated per batch.
6. **How a voice stays the same person.** A preset speaker plus a seed drifts between model
   versions. A fixed reference clip per character may not. The studio's voice-quality work
   measures this with the speaker-identity check. That figure, not a listening impression,
   decides whether a stable cast is technically possible.
7. **How large the unfamiliar share is.** Constraint 2 and a stable cast pull in opposite
   directions. The design names the share of listening time that stays with voices outside the
   cast, and how it is counted.
