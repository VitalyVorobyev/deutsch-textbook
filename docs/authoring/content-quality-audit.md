# Content-quality audit contract

This is the shared manual-review contract for an existing Deutsch-Atlas topic. It complements the
schema and coverage instruments: a valid file can still teach the wrong distinction, accept only
one of several correct answers, or combine materials that do not form a learnable sequence.

The review unit is the **topic profile**, never one YAML file in isolation. Read the article,
outcomes, all teaching and probe sets, readings, listening scripts, documents and owned vocabulary
together. Counts are routing signals, not verdicts.

## Evidence states

Record one state for each surface:

- **corrected** — a concrete defect was fixed in the same change;
- **verified** — the surface was read and no material defect was found;
- **intentionally bounded** — a simplification is appropriate at this level and its boundary is
  explicit;
- **needs specialist or media review** — do not guess, especially when a recording or provenance
  claim would need replacement.

An automated or agent-assisted pass does not set a topic to `reviewed`. That status remains a
separate human editorial transaction with the full validator and provenance gate. Existing human
sign-offs are retained; a new corpus pass records its evidence without impersonating approval.

## Topic and article

- The outcomes describe actions the learner can actually practise; knowledge, reception, writing
  and speaking are not interchangeable modes.
- `Kurz gesagt` gives a usable decision, not a table-of-contents summary.
- `Erklärung` has one addressable `###` section per named confusion or grammar point. Sections are
  semantic units, not headings inserted to satisfy a counter.
- Rules state their boundary and do not turn a useful A1–B1 tendency into a false absolute.
- German examples are natural in the stated situation and register. Incorrect examples are clearly
  marked and never left as the most visually salient model.
- EN, RU and UK explanations are authored independently. Each explains the German decision from
  that language's perspective; one support language is not used as the reasoning bridge for another.
- L1 contrasts explain a likely transfer error. They do not make unsupported universal claims about
  English, Russian or Ukrainian.
- Every taught fact is necessary for an outcome or later prerequisite and appears in practice. Cut
  attractive trivia that consumes attention without changing a learner decision.

## Learning activities

Review the topic-level sequence before individual items:

1. exactly one 8–15 item `core/geruest` set establishes the main model;
2. an `extension` owns a genuinely separate contrast or subskill, not overflow from the core set;
3. `application/transfer` removes support and changes the facts or communicative context;
4. `remediation` names a measured confusion and is not generic extra practice;
5. listening, document and spoken sets earn separate files only when their medium or interaction
   changes what the learner must do.

For each item:

- It is understandable without remembering the item before it.
- The German prompt, answer and accepted alternatives are grammatical, natural and appropriate to
  the declared level and register.
- Distractors diagnose a plausible decision; nonsense forms may illustrate one exact form error but
  cannot dominate a set.
- Every correct, target-preserving alternative is accepted. A correct answer that bypasses the
  target is constrained in the instruction instead of being called wrong.
- `explain` says why the answer is right and why the tempting alternative fails; it does not merely
  repeat the key.
- `focus` names the error the response can actually reveal. `key_tokens` contain only the smallest
  deterministic graded surface. Open composition is `write`, not a disguised `translate`.
- A selection, cloze or word-order item is not counted as productive evidence for a decision it
  supplies on screen.
- A probe family has three parallel fresh-context variants, one competence and exact arming. It is a
  delayed measurement, never more practice disguised by `role: probe`.

## Readings, listening and documents

- The artifact has a concrete input purpose and a coherent situation, speaker and information flow.
- The load is comprehensible at the level. Word count remains a tripwire; no text is padded or cut to
  enter a numeric band.
- Glosses support the words needed to follow the text and use independent, contextual EN/RU/UK
  meanings. They do not translate words the context already makes effortless.
- Questions are answerable from the artifact, have plausible alternatives and test meaning rather
  than isolated visual matching.
- Audio questions require listening. The transcript or a visible duplicate cannot reveal the answer
  before the attempt; the script remains byte-equivalent to the reviewed recording contract.
- A document task asks the learner to extract or produce the function of the document, not transcribe
  decorative text.

## Vocabulary

- Nouns carry article, plural and any relevant restricted-use note; verbs carry principal forms,
  auxiliary, separability and valence; phrases make fixed government visible.
- IPA is checked manually for compounds, separable verbs and loanwords after generation.
- `example_de` is natural, level-appropriate and demonstrates the headword's actual pattern.
- EN/RU/UK headword and example glosses are independently correct in context, including number,
  aspect and register.
- `cards: both` means the learner should produce the form. `cards: recognition` is reserved for
  written labels, rare full forms and receptive variants. `~` is evidence-backed grammar or bound
  morphology, never a coverage escape hatch.

## Closing a topic pass

1. Record every artifact class checked and every correction or deliberate no-change decision in the
   [topic-quality ledger](../curriculum/topic-quality-audit.md).
2. Run `bun run validate`, `bun run activity:audit`, grammar and Wortliste coverage, tests, checks,
   lint and both application builds.
3. Confirm Redaction's derived queue has not grown and preview the touched article/exercises in each
   supported language.
4. Leave a `draft` topic as `draft` until a human editor explicitly completes the review/provenance
   transaction. Coverage delivery and editorial approval are separate facts.
