# Schreib-Assistent: local advisory writing feedback

Status: design accepted 2026-07-14; P7-1/P7-2 implemented and piloted against the live model
2026-07-15 (findings folded in below — see *Prompt design* and *Latency*). Implementation is
Phase 7 (P7-1…P7-3) in [backlog.md](backlog.md); this document is the contract those items
implement. P7-3 (Tauri transport) remains open.

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

At most four hints: a wall of feedback gets skimmed, and an optional revision should stay a
revision, not a correction transcript. The category enum both constrains the model and gives the panel a
label per hint.

## Prompt design

The system rubric is written in **English** — small local models follow English instructions most
reliably — and says, in substance:

- You are a German teacher for a learner at CEFR level X. Comment **within that ceiling**: do not
  demand B1 structures in an A2 note, and do not flag correct A2 German for lacking sophistication.
- Every hint must **quote the learner's exact words** — a verbatim substring of the draft.
- **Never rewrite. Never supply the corrected sentence.** The pedagogy is the point: the revision
  must be the learner's own retrieval. A model that hands over the corrected sentence turns the
  learner's revision into a copy edit, which is precisely the practice value it exists to create.
- Nudges are questions or rule pointers — "Which case does *mit* take?" — written in the learner's
  explanation language. German is quoted, never corrected.

Three rules were **earned in the 2026-07-15 pilot** against `gemma4:e4b` (two synthetic A2 drafts —
one with planted errors, one near-perfect — on the real `alltag-produktion` write task). The model
quoted flawlessly and never rewrote, but it padded the near-perfect draft with invented problems
("räume ich immer die Küche auf" flagged for a separable-prefix rule the learner had followed)
until the rubric said, in substance:

- Flag only errors you can name precisely; if you cannot name a definite error in the quoted
  words, do not give the hint.
- A fronted time phrase with verb-then-subject is correct German; a separable prefix at the
  sentence end is correct — two concrete false-positive patterns the pilot surfaced.
- Returning `"hints": []` is a good and common outcome; never pad the list.

With those rules the error draft got 4/4 anchored, real hints (in idiomatic English and Russian
alike) and the near-perfect draft got zero. A praise-only reply (`hints: []`) is therefore a
**legitimate result, not a filter failure** — the corrective retry fires only when returned hints
all fail the quote filter or the JSON is malformed.

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

**The compare screen only, on demand (a button) — never while drafting.**

- Hints shown while the learner is still drafting would replace the retrieval attempt the item
  exists to provoke; the assistant only ever comments on a full first draft. (The original staged
  flow additionally gated the panel behind a before-assessment; that checklist ceremony was retired
  in 2026-07 — open production is minimal-ceremony now, and Write's compare screen keeps the text
  editable, so a revision is an option rather than a stage.)
- On demand rather than automatic: generation costs tens of seconds (below), and the model
  comparison is the primary instrument — the assistant is a second opinion the learner asks for,
  not a gate they wait behind.

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

The request sends **`think: false`**: the pilot measured ~20–30 s per review with `gemma4:e4b`'s
reasoning on and 1–6 s with it off, at identical hint quality on both drafts. Ollama ignores a
false `think` on models without the thinking capability, so the flag is safe to send always.

## Open risk

The feedback quality of a small local model is unknown until piloted. The design makes failure
cheap — advisory-only, quote-filtered, self-hiding — but cheap failure is not usefulness. P7-2
therefore requires a manual pilot against the live model with two or three real drafts **before**
the PR opens, and expects prompt iteration. If the pilot shows the model cannot produce useful
nudges at this level, the honest outcome is to record that finding here and stop after P7-1 — the
library costs nothing to keep.

**Pilot outcome (2026-07-15, three prompt iterations):** useful. On the planted-error draft the
final prompt caught the V2 violation, the um/am confusion and *mit* + Dativ with verbatim quotes
and genuinely Socratic nudges, in both English and Russian; on the near-perfect draft it returned
praise and an empty hint list. Residual risk, accepted: an occasional mild false positive survives
(the Russian run flagged one correct adverb placement with a question the learner can answer and
thereby confirm their text) — tolerable for an advisory panel whose footnote says it never scores.
