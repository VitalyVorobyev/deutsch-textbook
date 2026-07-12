# A1 learning-system audit

Status: **accepted product direction** (2026-07-12).

This audit was made after the A1-ready v0.2.0 release and before further A2 authoring. Its purpose
is to judge Deutsch-Atlas as a learning system, not merely as a valid content collection. The
review applies the repository's learning-science lens and inspects both the shipped A1 catalog and
the newest available learner snapshot.

## Conclusion

A1 has a strong instructional foundation: explicit outcomes, pretests, bilingual explanations,
worked examples, explanatory feedback, varied retrieval formats, productive flashcards, FSRS,
mixed training, honest mastery, and a cumulative checkpoint. The main deficit is not article
length. The missing depth lies **between and after articles**: sustained input, coherent real-world
missions, spoken response, revision after open production, contextual variation, and delayed
evidence that learning survives.

Consequently, the project will harden the A1 learning loop before scaling the current lesson
pattern across A2.

## Catalog findings

The released A1 catalog has ten topics, 29 exercise sets and 230 exercise items. Every item has
explanatory feedback. The item distribution is:

| Type | Items |
| --- | ---: |
| Multiple choice | 77 |
| Cloze | 46 |
| Translation | 25 |
| Order | 21 |
| Dictation (`listen`) | 16 |
| Audio comprehension | 14 |
| Match | 14 |
| Table | 9 |
| Open writing | 8 |

There are ten three-item pretests, 18 practice sets, 14 intensive graded readings, one cumulative
A1 checkpoint, and no delayed probe sets. The catalog is not recognition-only, but tightly
constrained manipulation still dominates, and a catalog count alone does not show which modes the
learner actually practices.

## Snapshot evidence

The newest snapshot inspected was `progress/vitaly/2026-07-10.json`, exported
`2026-07-10T08:46:08.009Z`. It is recent, but contains A2 rather than A1 activity; it therefore
cannot establish whether the released A1 path produces A1 competence.

- 40 attempts: 17 `mc`, 10 `cloze`, six `order`, five `match`, two `table`.
- Zero `translate`, `listen`, `audio-comprehension`, or `write` attempts.
- Three reading-question attempts.
- 29 of 40 attempts came from one A2 topic.
- 37 answers were correct; all three errors involved `trennbar-wortstellung`.
- 15 cards were graded for 19 total reviews: four productive-direction cards and eleven receptive.
- No lapses yet and too little elapsed history for a delayed-retention conclusion.

These are engagement observations, not evidence of balanced competence. The primary future
evaluation signals are success after a real interval and success on a parallel, previously unseen
context.

## Ranked findings and decisions

### 1. Delayed retention is specified but not operational — high

Retrieval and spacing are the strongest evidence-backed levers in the project, yet A1 has no
scheduled outcome probes. Implement local, snapshot-safe probes with parallel variants and broad
cumulative retrieval before bulk A2 authoring. Repeating the identical item is not a valid transfer
check.

### 2. Spoken outcomes exceed practiced spoken interaction — high

Outcomes include introductions, spelling, ordering, directions and invitations, but their evidence
usually comes from written selection or composition. Add local record, replay, model and self-check
practice. Speech remains unverified unless a trustworthy assessment method is introduced; cloud
speech recognition is not a prerequisite.

### 3. Open writing stops before feedback-led revision — high

The eight A1 writing prompts are useful communicative tasks, but showing one model is not a complete
feedback cycle. Change the workflow to draft → checklist comparison → revision. Preserve both
versions as practice evidence and never treat word count or submission as verified correctness.

### 4. Themes need richer use, not longer explanations — medium

The grammar and theme articles are generally long enough for their explanatory job. Theme depth
should instead be measured by communicative transformations, genres, speakers and contexts. A unit
should combine several skills in a coherent mission rather than merely lengthen its article.

### 5. Intensive reading is sound; volume input is absent — medium

The current 90–130-word glossed readings are intensive input and should stay concise. Add a separate
episodic reader track: roughly 250–400 words at late A1 and 500–800 at A2, with very high known-word
coverage and sparse interruption.

### 6. Listening lacks sufficient acoustic variability — medium

Browser TTS is suitable as a dictation fallback, but not as the only model of natural connected
speech. Distinguish dictation, comprehension and pronunciation purposes. Comprehension should
progressively use reviewed, committed multi-voice audio while keeping transcripts hidden until the
attempt.

### 7. Outcome labels overstate the response mode actually measured — medium

An item may teach a spoken-interaction outcome through written MC or cloze. That is legitimate
teaching evidence, but it is not spoken-interaction evidence. Attempts need an explicit actual
response mode and evidence quality so progress can expose mode gaps honestly.

### 8. Personalization still depends on manual drill authoring — medium

Focus-tag diagnosis is strong, but authoring a new YAML drill for each snapshot will not scale.
Build conservative, reviewed contrast families and deterministic variation for common confusions;
do not use unconstrained generation for answer-keyed German.

## Extended learning-design principles

The existing learning-science skill remains the governing review lens. A2 work must additionally
apply these operational principles:

1. **Pronunciation:** perception before production, lexical and sentence stress, imitation,
   record-and-compare, and delayed re-recording. IPA and TTS are support, not a curriculum.
2. **Formulaic language:** teach and retrieve high-frequency chunks as usable units, alongside
   compositional grammar.
3. **Revision:** open production includes self-check, comparison, revision and re-attempt.
4. **Mode validity:** distinguish what an artifact teaches from what the learner actually did.
5. **Adaptive safeguards:** generated practice uses reviewed constraints and deterministic
   fixtures; AI/ASR uncertainty never silently becomes mastery evidence.

## A2 unit quality gate

Before an A2 unit is complete, the unit as a whole—not necessarily every individual topic—must
provide:

1. low-stakes pretesting;
2. comprehensible model input;
3. concise explanation and worked examples;
4. blocked explanatory practice;
5. faded discrimination against confusable earlier material;
6. listening with a hidden transcript;
7. independent written production with revision;
8. record-and-replay spoken production or interaction;
9. a coherent real-world mission joining multiple skills;
10. a later parallel outcome probe;
11. a connection to sustained reader/listener input where appropriate; and
12. evidence labelled by actual response mode and verification quality.

## Evaluation

Pilot evaluation compares immediate performance with parallel probes after approximately 2–3, 7
and 21 days. Report delayed retention, novel-context transfer, focus-error reduction, mode coverage
and learner workload. Attempts, sessions and streaks remain engagement signals and must not stand in
for learning.
