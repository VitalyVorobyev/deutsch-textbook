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

**Revised 2026-07-12.** This section originally rested on `progress/vitaly/2026-07-10.json` — 40
attempts, zero `translate`/`listen`/`write` — and concluded that the data "cannot establish whether
the released A1 path produces A1 competence." That is no longer the situation.
`progress/vitaly/2026-07-12.json` holds **671 attempts across three consecutive days**, 149 cards
and 305 reviews, and it exercises every item type. It both confirms the production thesis below and
exposes a defect the thin snapshot could not show.

Accuracy by item type:

| Type | Accuracy | Attempts |
| --- | ---: | ---: |
| `order` | 100% | 45 |
| `match` | 94% | 36 |
| `mc` | 93% | 305 |
| `cloze` | 82% | 134 |
| `listen` | 76% | 42 |
| `table` | 54% | 31 |
| `translate` | 54% | 64 |

Competence collapses exactly where the response stops being constrained. Recognition and
manipulation sit at 93–100%; free production sits at 54%. That is the audit's central claim, now
measured rather than argued.

Two further observations:

- **`mc` is 305 of 671 attempts (45% of everything the learner did) at 93% accuracy**, and
  `mc`+`match`+`order` together are ~58% of all attempts at 93–100%. Roughly half the practice
  budget is spent on formats that no longer discriminate. `order` (45/45) yields no information at
  all.
- **149 cards and 305 reviews produced one lapse.** FSRS has effectively never observed a failure,
  so every stability estimate is untested. The first 7-day intervals fall due 2026-07-17; that is
  the first honest retention signal the project will have.

These remain engagement and immediate-performance observations. The primary evaluation signals stay
what they were: success after a real interval, and success on a parallel, previously unseen context.

## Ranked findings and decisions

### 0. Free-production scoring and error attribution were invalid — critical (fixed 2026-07-12)

Added after the 671-attempt snapshot. Everything downstream of the attempt log — weakness
detection, mixed-training priority, drill authoring, mastery, and the delayed probes in finding 1 —
reads the `correct` flag and the `focus` tag. Both were being written wrongly for `translate` items,
so the system was measuring something other than what it claimed.

Two defects, each verified against the answer keys:

- **Spelling slips were scored as grammar failures.** 12 of the 29 failed translations were
  single-token slips (`Kanst`, `heite`, `Artzt`, `schimmen`, `bischen`). A translate item asks for a
  whole sentence, so one mistyped character sank it — and was then recorded as a failure of the
  grammar the item drilled.
- **The `focus` tag was attached to the item, not to the error.** Any failure anywhere in the
  sentence was blamed on the tag being drilled. `Sie ist zu Hause gebliebt` counted as `haben-sein`
  evidence though the auxiliary `ist` is correct; `Ich kann gut schimmen` counted as
  `modal-satzklammer` though the bracket is perfect; `Ich möchte einen Termin absagen` counted as
  `trennbar-modal` though the structure is textbook.

The consequence was not academic. `weakFocuses()` steers both training priority and drill authoring,
and `a2/drill-mir-mich` — **the most-practiced set in the entire corpus, 73 attempts** — was authored
for a mir/mich confusion the learner does not have (`dativ-pronomen`: 7% error rate). The
personalization loop aimed at a phantom.

**Decision:** fix the instrument before scheduling probes, so that the retention cohort in finding 1
is measured with a scorer that works. Implemented in `src/lib/production.ts`:

1. A one-token near-miss outside the graded tokens is a spelling slip — shown as a correction,
   scored correct, logging no focus error. Closed-class words (`den`/`dem`, `ihn`/`ihm`,
   `einen`/`einem`) are excluded: they are one edit apart *and* they are what the taxonomy grades,
   so a swap there is a choice, never a slip.
2. A real error is attributed to the item's tag only when a token that tag grades is what diverged;
   otherwise the attempt is logged **unattributed**. An honest gap in the signal beats a false entry
   in it.

Items declare `key_tokens` — the tokens whose exact form they grade. Replaying the snapshot through
the new scorer: 10 attempts rescored correct, 5 failures stripped of a false tag, `verben-mit-dativ`
fell 33%→20%, `haben-sein` 27%→17%, `modal-satzklammer` 15%→0%, and **`trennbar-modal` left the weak
list entirely — it was a phantom weakness**. The genuine weaknesses (`kein-nicht` 50%,
`dativ-artikel` 38%) are unchanged, which is the point: the fix removes noise without flattering the
learner.

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

### 8. Personalization did not aim, and only then does it need to scale — medium

Originally filed as "personalization still depends on manual drill authoring." That is true, but it
was the second problem. The 671-attempt snapshot showed the first: the focus-tag signal the loop
diagnoses from was **wrong** (finding 0), and the most-practiced set in the corpus was a drill
written for a confusion the learner did not have. Automating drill generation on top of that would
have industrialized the aiming error rather than fixing it.

With the scorer corrected, the original point stands: authoring a new YAML drill per snapshot will
not scale. Build conservative, reviewed contrast families and deterministic variation for common
confusions; do not use unconstrained generation for answer-keyed German. But **verify the tags are
telling the truth before automating anything that consumes them** — the ordering is the finding.

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
