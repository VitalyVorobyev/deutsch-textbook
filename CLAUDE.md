# Deutsch-Atlas

An agent-authored German learning system: wiki-like textbook + interactive exercises +
FSRS flashcards. The learner (Vitaly) is at ~A1/A2 working toward B2, with **bilingual
EN + RU explanations**. The repo is both the knowledge base (`content/`) and the Astro
site that renders it.

## Commands

- `npm run dev` — dev server
- `npm run validate` — content validation (**run after every content change; it must pass before you are done**)
- `npm run build` — production build (also type-checks content against schemas)

## Architecture

- `content/topics/<level>/<id>.mdx` — atlas nodes (articles). Level dir must match frontmatter `level`.
- `content/vocab/<id>.yaml` — vocabulary files; every entry becomes two flashcards (DE→EN/RU and EN/RU→DE).
- `content/exercises/<level>/<set-id>.yaml` — exercise sets, embedded automatically on the owning topic's page.
- `content/reading/<level>/<id>.yaml` — graded reading texts (comprehensible input): glossed paragraphs + 2–4 `mc` comprehension questions; rendered as the topic's "Lesetext" section (`src/components/reading/ReadingText.tsx`). Attempts log under `reading:<path-id>`.
- `content/atlas.yaml` — the topic graph (id/level/kind/prerequisites per node). Must stay consistent with topic frontmatter; `npm run validate` enforces it.
- `progress/*.json` — learner progress snapshots exported from the browser. Read these to find weak spots and generate targeted drill sets (put drills in `content/exercises/<level>/drill-*.yaml` attached to the relevant topic).
- `src/lib/schemas.ts` — Zod schemas, the single source of truth for all content shapes (shared by `src/content.config.ts` and `scripts/validate.ts`).
- Exercise UI: `src/components/exercises/` (item types: `mc`, `cloze`, `match`, `order`, `table`, `translate`). SRS: `src/lib/srs.ts` + `src/components/srs/`.
- `/training` — cross-topic interleaved practice (`src/components/training/MixedTraining.tsx`): pulls recently-wrong and least-practiced items from all sets, never two consecutive items from one topic; attempts are logged under the item's origin set id. EN/RU→DE flashcards use typed input (`src/lib/typing.ts` does the matching: article required for nouns, umlaut-substitute detection, trailing-punctuation-tolerant).

## Authoring rules (content quality is the product)

### Language discipline
- German orthography must be perfect: ä/ö/ü/ß always (never ae/oe/ue/ss substitutes), nouns capitalized.
- Russian and English explanation text must be complete and idiomatic — never machine-translation-ese, never transliteration.
- **CEFR discipline**: in a topic at level X, German example sentences and exercise items may only use grammar and vocabulary at or below level X. An A2 article must be fully readable by an A2 learner.
- Every German example sentence gets EN and RU translations.

### Bilingual voice
- Explanations are wrapped in `<Bilingual><En>…</En><Ru>…</Ru></Bilingual>` (components are injected; no imports needed in MDX).
- EN and RU versions must carry the same content — write both from scratch, don't translate word-for-word.
- German content (examples, tables, headings like "Beispiele") stays outside Bilingual blocks — it is always visible.
- Grammar terminology: use German terms with a gloss on first use (e.g. "der Kasus (case / падеж)").

### Topic article skeleton
Section order (H2 headings, in German):
1. `## Kurz gesagt` — the rule in 2–3 sentences (bilingual).
2. `## Erklärung` — the full explanation with tables (bilingual prose, German tables).
3. `## Beispiele` — 5–10 German sentences as blockquotes, each with EN/RU translation in a Bilingual block right after.
4. `## Häufige Fehler` — typical mistakes (❌/✅ pairs), especially Russian-speaker interference errors.
- Do **not** add Übungen/Wortschatz sections in the article — the page template renders them from frontmatter (`exercises`, `vocab`).

### Frontmatter / schema notes
- Topic `id` must equal the filename; kebab-case ASCII (no umlauts in ids/slugs).
- `prerequisites` reference topic ids; keep the graph acyclic; update `content/atlas.yaml` in the same change.
- Exercise refs are path-ids like `a2/perfekt-haben-sein` (relative to `content/exercises/`, no extension).
- Cloze gaps: `{{answer}}` or `{{answer|alternative}}` inline in `text`.
- `translate` items: `prompt_en` + `prompt_ru` (same sentence, written independently), `answer` (canonical German), optional `accept` list for legitimate variants (e.g. fronted time phrase vs subject-first — both valid V2). Matching is case-sensitive and whitespace-normalized with trailing `.!?` optional, so `accept` is for real word-order/wording variants, not typo tolerance.
- `mc` has exactly one correct answer (`correct` = index into `options`).
- Reading gloss markers: `[[German phrase::en gloss::ru gloss]]` inline in `text` paragraphs — exactly three non-empty `::`-separated fields; every reading should gloss 6–10 phrases.
- Pretests: a 3-item exercise set at `content/exercises/<level>/<topic-id>-pretest.yaml`, referenced via the topic's `pretest` field — never listed in `exercises`. Rendered above the article as the "Was weißt du schon?" callout (guessing before reading boosts retention, even when wrong).
- Every exercise item should have an `explain` (bilingual) — it is shown on wrong answers and is where the teaching happens.
- Vocab: nouns need `gender` + `plural` (with article: "die Äpfel"); verbs need `partizip2`, `aux`, `praesens_3sg`, and `valence` when governed ("+ Dat").
- **Card identity**: flashcard history is keyed by `<vocab-file-id>::<de>::<direction>`. Renaming a headword or the vocab file id resets the learner's SRS history for it — avoid unless the entry was wrong.

### Checklists

New topic:
1. `content/topics/<level>/<id>.mdx` with full frontmatter + article following the skeleton.
2. Exercise set(s) in `content/exercises/<level>/<id>.yaml` — 8–15 items, ≥3 different types, each with `explain`.
3. Pretest in `content/exercises/<level>/<id>-pretest.yaml` — 3 `mc` items probing the topic's core rules, referenced via `pretest`.
4. Reading text in `content/reading/<level>/<id>.yaml` — ~90–130 words at the topic's level, 6–10 glosses, 3 comprehension questions; referenced via `reading`.
5. Vocab file if the topic introduces a word field (20–40 entries).
6. Add the node to `content/atlas.yaml`.
7. `npm run validate` must pass.

Drills from progress (the personalization loop):
1. Read the newest `progress/*.json`; find items with `correct: false` and cards with high `lapses`.
2. Diagnose the underlying confusion (e.g. haben/sein choice, adjective endings), don't just repeat failed items verbatim.
3. Write a drill set targeting that confusion; attach it to the relevant topic's `exercises` list.
