# Deutsch-Atlas

An agent-authored German learning system: wiki-like textbook + interactive exercises +
FSRS flashcards. The course currently targets A1–A2; the learner (Vitaly) has B2 as a
longer-term goal. Explanations are bilingual **EN + RU**, with optional **UK** arriving in
translation waves and, from B1 onward, an optional German-medium explanation half. The repo is
both the knowledge base (`content/`) and the Astro site that renders it.

**This file is the index and the rule digest.** Every rule the project enforces has its imperative
here, in one line. The *reasoning* — the measurement that produced the rule, the failure that
motivated it, the hazard it guards — lives in a companion doc, because it is only ever needed once
you already know which job you are doing. **A one-line rule you do not understand is a rule to go
read**, not a rule to guess at.

## Before you do X, read Y

| If you are… | Read first |
| --- | --- |
| authoring or editing an **exercise item** (any type, `key_tokens`, item mix, placement sets, vocab entries) | [`docs/item-authoring.md`](docs/item-authoring.md) |
| choosing or adding a **`focus` tag** | [`docs/focus-tags.md`](docs/focus-tags.md) |
| changing anything in **`src/lib/`** | [`docs/runtime-contracts.md`](docs/runtime-contracts.md) |
| shipping a **new topic**, or writing a **drill from learner progress** | [`docs/authoring-checklists.md`](docs/authoring-checklists.md) |
| touching a **coverage figure** (Wortliste `~`, grammar inventory, `/about`) | [`docs/coverage-instruments.md`](docs/coverage-instruments.md) |
| hand-editing a vocab **`ipa`** | [`docs/lautschrift.md`](docs/lautschrift.md) |
| authoring **Entdecken** material or adding a **document** | [`docs/future-content-directions.md`](docs/future-content-directions.md) |
| deciding **what A2 teaches**, in what order, with which frozen identities | [`docs/curriculum-a2-b1.md`](docs/curriculum-a2-b1.md) |
| checking a finished unit against the **quality gate** | [`docs/a1-learning-audit.md`](docs/a1-learning-audit.md) |
| looking for the **system map** or **the queue** | [`docs/design.md`](docs/design.md) · [`docs/backlog.md`](docs/backlog.md) |

## Commands

This project uses **Bun** as its package manager and task runner (`bun install`, `bun run <script>`; the validator runs directly on Bun's native TypeScript loader).

- `bun run dev` — dev server
- `bun run validate` — content validation (**run after every content change; it must pass before you are done**)
- `bun test` — domain regression tests
- `bun run check` — Astro/TypeScript diagnostics
- `bun run lint` — ESLint
- `bun run build` — production build (also type-checks content against schemas)
- `bun run progress:audit --profile <slug>` — aggregate the newest learner snapshot. **Never Read a raw snapshot**: they run 300 KB+ and the audit already aggregates everything. `--item <set-id>:<item-id>` for focused evidence on one item.
- `bun run gen:ipa` — fill missing `ipa` on vocab entries via espeak-ng (`brew install espeak-ng`; one-off dev tool, nothing about espeak ships). **Always review the output** — it is a good phoneme skeleton but gets compound/separable-verb stress, loanwords and unstressed vowel quality wrong. `--calibrate` diffs against a known-answer table; `--check` is a dry run; `--force` regenerates, discarding manual fixes.
- `bun scripts/coverage.ts <A1|A2>` — Goethe Wortliste coverage. **A1 and A2 are both at 100% — keep them there.** A new word belongs to exactly one deck; the manifest gains a line in the same change. A leading `~` (taught as grammar, no flashcard) **must be earned** — the validator hard-fails unless the word occurs in the taught surface. Run `--check-deck <file.yaml>` per deck before `bun run validate` on any completion pass. → [`docs/coverage-instruments.md`](docs/coverage-instruments.md)
- `bun scripts/grammar-coverage.ts <A1|A2|B1>` — structural coverage against `data/grammar-inventory.yaml`. A point counts as taught only when a `practice`/`drill` item carries the focus tag naming its confusion — not a checkpoint, pretest, probe, or `preview: true` item. **Closing a gap means lowering the number in `tests/grammar-coverage.test.ts` in the same commit**; it is a tripwire. A1 22/22, A2 30/30, B1 0/31. → [`docs/coverage-instruments.md`](docs/coverage-instruments.md)
- `bun tauri dev` / `bun tauri build` — desktop app (thin Tauri v2 shell in `src-tauri/`; needs a Rust toolchain). Release: push a plain `vX.Y.Z` tag → `.github/workflows/release.yml` builds Windows, Linux and macOS (unsigned) installers into a GitHub Release; the tag is stamped as the version. Keep the site base-path-agnostic. Tauri JS APIs only behind the `isTauri()` runtime check (`src/lib/syncdir.ts`).

## Where content lives

| Path | What it is |
| --- | --- |
| `content/topics/<level>/<id>.mdx` | atlas nodes (articles); level dir must match frontmatter `level` |
| `content/vocab/<id>.yaml` | vocabulary; **every entry becomes two flashcards** (DE→EN/RU and EN/RU→DE) |
| `content/exercises/<level>/<set-id>.yaml` | exercise sets, embedded on the owning topic's page |
| `content/reading/<level>/<id>.yaml` | graded reading; `kind: intensive` and `kind: extensive` are **different artifacts for different purposes** |
| `content/documents/` | reusable visual stimuli; **viewing is never evidence**; real/adapted assets require `attribution` + `license` |
| `content/wortfelder/`, `content/wortnetze/` | lexical overlays and word families; **enrich only the answer side** — receptive members create no cards and no mastery |
| `content/discovery/`, `content/reference-data/` | optional Entdecken material; canonical lookup data |
| `content/atlas.yaml` | topic graph **and the curriculum spine** |
| `progress/<profile>/*.json` | learner snapshots, one folder per local profile |
| `src/lib/schemas.ts` | Zod schemas — the single source of truth for all content shapes |

**`content/atlas.yaml` carries three rules worth stating here**, because breaking one is silent:
`units:` file order **is** the recommended path (insert, never renumber); every topic lives in
exactly one unit of its own level, never before a prerequisite; and a `deepens:` edge **must share
a focus tag the base topic drills**, because the tag is the edge's only runtime channel — an edge
without one is inert. Each node declares 2–4 learner-facing `outcomes`. All of it is validated.

## Runtime invariants

Load-bearing, and each one silent when broken. Mechanism and history: [`docs/runtime-contracts.md`](docs/runtime-contracts.md).

- **`planReview()` (`src/lib/decks.ts`) is the ONE rule for what a review queue contains.** New cards are rationed **per day, not per queue** (`DAILY_NEW_CARDS = 15`) — `planReview` re-runs on every mount, so a per-queue cap alone dealt a reloading learner 75 new cards and months of review debt. Fresh-card ties break at random, never by card id.
- **Never mount a React island per table row.** In `.astro` templates use `src/components/SpeakButton.astro` — one hoisted, delegated listener for the whole page.
- **Probe state is derived from the attempt log, never stored.** A due probe opens the session as step 0, *before* review and training. `MAX_PROBES_PER_SESSION = 3`.
- **Checkpoints and placements are data, not wiring** — discovered by role, level read off the directory. Shipping the next level's is one new YAML file and no code. One of each per level.
- **A passed placement is a third evidence class**: green, real, and it **never raises the measured tier**. Do not add a placement branch to `topicTier`/`effectiveTier`; never fold placed topics into a mastery counter; add no fifth chip to `EvidenceChips`. Nothing is written until the learner presses *Ergebnis übernehmen*.
- **Navigation asks a different question than the badge.** `pathDone` is mastered *or* primary practice completed *or* self-rated `learned`. **Never derive a badge from `pathDone`** — a self-rating is not evidence. And never gate the path on item-level completion alone.
- **Unverified practice never raises measured mastery.** `write` and `speak` are minimal-ceremony: attempt → model answer → done. Their `requirements`/`checklist` render as guidance, **never as gated forms** — the app cannot verify free production, so it must not charge steps for feedback it cannot give.
- **There is no default profile and no name is ever assumed.** Nothing may create a database before discovery has run. The last remaining profile cannot be deleted.
- **Every figure on `/about` is computed from content at build time.** Never hand-write a count there, and never claim a level is more finished than it is.
- Legacy or mismatched-revision attempts keep their logged result and are **never replayed** against a current key. Snapshot migrations v1–v6 are explicit (`src/lib/snapshot-schema.ts`).
- `localStorage` keys with persisted user choices (e.g. `da:topics-view`) — **migrate old values** rather than stranding a learner on a state that no longer exists.

## Authoring rules (content quality is the product)

### Language discipline
- German orthography must be perfect: ä/ö/ü/ß always (never ae/oe/ue/ss substitutes), nouns capitalized.
- Russian and English explanation text must be complete and idiomatic — never machine-translation-ese, never transliteration.
- **CEFR discipline**: in a topic at level X, German example sentences and exercise items may only use grammar and vocabulary at or below level X. An A2 article must be fully readable by an A2 learner.
- Every German example sentence gets EN and RU translations.

### Bilingual voice
- Explanations are wrapped in `<Bilingual><En>…</En><Ru>…</Ru></Bilingual>` (components are injected; no imports needed in MDX). Two optional halves may join them: `<Uk>` (Ukrainian, arriving in translation waves — per-file all-or-none, validator-enforced) and `<De>` (the German-medium explanation for advanced learners — authored from B1 onward, never backfilled to A1/A2). A missing half falls back to EN at render time.
- EN and RU halves are each a complete, self-sufficient explanation of the same point — write both from scratch. They **may diverge** where it helps their reader: the RU half may contrast German with Russian («быть», падежи); the EN half may contrast with English ("must not" ≠ *muss nicht*) or use German-internal hooks (the wem?-question test). Never assume an EN reader knows Russian or vice versa.
- **No Cyrillic and no references to Russian inside `<En>…</En>` or any `en`/`*_en` YAML field.** Likewise no Cyrillic in `de`/`*_de` fields, no Ukrainian-only letters (і/ї/є/ґ) in `ru` fields, no Russian-only letters (ы/э/ъ/ё) in `uk` fields. Enforced by `bun run validate`.
- **The EN surface never assumes RU or UK** — this binds *rendering code*, not just authored fields: under explanation language `en`, a learner sees English (and German) only. Never hardcode a combined `en · ru` string; a card's meaning-side second half goes through `pickSecond` (`src/lib/prefs.ts`), which returns the gloss of the *chosen* language and `undefined` under `en`/`de`. RU and UK modes stay dual with EN (`en · ru`, `en · uk`). The one language selector is **Lernsprache** in the ProfileSwitcher dropdown (per-profile `ExplainLang`); the chrome is pinned German — deliberate immersion, one-line reversible (`resolveUiLang`).
- German content (examples, tables, headings like "Beispiele") stays outside Bilingual blocks — it is always visible.
- Grammar terminology: use German terms with a per-language gloss on first use — in En blocks "der Kasus (case)", in Ru blocks "der Kasus (падеж)".

### Topic article skeleton
Section order (H2 headings, in German):
1. `## Kurz gesagt` — the rule in 2–3 sentences (bilingual).
2. `## Erklärung` — the full explanation with tables (bilingual prose, German tables).
3. `## Beispiele` — 5–10 German sentences as blockquotes, each with EN/RU translation in a Bilingual block right after.
4. `## Häufige Fehler` — typical mistakes (❌/✅ pairs). The Ru half highlights Russian-interference errors; the En half gets its own framing — English false friends where they exist ("must not"), otherwise neutral rule statements. Never Russian-framed English.
- Do **not** add Übungen/Wortschatz sections in the article — the page template renders them from frontmatter (`exercises`, `vocab`).

### Exercise items → [`docs/item-authoring.md`](docs/item-authoring.md)

- Topic `id` equals the filename; kebab-case ASCII. Exercise refs are path-ids like `a2/perfekt-haben-sein`.
- **Item ids are stable.** Increment `revision` only when prompts, accepted answers, scoring, outcomes or focus semantics change — explanation-only polish does not.
- Every set declares `role: pretest|practice|drill|checkpoint|probe|placement`.
- **Every topic owns at least one `role: practice` set.** The first one is its `primaryPractice`, whose completion advances the Lernpfad — **so its item list must not grow later.** Add practice to a non-primary set instead.
- Every item declares `outcomes:`; every item should have a bilingual `explain` (it is where the teaching happens); every item that drills one nameable confusion gets a `focus` tag. `preview: true` only for an intentional forward reference.
- **Pretests are never weakness evidence, never training, never `Geübt`.** The `-pretest` filename is validator-enforced in both directions, because an attempt records no role.
- **Item mix, per topic, over `role: practice` sets:** ≥ 2 `translate`; `mc` ≤ ⅓; `mc`+`match`+`order` ≤ 45%. Plus `order` ≤ 2 **per set** — it is scaffolding, not a test, and it saturates.
- **`key_tokens` on a `translate` item are the tokens whose exact form the item's `focus` grades.** Four rules, each of which has been got wrong here: pin **both ends** of a word-order rule (the finite verb alone grades the word the error leaves in place); **only pin what the tag grades**; **never pin nothing** (an empty list blanket-attributes every error to the tag); and a token repeated in the defining rendering **grades both occurrences** — rewrite the sentence.
- **A cloze gap asking for a lexical verb must be determinate** — name the infinitive, or give context only one verb fits.
- `mc` has exactly one correct answer. A `match` meaning-side right is a `{en, ru, uk?}` record, **never a mixed `"en / ru"` string**. `listen` text is ≤ ~10 words with numbers written as words. Readings gloss 6–10 phrases as `[[de::en::ru]]`.
- **Placement sets are held to seven stricter rules** than practice — a guessed placement item retires a lesson the learner never sees again.

### Focus tags → [`docs/focus-tags.md`](docs/focus-tags.md)

The table there is an **allowlist**: `bun run validate` rejects a tag not registered in
`focusIntroducedBy` (`scripts/validate.ts`) with the topic that introduces it. Use an existing tag
whenever possible; a new one is for a genuinely new confusion and joins both places in the same
change. Leave genuinely mixed or pure-comprehension items untagged — **a false tag is worse than no
tag**, because it sends training and drill authoring after a confusion the learner does not have.

### Vocab entries → [`docs/item-authoring.md`](docs/item-authoring.md#vocab-entries)

- Nouns need `gender` + `plural` (with article); verbs need `partizip2`, `aux`, `praesens_3sg`, and `valence` when governed. Every entry except sentence-length `phrase`s needs a reviewed `ipa`.
- **`accept` exists because `de` is three things at once** — the Wortliste key, the answer shown, and the answer typed. Reflexive verbs, adjectival nouns and course-taught spelling variants need it, or the card marks correct German **wrong**. A reflexive verb's form fields must carry `sich` too (validator-enforced when reflexivity is declared).
- **Card identity is `<vocab-file-id>::<de>::<direction>`.** Renaming a headword or file id resets the learner's SRS history — avoid unless the entry was wrong.
- **A2 vocabulary recycles, never adopts**, and **Wortliste completion decks stay unowned** — listing one in a topic's `vocab:` flips its fresh-card gate and buries hundreds of words behind that topic.

### Entdecken & Dokumente → [`docs/future-content-directions.md`](docs/future-content-directions.md)

Optional editorial material outside the spine (`content/discovery/<level>/<id>.mdx`): **no mastery,
no review debt, no completion bar**, and opening one obligates the learner to nothing. Only
`status: reviewed` ships. Every piece must pass the editorial test in that doc, which also holds the
provenance contract for `images[]`, `links[]` and `content/documents/` — real and adapted assets
are someone else's work and require `attribution` and `license`, validator-enforced. **Viewing a
document is never learning evidence.**

### Claims written into this repo

Every rule above makes a *published* figure earned rather than asserted — the Wortliste `~`, the Über page, the coverage manifests. **The same bar applies to prose**, and it is the bar this repo keeps failing: the 2026-07-20 session wrote four claims into docs and comments that were simply wrong, none of which any check could have caught — `41 of 83` A2 outcomes are spoken (it is 32), "the scorer change is safe to land at any time" (it moves the gate the cohort reads), "wait for the cohort read" before the A2 probe pass (16 of 19 topics were free all along), and `key_tokens: []` is "strictly better" (it costs 52 false attributions and buys back 5).

- **A number in prose carries the command that produces it.** One paste re-derives it, and writing it forces the author to have run it. Where no command exists, say how it was counted.
- **A fixture proves the mechanism; only the corpus gives the magnitude.** Both `key_tokens` reversals came from a four-token invented sentence with two error modes; the real attempt log said the opposite, twice. Never let an example you wrote decide a trade-off.
- **An unmeasured deferral is a claim too.** It reads as caution and costs real work. `essen-trinken` was measured before freezing (2.34 d shift — genuinely blocked); the whole A2 probe pass was deferred on a guess, and 16 of its 19 topics turned out to shift by zero.
- **A conclusion you just reversed is more suspect, not less.** Measure it again before writing it down — the second `key_tokens` answer was also wrong, and only a third pass (counting *errors* rather than *changes*) got it right.
- **A new rule is not verified until you have watched it fail.** Break it deliberately, once per rule: two of the seven placement rules turned out to be unreachable behind a schema error the first time they were tried.
- **An estimate you gave is a claim you owe a correction on.** The restructure that produced this file was estimated at −14% and delivered −4.4% on its first pass; the miss was reported rather than quietly absorbed.

One mechanical hazard in the same family — silently wrong, and no gate catches it: **never write a literal NUL byte into source.** It is valid TypeScript, so tests, `astro check`, ESLint and the build all pass, but `file` reports the source as `data` and grep, ripgrep and editor search then **skip the file without saying so**. Two files sat that way. Use the escape in a template literal instead; `tests/source-hygiene.test.ts` fails on any tracked file containing one.

### Shipping a topic → [`docs/authoring-checklists.md`](docs/authoring-checklists.md)

A topic is not done until all nine are:

1. `content/topics/<level>/<id>.mdx` — full frontmatter + article following the skeleton.
2. Exercise set(s) — 8–15 items, ≥3 types, each with `explain`, clearing the item-mix bar; every `translate` declares `key_tokens`; include the modes the outcomes claim.
3. Pretest — 3 items at `<id>-pretest.yaml`, referenced via `pretest`.
4. Probe family — `probe-<id>.yaml`, 3 **parallel variants**: different tasks, **one competence**, same `focus` and `outcomes`, none answerable from memory of a practice item. **A second family re-arms the topic** — measure `armedAt` before and after, or you silently re-label probes already taken.
5. Reading — `kind: intensive`, ~90–130 words, 6–10 glosses, 3 questions.
6. Vocab file if the topic introduces a word field; fill `ipa` with `bun run gen:ipa`, then review it.
7. Atlas node + unit slot, with 2–4 `outcomes`. **Every outcome must be measured by a `practice`/`drill` item or a reading question** — pretests, checkpoints and probes deliberately do not count, because an outcome only ever tested was never practised.
8. New `focus` tags registered in [`docs/focus-tags.md`](docs/focus-tags.md) **and** in `focusIntroducedBy`.
9. `bun run validate` passes.

### Lesson cycle (required)

Each topic implements **pretest → model → explanation → scaffold → fade → transfer → delayed check**: the pretest is diagnostic generation, not practice; the article and readings give a comprehensible model with maximal support; topic-owned practice begins blocked and explanatory; mixed training removes hints and interleaves only after the article was opened; at least one fresh-context production task checks transfer; checkpoints and probes use separate roles and never leak into ordinary training.

### Drills from progress (the personalization loop)

1. `bun run progress:audit --profile <slug>` — **never Read the raw snapshot.**
2. **Triage the grading queue first.** Rulings live in `data/grading-decisions.yaml` and must be committed, or the same rendering returns for review forever. An `accept` or `constrain` is paid for in the same change (an `accept` must pass today's grader; a `constrain` adds the bilingual `instruction`), both with a `revision` bump. **Never author a drill from a pre-triage weak-focus table** — rule the queue, rerun the audit, then read the table.
3. Diagnose via the weak **focus tags**, not individual failed items. Write a drill set targeting that confusion, tag every item with it, and attach the set to the relevant topic's `exercises`.

Full procedure, including what each `decision` means and how attribution is recomputed: [`docs/authoring-checklists.md`](docs/authoring-checklists.md) and the `progress-review` skill.
