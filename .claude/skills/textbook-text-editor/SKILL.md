---
name: textbook-text-editor
description: Rewrite native-language textbook explanations to improve clarity, naturalness, coherence, and instructional value while preserving all verified educational meaning.
---

# Textbook Text Editor

## Goal

Produce publication-ready native-language educational prose that is easier to understand and apply than the source text.

Preserve verified meaning. Improve wording, information order, and instructional structure.

Do not add new linguistic claims unless they are explicitly supported by the supplied material.

## Inputs

Use, when provided:

- source passage;
- reviewer report;
- learning objective;
- learner level;
- style guide;
- verified linguistic facts;
- surrounding lesson context.

Treat critical and major reviewer findings as mandatory requirements.

## Editing procedure

### 1. Fix meaning before style

Determine:

- the central claim;
- required distinctions;
- necessary qualifications;
- expected learner action.

Do not begin by replacing individual words. First establish the correct conceptual structure.

### 2. Reorder for learning

Use the smallest structure that supports the objective.

A default explanation pattern is:

1. direct learner-oriented meaning;
2. primary usage rule;
3. contrast with the nearest confusing alternative;
4. short representative example;
5. necessary qualification;
6. optional check or cue.

Do not force this pattern onto passages with a different function.

### 3. Rewrite for clarity

Prefer:

- concrete subjects;
- finite verbs;
- familiar words;
- explicit logical relations;
- one central proposition per sentence;
- short paragraphs;
- parallel structure for comparisons;
- rules placed immediately before their examples.

Avoid:

- bureaucratic nominalizations;
- vague pronouns;
- translated syntax;
- decorative transitions;
- repeated conclusions;
- unnecessary synonyms for the same concept;
- exceptions before the basic rule is established.

Sentence length is a diagnostic, not a target. Do not make the prose childish or telegraphic merely to shorten it.

### 4. Control cognitive load

Remove content that does not support the immediate objective.

Separate:

- the core rule;
- contrastive information;
- exceptions;
- historical or stylistic commentary.

Introduce no more terminology than the passage needs.

Examples must isolate the target phenomenon. Avoid examples whose vocabulary or grammar creates a second learning problem.

### 5. Preserve meaning explicitly

Create a private claim inventory from the source:

- core meaning;
- conditions of use;
- contrasts;
- register;
- word order or grammar;
- exceptions;
- warnings.

After rewriting, verify every retained claim against the revision.

Do not preserve redundancy merely because it appears in the source.

### 6. Perform an adversarial self-review

Check:

- Could a learner reasonably infer a wrong rule?
- Does any pronoun have two possible referents?
- Is a tendency presented as an absolute rule?
- Was any qualification lost during simplification?
- Does the example actually demonstrate the explanation?
- Can the learning objective be achieved using this text alone?
- Does the revision sound native rather than translated?

Revise once more when any answer exposes a defect.

## Output format

```markdown
## Revised text

[publication-ready revision]

## Editorial notes

- Main changes: ...
- Information intentionally removed: ...
- Meaning-preservation concerns: none | ...
- Remaining factual questions: none | ...
```

Omit `Editorial notes` when the user requests only publication-ready text.

## Completion criteria

The revision is complete only when:

- every required factual claim is preserved;
- no critical or major reviewer issue remains;
- each paragraph has one clear educational function;
- the central rule precedes secondary qualifications;
- references are unambiguous;
- examples directly support the rule;
- the revised text passes the shared rubric ([`../textbook-quality-rubric.md`](../textbook-quality-rubric.md));
- three comprehension questions can be answered without guessing.

---

# Recommended agent workflow

```text
INPUT
  ↓
Textbook Text Reviewer
  ↓
REJECT ──→ return for factual or instructional redesign
  ↓
REVISE
  ↓
Textbook Text Editor
  ↓
Textbook Text Reviewer
  ↓
PASS ──→ accept
```

Use a fresh reviewer invocation after editing. Do not ask the editor to approve its own output.

## Minimal orchestration instruction

```markdown
Review the passage with `textbook-text-reviewer`.

If the result is REVISE, pass the source passage and the complete review to
`textbook-text-editor`. Then review the revision again with a fresh reviewer
context.

Stop after two editing cycles. If the text still fails, report the unresolved
issues instead of repeatedly paraphrasing it.

If the result is REJECT, do not invoke the editor. Return the passage for
content or instructional redesign.
```

## Calibration recommendation

Before using numeric scores as quality gates, create a small calibration set:

- 20–30 accepted textbook passages;
- 20–30 problematic passages;
- human annotations from at least two native-speaking reviewers;
- examples covering definitions, comparisons, grammar explanations, vocabulary notes, and exercise instructions.

Use the set to calibrate score interpretations and prompt examples. Do not treat an unvalidated LLM score such as `3.7/4` as an objective measurement.

For production monitoring, track:

- reviewer pass rate;
- human acceptance rate;
- disagreement between agent and human reviewers;
- number of editing cycles;
- comprehension-question success;
- recurring issue categories.

The final acceptance criterion should remain demonstrated learner comprehension or qualified human review, not the composite score alone.

This is intentionally a **compact operational package**, rather than several narrowly fragmented skills. The reviewer can later be specialized by text type—vocabulary notes, grammar explanations, instructions, reading texts—once you have real examples showing that their failure modes differ.
