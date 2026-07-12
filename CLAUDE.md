# Deutsch-Atlas

An agent-authored German learning system: wiki-like textbook + interactive exercises +
FSRS flashcards. The course currently targets A1–A2; the learner (Vitaly) has B2 as a
longer-term goal. Explanations are bilingual **EN + RU**. The repo is both the knowledge
base (`content/`) and the Astro site that renders it.

## Commands

This project uses **Bun** as its package manager and task runner (`bun install`, `bun run <script>`; the validator runs directly on Bun's native TypeScript loader).

- `bun run dev` — dev server
- `bun run validate` — content validation (**run after every content change; it must pass before you are done**)
- `bun test` — domain regression tests
- `bun run check` — Astro/TypeScript diagnostics
- `bun run lint` — ESLint
- `bun run build` — production build (also type-checks content against schemas)
- `bun run gen:ipa` — fill missing `ipa` (Lautschrift) on vocab entries via espeak-ng (`brew install espeak-ng`; one-off dev tool — the IPA is committed to YAML and nothing about espeak ships). **Always review the output**: it is a good phoneme skeleton but gets compound/separable-verb stress, loanwords, and unstressed vowel quality wrong. `--calibrate` diffs it against a known-answer table; `--check` is a dry run; `--force` regenerates (discarding manual fixes).
- `bun scripts/coverage-a1.ts` — Goethe-A1 Wortliste coverage report against `data/goethe-a1-wortliste.txt` (headwords only; a leading `~` marks words taught as grammar, no flashcard). `--missing-only` hides covered words. A1 is at 100% — keep it there: a new A1 word belongs in exactly one deck (the validator hard-fails cross-file duplicate headwords), and the manifest gains a line in the same change.
- `bun tauri dev` / `bun tauri build` — desktop app (thin Tauri v2 shell in `src-tauri/`; needs a Rust toolchain). Release: push a plain `vX.Y.Z` tag → `.github/workflows/release.yml` builds Windows (.exe/.msi), Linux (.deb/.AppImage), and macOS (.dmg, unsigned) installers into a GitHub Release; the tag is stamped as the version (committed `version` fields are dev placeholders). Keep the site base-path-agnostic — the app ships the default root-base build. Tauri JS APIs are used only behind the `isTauri()` runtime check (`src/lib/syncdir.ts`).

## Architecture

- `content/topics/<level>/<id>.mdx` — atlas nodes (articles). Level dir must match frontmatter `level`.
- `content/vocab/<id>.yaml` — vocabulary files; every entry becomes two flashcards (DE→EN/RU and EN/RU→DE).
- `content/exercises/<level>/<set-id>.yaml` — exercise sets, embedded automatically on the owning topic's page.
- `content/reading/<level>/<id>.yaml` — graded reading texts (comprehensible input): glossed paragraphs + 2–4 `mc` comprehension questions; rendered as the topic's "Lesetext" section (`src/components/reading/ReadingText.tsx`). Attempts log under `reading:<path-id>`.
- `content/atlas.yaml` — the topic relationships **and the curriculum spine**. Per node: id/level/kind/prerequisites, optional `deepens: [base-topic-ids]` (spiral revisits — targets must appear earlier in the spine), and 2–4 `outcomes` (learner-facing "Ich kann …" can-do statements with independently written `en`/`ru`). `units:` is the ordered spine — file order IS the recommended path (A1 units before A2; insert, never renumber); every topic lives in exactly one unit of its own level, never before a prerequisite. All of it is enforced by `bun run validate`. Runtime: `getCurriculum()` in `src/lib/curriculum.ts` provides the flattened spine, and `recommendedNext()` in `src/lib/mastery.ts` selects its first topic below measured mastery for Heute and Themen. The path is soft: it guides navigation but never unlocks unread material for automatic training or fresh-card selection.
- `progress/<profile>/*.json` — learner progress snapshots, **one folder per local profile**. The folder name is the slug of whatever name the learner chose at first run; this repo's historical learner folder is `progress/vitaly/`. v3 snapshots carry `attempts`, `cards`, `sessions` (daily-session completion log) and `topics` (per-topic `readAt` + a manual `learned`/`reopened` override; import back-compat reads v1/v2/v3). Read the newest snapshot in the relevant profile folder to find weak spots and generate targeted drill sets (put drills in `content/exercises/<level>/drill-*.yaml` attached to the relevant topic). Snapshots sync **automatically** on two paths (`src/lib/autosync.ts`, debounced full-snapshot on every progress write): under `bun run dev` via POST to the dev-only `POST /__progress/<profile>` middleware (`src/integrations/progress-writer.ts`), which writes `progress/<profile>/<date>.json` into the repo; in the desktop app via the Tauri fs plugin into the configurable sync folder (`src/lib/syncdir.ts`, localStorage `da:syncdir`, default app-data — point it at a repo clone's `progress/` on the Fortschritt page). The Fortschritt page's Export button does the same on demand; on the plain deployed website it falls back to a file download. Import is a **non-destructive merge** by default (Replace is confirm-gated).
- `src/lib/schemas.ts` — Zod schemas, the single source of truth for all content shapes (shared by `src/content.config.ts` and `scripts/validate.ts`).
- Exercise UI: `src/components/exercises/` (item types: `mc`, `cloze`, `match`, `order`, `table`, `translate`, `listen`, `write`, `audio-comprehension`). Every set declares a learning `role`; every item references stable curriculum `outcomes`. `write` logs unverified practice evidence and never affects accuracy/mastery. `audio-comprehension` supports a committed asset or TTS dialogue and visibly becomes reading when audio is unavailable. SRS: `src/lib/srs.ts` + `src/components/srs/`. TTS: `src/lib/speech.ts` + `src/components/SpeakerButton.tsx` (browser speechSynthesis, German voice; also powers the flashcards' "Hören" dictation input mode). In `.astro` templates use `src/components/SpeakButton.astro` instead — it emits plain `<button data-speak>` markup driven by one hoisted, delegated listener, so a 40-row Wortschatz table costs one event handler; **never mount a React island per table row**. The buttons are CSS-hidden until the script sets `<html data-tts="ready">`, so no-JS/no-voice readers never see a dead control.
- `/training` — cross-topic interleaved practice (`src/components/training/MixedTraining.tsx`): prioritizes recently-wrong items, then items tagged with a currently weak focus (`src/lib/weakness.ts` aggregates error rates per focus tag), then never-attempted items; never two consecutive items from one topic; attempts are logged under the item's origin set id. EN/RU→DE flashcards use typed input (`src/lib/typing.ts` does the matching: article required for nouns, umlaut-substitute detection, trailing-punctuation-tolerant).
- Profiles & progress store: `src/lib/profile.ts` (local learner profiles — no accounts/server; each profile owns the IndexedDB database `deutsch-atlas--<id>` and writes its identity into it under the key `profile`, so the browser's databases — not the localStorage registry — are the source of truth for who learns on this device; switcher in the header). There is **no default profile and no name is ever assumed**: with no profile registered, `resolveProfileState()` reports `first-run` and the blocking `src/components/FirstRunGate.tsx` asks who is learning, offering to reconnect anything `discoverProfiles()` finds (a named database → one-click "continue as …"; the unnamed pre-profile `deutsch-atlas` database → the learner claims it by giving it a name, which binds it via the registry entry's `db` field). Name → id → database is deterministic (`slugify`), so re-entering the same name reconnects even where `indexedDB.databases()` is unavailable. The last remaining profile cannot be deleted. `src/lib/store.ts` (profile-aware `getStore`; keys `attempts`/`cards`/`sessions`/`topics` + the `profile` identity record; `mergeSnapshot`/`replaceSnapshot`) awaits that decision before touching IndexedDB and parks writes while the gate is up (nothing may create a database before discovery has run).
- Lesson resume: `src/lib/resume.ts` — profile-scoped, same-day localStorage state so a reload (mobile tab discard, mid-session navigation) returns to the same lesson point. Used by `ExerciseSet` (answered items), `MixedTraining` (built queue + position, via `resumeKey`), and `SessionFlow` (step + review count). Cleared on finish/restart; flashcards need no resume state (each grade persists immediately, so the due queue rebuilds itself).
- Topic completion: `src/lib/mastery.ts` derives tiers `untouched → read → practiced → mastered` from non-pretest attempts + cards + persisted topic state; unverified practice never raises measured mastery. Tiers appear on the topic header and in the `/topics` Lernpfad (`src/components/atlas/CurriculumPath.tsx`).
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
- `translate` items: `prompt_en` + `prompt_ru` (same sentence, written independently), `answer` (canonical German), optional `accept` list for legitimate variants (e.g. fronted time phrase vs subject-first — both valid V2). Matching is case-sensitive and whitespace-normalized with trailing `.!?` optional, so `accept` is for real word-order/wording variants, not typo tolerance.
- `mc` has exactly one correct answer (`correct` = index into `options`).
- `listen` items (dictation): `text` is spoken via browser TTS and is also the canonical typed answer — keep it ≤ ~10 words at the set's level, write numbers as words (validate fails on digits), gloss nothing. Matching ignores punctuation but keeps case (noun capitalization is part of the drill); `accept` is for real spelling variants only.
- Reading gloss markers: `[[German phrase::en gloss::ru gloss]]` inline in `text` paragraphs — exactly three non-empty `::`-separated fields; every reading should gloss 6–10 phrases.
- Every exercise set declares `role: pretest|practice|drill|checkpoint|probe`. Pretests are 3-item sets at `content/exercises/<level>/<topic-id>-pretest.yaml`, referenced via the topic's `pretest` field — never listed in `exercises`, never mixed into training, and never counted as `Geübt`.
- Every item declares `outcomes: [stable-outcome-id]`; ids, modes and domains live in `content/atlas.yaml`. Use `preview: true` only when an item intentionally uses a focus introduced later in the spine; the validator otherwise rejects curriculum-order leakage.
- Every exercise item should have an `explain` (bilingual) — it is shown on wrong answers and is where the teaching happens.
- Every exercise item that clearly drills one confusion gets a `focus` tag (kebab-case ASCII, validated against `/^[a-z0-9]+(-[a-z0-9]+)*$/`) from the canonical table below. Leave genuinely mixed or pure-comprehension items (dialogue matching, lexical MC) untagged. Attempts carry the tag into progress snapshots; weakness detection and training prioritization aggregate per tag.

### Focus tags (the confusion taxonomy)

Use existing tags whenever possible; add a new one only for a genuinely new confusion, and add it to this table in the same change.

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

New topic:
1. `content/topics/<level>/<id>.mdx` with full frontmatter + article following the skeleton.
2. Exercise set(s) in `content/exercises/<level>/<id>.yaml` — 8–15 items, ≥3 different types, each with `explain`.
3. Pretest in `content/exercises/<level>/<id>-pretest.yaml` — 3 `mc` items probing the topic's core rules, referenced via `pretest`.
4. Reading text in `content/reading/<level>/<id>.yaml` — ~90–130 words at the topic's level, 6–10 glosses, 3 comprehension questions; referenced via `reading`.
5. Vocab file if the topic introduces a word field (20–40 entries). Fill `ipa` with `bun run gen:ipa`, then review it — the generator is weakest exactly on compounds, separable verbs and loanwords.
6. Add the node (with 2–4 can-do `outcomes`) and its unit slot to `content/atlas.yaml`.
7. `bun run validate` must pass.

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
