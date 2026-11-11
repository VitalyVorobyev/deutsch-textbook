---
name: atlas
description: >-
  The owner's single entry point to Deutsch-Atlas. Use when the owner types
  /atlas, or says "let's work", "what's next", "open Redaktion", "open Tonwerk",
  "start a session", "I want to review", "I want to listen", or otherwise asks
  where to begin without naming a command. Claude runs every command; the owner
  never has to remember one.
---

# Atlas — the owner's desk

The owner does not keep commands or routines in his head, and should not have to. **You run
everything.** Never answer with a command for him to type when you can run it yourself; never
ask him to file something with a CLI — he says it in chat and you file it.

## 1. Open the desk (always, without asking)

Run these, then show the result as a short status, at most eight lines:

1. `bun run queue` — what the owner filed or answered. That is the session's first work.
2. `source setenv.sh && bun run progress:audit --profile vitaly --pull` into a scratchpad file.
   Read from it only: the grading-rulings line, the three "N/M readable competences at ≥80%"
   lines, the translate score, and the top of *Focus signals*. If renderings await review, say
   how many; ruling them is yours to do (`progress-review` skill), not his.
3. `git status --short | head` and `gh pr list` — unfinished work from an earlier session.
4. The *Now* horizon of `docs/roadmap.md` — the step that is next.

## 2. Offer what he can do now

Ask one question with `AskUserQuestion`, the recommended option first. The standing options:

| He picks | You do |
| --- | --- |
| **Weiter im Plan** | Take the next step of the roadmap's *Now* horizon and work it through the `pr-cycle` skill. Implementation goes to one Opus subagent at a time; German, Russian and Ukrainian content stays with you. |
| **Redaktion** | Section 3. |
| **Tonwerk** | Section 4. |
| **Lernstand** | Walk him through the audit in plain words: what improved, what does not stick, what the next study sessions should be. No tables unless he asks. |

Add a fifth, situational option when the status shows one: an open PR to merge, an answer of his
waiting in the queue, a release he asked for.

## 3. A Redaktion session

1. Start it in the background and open it: `bun run redaktion` (run in background), wait for
   `http://localhost:4330` to answer, then `open http://localhost:4330`.
2. Tell him, in three lines, where to click for what he came to do. The usual visit is
   **Prüfen**: the files Claude handed over, each with *Diff zeigen* and *Als geprüft markieren*,
   and the answers waiting under *Anliegen*. The full guide is `docs/apps/redaktion.md`; quote
   the one paragraph he needs, never the page.
3. Stay in the conversation. Whatever he says while using it — a wrong fact, an item that
   rejects good German, a button he could not find, something that bored him — you file:
   - about course material: `bun run queue --new --type finding` (or `request`, `question`)
     on the file it concerns;
   - about the tool itself: an entry in `docs/backlog/redaktion.md`, in the backlog's format.
   He can also file from the app with **Anliegen an Claude**; both end in the same queue.
4. When he is done, stop the background server, and commit what the session wrote
   (`data/review-ledger.yaml`, `data/redaktion-queue.yaml`) in the open batch.

## 4. A Tonwerk session

1. Start it: `bun run tonwerk:start` in the background. It opens a signed-in browser tab by
   itself. If it fails, read `~/Library/Logs/dev.nonvision.deutsch-atlas.tonwerk/engine.log` or
   the command's output, and fix or report the cause; do not hand him the error.
2. The usual visit is listening: **Bibliothek** lists every published recording. Tell him which
   ones to play for what he came to judge.
3. What he says about a recording — pace, pauses, a voice he cannot tell from another, a
   mispronounced word, a line of script — you file with `bun run queue --new --type finding` on
   the recording's set, quoting him. A remark about the studio itself goes to
   `docs/backlog/tonwerk.md`.
4. Stop the engine when he is done.

## 5. Close the desk

Before the session ends: say in two or three lines what was done and what is next, make sure
everything written is committed on a branch (never on `main`), and leave no server running.
