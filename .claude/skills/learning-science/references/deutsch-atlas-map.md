# Where each learning lever lives in Deutsch-Atlas

The map from principle → the concrete artifact or file that implements it. Use it
two ways:
- **Review:** to know *what to inspect* when auditing a principle ("is retrieval
  practice honored?" → look at exercise types + flashcard directions).
- **Design:** to know *what to reuse* instead of reinventing ("this topic needs a
  generation step" → add a `pretest`, don't invent a new mechanism).

If a file path here disagrees with the repo, trust the repo — this map is a guide,
not a spec. `CLAUDE.md` is the authoritative content/authoring contract.

## Principle → implementation

| Principle | Lives in | Notes |
| --- | --- | --- |
| **Retrieval practice** (§1) | `content/exercises/**`, flashcards (`src/components/srs/`, `src/lib/srs.ts`), typed input (`src/lib/typing.ts`) | Every vocab entry → two cards; exercises are production, not re-reading. |
| **Spaced practice** (§2) | FSRS scheduler `src/lib/srs.ts`; daily session `src/components/session/SessionFlow.tsx`; `sessions` log in `src/lib/store.ts` | Small daily sessions; scheduler revisits at the edge of forgetting. |
| **Interleaving** (§3) | `/training` `src/components/training/MixedTraining.tsx`; the daily session's step 2 | "Never two consecutive items from one topic"; prioritizes recently-wrong then weak-focus then never-attempted. |
| **Generation / pretest** (§4) | Topic `pretest` field → `content/exercises/<level>/<id>-pretest.yaml`; "Was weißt du schon?" callout above the article | 3 `mc` items probing core rules, shown *before* reading. Reading glosses are click-to-reveal (no guess step) — generation lives in the pretests. |
| **Elaboration** (§5) | `<Bilingual><En>/<Ru></Bilingual>` prose; RU half contrasts with Russian, EN half uses L2-internal hooks | Two independent, complete explanations — a divergence *feature*, not duplication. |
| **Feedback** (§6) | Every exercise item's `explain` (bilingual), shown on wrong answers | "Where the teaching happens." Missing/empty `explain` is a defect. |
| **Desirable difficulties** (§7) | Typed production (EN/RU→DE) over MC; strict-but-fair matching `src/lib/typing.ts` | The typed-input decision *is* a desirable-difficulty decision. |
| **Worked examples / cognitive load** (§8) | Article skeleton §3 `## Beispiele` (5–10 examples); CEFR ceiling; one-confusion-per-item | An A2 article must be fully readable by an A2 learner — load control. |
| **Metacognition / calibration** (§9) | Mastery tiers `src/lib/mastery.ts` (`untouched→read→practiced→mastered`), progress dashboard `src/components/progress/`, pretests | Tiers derive from real attempts+cards, not page views — honest signal. |
| **Dual coding** (§10) | Grammar tables (German, outside Bilingual); TTS `src/lib/speech.ts` + `SpeakerButton`; `listen` dictation items | Audio channel reinforces the verbal one; tables are the spatial channel. |
| **Comprehensible input** (§11) | Graded reading `content/reading/**` → `ReadingText.tsx`; `[[phrase::en::ru]]` glosses; CEFR discipline | ~90–130 words at level, 6–10 glosses so comprehension never breaks. |
| **Pushed output / productive recall** (§12) | EN/RU→DE typed flashcards; `translate` items; `listen` dictation | Card identity `<file>::<de>::<direction>` — both directions are first-class. |
| **Transfer-appropriate processing** (§13) | `translate`, `listen`, typed production; card directions | Practice in the form of real use; dictation trains sound→spelling. |
| **Frequency / contrastive** (§14) | Vocab ordering; the **focus-tag taxonomy** in `CLAUDE.md`; RU explanation halves; weakness detection `src/lib/weakness.ts`, `src/lib/trends.ts` | Focus tags name the confusions, incl. L1-interference (`kopula-sein`, `artikel-pflicht`, case transfer). |
| **Self-determination / anti-gamification** (§15) | "Nothing to decide" daily session (autonomy) that is also skippable; honest heatmap + streak; mastery tiers (competence); local profiles + data ownership `src/lib/profile.ts` | No points/badges/coins. Streak *informs*, does not punish. |

## The personalization loop (error-driven learning made operational)

Principles §1/§3/§14 combine in the loop documented in `CLAUDE.md` → "Drills from
progress":
1. Read newest `progress/<profile>/*.json`; aggregate error rates **per focus tag**
   (same logic as `weakFocuses` in `src/lib/weakness.ts`: last ~30 attempts,
   weak = ≥4 attempts and ≥35% errors) and high-`lapses` cards.
2. Diagnose by the *confusion* (the focus tag names it), not the individual item.
3. Author a drill set targeting that confusion, tag every item, attach it to the
   topic. Future snapshots keep measuring the same tag → closed feedback loop.

This is retrieval practice (§1) aimed by real calibration data (§9), interleaved
(§3), at the learner's specific L1-interference and developmental errors (§14).

## Known tension points to watch (where levers pull against each other)

- **Matching strictness (§7 vs §12):** too lenient → no pushed output; too brittle
  → undesirable (extraneous) load. `src/lib/typing.ts` is the balance point:
  tolerate typos/umlaut-substitutes/trailing punctuation, reject wrong forms.
- **Interleaving vs initial acquisition (§3 vs §8):** a *brand-new* rule needs a
  little blocked practice to form the concept before mixed drills discriminate it.
  Topic-owned exercise sets can block; `/training` and the daily session interleave.
- **Generation vs frustration (§4 vs §6):** pretests must be short, low-stakes, and
  immediately corrected — wrong guesses help only when the correction lands.
- **Progress signals (§9 vs §15):** a tier or streak must reflect *demonstrated
  retrieval*. The moment it inflates or is bolted on as a reward, it flips from
  honest competence feedback to gamified extrinsic pressure.
- **Input level (§11 vs §8):** every above-level word in a reading/example spends
  load on decoding instead of on the target pattern. CEFR ceiling is the guard.
