# A1–A2 Curriculum and Learning-System Revision

## Summary

Deutsch-Atlas has a strong foundation: bilingual contrastive explanations, pretests, immediate explanatory feedback, FSRS vocabulary review, interleaved exercises, typed production, graded readings, listening dictation, and weakness tracking. All current content validates: 10 topics, 180 vocabulary entries, 28 exercise sets, and 20 readings.

The central gap is that it is a collection of polished grammar-oriented lesson islands, not yet a complete A1–A2 course. The official CEFR model covers reception, production, interaction, and mediation through practical “can-do” outcomes; Goethe A1/A2 likewise assesses listening, reading, writing, and speaking. Deutsch-Atlas currently emphasizes grammar recognition, constrained written production, and short intensive reading, with little open writing, spoken interaction, authentic listening, or real-world task completion. [Council of Europe CEFR](https://www.coe.int/en/web/portfolio/the-common-european-framework-of-reference-%20for-languages-learning-teaching-assessment-cefr-), [Goethe A1](https://www.goethe.de/en/spr/prf/ueb/pa1.html), [Goethe A2](https://www.goethe.de/en/m/spr/prf/ueb/pa2.html).

## Curriculum and Content Changes

### 1. Introduce a can-do curriculum map

Create `content/curriculum.yaml` as the course-level source of truth. Each outcome will have:

- Stable ID, A1/A2 level, personal/public/professional domain, and mode: listening, reading, writing, spoken production, spoken interaction, or mediation.
- German task statement plus independent English and Russian explanations.
- Prerequisite outcomes, teaching topics, and one or more checkpoint tasks.
- Status: uncovered, introduced, practiced, or assessed.

Topic frontmatter will reference outcome IDs. Validation will reject unknown outcomes, uncovered mandatory outcomes, and outcomes marked assessed without a checkpoint.

### 2. Complete A1

Retain the four existing topics, but build a coherent introductory sequence around them:

1. Pronunciation, alphabet, spelling names, numbers, phone numbers, and addresses.
2. Greetings, introductions, countries, languages, and personal-information forms.
3. Präsens, `sein`, `haben`, basic statements, yes/no questions, and W-questions.
4. Family, people, possessive articles, occupations, and simple descriptions.
5. Articles, gender, plurals, `kein` versus `nicht`, and article obligation.
6. Time, dates, weekdays, frequency, and basic daily routine.
7. Food, drink, quantities, prices, ordering, paying, allergies, and grocery shopping.
8. Akkusativ, direct objects, common accusative prepositions, and pronouns.
9. Home, rooms, furniture, `es gibt`, and basic location expressions.
10. City, transport, asking for and understanding directions.
11. Work, school, schedules, languages, and simple abilities with `können`.
12. Leisure, invitations, weather, clothing, likes, and simple plans.
13. Body, symptoms, pharmacy language, and basic appointments.
14. A1 cumulative missions and a four-skill checkpoint.

### 3. Complete A2

Keep the six existing A2 topics and add:

1. Housing, moving, neighbours, and two-way prepositions.
2. Travel, tickets, transport problems, accommodation, and directions.
3. Shopping, clothing, sizes, comparisons, returns, and complaints.
4. Health, doctor/pharmacy conversations, advice, and imperatives.
5. Work, job communication, duties, and simple professional messages.
6. Education, courses, learning strategies, and asking for clarification.
7. Biography and past experiences, including Perfekt and common Präteritum forms of `sein`, `haben`, and modal verbs.
8. Friends, family events, invitations, and social arrangements.
9. Media, leisure, events, preferences, comparisons, and short opinions.
10. Public services: authorities, bank, post, forms, and common requests.
11. Reasons and reported information with `weil`, `dass`, and common connectors.
12. Conditions and plans with basic `wenn`, future intentions, and polite wishes.
13. A2 cumulative missions and a four-skill checkpoint.

Do not create isolated grammar lessons for every structure. Attach grammar to communicative modules unless the concept needs a dedicated explanation and contrast set.

### 4. Strengthen the existing ten themes

- Split overloaded targets inside `praesens-wortstellung` and `artikel-genus` into explicit outcome sequences; add question formation, negation, plural formation, and irregular ending patterns.
- Extend `essen-trinken` from vocabulary recall into complete transactions: menu comprehension, quantities, substitutions, allergies, ordering, asking for the bill, and responding to clarification.
- Add common governed prepositions, meaningful case choice, and varied contexts to Akkusativ and Dativ. Teach two-way prepositions separately.
- Turn `perfekt-haben-sein` into narrative practice: sequencing events, answering follow-up questions, recounting yesterday, and contrasting movement with activity.
- Add communicative functions and negative distinctions to `modalverben`, not only conjugation and sentence brackets.
- Add authentic lexical contexts, imperative and Perfekt interactions to `trennbare-verben`.
- Expand `alltag-tagesablauf` with frequency, chores, weekday/weekend comparison, and short spoken/written routine descriptions.
- Preserve the strong `termine-vereinbaren` material, then add branching calls, voicemail, calendar reading, rescheduling by message, and spoken role-play.
- Move all topics from `draft` to `reviewed` only after German, English, Russian, CEFR-load, audio, task-transfer, and checkpoint review.

### 5. Add missing content forms

- Short authentic text genres: signs, menus, timetables, advertisements, chats, emails, forms, notices, receipts, instructions, and simple official letters.
- Authored audio with multiple speakers and natural prosody: dialogues, announcements, phone messages, requests, and short narratives. Keep TTS as fallback, not the main listening corpus.
- Cumulative readers: approximately 250–400 words by late A1 and 500–800 words by late A2, in addition to the current short intensive readings.
- Reusable phrase frames, collocations, pronunciation contrasts, minimal-pair practice, rhythm, word stress, sentence stress, and repair phrases such as `Wie bitte?` and `Können Sie das wiederholen?`
- Cultural-pragmatic content for Germany: register, punctuality, appointments, forms, opening hours, shared housing, recycling, public transport, and polite disagreement.

## Learning Workflow and Technical Changes

### Lesson cycle

Every module will follow:

1. Low-stakes three-item pretest.
2. Short comprehensible model or dialogue.
3. Focused explanation and worked examples.
4. Scaffolded recognition/discrimination.
5. Cloze or constrained production.
6. Independent writing or speaking task.
7. Scenario transfer in a new context.
8. Delayed checkpoint on later days.
9. Cumulative interleaving with earlier outcomes.

Hints, translations, and model answers will fade across these stages rather than remain constant.

### Exercise interfaces

Add three task types:

- `audio-comprehension`: bundled audio asset, hidden transcript, replay policy, comprehension prompt, and explanatory feedback.
- `write`: bilingual situation, communicative goal, required content points, model response, and compact rubric. Save the learner response locally.
- `speak`: prompt, locally recorded response, replay, model audio/transcript, and checklist. Version one will not use cloud speech recognition; self-assessed evidence will be labelled unverified and will not independently grant mastery.

Add optional scenario grouping so several listening, speaking, reading, and writing tasks can share one real-world mission without requiring a complex branching engine initially.

### Progress and adaptation

- Exclude pretests, checkpoints, and content from unread/ineligible topics from global mixed training.
- Always review already-due cards, but introduce fresh vocabulary only from topics the learner has opened or that are currently eligible.
- Make next-topic selection use the same two-day, card-aware mastery rules as the progress dashboard; remove the current attempts-only shortcut.
- Replace binary-only attempt scoring with backward-compatible `correctParts` and `totalParts`. Tables and matches must no longer count as equivalent to one multiple-choice response.
- Track skill/outcome evidence separately from topic completion. Open writing and speaking completion counts as practice evidence, not verified accuracy.
- Replace the manual `learned → mastered` override with a visibly separate self-assessment that cannot override measured mastery.
- Schedule delayed outcome probes at increasing intervals and select parallel variants rather than immediately recycling the same fixed item.
- Keep weakness targeting, but reserve part of every session for broad cumulative practice so the learner does not overfit to one focus tag.

## Learning-Science Skill Revision

Rewrite `.claude/skills/learning-science` to:

- Add CEFR action-oriented design, communicative competence, interaction, mediation, pronunciation, task authenticity, varied-context transfer, and four-skill balance.
- Replace “every touch must produce an answer” with a balanced distinction between meaningful input, retrieval, interaction, and production.
- Describe short current readings as intensive graded input, not extensive reading.
- Remove the implication that TTS or repeated on-screen text is automatically “dual coding”; evaluate audio by listening and phonological purpose.
- Calibrate claims about `i+1`, pretesting, interleaving, and dual coding instead of presenting every principle as equally settled or universally applicable.
- Add the model → scaffold → fade → independent transfer → delayed check progression.
- Add review checks for distractor plausibility, valid alternative answers, natural German, item memorization, task authenticity, audio quality, and scoring granularity.
- Require course audits to inspect actual learner attempts and mode distribution. The current snapshot, for example, contains 40 attempts but no translation, listening, or speaking evidence and perfect multiple-choice performance, which is not evidence of balanced competence.
- Distinguish engagement metrics from learning metrics and require delayed retention plus novel transfer as the primary evaluation criteria.

## Test and Acceptance Plan

- Content validation: every required A1/A2 outcome is mapped to teaching content and at least one checkpoint; all topic prerequisites remain acyclic.
- Eligibility tests: unseen A2 topics, pretests, and fresh vocabulary cannot leak into daily mixed training.
- Scoring tests: MC, multi-gap cloze, match, and table results contribute correctly weighted evidence while old snapshots remain readable.
- Workflow tests: a learner can resume every lesson stage; delayed probes become due on the intended day; failed outcomes reappear with a variant.
- Audio tests: authored audio works in web and Tauri builds; missing audio degrades explicitly to TTS or text without silently converting a listening assessment into copying.
- Writing/speaking tests: responses and recordings remain local, survive intended navigation where appropriate, and never produce false automatic mastery.
- Content QA: each module receives native-level German review, independent EN/RU review, CEFR-load review, and a real-world transfer-task review.
- Pilot evaluation: compare immediate results with 7- and 21-day delayed probes and novel scenario tasks. Use retention, transfer, error-type reduction, and learner workload—not raw session counts—as success measures.

## Assumptions

- Deutsch-Atlas will become a complete practical A1–A2 core course, not merely an exam-preparation product.
- CEFR can-do coverage is authoritative; Goethe material is a coverage and task-format reference.
- The product remains local-first, bilingual EN/RU, adult-oriented, and deliberately non-gamified.
- Existing topic IDs and vocabulary headwords are preserved where possible to retain progress and SRS history.
- Rich technical work is phased: curriculum map and workflow correctness first, authored audio and open production second, cumulative assessments third.
