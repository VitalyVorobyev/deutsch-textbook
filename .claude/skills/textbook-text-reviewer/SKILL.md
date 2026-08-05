---
name: textbook-text-reviewer
description: Review native-language textbook explanations for clarity, naturalness, coherence, ambiguity, cognitive load, and instructional usefulness. Produce a concise diagnostic report without rewriting the text.
---

# Textbook Text Reviewer

## Goal

Determine whether a textbook passage communicates its intended educational content clearly and efficiently to the specified learner.

Review the native-language explanation, not merely its grammar.

Do not rewrite the passage unless the user explicitly requests a revised version. The purpose of this skill is diagnosis.

## Required context

Use the supplied information when available:

- language of the textbook explanation;
- language being taught;
- learner level;
- lesson objective;
- terminology introduced earlier;
- original source or factual specification.

Do not invent missing curricular requirements. State material assumptions in the report.

## Review procedure

### 1. Recover the instructional contract

State in one sentence:

> After reading this passage, the learner should be able to ...

If no clear outcome can be recovered, mark this as a critical issue.

### 2. Test independent comprehension

Read the passage as a learner with only the stated prior knowledge.

Identify:

- sentences that require rereading;
- missing logical links;
- undefined terms;
- ambiguous references;
- hidden assumptions;
- rules that cannot be applied;
- examples that do not demonstrate the stated point.

### 3. Apply the shared rubric

The rubric lives at [`../textbook-quality-rubric.md`](../textbook-quality-rubric.md), beside this skill's directory. Score:

- clarity;
- referential precision;
- coherence;
- cognitive economy;
- instructional sufficiency;
- naturalness.

When an original factual specification is available, also check whether the passage expresses it faithfully.

### 4. Generate verification questions

Write three short questions:

1. one recall question;
2. one distinction or interpretation question;
3. one application question.

Answer them using only the reviewed passage.

If an answer requires outside knowledge or guessing, report the corresponding information gap.

### 5. Classify issues

Use these severities:

- **Critical:** may teach an incorrect rule or prevent reliable understanding;
- **Major:** creates substantial ambiguity, cognitive load, or instructional incompleteness;
- **Minor:** reduces fluency or polish without blocking understanding.

Do not report subjective preferences as defects. Every issue must explain its probable effect on the learner.

## Output format

```markdown
## Review result

**Status:** PASS | REVISE | REJECT  
**Learning objective:** ...

### Scores

| Dimension | Score | Reason |
|---|---:|---|
| Clarity | 0–4 | ... |
| Referential precision | 0–4 | ... |
| Coherence | 0–4 | ... |
| Cognitive economy | 0–4 | ... |
| Instructional sufficiency | 0–4 | ... |
| Naturalness | 0–4 | ... |

### Findings

1. **[severity] Short issue name**
   - Location: exact quotation or section
   - Problem: ...
   - Learner impact: ...
   - Revision direction: ...

### Comprehension check

1. Question: ...
   - Answer supported by the text: ...
   - Result: PASS | FAIL

2. ...

3. ...

### Required changes

- ...
```

Keep the report proportional to the passage. Do not produce a long essay for a short paragraph.

## Decision rules

Return **PASS** when all acceptance rules in the shared rubric are satisfied.

Return **REVISE** when the intended lesson remains recoverable but one or more criteria fail.

Return **REJECT** when:

- the learning objective cannot be recovered;
- the passage teaches a materially incorrect or contradictory distinction;
- revision would require reconstructing the content rather than editing it.
