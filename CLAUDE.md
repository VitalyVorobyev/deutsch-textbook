# Deutsch-Atlas

An agent-authored German learning system: wiki-like textbook + interactive exercises +
FSRS flashcards. The course currently targets A1–A2; the learner (Vitaly) has B2 as a
longer-term goal. Explanations are bilingual **EN + RU**. The repo is both the knowledge
base (`content/`) and the Astro site that renders it.

This file is the **authoring contract**: how any single artifact must be written. Three companions
decide the rest, and they are not optional reading. [`docs/curriculum-a2-b1.md`](docs/curriculum-a2-b1.md)
decides *what* A2 teaches, in what order, with which frozen identities.
[`docs/a1-learning-audit.md`](docs/a1-learning-audit.md) holds the twelve-point quality gate a
finished unit must clear. [`docs/backlog.md`](docs/backlog.md) is the execution queue.

## Commands

This project uses **Bun** as its package manager and task runner (`bun install`, `bun run <script>`; the validator runs directly on Bun's native TypeScript loader).

- `bun run dev` — dev server
- `bun run validate` — content validation (**run after every content change; it must pass before you are done**)
- `bun test` — domain regression tests
- `bun run check` — Astro/TypeScript diagnostics
- `bun run lint` — ESLint
- `bun run build` — production build (also type-checks content against schemas)
- `bun run gen:ipa` — fill missing `ipa` (Lautschrift) on vocab entries via espeak-ng (`brew install espeak-ng`; one-off dev tool — the IPA is committed to YAML and nothing about espeak ships). **Always review the output**: it is a good phoneme skeleton but gets compound/separable-verb stress, loanwords, and unstressed vowel quality wrong. `--calibrate` diffs it against a known-answer table; `--check` is a dry run; `--force` regenerates (discarding manual fixes).
- `bun scripts/coverage.ts <A1|A2>` — Goethe Wortliste coverage report against `data/goethe-<level>-wortliste.txt` (headwords only; a leading `~` marks words taught as grammar, no flashcard). `--missing-only` hides covered words. A level with no manifest has no coverage figure and must not claim one. A1 is at 100% — keep it there: a new A1 word belongs in exactly one deck (the validator hard-fails cross-file duplicate headwords), and the manifest gains a line in the same change. **The two manifests are separate lists, not nested ones** — the Goethe A2 Wortliste is not a superset of the A1 one (it does not repeat *Nase*, *Finger*, *anziehen*), so a word is measured as covered by whichever deck teaches it, at any level.
- `bun tauri dev` / `bun tauri build` — desktop app (thin Tauri v2 shell in `src-tauri/`; needs a Rust toolchain). Release: push a plain `vX.Y.Z` tag → `.github/workflows/release.yml` builds Windows (.exe/.msi), Linux (.deb/.AppImage), and macOS (.dmg, unsigned) installers into a GitHub Release; the tag is stamped as the version (committed `version` fields are dev placeholders). Keep the site base-path-agnostic — the app ships the default root-base build. Tauri JS APIs are used only behind the `isTauri()` runtime check (`src/lib/syncdir.ts`).

## Architecture

- `content/topics/<level>/<id>.mdx` — atlas nodes (articles). Level dir must match frontmatter `level`.
- `content/vocab/<id>.yaml` — vocabulary files; every entry becomes two flashcards (DE→EN/RU and EN/RU→DE).
- `content/exercises/<level>/<set-id>.yaml` — exercise sets, embedded automatically on the owning topic's page.
- `content/reading/<level>/<id>.yaml` — graded reading texts (comprehensible input). `kind: intensive` (the default) is the topic's "Lesetext": glossed paragraphs + 2–4 `mc` comprehension questions, ~90–130 words. `kind: extensive` is a **different artifact for a different purpose** — 250–400 words, ≤2 questions, ~1 gloss per 40 words, bounds enforced by the validator — meant to be read straight through for meaning with the glosses closed. A long text quizzed line by line is just a long intensive text, and the volume input it exists to provide never happens; the reader UI says so to the learner. Rendered by `src/components/reading/ReadingText.tsx`; attempts log under `reading:<path-id>`.
- `content/atlas.yaml` — the topic relationships **and the curriculum spine**. Per node: id/level/kind/prerequisites, optional `deepens: [base-topic-ids]` (spiral revisits — targets must appear earlier in the spine, **and must share a focus tag the base drills**: the tag is the edge's only runtime channel, so an edge without one is inert — see below), and 2–4 `outcomes` (learner-facing "Ich kann …" can-do statements with independently written `en`/`ru`). `units:` is the ordered spine — file order IS the recommended path (A1 units before A2; insert, never renumber); every topic lives in exactly one unit of its own level, never before a prerequisite. All of it is enforced by `bun run validate`. Runtime: `getCurriculum()` in `src/lib/curriculum.ts` provides the flattened spine, and `recommendedNext()` in `src/lib/mastery.ts` selects the first topic the learner has not put behind them (`pathDone`, below) for Heute and Themen. The path is soft: it guides navigation but never unlocks unread material for automatic training or fresh-card selection.
- `progress/<profile>/*.json` — learner progress snapshots, **one folder per local profile**. The folder name is the slug of whatever name the learner chose at first run; this repo's historical learner folder is `progress/vitaly/`. v3 snapshots carry `attempts`, `cards`, `sessions` (daily-session completion log) and `topics` (per-topic `readAt` + a manual `learned`/`reopened` override; import back-compat reads v1/v2/v3). Read the newest snapshot in the relevant profile folder to find weak spots and generate targeted drill sets (put drills in `content/exercises/<level>/drill-*.yaml` attached to the relevant topic). Snapshots sync **automatically** on two paths (`src/lib/autosync.ts`, debounced full-snapshot on every progress write): under `bun run dev` via POST to the dev-only `POST /__progress/<profile>` middleware (`src/integrations/progress-writer.ts`), which writes `progress/<profile>/<date>.json` into the repo; in the desktop app via the Tauri fs plugin into the configurable sync folder (`src/lib/syncdir.ts`, localStorage `da:syncdir`, default app-data — point it at a repo clone's `progress/` on the Fortschritt page). The Fortschritt page's Export button does the same on demand; on the plain deployed website it falls back to a file download. Import is a **non-destructive merge** by default (Replace is confirm-gated).
- `src/lib/schemas.ts` — Zod schemas, the single source of truth for all content shapes (shared by `src/content.config.ts` and `scripts/validate.ts`).
- Exercise UI: `src/components/exercises/` (item types: `mc`, `cloze`, `match`, `order`, `table`, `translate`, `listen`, `write`, `speak`, `audio-comprehension`). Every set declares a learning `role`; every item references stable curriculum `outcomes`. `write` requires draft → checklist → revision; `speak` requires two say-aloud attempts with local record/replay when supported. Both log unverified practice evidence and never affect accuracy/mastery. Attempts also record their actual `responseMode`, separate from the outcome's target CEFR mode. `audio-comprehension` supports a committed asset or TTS dialogue and visibly becomes reading when audio is unavailable. SRS: `src/lib/srs.ts` + `src/components/srs/`. `planReview()` in `src/lib/decks.ts` is the ONE rule for what a review queue contains — most-overdue first, then fresh cards in curriculum-priority order. Ties are broken at random (never by card id: that dealt the same sequence every session), and `spaceSiblings()` keeps a word's two flashcards apart — the recognition card hands over the answer to the production card, so back-to-back they are one retrieval, not two. TTS: `src/lib/speech.ts` + `src/components/SpeakerButton.tsx` (browser speechSynthesis, German voice; also powers the flashcards' "Hören" dictation input mode). In `.astro` templates use `src/components/SpeakButton.astro` instead — it emits plain `<button data-speak>` markup driven by one hoisted, delegated listener, so a 40-row Wortschatz table costs one event handler; **never mount a React island per table row**. The buttons are CSS-hidden until the script sets `<html data-tts="ready">`, so no-JS/no-voice readers never see a dead control.
- Delayed probes: `src/lib/probes.ts` + `content/exercises/<level>/probe-*.yaml` (`role: probe`). The same competence is asked again 2, 7 and 21 days after the outcome was first practiced, in a task the learner has not seen — each family owns several **parallel variants**, and a due probe always draws an unused one, because re-presenting a practice item measures recognition of that item, not retention. A due probe opens the session as step 0, **before** review and training: a probe answered after twenty minutes of practice on the same material measures the practice, not the interval. Probe state is **derived from the attempt log, never stored** (armed = earliest verified attempt on the topic's practice/drill sets; taken = its attempts; variants used = their item ids), so scheduling survives export/import with nothing for `mergeSnapshot` to merge. `MAX_PROBES_PER_SESSION = 3`.
- Level checkpoints: `content/exercises/<level>/checkpoint-<level>.yaml` (`role: checkpoint`) — **data, not wiring**. `getCheckpoints()` (`src/lib/content.ts`) discovers every checkpoint set, reads its level off its directory, and hands the descriptor (`setId`/`level`/`path`/`title`/`items`) to the four surfaces that show one: the `/checkpoint/[level]` route (`getStaticPaths` — the A1 checkpoint keeps the URL `/checkpoint/a1`), the Heute card, the Lernpfad and Fortschritt. Nothing names a checkpoint set, so **shipping the next one is one new YAML file and no code**. `dueCheckpoint()` (`src/lib/checkpoint.ts`) is the one rule for which checkpoint to offer: the lowest level whose lessons are all behind the learner (`levelPathDone`) and whose set is unattempted — nobody is sent to the A2 checkpoint with the A1 one unstarted. The validator enforces one checkpoint per level (they would fight for the same route) and that the directory names the level.
- `/training` — cross-topic interleaved practice (`src/components/training/MixedTraining.tsx`; queue built by `buildSession()` in `src/lib/training.ts`, which is pure and tested): prioritizes recently-wrong items, then items tagged with a currently weak focus (`src/lib/weakness.ts` aggregates error rates per focus tag), then never-attempted items; never two consecutive items from one topic; attempts are logged under the item's origin set id. `BROAD_RETRIEVAL_SHARE = 0.25` reserves a quarter of every session for items answered *correctly*, longest ago — the three priority bands can always fill a session on their own, so without the reservation a learner with any backlog would never meet an old topic again, and an old topic answered correctly weeks ago is exactly the material whose retention has decayed most. The reservation is elastic in both directions. EN/RU→DE flashcards use typed input (`src/lib/typing.ts` does the matching: article required for nouns, umlaut-substitute detection, trailing-punctuation-tolerant).
- Profiles & progress store: `src/lib/profile.ts` (local learner profiles — no accounts/server; each profile owns the IndexedDB database `deutsch-atlas--<id>` and writes its identity into it under the key `profile`, so the browser's databases — not the localStorage registry — are the source of truth for who learns on this device; switcher in the header). There is **no default profile and no name is ever assumed**: with no profile registered, `resolveProfileState()` reports `first-run` and the blocking `src/components/FirstRunGate.tsx` asks who is learning, offering to reconnect anything `discoverProfiles()` finds (a named database → one-click "continue as …"; the unnamed pre-profile `deutsch-atlas` database → the learner claims it by giving it a name, which binds it via the registry entry's `db` field). Name → id → database is deterministic (`slugify`), so re-entering the same name reconnects even where `indexedDB.databases()` is unavailable. The last remaining profile cannot be deleted. `src/lib/store.ts` (profile-aware `getStore`; keys `attempts`/`cards`/`sessions`/`topics` + the `profile` identity record; `mergeSnapshot`/`replaceSnapshot`) awaits that decision before touching IndexedDB and parks writes while the gate is up (nothing may create a database before discovery has run).
- Lesson resume: `src/lib/resume.ts` — profile-scoped, same-day localStorage state so a reload (mobile tab discard, mid-session navigation) returns to the same lesson point. Used by `ExerciseSet` (answered items), `MixedTraining` (built queue + position, via `resumeKey`), and `SessionFlow` (step + review count). Cleared on finish/restart; flashcards need no resume state (each grade persists immediately, so the due queue rebuilds itself).
- Topic completion: `src/lib/mastery.ts` derives tiers `untouched → read → practiced → mastered` from non-pretest attempts + cards + persisted topic state; unverified practice never raises measured mastery. `topicEvidence()` returns the chips behind the tier (`src/components/topic/EvidenceChips.tsx`), shared by Fortschritt and Themen so the two cannot disagree.
  **Navigation asks a different question than the badge**: `pathDone(node, ctx)` — mastered, *or* the primary practice set completed, *or* the learner self-rated it `learned`; `reopened` puts a topic back until its set is worked through again (attempts after `manualAt`). Every path surface goes through it — `recommendedNext`, `recommendedForGoal`, `levelPathDone`/`levelRemaining` (the checkpoint gate), fresh-card priority. **Never derive a badge from `pathDone`**: a self-rating is not evidence. And never gate the path on item-level completion alone — practice sets grow when a topic is deepened, which would silently un-finish a lesson the learner had already mastered.
- Themen (`/topics`) is one island, `src/components/atlas/CurriculumPath.tsx`, with three tabs: **Lernpfad** (the single next step), **Atlas** (strand → group map), **Alle Themen** (`OverviewTable.tsx` — every topic in curriculum order with its tier, evidence and next action; expanding a row shows its relations). Shared types/labels live in `atlas/course.ts`, the relations pane in `atlas/TopicDetail.tsx`. The tab id persists in `localStorage['da:topics-view']` — migrate old values rather than stranding a learner on a tab that no longer exists.
- `/about` (Über) states the learning principles and how complete each CEFR level is. **Every figure on it is computed from the content at build time** (`goetheCoverage(level)` in `src/lib/coverage.ts`, shared with `scripts/coverage.ts`) — never hand-write a count there, and never claim a level is more finished than it is.
- `/progress` (Fortschritt) is a dashboard (`src/components/progress/`): activity heatmap + streak, per-day session log, per-topic progress, and weakness-tag trends (`src/lib/trends.ts`), plus profile-aware export/import.

## Authoring rules (content quality is the product)

### Language discipline
- German orthography must be perfect: ä/ö/ü/ß always (never ae/oe/ue/ss substitutes), nouns capitalized.
- Russian and English explanation text must be complete and idiomatic — never machine-translation-ese, never transliteration.
- **CEFR discipline**: in a topic at level X, German example sentences and exercise items may only use grammar and vocabulary at or below level X. An A2 article must be fully readable by an A2 learner.
- Every German example sentence gets EN and RU translations.

### Bilingual voice
- Explanations are wrapped in `<Bilingual><En>…</En><Ru>…</Ru></Bilingual>` (components are injected; no imports needed in MDX).
- EN and RU halves are each a complete, self-sufficient explanation of the same point — write both from scratch. They **may diverge** where it helps their reader: the RU half may contrast German with Russian («быть», падежи); the EN half may contrast with English ("must not" ≠ *muss nicht*) or use German-internal hooks (the wem?-question test). Never assume an EN reader knows Russian or vice versa.
- **No Cyrillic and no references to Russian inside `<En>…</En>` or any `en`/`*_en` YAML field.** Enforced by `bun run validate`.
- German content (examples, tables, headings like "Beispiele") stays outside Bilingual blocks — it is always visible.
- Grammar terminology: use German terms with a per-language gloss on first use — in En blocks "der Kasus (case)", in Ru blocks "der Kasus (падеж)".

### Topic article skeleton
Section order (H2 headings, in German):
1. `## Kurz gesagt` — the rule in 2–3 sentences (bilingual).
2. `## Erklärung` — the full explanation with tables (bilingual prose, German tables).
3. `## Beispiele` — 5–10 German sentences as blockquotes, each with EN/RU translation in a Bilingual block right after.
4. `## Häufige Fehler` — typical mistakes (❌/✅ pairs). The Ru half highlights Russian-interference errors; the En half gets its own framing — English false friends where they exist ("must not"), otherwise neutral rule statements. Never Russian-framed English.
- Do **not** add Übungen/Wortschatz sections in the article — the page template renders them from frontmatter (`exercises`, `vocab`).

### Frontmatter / schema notes
- Topic `id` must equal the filename; kebab-case ASCII (no umlauts in ids/slugs).
- `prerequisites` reference topic ids; keep the graph acyclic; update `content/atlas.yaml` in the same change.
- Exercise refs are path-ids like `a2/perfekt-haben-sein` (relative to `content/exercises/`, no extension).
- Cloze gaps: `{{answer}}` or `{{answer|alternative}}` inline in `text`.
- `translate` items: `prompt_en` + `prompt_ru` (same sentence, written independently), `answer` (canonical German), optional `accept` list for legitimate variants (e.g. fronted time phrase vs subject-first — both valid V2). `accept` is for real word-order/wording variants, **not** typo tolerance — typos are handled by the scorer, below.
- **`key_tokens` on a `translate` item — the tokens whose exact form the item's `focus` grades.** `src/lib/production.ts` is the one rule for scoring a typed sentence, and it exists because a translate item asks for a whole sentence: one mistyped character used to sink it *and* be recorded as a failure of the grammar it drilled. Two rules:
  1. A one-token near-miss (Damerau-Levenshtein ≤ 1) **outside** `key_tokens` is a spelling slip: the learner is shown the correction, the attempt scores **correct**, and no focus error is logged. Closed-class words (`den`/`dem`, `ihn`/`ihm`, `einen`/`einem`) are never forgiven — they are one edit apart *and* they are exactly what the taxonomy grades, so a swap there is a choice, not a slip. A non-word (`do` for `du`) still counts as a slip: it cannot have been chosen.
  2. A real failure is attributed to `focus` **only when a token that tag grades is what diverged**. Otherwise the attempt is logged wrong but *unattributed*. An honest gap in the weakness signal beats a false entry in it — `weakFocuses()` drives training priority and drill authoring, and a false tag sends both after a confusion the learner does not have.
  Word order needs no declaration (tokens are compared positionally), so an item grading only placement (`modal-satzklammer`, `verbzweit`) needs `key_tokens` only for the verb it pins. Declare the tokens the tag is about: the auxiliary **and** participle for `haben-sein` (a Perfekt item grades both halves of the tense), the case-marked article for `dativ-artikel`, `gern` for `gern-moegen`. The validator rejects a `key_tokens` entry that does not occur in `answer`, or that occurs in it more than once.

  **A `key_token` is matched by string, not by position** (`graded` in `src/lib/production.ts`), so if the word occurs **twice** in the answer, the tag grades *both* occurrences. `Tom hängt die Uhr über die Tür.` with `key_tokens: [die]` grades the accusative *object* article as well as the directional one — and a learner who writes `der Uhr` is then logged as a `wo-wohin` failure, which is not the confusion they had. **`bun run validate` rejects this**: a `key_tokens` entry that occurs more than once in `answer` fails the build. Rewrite the sentence so the graded token appears once (`Tom hängt den Kalender über die Tür.`), or pin a different word that is unique — tokens are whole words, so a multi-word phrase cannot be pinned. Where the repetition is genuinely the same decision twice, it is still worth splitting: the item would otherwise weigh one confusion twice as heavily as its siblings. A false entry in the weakness signal is worse than a missing one: it sends training and drill authoring after a confusion the learner does not have.

  **Only pin what the tag grades.** Attribution is all-or-nothing to the single `focus`, so a token that the tag is not about turns an unrelated error into a false entry under that tag: `focus: duerfen-muessen` with `key_tokens: [musst, kommen]` logs a fumbled lexical verb as a dürfen/müssen confusion; `focus: partizip2-form` pinning the auxiliary `habe` logs `bin`-for-`habe` — a `haben-sein` error — as a failure to build the Partizip II. The validator cannot check this (it is a question about meaning), so it is on the author.
  `listen` (dictation) deliberately uses none of this: there, spelling *is* the drill.
- `mc` has exactly one correct answer (`correct` = index into `options`).
- `listen` items (dictation): `text` is spoken via browser TTS and is also the canonical typed answer — keep it ≤ ~10 words at the set's level, write numbers as words (validate fails on digits), gloss nothing. Matching ignores punctuation but keeps case (noun capitalization is part of the drill); `accept` is for real spelling variants only.
- `speak` items: declare `mode: spoken-production|spoken-interaction`, a bilingual communicative `prompt` and `goal`, 2–4 bilingual self-check points, and a concise German `model_answer`. The learner records/replays locally when supported and makes a second attempt; audio is never uploaded or automatically scored.
- Reading gloss markers: `[[German phrase::en gloss::ru gloss]]` inline in `text` paragraphs — exactly three non-empty `::`-separated fields; every reading should gloss 6–10 phrases.
- Every exercise set declares `role: pretest|practice|drill|checkpoint|probe`. Pretests are 3-item sets at `content/exercises/<level>/<topic-id>-pretest.yaml`, referenced via the topic's `pretest` field — never listed in `exercises`, never mixed into training, and never counted as `Geübt`.
- **Every topic must own at least one `role: practice` set** (validator-enforced). Its first one is the topic's `primaryPractice` — the set whose completion advances the Lernpfad. A topic with only drills or Hören sets could never be completed, and the recommended path would stop on it forever.
- Every item declares `outcomes: [stable-outcome-id]`; ids, modes and domains live in `content/atlas.yaml`. Use `preview: true` only when an item intentionally uses a focus introduced later in the spine; the validator otherwise rejects curriculum-order leakage.
- Every exercise item should have an `explain` (bilingual) — it is shown on wrong answers and is where the teaching happens.
- Every exercise item that clearly drills one confusion gets a `focus` tag (kebab-case ASCII, validated against `/^[a-z0-9]+(-[a-z0-9]+)*$/`) from the canonical table below. Leave genuinely mixed or pure-comprehension items (dialogue matching, lexical MC) untagged. Attempts carry the tag into progress snapshots; weakness detection and training prioritization aggregate per tag.

### Item mix (validator-enforced, per topic)

Recognition items are cheap to author and cheap to answer, so a catalog drifts toward them on its own. The A1 pilot learner scored **93% on `mc`, 94% on `match` and 45/45 on `order`** against **54% on `translate`** — the constrained formats had stopped carrying information, while the one format that discriminates was 13% of the catalog. `bun run validate` therefore enforces, over the union of a topic's `role: practice` sets:

| Rule | Why |
| --- | --- |
| **≥ 2 `translate` items** | Free production of a whole sentence is the only format here that reliably separates learners who can build German from learners who can recognize it. |
| **`mc` ≤ ⅓ of the topic's practice items** | Recognition cannot carry a topic. |
| **`mc` + `match` + `order` ≤ 45%** | Above that, the learner mostly picks from what is already on screen and rarely has to produce anything. |

Checked per **topic**, not per set, so a set may still specialize — a Hören set is all `listen`, and should be.

`order` gives the learner every token and asks only for the sequence. It is scaffolded first-encounter practice for a word-order rule, not a test of one, and it saturates fast. Keep it to a couple per set, and never let it stand in for a `translate` of the same rule.

**Adding items to an existing topic is not free.** `pathDone` treats a topic as finished when its `primaryPractice` set's items have all been attempted, so appending an item to that set silently un-finishes the topic for anyone who had completed it (mastered topics are safe — they pass `pathDone` by mastery). When adding practice to a topic that already ships, append it to a **non-primary** set, or add a new `role: practice` set **after** the existing ones in the topic's `exercises` list — `primaryPractice` is the *first* practice set, so it stays put.

### Focus tags (the confusion taxonomy)

Use existing tags whenever possible; add a new one only for a genuinely new confusion, and add it to this table in the same change. The table is an **allowlist**: `bun run validate` rejects a focus tag that is not also registered in `focusIntroducedBy` (`scripts/validate.ts`) with the topic that introduces it, so a typo or an undeclared confusion cannot slip through unchecked.

| Tag | Confusion it names |
| --- | --- |
| `verbzweit` | conjugated verb must stay in position 2 (inversion after fronted element, W-questions) |
| `verb-endungen` | present-tense person endings, incl. stem changes (du sprichst) and sein/haben forms |
| `kopula-sein` | dropping sein like Russian drops «быть» (❌ Ich müde) |
| `genus` | noun gender / der–die–das, incl. -ung/-chen signals; no transfer from Russian |
| `plural-artikel` | plural article is always die |
| `artikel-pflicht` | dropping the article (❌ Ich habe Frage) |
| `kein-nicht` | negating nouns with kein-, not nicht |
| `nicht-position` | placing nicht correctly: after verb and object, before predicative adjectives/adverbs (❌ Ich nicht arbeite) |
| `possessivartikel` | choosing mein/dein/sein/ihr and matching nominative gender/plural endings |
| `akkusativ-artikel` | accusative article forms: der→den, ein→einen, kein→keinen; only masculine changes |
| `akkusativ-pronomen` | accusative pronoun forms: mich, dich, ihn |
| `akkusativ-praepositionen` | für/ohne/um always govern the accusative (für einen Freund, ohne mich) |
| `dativ-artikel` | dative article/noun forms: dem, der, den …-n (Dativ Plural) |
| `dativ-pronomen` | dative pronoun forms: mir, dir, ihm, ihr, Ihnen |
| `dativ-praepositionen` | aus/bei/mit/nach/seit/von/zu always govern the dative (incl. zum/zur/beim/vom) |
| `verben-mit-dativ` | dative-governing verbs: helfen, danken, gefallen, gehören, antworten, schmecken |
| `passen-dativ` | passen + Dativ (Passt es Ihnen? — ❌ Passt es Sie?) |
| `wechsel-akk-dat` | choosing Akkusativ vs Dativ (two-object sentences; later: two-way prepositions) |
| `trennbar-wortstellung` | separable prefix splits off and goes to the clause end |
| `trennbar-modal` | after a modal/möchte the separable verb stays whole at the end (… muss … aufstehen) |
| `trennbar-untrennbar` | separable vs inseparable prefixes (be-, ver-, er- … never split) |
| `modal-satzklammer` | modal in position 2, bare infinitive at the very end |
| `modal-konjugation` | modal forms: ich/er kann without -t, vowel change only in singular |
| `duerfen-muessen` | darf nicht (prohibition, «нельзя») vs muss nicht (no necessity) |
| `will-moechte` | blunt wollen vs polite möchte (vs mögen = general liking) |
| `gern-moegen` | expressing liking: verb + gern (Ich spiele gern Fußball), not a «люблю + инфинитив» calque; mögen only with nouns at A1 |
| `haben-sein` | Perfekt auxiliary choice: sein for A→B movement + bleiben/sein/passieren, else haben |
| `partizip2-form` | building the Partizip II: ge-…-t/-en, -ieren without ge-, separable -ge- inside, inseparable without ge- |
| `perfekt-satzklammer` | Perfekt bracket: haben/sein in position 2, participle at the very end |
| `haben-wendungen` | states expressed with haben + noun: Hunger/Durst/Feierabend haben (❌ Ich bin Hunger) |
| `um-am-zeit` | time prepositions: um + clock time, am + day/part of day, im + month/season, in der Nacht |
| `du-sie` | register: du vs Sie with strangers/officials |
| `wo-wohin` | two-way prepositions: Wo? + Dativ (position) vs Wohin? + Akkusativ (direction) |
| `stellen-stehen` | the placement/position verb pairs: stellen/stehen, legen/liegen, hängen |
| `komparativ-als` | comparison with *als*, incl. the irregulars (gut → besser, gern → lieber, viel → mehr) |
| `superlativ-am` | the superlative *am …-sten* |

**The tag is also what makes a `deepens` edge real.** Weakness is aggregated per tag and is blind to the topic an attempt came from (`focusStats` in `src/lib/weakness.ts` keys only by `focus`), so an error while practising a deepening topic marks that confusion weak *course-wide*; mixed training's second band then pulls every item carrying it out of the whole eligible pool — the base topic's practice and drill sets included. That is the entire runtime meaning of `deepens`, and nothing else reads the field. A spiral revisit whose two ends share no focus tag can therefore resurface nothing, so `bun run validate` requires each `deepens: [base]` edge to share at least one tag between the deepening topic's items and a `practice`/`drill` item of the base. Do **not** add `deepens`-aware special cases to weakness aggregation or training priority: scoping a tag to a topic would *narrow* a signal that is deliberately global.

- Vocab: nouns need `gender` + `plural` (with article: "die Äpfel"); verbs need `partizip2`, `aux`, `praesens_3sg`, and `valence` when governed ("+ Dat"). Every entry except sentence-length `phrase`s needs `ipa` (Lautschrift) — see below.

### Lautschrift (the `ipa` field)

Duden-flavoured IPA of the **headword alone**, generated with `bun run gen:ipa` and then reviewed. Rendered under the word in the Wortschatz table and on the flashcard's back. The character set and these rules are enforced by `bun run validate` (`IPA_CHARS` in `src/lib/schemas.ts`).

| Rule | Yes | No |
| --- | --- | --- |
| Bare — the UI adds the brackets | `ˈapfl̩` | `[ˈapfl̩]`, `/ˈapfl̩/` |
| Headword only, no article | `ˈapfl̩` | `deːɐ̯ ˈapfl̩` |
| Primary stress always marked, incl. monosyllables | `ˈbʁoːt` | `bʁoːt` |
| Secondary stress in compounds and separable verbs, primary on the prefix/first stem | `ˈaʊ̯fˌʃteːən`, `ˈfʁyːˌʃtʏk` | `aʊ̯fˈʃteːən`, two `ˈ` |
| Uvular r; vocalized r is `ɐ̯` (incl. the ver-/er- prefixes) | `ʁ`, `ˈuːɐ̯`, `fɛɐ̯ˈʃteːən` | `r`, `ʀ` |
| ASCII g (U+0067) | `g` | `ɡ` (U+0261 — the Wiktionary copy-paste trap) |
| Affricates as sequences, no tie bars | `ts`, `pf`, `tʃ` | `t͡s`, `p͡f` |
| Diphthong offglides carry ̯ (U+032F) | `aɪ̯ aʊ̯ ɔʏ̯` | `aɪ aʊ ɔʏ` |
| Syllabic consonant after an obstruent — but not after a sonorant | `ˈmaxn̩`, `ˈapfl̩`, `telefoˈniːʁən` | `telefoˈniːʁn̩` |
| Glottal stop before a word-internal stressed vowel; omitted word-initially | `bəˈʔantvɔʁtn̩`, `ˈmɪtaːkˌʔɛsn̩` | `ˈʔapfl̩` |
- **Card identity**: flashcard history is keyed by `<vocab-file-id>::<de>::<direction>`. Renaming a headword or the vocab file id resets the learner's SRS history for it — avoid unless the entry was wrong.

### Checklists

New topic — a topic is not done until every line here is:
1. `content/topics/<level>/<id>.mdx` with full frontmatter + article following the skeleton.
2. Exercise set(s) in `content/exercises/<level>/<id>.yaml` — 8–15 items, ≥3 different types, each with `explain`, each clearing the item-mix bar above. Every `translate` declares `key_tokens`. Include the modes the topic's outcomes claim: a hidden-transcript `audio-comprehension`, a `write` (draft → checklist → revision), a `speak` (record/replay), and a faded discrimination set against the material this topic is confusable with. The **first** `role: practice` set in `exercises:` is the topic's `primaryPractice` — its completion advances the Lernpfad, so its item list must not grow later.
3. Pretest in `content/exercises/<level>/<id>-pretest.yaml` — 3 `mc` items probing the topic's core rules, referenced via `pretest`.
4. Probe family in `content/exercises/<level>/probe-<id>.yaml` — `role: probe`, 3 **parallel variants**: different tasks, **one competence**. Never listed in `exercises`. Two rules, both validator-enforced, and both easy to get wrong in a way that looks fine:
   - **All three variants carry the same `focus` and the same `outcomes`.** `dueProbe` serves one unused variant per interval, so variants that test *different* things measure each of them exactly once, at exactly one delay — and a retention curve needs the same competence at several delays. There is then nothing to compare, and the number that comes out looks like retention without being it. (All sixteen families shipped this way and had to be rewritten.) A topic with two competences worth delayed evidence owns two families, not one family with two kinds of item.
   - **A variant may not be answerable from memory of a practice item** — that measures recognition of the item, not retention. Write each against the topic's existing answer keys: new people, new situation, new lexis, same rule.
   Probe one competence per topic: the thing the lesson is *about*. A topic's other outcomes get their evidence from practice, which is where outcome mastery comes from anyway.
5. Reading text in `content/reading/<level>/<id>.yaml` — `kind: intensive`, ~90–130 words at the topic's level, 6–10 glosses, 3 comprehension questions; referenced via `reading`. An extensive reader is a *different artifact* (`kind: extensive`, 250–400 words, ≤2 questions, ~1 gloss per 40 words) and is meant to be read straight through.
6. Vocab file if the topic introduces a word field (20–40 entries; A2 units are thinner — see below). Fill `ipa` with `bun run gen:ipa`, then review it — the generator is weakest exactly on compounds, separable verbs and loanwords.
7. Add the node (with 2–4 can-do `outcomes`) and its unit slot to `content/atlas.yaml`. **Every outcome must be referenced by at least one item in a `role: practice` or `role: drill` set, or by at least one reading question** (validator-enforced). Pretests, checkpoints and probes deliberately do not count: a pretest is a guess taken *before* the lesson, and a checkpoint or probe *tests* an outcome rather than teaching it — an outcome that is only ever tested was never practised. An outcome nothing measures can never light up, and a probe on it can never arm.
8. New `focus` tags registered in the table above **and** in `focusIntroducedBy` (`scripts/validate.ts`).
9. `bun run validate` must pass.

**A2 vocabulary — recycle, never adopt.** The lexical fields are largely spent: twenty-five decks own 711 headwords, and the validator hard-fails a headword that appears in two of them. Twelve decks are deliberately *unowned* (the Goethe-A1 Wortliste completion decks); they gate their fresh cards on the learner's level rather than on a topic. Listing one of them in a new A2 topic's `vocab:` would flip that gate to "this A2 topic has been opened" and push hundreds of A1 words behind A2. So an A2 unit **recycles** the A1 field deck in its article, reading and exercises, and **owns one thin new `level: A2` deck** (12–24 entries) of language no deck already teaches — the genuinely A2 words plus the chunks that carry the function. Receptive-only language (announcements, listing abbreviations, form headings) belongs in readings and article tables, never in a deck: every vocab entry becomes *two* cards, so a deck cannot teach for recognition alone.

### Lesson cycle (required)

Each topic implements **pretest → model → explanation → scaffold → fade → transfer → delayed check**:
1. The pretest is diagnostic generation, not practice.
2. The article/readings provide a comprehensible model with maximal support.
3. Topic-owned practice begins blocked and explanatory.
4. Mixed training removes hints and interleaves only after the article was opened.
5. At least one fresh-context production task (`translate` or `write`) checks transfer.
6. Checkpoints/probes use separate roles and never leak into ordinary training.

Drills from progress (the personalization loop):
1. Read the newest `progress/<profile>/*.json` (folders are named after the learner's chosen profile; the historical folder here is `progress/vitaly/`). Attempts carry a `focus` tag — aggregate error rates per tag (the same logic as `weakFocuses` in `src/lib/weakness.ts`: last ~30 attempts per focus, weak = ≥4 attempts and ≥35% errors) and also check cards with high `lapses`.
2. Diagnose via the weak focus tags, not individual failed items — the tag names the confusion (e.g. `haben-sein`, `dativ-pronomen`). For untagged failures, infer the confusion from `given` vs the answer key.
3. Write a drill set targeting that confusion; give every drill item the matching `focus` tag (so future snapshots keep measuring it) and attach the set to the relevant topic's `exercises` list.
