# Authoring an exercise item

The per-item-type contract, lifted out of [`CLAUDE.md`](../CLAUDE.md) because you can only reach
it once you already know you are authoring an item. CLAUDE.md keeps the one-line rule; this file
keeps the mechanism and the measurement that produced it.

Almost everything here is enforced by `bun run validate`. Where a rule is *not* checkable — where
it is a question about meaning — the text says so, and it is then on the author.

## Contents

- [Identity and revision](#identity-and-revision)
- [Item types and their contracts](#identity-and-revision)
- [`key_tokens` — the tokens the focus tag grades](#item-mix-validator-enforced-per-topic)
- [Item mix](#item-mix-validator-enforced-per-topic)
- [Placement sets](#placement-sets-the-entry-test)
- [Vocab entries](#vocab-entries)

---

## Identity, revision and item types

- Topic `id` must equal the filename; kebab-case ASCII (no umlauts in ids/slugs).
- `prerequisites` reference topic ids; keep the graph acyclic; update `content/atlas.yaml` in the same change.
- Exercise refs are path-ids like `a2/perfekt-haben-sein` (relative to `content/exercises/`, no extension).
- Exercise item ids are stable. Increment `revision` only when prompts, accepted answers, scoring, outcomes or focus semantics change. Explanation-only polish does not require a bump. Never replay an attempt whose revision is absent or different.
- **Determinacy, across every type: an item may never grade which word the author had in mind.** The three faces it has worn so far, each found by a learner producing correct German and being told it was wrong:
  - a **cloze** gap asking for a lexical verb with nothing naming it (below);
  - a **`translate`** item whose every accepted rendering pins one of two interchangeable connectors — «потому что» is exactly as ambiguous as *because*, and *denn* (V2) and *weil* (verb-final) both render it. Validator-enforced over a curated group list (`INTERCHANGEABLE_CONNECTORS` in `scripts/validate.ts`), because *whether the instruction names it* is the one part of the `constrain` judgement a machine can check. **Which way to resolve it depends on the tag:** where the connector carries the `focus` (`verbzweit` is *about* the verb staying in position 2 after *denn*; `nebensatz-verbende` is defined as verb-final *in a weil-clause*) name it in the bilingual `instruction`; where it is carrier material (`hoeflich-konjunktiv` grades *würde gern* and does not care what follows) add the sibling rendering to `accept` instead. Constraining an item that did not need it is the same defect pointed the other way — it narrows real production for nothing;
  - a **`table`** row whose `given` stub ends in an ellipsis and whose graded cell repeats the word the stub just handed over (`Ich komme nicht, weil …` + `weil ich heute arbeite` reads back as *weil weil*). The ellipsis marks a continuation prompt; the answer continues it. Validator-enforced, and keyed on the ellipsis precisely so a paradigm table — where Nominativ `die` and Akkusativ `die` are both genuinely `die` — is untouched.

  **This class hides behind curriculum order.** `a2/arbeit-beruf` teaches *denn* and its article says *weil* "comes later", so on the topic's own page the task really is determinate. Mixed training then serves the item stripped of that context, months after *weil* was taught. **An item is determinate only if it is determinate when served alone** — that is the test to apply, because interleaving guarantees it will be.
- Cloze gaps: `{{answer}}` or `{{answer|alternative}}` inline in `text`. **A gap that asks for a lexical verb must be determinate**: name the infinitive — inline after the sentence (`Der Zug {{fährt}} um acht Uhr {{ab}}. (abfahren)`) or in the `instruction` — or give context only one verb fits. `Ich ___ am Samstag ___.` graded *mitkommen* as a `trennbar-wortstellung` failure when the learner's bracket was perfect; the competence is the bracket, never guessing which verb the author had in mind. Grammar-word gaps (articles, prepositions, endings) are already determined by their sentence and need no hint.
- `translate` items: `prompt_en` + `prompt_ru` (same sentence, written independently), `answer` (the preferred teaching model), optional `accept` list for **equally correct, target-preserving** German (e.g. fronted time phrase vs subject-first — both valid V2). `accept` is for real word-order/wording variants, **not** typo tolerance — typos are handled by the scorer, below. Audit the likely alternatives before shipping, but do not invent a second rendering where none is useful. A variant must preserve meaning, register, person, tense, and the competence the item measures: a `passen-dativ` item does not accept *Der Termin geht nicht* merely because it communicates the situation without demonstrating `passen` + dative. If the source admits a common paraphrase that bypasses the target, state the constraint in the bilingual `instruction` (*Use passen / Используйте passen*) rather than silently treating good German as a grammar failure. After submission the UI shows the authored alternatives; on a miss it diffs against the closest authored rendering, so valid learner choices such as fronting are never presented as errors merely because `answer` uses another order.
- **`key_tokens` on a `translate` item — the tokens whose exact form the item's `focus` grades.** `src/lib/production.ts` is the one rule for scoring a typed sentence, and it exists because a translate item asks for a whole sentence: one mistyped character used to sink it *and* be recorded as a failure of the grammar it drilled. Two rules:
  1. A one-token near-miss (Damerau-Levenshtein ≤ 1) **outside** `key_tokens` is a spelling slip: the learner is shown the correction, the attempt scores **correct**, and no focus error is logged. Closed-class words (`den`/`dem`, `ihn`/`ihm`, `einen`/`einem`) are never forgiven — they are one edit apart *and* they are exactly what the taxonomy grades, so a swap there is a choice, not a slip. A non-word (`do` for `du`) still counts as a slip: it cannot have been chosen.
  2. A real failure is attributed to `focus` **only when a token that tag grades is what diverged**. Otherwise the attempt is logged wrong but *unattributed*. An honest gap in the weakness signal beats a false entry in it — `weakFocuses()` drives training priority and drill authoring, and a false tag sends both after a confusion the learner does not have.
  **Word order is graded through `key_tokens` like everything else — pin every word whose position the tag decides, in `answer` and in every synonymous `accept` rendering.** A displaced token is not a missing one, and the scorer asks both questions: is an expected word absent (an alignment diff), *and* did something else land in a slot the item grades (a positional check against the accepted rendering the learner came closest to). Only the second one sees a transposition, and it only sees it if the moved word is pinned. So for a bracket or verb-final rule, pin **both ends**: `muss` **and** `arbeiten`, `kann` **and** `schwimmen`; if an accepted rendering substitutes *schauen* for *sehen*, pin both infinitives. Pinning the finite verb alone is the classic mistake — in *Ich kann gut schwimmen* the modal never moves, so `key_tokens: [kann]` grades the one word the error leaves in place, and the collapse the tag exists to catch is logged wrong but **unattributed**. Declare the tokens the tag is about: the auxiliary **and every accepted participle** for `haben-sein` (a Perfekt item grades both halves of the tense), the case-marked article for `dativ-artikel`, `gern` for `gern-moegen`. The validator rejects a `key_tokens` entry that does not occur in any authored rendering; it also applies the uniqueness guard to `answer`, or to the accepted rendering that introduces an alternative-only token.

  **Do not "solve" a placement item by pinning nothing.** The reasoning is seductive — a reordered sentence changes at least two positions, so rule 1 could never mistake it for a typo, and with no pins the collapse still gets attributed. It is measurably wrong: with `key_tokens` empty the scorer blanket-attributes *every* real error to the tag (`graded.size === 0` in `gradeTranslation`), so an unrelated fumbled noun in a `trennbar-modal` item is logged as a Satzklammer failure. Reviewed one by one against this repo's attempt log, dropping the pins changes 54 attributions — and **52 of the 54** are errors belonging to a *different* tag than the item's (a fumbled article in a `trennbar-modal` item, a mis-built participle in a `praeteritum-sein-haben` item, a nominative-for-accusative pronoun in a `konjunktionaladverb-inversion` item whose inversion is perfect). So the pins cost **5** wrong attributions and buy back **52**. Pin both ends.

  **A `key_token` is matched by string, not by position** (`graded` in `src/lib/production.ts`), so if the word occurs **twice in the rendering that defines it**, the tag grades *both* occurrences. `Tom hängt die Uhr über die Tür.` with `key_tokens: [die]` grades the accusative *object* article as well as the directional one — and a learner who writes `der Uhr` is then logged as a `wo-wohin` failure, which is not the confusion they had. **`bun run validate` rejects this** in `answer`, and likewise when an alternative-only token repeats in the accepted rendering that introduces it. Rewrite the sentence so the graded token appears once (`Tom hängt den Kalender über die Tür.`), or pin a different word that is unique — tokens are whole words, so a multi-word phrase cannot be pinned. Where the repetition is genuinely the same decision twice, it is still worth splitting: the item would otherwise weigh one confusion twice as heavily as its siblings. A false entry in the weakness signal is worse than a missing one: it sends training and drill authoring after a confusion the learner does not have.

  **Only pin what the tag grades.** Attribution is all-or-nothing to the single `focus`, so a token that the tag is not about turns an unrelated error into a false entry under that tag: `focus: duerfen-muessen` with `key_tokens: [musst, kommen]` logs a fumbled lexical verb as a dürfen/müssen confusion; `focus: partizip2-form` pinning the auxiliary `habe` logs `bin`-for-`habe` — a `haben-sein` error — as a failure to build the Partizip II. The validator cannot check this (it is a question about meaning), so it is on the author.

  **The known exception, recorded rather than papered over:** pinning the participle for `haben-sein` (mandated above, so that a mis-built participle is not forgiven outright as a one-edit slip) does log a `partizip2-form` error under `haben-sein` — `Sie ist nach Spanien geflügen` has the auxiliary exactly right. That is the rule above being violated by the rule above it, and it is a real false entry, live in the log. It is left standing because the alternative — dropping the pin — scores a wrongly-built participle **correct**, which is worse. The fix is to let a token be pinned for *presence without attribution*; until `key_tokens` can say that, prefer the pin and know what it costs.
  `listen` (dictation) deliberately uses none of this for **scoring**: there, spelling *is* the drill, and a typo is a miss. But a `listen` item's `focus` is still a *grammar* tag, so `Listen.tsx` withholds **attribution** when the miss is unmistakably a spelling slip (one token off, one edit away, not a closed-class swap — `dictationSlip` in `src/lib/production.ts`). Otherwise a learner who hears *Ich bringe dir einen Kuchen mit.* and types `Kuhen` would be logged as failing separable-verb word order. `den` for `dem` is still attributed: that is a choice, and it is exactly what a `dativ-artikel` dictation exists to grade.
- `mc` has exactly one correct answer (`correct` = index into `options`).
- `match` pairs: a German↔German pair keeps plain strings; a meaning-side right is a `{en, ru, uk?}` record — never a mixed `"en / ru"` string, which no language mode can render and the parity/letter-set checks cannot see. A record's `en` is the pair's stable identity in the UI, so edit it as carefully as an answer.
- `listen` items (dictation): `text` is spoken via browser TTS and is also the canonical typed answer — keep it ≤ ~10 words at the set's level, write numbers as words (validate fails on digits), gloss nothing. Matching ignores punctuation but keeps case (noun capitalization is part of the drill); `accept` is for real spelling variants only.
- `speak` items: declare `mode: spoken-production|spoken-interaction`, a bilingual communicative `prompt` and `goal`, 2–4 bilingual self-check points (rendered as guidance on the compare screen, never as a gated form), and a concise German `model_answer`. Recording is optional and local-only; a stopped take auto-plays and the learner may re-record freely, including after seeing the model. Audio is never uploaded, persisted or automatically scored.
- Reading gloss markers: `[[German phrase::en gloss::ru gloss]]` inline in `text` paragraphs — three non-empty `::`-separated fields, or four with a trailing `uk` gloss (`[[de::en::ru::uk]]`), all-or-none per reading; every reading should gloss 6–10 phrases.
- Every exercise set declares `role: pretest|practice|drill|checkpoint|probe|placement`. Pretests are 3-item sets at `content/exercises/<level>/<topic-id>-pretest.yaml`, referenced via the topic's `pretest` field — never listed in `exercises`, never mixed into training, never counted as `Geübt`, and **never weakness evidence**. That last one was an oversight for months: `focusStats` keys only by `focus` and saw them, and since all 96 pretest items are `mc` — the format the pilot learner scores ~93% on — 91 easy recognition attempts sat in the denominators of a signal that exists to find *production* confusion. It changed the error rate of 27 tags and swapped a member of the weak set (`nebensatz-vorfeld` masked, `konjunktionaladverb-inversion` falsely raised). `isPretestAttempt` (`src/lib/weakness.ts`) now excludes them, in `focusStats` and in the audit's own table, and **the `-pretest` filename is validator-enforced in both directions** because an attempt records no role — the runtime predicate reads the suffix, so the convention has to be a checked contract.
- **Every topic must own at least one `role: practice` set** (validator-enforced). Its first one is the topic's `primaryPractice` — the set whose completion advances the Lernpfad. A topic with only drills or Hören sets could never be completed, and the recommended path would stop on it forever.
- Every item declares `outcomes: [stable-outcome-id]`; ids, modes and domains live in `content/atlas.yaml`. Use `preview: true` only when an item intentionally uses a focus introduced later in the spine; the validator otherwise rejects curriculum-order leakage.
- Every exercise item should have an `explain` (bilingual) — it is shown on wrong answers and is where the teaching happens.
- Every exercise item that clearly drills one confusion gets a `focus` tag (kebab-case ASCII, validated against `/^[a-z0-9]+(-[a-z0-9]+)*$/`) from the canonical table below. Leave genuinely mixed or pure-comprehension items (dialogue matching, lexical MC) untagged. Attempts carry the tag into progress snapshots; weakness detection and training prioritization aggregate per tag.

---

## Item mix (validator-enforced, per topic)

Recognition items are cheap to author and cheap to answer, so a catalog drifts toward them on its own. The A1 pilot learner scored **93% on `mc`, 94% on `match` and 45/45 on `order`** against **54% on `translate`** — the constrained formats had stopped carrying information, while the one format that discriminates was 13% of the catalog. `bun run validate` therefore enforces, over the union of a topic's `role: practice` sets:

| Rule | Why |
| --- | --- |
| **≥ 2 `translate` items** | Free production of a whole sentence is the only format here that reliably separates learners who can build German from learners who can recognize it. |
| **`mc` ≤ ⅓ of the topic's practice items** | Recognition cannot carry a topic. |
| **`mc` + `match` + `order` ≤ 45%** | Above that, the learner mostly picks from what is already on screen and rarely has to produce anything. |

Checked per **topic**, not per set, so a set may still specialize — a Hören set is all `listen`, and should be.

`order` gives the learner every token and asks only for the sequence. It is scaffolded first-encounter practice for a word-order rule, not a test of one, and it saturates fast — 99% over 78 attempts here. **Validator-enforced at ≤ 2 per set**, and per *set* rather than per topic on purpose: the topic-level caps above cannot see a single set that is mostly `order`, because a sibling set's `translate` items dilute the ratio. `a2/trennbare-verben` had 4 of 18 while `trennbar-wortstellung` was one of the worst persistent weak focuses in the log — a quarter of the practice for a rule the learner was failing handed them the tokens. Never let `order` stand in for a `translate` of the same rule.

**Adding items to an existing topic is not free.** `pathDone` treats a topic as finished when its `primaryPractice` set's items have all been attempted, so appending an item to that set silently un-finishes the topic for anyone who had completed it (mastered topics are safe — they pass `pathDone` by mastery). When adding practice to a topic that already ships, append it to a **non-primary** set, or add a new `role: practice` set **after** the existing ones in the topic's `exercises` list — `primaryPractice` is the *first* practice set, so it stays put.

---

## Placement sets (the entry test)

One `role: placement` set per level, at `content/exercises/<level>/placement-<level>.yaml`, anchored
to the level's **last** topic in the spine (as the checkpoint is) so every focus tag introduced
anywhere in the level clears the curriculum-order check. Seven rules, all validator-enforced, all
tighter than the practice equivalents — a practice item the learner guesses costs one wrong answer,
a placement item they guess **retires a whole lesson they will never be shown again**:

| Rule | Why |
| --- | --- |
| **Every topic of the level, ≥ 2 items** | One item is a coin flip, and the verdict is permanent. Sizing follows from this: A1 is 24 items over 10 topics, A2 is 46 over 22. |
| **Every item's outcomes belong to exactly one topic** | The item's score decides that topic's verdict; an item counted toward two would blur both, and eleven items could otherwise "cover" twenty-two topics. |
| Outcomes belong to topics **of the set's own level** | |
| **`mc` ≤ 25%**, `mc`+`match`+`order` ≤ 40% | Recognition is precisely what a placement test must not mistake for knowledge. |
| **≥ 1 listening item** | Nothing else stops a placement test being read end to end, and certifying reading while placing the learner out of the listening topics is the worst false positive this design can produce. Prefer `audio-comprehension`: it visibly becomes reading where audio is unavailable, while `listen` needs a German voice to be answerable at all. |
| **No `write`/`speak`** | Open production is never verified, so it cannot score — and since "every item answered" is half the pass condition, one unscorable item would make its topic permanently unplaceable. |
| **Every item has `explain`** | The results screen is the one place a learner who places out ever meets this material. |

`key_tokens` follow the ordinary rules, and an item that does not drill one nameable confusion stays
untagged **and therefore unpinned** — `key_tokens` without a `focus` grades nothing, and the
validator says so.

---

## Vocab entries

- Nouns need `gender` + `plural` (with article: "die Äpfel"); verbs need `partizip2`, `aux`, `praesens_3sg`, and `valence` when governed ("+ Dat").
- **`ipa` (Lautschrift)** on every entry except sentence-length `phrase`s: Duden-flavoured IPA of the **headword alone**, generated with `bun run gen:ipa` and then **reviewed** — the generator is weakest on compounds, separable verbs and loanwords. The character set and the transcription rules (stress, uvular r, syllabic consonants, glottal stop, the U+0261 copy-paste trap) are enforced by `bun run validate` and written out in [`docs/lautschrift.md`](lautschrift.md) — read it before hand-editing an `ipa`.
- **`accept` on a vocab entry** — other correct typed answers for the EN/RU→DE production card. It exists because `de` is *three* things at once: the Wortliste key (matched against the manifest character for character), the answer shown on the back, and the answer the learner must type. For most words those coincide; for four classes they do not, and without `accept` the card marks correct German **wrong**:
  - a **reflexive verb** — the headword is `ärgern`, but the form to produce is `sich ärgern`;
  - an **adjectival noun** — the card shows `die Deutsche`, but `der Deutsche` and `ein Deutscher` are equally right (same for `Angestellte`, `Verwandte`, `Erwachsene`, …);
  - a **spelling variant** the course itself teaches (`die Disko` beside `die Disco`, `Geographie` beside `Geografie`) — a card that rejects it is teaching against its own article;
  - a **reflexive verb's form fields** must also carry `sich` (`bewirbt sich` · `hat sich beworben`), because `deDetail` and the `/referenz/verbformen` table both **compose** `hat ${partizip2}` out of them — bare forms there do not merely drop a pronoun, they teach `hat gefreut`, and they collapse the minimal pairs the decks are built on (`treffen`/`sich treffen`, `anziehen`/`sich anziehen` would print the same Perfekt). `bun run validate` enforces this whenever reflexivity is **declared** — the headword starts with `sich `, or `valence` leads with it. A verb whose valence offers *both* readings (`+ Akk / sich`, as for `anziehen` = to put a garment on) is genuinely dual: its forms stay bare and the rule does not fire. So say which one you mean in `valence` — that field is what the check reads.
  An **article-free proper noun** is not solved with `accept`: it is `pos: phrase`, so the noun path never prepends an article. `das Deutschland` is not German. `die Schweiz` stays a noun — it really does take the article, and that card *is* the lesson.
- **Card identity**: flashcard history is keyed by `<vocab-file-id>::<de>::<direction>`. Renaming a headword or the vocab file id resets the learner's SRS history for it — avoid unless the entry was wrong.
