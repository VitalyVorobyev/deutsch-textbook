# content/ — authoring rules

Claude Code loads this file when you work in this directory; the root [`CLAUDE.md`](../CLAUDE.md) applies too. The course is the product, so these rules are the ones most often load-bearing.

## Instruments

- `bun run progress:audit --profile <slug>` — aggregate the newest learner snapshot. **Never Read a raw snapshot** (300 KB+). `--pull` fetches first and audits nothing if the fetch fails, because a stale snapshot does not look stale. `--item <set-id>:<item-id>` for one item's evidence. `--project <YYYY-MM-DD>` asks whether a gate *can* be read by that date — ask it **before** the date.
- `bun run gen:ipa` — fill missing `ipa` via espeak-ng (`brew install espeak-ng`). **Always review the output** — it gets compound and separable-verb stress, loanwords and unstressed vowels wrong. `--calibrate`, `--check` (dry run), `--force` (discards manual fixes).
- `bun scripts/coverage.ts <A1|A2|B1>` — Goethe Wortliste coverage; **keep all three at 100%**. A new word belongs to exactly one deck and the manifest gains a line in the same change. A leading `~` (taught as grammar, no flashcard) **must be earned** by the taught surface. Run `--check-deck <file.yaml>` per deck before `bun run validate` on a completion pass. → [`docs/authoring/coverage-instruments.md`](../docs/authoring/coverage-instruments.md)
- `bun scripts/giveaway-audit.ts [--level a1|a2|b1]` — items whose answer is printed on the screen that asks for it: a gap whose hint is its answer, an mc whose right option is quoted in its stem. **Read-only; read every hit** — a conjugation gap whose right form equals the lemma (*Die Kinder dürfen*) is still a decision. The one unambiguous case, gaps that spell a word printed beside them, `bun run validate` fails.
- `bun scripts/lang-cost.ts <file…>` — words per explanation half, and what four halves cost against two; the counting method is in the script.
- `bun scripts/grammar-coverage.ts <A1|A2|B1>` — structural coverage against `data/grammar-inventory.yaml`: A1 28/28, A2 46/46, B1 32/32. A point counts as taught only when a `practice`/`drill` item carries the focus tag naming its confusion — not a checkpoint, pretest, probe or `preview: true` item. **Closing a gap means lowering the number in `tests/grammar-coverage.test.ts` in the same commit.**
- `bun scripts/comprehensibility.ts <level>/<topic-id>` — input load: how much of a topic's German the learner has not met yet, per section, with the words listed. `--rank [A1|A2|B1]` ranks a level. **Read-only, no threshold**: read every row against the level median it prints; outliers are the product, and nothing here is an absolute claim about a learner. → [`docs/authoring/coverage-instruments.md`](../docs/authoring/coverage-instruments.md)
- `bun scripts/grammar-depth.ts [<level>] [--thin] [--by-point] [--no-probe]` — **how much practice stands behind each confusion**: teaching items, production, distinct practice files, probe items. **No threshold**; read against the level median. Median items per confusion **A1 13 · A2 9 · B1 6**, production 9 · 6 · 5; `tests/grammar-depth.test.ts` ratchets them so they may only improve. **Breadth and depth are two numbers and neither substitutes for the other** — choose a new topic's focus tags from `--thin`.

## Where content lives

| Path | What it is |
| --- | --- |
| `content/topics/<level>/<id>.topic.yaml` | **the topic**: identity, outcomes and the `elements:` list of every part it owns; level dir must match `level` |
| `content/topics/<level>/<id>.mdx` | its article — **prose only, no frontmatter** ([ADR 0002](../docs/adrs/0002-topic-manifests-and-learning-activities.md)) |
| `content/vocab/<id>.yaml` | vocabulary; **every entry becomes two flashcards** (DE→EN/RU and EN/RU→DE) |
| `content/exercises/<level>/<set-id>.yaml` | exercise sets, embedded on the owning topic's page |
| `content/reading/<level>/<id>.yaml` | graded reading; `kind: intensive` and `kind: extensive` are **different artifacts for different purposes** |
| `content/documents/` | reusable visual stimuli; **viewing is never evidence**; real/adapted assets require `attribution` + `license` |
| `content/wortfelder/`, `content/wortnetze/` | lexical overlays and word families; **enrich only the answer side** — receptive members create no cards and no mastery |
| `content/discovery/`, `content/reference-data/` | optional Entdecken material; canonical lookup data |
| `content/atlas.yaml` | the `groups:` taxonomy **and the curriculum spine** (`units:`) |
| `data/lid/bank.yaml`, `content/lid/` | the official LiD questions (generated, verbatim) and the course's notes: `topics.yaml`, and `notes/<topic>.yaml`, whose file **is** each question's topic; `lessons/<id>.mdx` are reading lessons over 1+ topics (a topic in **at most one** lesson) — German throughout, `## Kurz gesagt` first, and **every section with German text closes with one `<Translation>`** (EN/RU/UK, translated from the German, nothing added; hidden under `de`), collapsed except the summary's `<Translation open>`. A lesson's maps and pictures are its `figures:`, shown by `<Figure id>` outside any `<Translation>` — a bank picture (`official`, never `withheld`) or a credited file under `public/lid/lessons/`, ≤ 300 KB → [`docs/authoring/future-content-directions.md`](../docs/authoring/future-content-directions.md#leben-in-deutschland-lesson-figures). Notes and lessons carry the UK half like every other file |
| `progress/<profile>/*.json` | learner snapshots, one folder per local profile — **local only, gitignored** |
| `packages/schema/src/index.ts` | Zod schemas — the single source of truth for all content shapes |

**The spine and the manifests carry five rules**, each silent when broken: `units:` file order
**is** the recommended path (insert, never renumber); every topic lives in exactly one unit of its
own level, never before a prerequisite; a `deepens:` edge **must share a focus tag the base topic
drills** — the tag is the edge's only runtime channel; every manifest declares 2–5 learner-facing
`outcomes`; and **`elements:` is closed** — a set or reading naming a topic that does not list it
is an error. **`primary_practice`** decides what completing a Lernpfad step means, and **`probes`**
is the delayed check; `elements.exercises` is **one ordered list on purpose**, the scaffold→fade arc
written down.

## Authoring rules (content quality is the product)

### Bilingual voice
- Explanations are wrapped in `<Bilingual><En>…</En><Ru>…</Ru></Bilingual>` (injected; no imports in MDX). Optional `<Uk>` — an independently authored half written from the German, never translated from a sibling, per-file all-or-none, validator-enforced — and `<De>`, the German-medium half, authored from B1 onward and never backfilled. A missing half falls back to EN.
- **B1 articles are German-first** ([ADR 0005](../docs/adrs/0005-explanation-languages.md)): the German is the body, and every section with German prose closes with `<Translation>` (translated from the German, nothing added; `<En>` required, `<Ru>`/`<Uk>` all-or-none per file; `open` on `## Kurz gesagt` only) then `<Erklaerung>` (the authored `<En>`/`<Ru>`/`<Uk>` halves, kept whole). No `<Bilingual>`, no `<De>` — `germanFirstTopicProblems`, validator-enforced for every B1 article.
- EN and RU halves are each a complete, self-sufficient explanation — write both from scratch. They **may diverge** where it helps their reader: RU may contrast with Russian («быть», падежи), EN with English ("must not" ≠ *muss nicht*) or German-internal hooks. Never assume an EN reader knows Russian or vice versa.
- **No Cyrillic and no references to Russian inside `<En>` or any `en`/`*_en` field.** No Cyrillic in `de`/`*_de`, no і/ї/є/ґ in `ru`, no ы/э/ъ/ё in `uk`. Enforced by `bun run validate`.
- **The EN surface never assumes RU or UK** — rendering code too: under `en`, a learner sees English and German only. Never hardcode `en · ru`; a card's second meaning goes through `pickSecond` (`src/lib/prefs.ts`). RU and UK modes stay dual with EN. The one language selector is **Lernsprache** in the ProfileSwitcher dropdown (per-profile `ExplainLang`); the chrome is pinned German (`resolveUiLang`).
- German content (examples, tables, headings like "Beispiele") stays outside Bilingual blocks — always visible.
- Grammar terminology: German terms with a per-language gloss on first use — "der Kasus (case)" in En, "der Kasus (падеж)" in Ru.

### Topic article skeleton → [`docs/authoring/article-prose.md`](../docs/authoring/article-prose.md)
H2 headings, in German, in this order:
1. `## Kurz gesagt` — an advance organizer: the schema the article fills in, ≤ ~100 words and ≤ 5 sentences per half, not a summary of details.
2. `## Erklärung` — the full explanation (bilingual prose, German tables).
3. `## Beispiele` — 5–10 German sentences as blockquotes, each followed by its EN/RU translation in a Bilingual block.
4. `## Häufige Fehler` — ❌/✅ pairs. The Ru half highlights Russian interference; the En half gets its own framing — English false friends where they exist, otherwise neutral rule statements.
- No Übungen/Wortschatz sections — the page template renders them from the manifest.
- **`## Erklärung` splits into `### German subsections`, one per named confusion**, plus the integrating section. The heading sits **outside** `<Bilingual>` so it stays visible in every language.
- **Each subsection keeps its table beside its prose.**
- **A sentence that points back to an earlier topic links it**: `<Siehe to="a2/einkaufen-reklamation#heading-slug">Auf A2</Siehe>`, or `to="referenz/zeitformen"`. The target topic, its heading and the Referenz page are validator-checked; following one leaves a "Zurück zu …" pill on the target. → [`docs/authoring/article-prose.md`](../docs/authoring/article-prose.md#links-back)
- **No paragraph over 120 words in any explanation half** (validator-enforced); target ≤ 90, one claim per paragraph. The cap is a tripwire, **never a target**. Command: `bun scripts/prose-shape.ts content/topics/<level>`.
- **A fact stated in `## Erklärung` is drilled by an item or serves an outcome**; otherwise it goes in a compact `### Feinheiten` table. A list over three members is a table or a bullet list, and prose never restates the table beside it.

### Exercise items → [`docs/authoring/item-authoring.md`](../docs/authoring/item-authoring.md)

- Topic `id` equals the filename; kebab-case ASCII. Exercise refs are path-ids like `a2/perfekt-haben-sein`.
- **Item ids are stable.** Increment `revision` only when prompts, accepted answers, scoring, outcomes or focus semantics change — not for explanation polish.
- Every set declares `role: pretest|practice|drill|checkpoint|probe|placement`.
- **Every topic owns at least one `role: practice` set** and names one `elements.primary_practice` — completing it advances the Lernpfad, **so its item list must not grow later.**
- Every item declares `outcomes:`; every item should have a bilingual `explain`; every item that drills one nameable confusion gets a `focus` tag. `preview: true` only for an intentional forward reference.
- **Pretests are never weakness evidence, never training, never `Geübt`.** The `-pretest` filename is validator-enforced in both directions.
- **Item mix, per topic, over `role: practice` sets:** ≥ 2 `translate`; `mc` ≤ ⅓; `mc`+`match`+`order` ≤ 45%; `order` ≤ 2 **per set**. The ratios count **written items only** — `audio-comprehension` sits on neither side.
- **`key_tokens` on a `translate` item are the tokens whose exact form the item's `focus` grades.** Pin **both ends** of a word-order rule; **only pin what the tag grades**; **never pin nothing**; and a token repeated in the defining rendering **grades both occurrences** — rewrite the sentence.
- **An item may never grade which word the author had in mind, and it must stay determinate when served alone and in every prompt language it ships.** A cloze gap asking for a lexical verb names the infinitive; a `translate` item pinning one of two interchangeable connectors (*denn*/*weil*) names it in the `instruction` or accepts the sibling — **depending on whether the connector carries the `focus`** — and the same test settles a determiner a bare Russian noun leaves free; a `table` answer key continues a `…` stub, and both forms are graded.
- `mc` has exactly one correct answer. A `match` meaning-side right is a `{en, ru, uk?}` record, **never a mixed `"en / ru"` string**. `listen` text is ≤ ~10 words with numbers written as words. An `audio-comprehension` item may name a reviewed `recording`; its `source.turns` are both the recorded script and the TTS fallback, held equal by the validator. Playback is never evidence. Readings gloss 6–10 phrases as `[[de::en::ru]]`.
- **Placement sets are held to seven stricter rules** than practice — a guessed placement item retires a lesson the learner never sees again.

### Focus tags → [`docs/authoring/focus-tags.md`](../docs/authoring/focus-tags.md)

The table there is an **allowlist**: `bun run validate` rejects a tag not registered in
`focusIntroducedBy` (`packages/content/src/focus-tags.ts`), and `tests/focus-tags.test.ts` holds the
two equal. Reuse an existing tag whenever possible; a new one is for a genuinely new confusion and
joins both places in the same change. Leave mixed or pure-comprehension items untagged — **a false
tag is worse than no tag**. **A `translate` probe whose tag names an *added* word** (*zu* after a
modal or *lassen*, an article before a name) **declares `focus_evidence.failed` predicates** —
`key_tokens` cannot see an insertion, so the probe would read it as retained (validator-enforced;
[`focus-tags.md`](../docs/authoring/focus-tags.md#errors-that-add-a-word)).

### Vocab entries → [`docs/authoring/item-authoring.md`](../docs/authoring/item-authoring.md#vocab-entries)

- Nouns need `gender` + `plural` (with article); verbs need `partizip2`, `aux`, `praesens_3sg`, and `valence` when governed. Every entry except sentence-length `phrase`s needs a reviewed `ipa`.
- **`accept` exists because `de` is three things at once** — the Wortliste key, the answer shown and the answer typed. Reflexive verbs, adjectival nouns and taught spelling variants need it. A reflexive verb's form fields carry `sich` too (validator-enforced).
- **A gloss is a concise idiomatic translation (1–4 words) — the retrieval cue, never a definition.** A disambiguating parenthetical only where two shipped cards would share a production prompt; teaching goes in `note`. Measured by `bun scripts/gloss-shape.ts`, ratcheted by `tests/gloss-shape.test.ts`.
- **A gloss is the question side of the production card, so it must never contain the answer.** Reflexivity, a governing frame or a fixed chunk goes in `note`. The headword may appear in a gloss only as the translation itself (validator-enforced). Every character of a typed answer must be on the insert bar (`GERMAN_INPUT_KEYS`, `src/lib/typing.ts`), also enforced.
- **A dual-language card explains a distinction once.** Keep `en` complete for EN-only mode; when EN and RU/UK both carry extended commentary, add a shorter `en_compact` for the dual view.
- **`cards: recognition` makes one card instead of two**, for language the learner must understand but will never produce. It is defaulted (`both`) and **never retrofitted**: the direction is in the card id, so flipping a shipped entry deletes its production history.
- **Card identity is `<vocab-file-id>::<de>::<direction>`.** Renaming a headword or file id resets the learner's SRS history — only when the entry was wrong.
- **A2 vocabulary recycles, never adopts**, and **Wortliste completion decks stay unowned** — listing one in a topic's `vocab:` buries its words behind that topic.

### Entdecken & Dokumente → [`docs/authoring/future-content-directions.md`](../docs/authoring/future-content-directions.md)

Optional editorial material outside the spine (`content/discovery/<level>/<id>.mdx`): **no mastery,
no review debt, no completion bar**. Only `status: reviewed` ships. Every piece passes the editorial
test in that doc, which also holds the provenance contract for `images[]`, `links[]` and
`content/documents/` — real and adapted assets require `attribution` and `license`,
validator-enforced. **Viewing a document is never learning evidence.**

### Shipping a topic → [`docs/authoring/authoring-checklists.md`](../docs/authoring/authoring-checklists.md)

A topic is not done until all nine are:

1. `content/topics/<level>/<id>.topic.yaml` — the manifest, and `<id>.mdx` beside it: the article following the skeleton, **prose only**.
2. Learning activities — exactly one 8–15-item `activity: core` Grundübung named by `primary_practice`, plus at least one productive `activity: application` in a fresh context; `extension` and `remediation` only for a coherent extra job. Every teaching set declares `stage`, `activity`, `title_de`; every item has `explain`; every `translate` has `key_tokens`. The item-mix bar is per topic. Run `bun run activity:audit`.
3. Pretest — 3 items at `<id>-pretest.yaml`, referenced via `pretest`.
4. Probe family — `probe-<id>.yaml`, listed in `elements.probes`, 3 **parallel variants**: different tasks, **one competence**, same `focus` and `outcomes`, none answerable from memory of a practice item. A further family is ordinary work — each has its own explicit `arming:` list — but **measure `armedAt` before and after**.
5. Reading — `kind: intensive`, 6–10 glosses, 3 questions. ~90–130 words is the authoring target and **no gate enforces it**: length is a cognitive-load judgement, made by the author.
6. Vocab file if the topic introduces a word field; fill `ipa` with `bun run gen:ipa`, then review it.
7. Unit slot in `content/atlas.yaml`, and 2–5 `outcomes` in the manifest. **Every outcome is measured by a `practice`/`drill` item or a reading question** — pretests, checkpoints and probes do not count.
8. New `focus` tags registered in [`docs/authoring/focus-tags.md`](../docs/authoring/focus-tags.md) **and** in `focusIntroducedBy`.
9. `bun run validate` passes.

### Lesson cycle (required)

Each topic implements **pretest → model → explanation → scaffold → fade → transfer → delayed check**: the pretest is diagnostic generation, not practice; the article and readings give a comprehensible model with maximal support; topic-owned practice begins blocked and explanatory; mixed training removes hints and interleaves only after the article was opened; at least one fresh-context production task checks transfer; checkpoints and probes use separate roles and never leak into ordinary training.

### Drills from progress (the personalization loop)

1. `bun run progress:audit --profile <slug>` — **never Read the raw snapshot.**
2. **Triage the grading queue first.** Rulings live in `data/grading-decisions.yaml` and must be committed. An `accept` or `constrain` is paid for in the same change (an `accept` must pass today's grader; a `constrain` adds the bilingual `instruction`), both with a `revision` bump. **Never author a drill from a pre-triage weak-focus table.**
3. Diagnose via the weak **focus tags**, not individual failed items. Write a drill set targeting that confusion, tag every item with it, and attach the set to the relevant topic's `exercises`.

Full procedure and decision rules: [`docs/authoring/authoring-checklists.md`](../docs/authoring/authoring-checklists.md) and the `progress-review` skill.
