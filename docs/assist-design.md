# Schreib-Assistent: local advisory writing feedback

Status: design accepted 2026-07-14. Implementation is Phase 7 (P7-1…P7-3) in
[backlog.md](backlog.md); this document is the contract those items implement, and P7-2 finalizes
it with whatever the manual pilot changes.

## What it is, and the one rule it lives under

A `write` task ends with the learner revising a draft against a checklist and honestly rating the
result. The assistant adds one optional voice to that revision: a local language model — Ollama, on
the learner's own machine — reads the draft and returns a short praise line and a handful of hints,
each quoting the learner's exact words and nudging with a question or rule pointer in the learner's
explanation language.

The rule is the standing one, restated because everything below is shaped by it: **assist output is
advisory only, never evidence.** Nothing the model produces touches accuracy, mastery, attempts or
the snapshot. A `write` already logs unverified practice evidence by design; the assistant does not
even reach that bar — it is a commentary on a draft, not an assessment of one. The feature
self-hides when no local model answers, so the course is complete without it: an enrichment for a
machine that happens to run Ollama, never a dependency. This deliberately does not reopen P5-3
(pronunciation assistance), which stays deferred.

## Module API

`src/lib/assist.ts` exports two functions and no UI:

- **`probeAssist()`** — `GET http://localhost:11434/api/tags` with a ~1.2 s timeout; returns
  availability plus the installed model tags. The probe is **skipped entirely when the page is
  `https:` and not running under Tauri**: a deployed https page cannot fetch `http://localhost`
  (mixed content), so probing would only produce console noise. On the plain deployed website the
  assistant simply does not exist.
- **`reviewDraft(request)`** — `POST /api/chat` with `stream: false`, `temperature: 0.2`, and
  `format:` set to the JSON schema of `writeHintsSchema` (Ollama's structured-output constraint).
  The request carries the item's bilingual prompt and goal, the draft, the topic's CEFR level and
  the learner's explanation language. A 60-second `AbortController` bounds the call; the caller may
  pass its own signal so the panel's Abbrechen button aborts immediately.

## The hints shape

```
writeHintsSchema = {
  praise: string          // one genuine sentence, in the explanation language
  hints: [                // at most 4
    {
      quote: string       // a verbatim substring of the learner's draft
      category: 'grammar' | 'word-order' | 'word-choice' | 'spelling' | 'task'
      nudge: string       // a question or rule pointer — never a corrected sentence
    }
  ]
}
```

At most four hints: a wall of feedback gets skimmed, and the revise stage should stay a revision,
not a correction transcript. The category enum both constrains the model and gives the panel a
label per hint.

## Prompt design

The system rubric is written in **English** — small local models follow English instructions most
reliably — and says, in substance:

- You are a German teacher for a learner at CEFR level X. Comment **within that ceiling**: do not
  demand B1 structures in an A2 note, and do not flag correct A2 German for lacking sophistication.
- Every hint must **quote the learner's exact words** — a verbatim substring of the draft.
- **Never rewrite. Never supply the corrected sentence.** The pedagogy is the point: the revision
  must be the learner's own retrieval. A model that hands over the corrected sentence turns the
  revise stage into a copy edit, which is precisely the practice value the stage exists to create.
- Nudges are questions or rule pointers — "Which case does *mit* take?" — written in the learner's
  explanation language. German is quoted, never corrected.

## Hallucination filter

Structured output constrains the shape, not the truth, and small local models will misquote:

1. Drop any hint whose `quote` is not a substring of the draft (after trivial whitespace
   normalization). The quote is the only thing anchoring a hint to reality; a hint about words the
   learner never wrote is noise at best and mis-teaching at worst.
2. If no hints survive the filter, retry **once** with a corrective message restating that quotes
   must appear verbatim in the draft.
3. If the retry also produces nothing usable, **fail silent and hide the assistant for the rest of
   the session.** A feature that visibly fails twice is worse than one that is not there.

## Where it attaches, and why exactly there

**Revise stage only, on demand (a button), and only after the before-assessment is complete.**

- The **before-ratings are a calibration instrument**: they measure the learner's own judgment of
  the draft. Feedback shown before them would anchor them — the rating would then measure the
  model's opinion rather than the learner's calibration. So the assist button stays disabled until
  the before-assessment is submitted.
- The **after-ratings rate the revised text** and are legitimately feedback-informed: the learner
  saw the checklist and possibly the hints, revised, and rates the result — that is what the stage
  is for. **This is accepted by design and stated here so a future audit does not rediscover it as
  a defect:** in snapshots from assist-enabled sessions, after-ratings may be feedback-informed;
  before-ratings never are.
- On demand rather than automatic: generation costs tens of seconds (below), and the checklist is
  the primary instrument — the model is a second opinion the learner asks for, not a gate they wait
  behind.

## Storage

**Not in the attempt, not in the snapshot.** Hints live in component state, plus an optional field
on the existing `SavedWriting` localStorage record (`src/components/exercises/Write.tsx`), so a
same-day reload does not re-bill a slow generation. This is the strongest available enforcement of
never-evidence: what is never persisted to attempts or snapshots cannot leak into mastery, export,
merge or the audit — there is nothing for `mergeSnapshot` to mishandle and nothing for a future
consumer to misread as a score.

## Settings

- `da:assist` — device-level, default **on**. Default-on is safe because the feature self-hides
  when the probe fails; on a machine without Ollama the setting is invisible.
- `da:assist:model` — default: the first `gemma*` tag reported by `/api/tags` (the pilot machine
  runs `gemma4:e4b`); the learner may pick any installed tag.
- A gear popover in the panel holds the model picker and the off switch. Device-level rather than
  profile-level: which model is installed is a property of the machine, not of who is learning.

## Transport

| Context | Transport | Why |
| --- | --- | --- |
| Dev server or any `http:` origin | browser `fetch` | localhost is reachable; no mixed content |
| Desktop app (Tauri) | `@tauri-apps/plugin-http`, capability scoped to `http://localhost:11434/*` (P7-3) | the webview's own fetch cannot be relied on for localhost; the capability keeps the reachable surface exactly one origin |
| Deployed `https:` site | none — the probe never runs | mixed content: an https page cannot call `http://localhost` |

## Failure modes

| Failure | Behaviour |
| --- | --- |
| Probe timeout or connection refused | feature hidden; no error surfaced |
| `https:` outside Tauri | probe skipped; the feature does not exist there |
| No installed model / no tags | feature hidden |
| Request timeout (60 s) or Abbrechen | short failure note with a retry; a second failure in the session hides the feature for the session |
| Malformed JSON despite `format` | treated as "nothing survived" → one corrective retry → fail silent and hide for the session |
| Every quote hallucinated | same path as malformed JSON |

## Latency

No streaming. The hints are one small JSON object; streaming partial JSON buys nothing and
complicates the quote filter. The panel shows a spinner and an **Abbrechen** button, and the
request carries the 60-second abort. A machine that needs longer than that will not make this
feature pleasant — fail fast rather than wait.

## Open risk

The feedback quality of a small local model is unknown until piloted. The design makes failure
cheap — advisory-only, quote-filtered, self-hiding — but cheap failure is not usefulness. P7-2
therefore requires a manual pilot against the live model with two or three real drafts **before**
the PR opens, and expects prompt iteration. If the pilot shows the model cannot produce useful
nudges at this level, the honest outcome is to record that finding here and stop after P7-1 — the
library costs nothing to keep.
