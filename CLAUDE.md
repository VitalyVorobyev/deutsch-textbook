# Deutsch-Atlas

An AI-assisted, human-directed and edited German learning system by Vitaly Vorobyev:
wiki-like textbook + interactive exercises + FSRS flashcards. A1, A2 and B1 are authored and their
denominators closed: Wortliste 673/673 · 1449/1449 · 3416/3416, internal grammar 28/28 · 46/46 ·
32/32, DTZ structures 93/93 · 300/300 · 164/164, Themen 70/70 and Sprachhandlungen 38/41 (the
three left — interkulturelle Begegnung, Wissensdivergenz, Gefühle ausdrücken — want a topic of
their own). The learner (Vitaly) aims at B2. Explanations are bilingual **EN + RU**, with an
optional **UK** half and, from B1 onward, an optional German-medium half. The repo is both the
knowledge base (`content/`) and the Astro site that renders it.

**This file is the index and the rule digest.** Every enforced rule has its imperative here, in one
line; the reasoning lives in the companion doc named below. **A one-line rule you do not understand
is a rule to go read**, not a rule to guess at. The full doc map is [`docs/README.md`](docs/README.md).

## Before you do X, read Y

| If you are… | Read first |
| --- | --- |
| writing or revising a **topic article** (`## Erklärung` structure, paragraph size, `Kurz gesagt`, the native-language prose-review loop) | [`docs/authoring/article-prose.md`](docs/authoring/article-prose.md) |
| authoring or editing an **exercise item** (any type, `key_tokens`, item mix, placement sets, vocab entries) | [`docs/authoring/item-authoring.md`](docs/authoring/item-authoring.md) |
| choosing or adding a **`focus` tag** | [`docs/authoring/focus-tags.md`](docs/authoring/focus-tags.md) |
| changing anything in **`src/lib/`** | [`docs/architecture/runtime-contracts.md`](docs/architecture/runtime-contracts.md) |
| adding to **`packages/`** or **`apps/redaktion`**, or asking the corpus a new question | [`docs/architecture/content-graph.md`](docs/architecture/content-graph.md) |
| using **Redaktion** or **Tonwerk** | [`docs/apps/redaktion.md`](docs/apps/redaktion.md) · [`docs/apps/tonwerk.md`](docs/apps/tonwerk.md) |
| touching **`worker/`**, `src/lib/sync-remote.ts` or `scripts/progress-pull.ts` (accounts, approval, snapshot sync) | [`docs/architecture/cloud-sync.md`](docs/architecture/cloud-sync.md) |
| reading or writing an **ADR**, or making an **architecture decision** | [`docs/adrs/README.md`](docs/adrs/README.md) |
| shipping a **new topic**, or writing a **drill from learner progress** | [`docs/authoring/authoring-checklists.md`](docs/authoring/authoring-checklists.md) |
| running a **topic-quality pass**, or checking a unit against the **unit gate** | [`docs/authoring/content-quality-audit.md`](docs/authoring/content-quality-audit.md) |
| drafting or reviewing **B1.4+**, or adding a generated/simulated asset | [`.agents/skills/authorship-provenance/SKILL.md`](.agents/skills/authorship-provenance/SKILL.md) · [`docs/authoring/product-protection.md`](docs/authoring/product-protection.md) |
| touching a **coverage figure** (Wortliste `~`, grammar inventory, `/about`) | [`docs/authoring/coverage-instruments.md`](docs/authoring/coverage-instruments.md) |
| hand-editing a vocab **`ipa`** | [`docs/authoring/lautschrift.md`](docs/authoring/lautschrift.md) |
| authoring **Entdecken** material or adding a **document** | [`docs/authoring/future-content-directions.md`](docs/authoring/future-content-directions.md) |
| deciding **what a unit owns** and what it may not touch, with which frozen identities | [`docs/curriculum/a2-b1.md`](docs/curriculum/a2-b1.md) |
| adding a **grammar-inventory row**, a `claims:` citation or an external **Strukturenliste** | [`data/strukturenlisten/README.md`](data/strukturenlisten/README.md) · [ADR 0011](docs/adrs/0011-external-grammar-anchors.md) |
| writing or changing **any document** — developer or user-facing | [`docs/README.md`](docs/README.md) |
| looking for the **system map** or **the queue** | [`docs/design.md`](docs/design.md) · [`docs/backlog.md`](docs/backlog.md) |

## Commands

**Bun** is the package manager and task runner (`bun install`, `bun run <script>`).

- `bun run dev` — dev server
- `bun run validate` — content validation (**run after every content change; it must pass before you are done**)
- `bun test` — domain regression tests
- `bun run check` — TypeScript 7 `tsc` over the root and Worker projects, then `.astro` diagnostics on TypeScript 6 (`tools/astro-check`, until `@astrojs/check` supports 7)
- `bun run lint` — Oxlint (`.oxlintrc.json`), with `--deny-warnings`: a warning fails it too
- `bun run fmt` / `bun run fmt:check` — Oxfmt (`.oxfmtrc.json`) over code and JSON only; `content/`, `data/`, MDX, Astro, Markdown and YAML stay hand-formatted, and the generated `packages/schema/schemas/` is byte-compared by the engine's tests
- `bun run build` — production build (also type-checks content against schemas)
- `bun run review:gate` — read-only merge gate: non-draft PR, green CI, no unresolved actionable threads, no outstanding change request. **It waits for no reviewer** — merge when it passes; a later review is answered in its threads.
- `bun run progress:audit --profile <slug>` — aggregate the newest learner snapshot. **Never Read a raw snapshot** (300 KB+). `--pull` fetches first and audits nothing if the fetch fails, because a stale snapshot does not look stale. `--item <set-id>:<item-id>` for one item's evidence. `--project <YYYY-MM-DD>` asks whether a gate *can* be read by that date — ask it **before** the date.
- `bun run progress:pull --profile <slug>` — fetch the cloud snapshot into `progress/<profile>/<date>.json`; needs `source setenv.sh` (R2 over S3). `--list`, `--account <id>`, `--date`. **It refuses to shrink an existing file** and parks the smaller state in `*.conflict-*.json` — investigate, never delete. → [`docs/architecture/cloud-sync.md`](docs/architecture/cloud-sync.md)
- `bun run deploy:smoke` — seven checks against the live origin. **Run it after every deploy that touches `worker/` or `wrangler.toml`**: a config without `main` strips the Worker's secrets and every gate here stays green. `--deep` also proves D1 and is the only check that writes. → [`docs/architecture/cloud-sync.md`](docs/architecture/cloud-sync.md#when-sign-in-stops-working)
- `bun run gen:ipa` — fill missing `ipa` via espeak-ng (`brew install espeak-ng`). **Always review the output** — it gets compound and separable-verb stress, loanwords and unstressed vowels wrong. `--calibrate`, `--check` (dry run), `--force` (discards manual fixes).
- `bun scripts/coverage.ts <A1|A2|B1>` — Goethe Wortliste coverage; **keep all three at 100%**. A new word belongs to exactly one deck and the manifest gains a line in the same change. A leading `~` (taught as grammar, no flashcard) **must be earned** by the taught surface. Run `--check-deck <file.yaml>` per deck before `bun run validate` on a completion pass. → [`docs/authoring/coverage-instruments.md`](docs/authoring/coverage-instruments.md)
- `bun run exam:ingest` — turn the **local-only** Goethe exam materials (`docs/GeotheInstitute/`, gitignored) into `public/exams/` (also gitignored); nothing it reads or writes may enter the repo. A module's `cues:` are proposed by `bun scripts/exam-cues-scan.ts <setId>/<module>` and **verified by ear before pasting**. → [ADR 0009](docs/adrs/0009-official-exam-materials-local-only.md) · [`docs/architecture/exam-trainer.md`](docs/architecture/exam-trainer.md)
- `bun run lid:import` — the official **Leben in Deutschland** bank (Bayern, 300 + 10) into `data/lid/bank.yaml` + `public/lid/`, **committed** (Anlage 1 of the EinbTestV, §5 UrhG) except five credited press photos, which stay `withheld`. **Never hand-edit the bank**; a re-import that changes a correct answer stops until accepted. `--check --crosscheck --pdf <file>` re-derives the answer-key evidence. LiD progress has its own store key and snapshot v8 — never `cards`/`attempts`. → [ADR 0021](docs/adrs/0021-leben-in-deutschland-trainer.md)
- `bun scripts/lang-cost.ts <file…>` — words per explanation half, and what four halves cost against two; the counting method is in the script.
- `bun scripts/grammar-coverage.ts <A1|A2|B1>` — structural coverage against `data/grammar-inventory.yaml`: A1 28/28, A2 46/46, B1 32/32. A point counts as taught only when a `practice`/`drill` item carries the focus tag naming its confusion — not a checkpoint, pretest, probe or `preview: true` item. **Closing a gap means lowering the number in `tests/grammar-coverage.test.ts` in the same commit.**
- `bun scripts/structures.ts <A1|A2|B1> [--unclaimed-only] [--beyond]` — does the inventory contain every structure the published standard lists? Each entry of `data/strukturenlisten/` is `claimed`, **`unclaimed`** (a hole) or **`beyond`** (a row citing no source — legitimate, but visible). **Read the `[audience]` line before the percentage**: the free A2 list is *Fit in Deutsch 2*, a teenagers' exam; the adult production standard for A2 and B1 is the cumulative DTZ Prüfungshandbuch. Say `100% des DTZ-Inventars`, never "all conceivable B1 grammar". → [`data/strukturenlisten/README.md`](data/strukturenlisten/README.md)
- `bun scripts/handlungen.ts <A1|A2|B1> [--unclaimed-only] [--beyond]` — the same question of the can-dos: do the 221 `outcomes` contain every communicative function the standard expects? (119 cite one.) `beyond` is expected here and is not a gap. → [`data/handlungslisten/README.md`](data/handlungslisten/README.md)
- `bun scripts/themen.ts <A1|A2|B1> [--unclaimed-only] [--beyond]` — is the course *about* what an adult in Germany needs to talk about? The claimant is a topic manifest. Read a hole as **topic-level**, never lexical. **The assignments are editorial**: an under-claim manufactures a hole exactly as an over-claim manufactures coverage. → [`data/themenlisten/README.md`](data/themenlisten/README.md)
- `bun scripts/anchor-check.ts [<source-id>] [--unaccounted]` — holds a transcribed anchor against its PDF: a `de:` label with a word the page lacks is a fabrication, one shaped like a sentence a leaked example. **Run it whenever a `data/*listen/*.yaml` changes** — no other gate sees either. The PDFs are local-only, so an absent source **skips**. → [`data/strukturenlisten/README.md`](data/strukturenlisten/README.md)
- `bun scripts/comprehensibility.ts <level>/<topic-id>` — input load: how much of a topic's German the learner has not met yet, per section, with the words listed. `--rank [A1|A2|B1]` ranks a level. **Read-only, no threshold**: read every row against the level median it prints; outliers are the product, and nothing here is an absolute claim about a learner. → [`docs/authoring/coverage-instruments.md`](docs/authoring/coverage-instruments.md)
- `bun scripts/grammar-depth.ts [<level>] [--thin] [--by-point] [--no-probe]` — **how much practice stands behind each confusion**: teaching items, production, distinct practice files, probe items. **No threshold**; read against the level median. Median items per confusion **A1 13 · A2 9 · B1 6**, production 9 · 6 · 5; `tests/grammar-depth.test.ts` ratchets them so they may only improve. **Breadth and depth are two numbers and neither substitutes for the other** — choose a new topic's focus tags from `--thin`.
- `bun run redaktion` — **Redaktion**, the editorial workbench (`apps/redaktion`, :4330); every figure comes from `@da/content`, never recomputed in a view. Saves are explicit, revision-checked and atomic, and only for existing text sources under `content/` and `data/`; `reviewed` goes through the allowlisted splice and the full rollback gate. `bun run redaktion:desktop` launches the Tauri app, whose webview gets one narrow stdio RPC and the folder picker — never general filesystem or shell access. → [`docs/apps/redaktion.md`](docs/apps/redaktion.md) · [ADR 0013](docs/adrs/0013-redaction-repository-workbench.md)
- `bun run redaktion:audit` — Redaktion's layout measured in a real browser (boots its own dev server; `bunx playwright install chromium` once): every route resolves, permalinks survive reload, no request leaves the origin, row raggedness ≤ 2× the median. Not in `bun test`. **A shared package can be invisible to Tailwind** — `tests/design-tokens.test.ts` fails if a `@da/ui` `.tsx` falls outside the `@source` globs.
- `bun run tonwerk` — **Tonwerk**, the audio studio (`apps/tonwerk`, :4340). It opens no files; everything comes from the local Python engine (`127.0.0.1:8765`) over a per-run bearer token. **QA is automatic, approval is not**, and publishing is the engine's (`scene publish-approved --yes`), never a button. → [`docs/apps/tonwerk.md`](docs/apps/tonwerk.md) · [`tools/listening-studio/README.md`](tools/listening-studio/README.md)
- `bun tauri dev` / `bun tauri build` — desktop app (Tauri v2 shell in `src-tauri/`; needs Rust). Release: push a plain `vX.Y.Z` tag and `.github/workflows/release.yml` builds Windows, Linux and macOS installers. **One release per batch, never per PR**: a PR writes its CHANGELOG lines under `## [Unreleased]`, bumps no version and pushes no tag; the release PR folds them into one heading, bumps `package.json`, `tauri.conf.json` and `Cargo.toml`, and is tagged when the owner calls it. Keep the site base-path-agnostic, and call Tauri JS APIs only behind `isTauri()` (`src/lib/syncdir.ts`).

## Where content lives

| Path | What it is |
| --- | --- |
| `content/topics/<level>/<id>.topic.yaml` | **the topic**: identity, outcomes and the `elements:` list of every part it owns; level dir must match `level` |
| `content/topics/<level>/<id>.mdx` | its article — **prose only, no frontmatter** ([ADR 0012](docs/adrs/0012-topic-manifests.md)) |
| `content/vocab/<id>.yaml` | vocabulary; **every entry becomes two flashcards** (DE→EN/RU and EN/RU→DE) |
| `content/exercises/<level>/<set-id>.yaml` | exercise sets, embedded on the owning topic's page |
| `content/reading/<level>/<id>.yaml` | graded reading; `kind: intensive` and `kind: extensive` are **different artifacts for different purposes** |
| `content/documents/` | reusable visual stimuli; **viewing is never evidence**; real/adapted assets require `attribution` + `license` |
| `content/wortfelder/`, `content/wortnetze/` | lexical overlays and word families; **enrich only the answer side** — receptive members create no cards and no mastery |
| `content/discovery/`, `content/reference-data/` | optional Entdecken material; canonical lookup data |
| `content/atlas.yaml` | the `groups:` taxonomy **and the curriculum spine** (`units:`) |
| `data/lid/bank.yaml`, `content/lid/` | the official LiD questions (generated, verbatim) and the course's notes: `topics.yaml`, and `notes/<topic>.yaml`, whose file **is** each question's topic; `lessons/<id>.mdx` are reading lessons over 1+ topics (a topic in **at most one** lesson) — German throughout, `## Kurz gesagt` first, and **every section with German text closes with one `<Translation>`** (EN/RU/UK, translated from the German, nothing added; hidden under `de`), collapsed except the summary's `<Translation open>`. A lesson's maps and pictures are its `figures:`, shown by `<Figure id>` outside any `<Translation>` — a bank picture (`official`, never `withheld`) or a credited file under `public/lid/lessons/`, ≤ 300 KB → [`docs/authoring/future-content-directions.md`](docs/authoring/future-content-directions.md#leben-in-deutschland-lesson-figures). Notes and lessons carry the UK half like every other file |
| `progress/<profile>/*.json` | learner snapshots, one folder per local profile |
| `packages/schema/src/index.ts` | Zod schemas — the single source of truth for all content shapes |

**Where the code lives.** A Bun workspace. `content/` and `data/` stay at the root because they
belong to no single app, and the learner app is the **root package** — Astro requires its content
collections under the project root (the reason is recorded beside `workspaces` in `package.json`).
Four packages, divided by what may be imported where:

| Package | What it is | May it touch `node:fs`? |
| --- | --- | --- |
| `@da/schema` | content shapes (Zod), gloss markup, letter-set checks, item-type classification | **no** — imported by React islands |
| `@da/grading` | does this answer count: `cloze`, `production`, `worddiff` | **no** |
| `@da/content` | reads the corpus: the graph, elements, all measurements, the payload | yes |
| `@da/ui` | Tailwind tokens + shared React primitives | **no** |

`@da/content` exports **per module, never a barrel** — `@da/content/focus-tags` must cost a browser
importer nothing. A pure value in an fs-opening module leaks the filesystem into the client bundle
and Vite externalises it silently; that is why `PRODUCTION_TYPES` lives in `@da/schema`.

**`contentGraph()` (`packages/content/src/graph.ts`) is the one pass over the corpus.** It is
memoised per root and **degrades a malformed file to a `note` rather than throwing**, because it is
the model an editor reads *while* authoring. Every artifact becomes an **`Element`** with its lesson
`stage`, pedagogical `activity`, derived delivery `medium` and the `touches` it delivers ([ADR
0014](docs/adrs/0014-learning-activity-architecture.md)): purpose (`core`, `extension`,
`application`, `remediation`) is never confused with media or with a file count.
`packages/content/src/profile.ts` turns that into per-topic checks and a ranked problem list,
**with no composite score**.

**The spine and the manifests carry five rules**, each silent when broken: `units:` file order
**is** the recommended path (insert, never renumber); every topic lives in exactly one unit of its
own level, never before a prerequisite; a `deepens:` edge **must share a focus tag the base topic
drills** — the tag is the edge's only runtime channel; every manifest declares 2–5 learner-facing
`outcomes`; and **`elements:` is closed** — a set or reading naming a topic that does not list it
is an error. **`primary_practice`** decides what completing a Lernpfad step means, and **`probes`**
is the delayed check; `elements.exercises` is **one ordered list on purpose**, the scaffold→fade arc
written down.

## Runtime invariants

Load-bearing, and each one silent when broken. Mechanism: [`docs/architecture/runtime-contracts.md`](docs/architecture/runtime-contracts.md).

- **`planReview()` (`src/lib/decks.ts`) is the ONE rule for what a review queue contains.** New cards are rationed **per day, not per queue** (`DAILY_NEW_CARDS = 15`), because `planReview` re-runs on every mount. Fresh-card ties break at random, never by card id.
- **A page header never repeats the navigation.** An H1 the active tab, nav link or breadcrumb already says is `sr-only`; a page's "what this is for" line is its nav link's `title` (`src/lib/nav-hints.ts`), never a standing paragraph. Content titles stay. → [`docs/design.md`](docs/design.md#page-chrome)
- **A missed card is retried later, not next.** "Again" shows the answer at once and re-queues the card after 8 cards (not retrieved at all) or 50 (a lapse or near miss), halved per further miss, floor 3 — `recordMiss` in `src/lib/requeue.ts`. The counts are heuristics; the delay is the finding. FSRS alone schedules across sessions. A missed LiD question follows the same rule.
- **A page never inlines the corpus.** The session pages pass `corpusUrl('cards' | 'sets')` and fetch content-hashed `data/*.json` files ([ADR 0022](docs/adrs/0022-session-content-as-shared-data-files.md)); an island never mounts on a file that has not arrived. `bun scripts/page-weight.ts` fails CI on any page over 1.5 MB.
- **Never mount a React island per table row.** In `.astro` templates use `src/components/SpeakButton.astro` — one hoisted, delegated listener for the whole page.
- **Probe state is derived from the attempt log, never stored.** A due probe opens the session as step 0, *before* review and training. `MAX_PROBES_PER_SESSION = 5`.
- **Checkpoints and placements are data, not wiring** — discovered by role, level read off the directory; one of each per level.
- **A passed placement is a third evidence class**: green, real, and it **never raises the measured tier**. No placement branch in `topicTier`/`effectiveTier`; never fold placed topics into a mastery counter; no fifth chip in `EvidenceChips`. Nothing is written until the learner presses *Ergebnis übernehmen*.
- **Navigation asks a different question than the badge.** `pathDone` is mastered *or* primary practice completed *or* self-rated `learned`. **Never derive a badge from `pathDone`** — a self-rating is not evidence — and never gate the path on item-level completion alone.
- **Unverified practice never raises measured mastery.** `write` and `speak` are attempt → model answer → done; their `requirements`/`checklist` render as guidance, **never as gated forms**.
- **There is no default profile and no name is ever assumed.** Nothing may create a database before discovery has run. The last remaining profile cannot be deleted. An OAuth display name may only *prefill* the first-run field.
- **The sync server stores opaque bytes and never merges.** `/api/sync/snapshot` (`worker/`) does not parse, validate or migrate a snapshot; merging is `mergeSnapshot` on the client. **An unconditional PUT does not exist** (no `If-Match`/`If-None-Match` → 428; a lost race → 412 → pull, merge, retry), and **signing in grants nothing** — a new account is `pending` until the owner approves it on `/konto`. A **device token grants sync only**, never admin, and **cannot approve a device pairing**. Pairing (`/api/pair/*`, RFC 8628's shape) is granted by a cookie session on an approved account, and the learner **types** the code rather than following a link. → [ADR 0003](docs/adrs/0003-opaque-snapshot-sync-and-approval-accounts.md) · [`docs/architecture/cloud-sync.md`](docs/architecture/cloud-sync.md)
- **Every figure on `/about` is computed from content at build time.** Never hand-write a count there, and never claim a level is more finished than it is.
- Legacy or mismatched-revision attempts keep their logged result and are **never replayed** against a current key. Snapshot migrations v1–v8 are explicit (`src/lib/snapshot-schema.ts`).
- **No input is sized, capped or captioned from the answer it is waiting for.** Every cloze gap rests at one width and grows with what the **learner** typed (`gapWidthCh`, `Cloze.tsx`); `maxLength`, `placeholder` and `size` are the same hazard — a box sized to the answer scores a width judgement as grammar. No gate can see this class.
- **A progress write is journaled before it is attempted, and loud when late; a stalled or implausibly empty read renders an error, never a fresh-profile view, and never feeds `planReview`.** Every write behind the journal or `withPersistenceRetry` must be idempotent — the managed store re-runs an aborted operation up to three times, and launch replay re-applies whatever outlived its commit. No snapshot writer ever shrinks an existing file. **A write that commits after its caller's 45 s deadline still confirms itself**: the journal drain keeps owning the op and removes its entry when the commit lands. → [ADR 0016](docs/adrs/0016-durable-progress-writes.md), [0019](docs/adrs/0019-writes-single-flight-and-confirm-late.md), [0020](docs/adrs/0020-owned-storage-recovery.md)
- **One readwrite transaction on `progress` at a time; a burst of writes is ONE commit, not N; a stalled transaction is aborted, never abandoned.** `enqueueUpdate` coalesces, and the runner awaits every batch to its end. `src/lib/managed-store.ts` owns connection and transaction: a 10 s watchdog calls `abort()`, a retry waits for the abort to be *observed*, and an open that misses its 2 s deadline is retired and closed if it lands. An unacknowledged abort or a third failure blocks the store until restart (`StorageRestartRequiredError`; nothing auto-reloads). Grades, attempts and session completion share **one ordered journal drain per profile**; a caller's clock starts when it submits. Only a `TypeError`/`RangeError` is quarantined to `da:journal-poison:<profileId>`, after its evidence is saved; storage errors stay pending, overflow never discards an entry, and a refused localStorage write keeps a volatile copy and says so. → [ADR 0020](docs/adrs/0020-owned-storage-recovery.md)
- **Reads get the same timed retries writes do, and every load surface distinguishes still-reading from read-failed from confirmed-empty.** All through `withReadRetry(op, { surface })` (0/2/5 s, `StoreStallError` at 10 s, stalls logged to `da:stall-log:<profileId>` as counters); a read that *rejects* is not retried. A progress surface renders `ProgressLoadError` with a retry; a badge renders an explicit unknown — **never a confident `0`**. **Nothing may sit between `getStore()` and its handle** (the card-id migration has one owner, `PersistenceAlert`, behind `da:cardid-migrated:<id>`), and **a repair that rewrites a whole blob commits in one `update()`**. → [ADR 0018](docs/adrs/0018-progress-reads-recover.md)
- `localStorage` keys with persisted user choices (e.g. `da:topics-view`) — **migrate old values** rather than stranding a learner on a state that no longer exists.

## Authoring rules (content quality is the product)

### Language discipline
- German orthography must be perfect: ä/ö/ü/ß always (never ae/oe/ue/ss), nouns capitalized.
- Russian and English explanation text must be complete and idiomatic — never machine-translation-ese, never transliteration.
- **A half that mirrors a sibling half's rhetoric sentence-for-sentence is a calque, and no gate can see it.** Diagnose with the `textbook-text-reviewer` skill, repair with `textbook-text-editor`. → [`docs/authoring/article-prose.md`](docs/authoring/article-prose.md)
- **CEFR discipline**: in a topic at level X, German examples and exercise items use only grammar and vocabulary at or below X. An A2 article must be fully readable by an A2 learner.
- Every German example sentence gets EN and RU translations.

### Bilingual voice
- Explanations are wrapped in `<Bilingual><En>…</En><Ru>…</Ru></Bilingual>` (injected; no imports in MDX). Optional `<Uk>` — an independently authored half written from the German, never translated from a sibling, per-file all-or-none, validator-enforced — and `<De>`, the German-medium half, authored from B1 onward and never backfilled. A missing half falls back to EN.
- **B1 articles are German-first** ([ADR 0023](docs/adrs/0023-b1-articles-german-first.md)): the German is the body, and every section with German prose closes with `<Translation>` (translated from the German, nothing added; `<En>` required, `<Ru>`/`<Uk>` all-or-none per file; `open` on `## Kurz gesagt` only) then `<Erklaerung>` (the authored `<En>`/`<Ru>`/`<Uk>` halves, kept whole). No `<Bilingual>`, no `<De>` — `germanFirstTopicProblems`, validator-enforced once a file uses `<Translation>`.
- EN and RU halves are each a complete, self-sufficient explanation — write both from scratch. They **may diverge** where it helps their reader: RU may contrast with Russian («быть», падежи), EN with English ("must not" ≠ *muss nicht*) or German-internal hooks. Never assume an EN reader knows Russian or vice versa.
- **No Cyrillic and no references to Russian inside `<En>` or any `en`/`*_en` field.** No Cyrillic in `de`/`*_de`, no і/ї/є/ґ in `ru`, no ы/э/ъ/ё in `uk`. Enforced by `bun run validate`.
- **The EN surface never assumes RU or UK** — rendering code too: under `en`, a learner sees English and German only. Never hardcode `en · ru`; a card's second meaning goes through `pickSecond` (`src/lib/prefs.ts`). RU and UK modes stay dual with EN. The one language selector is **Lernsprache** in the ProfileSwitcher dropdown (per-profile `ExplainLang`); the chrome is pinned German (`resolveUiLang`).
- German content (examples, tables, headings like "Beispiele") stays outside Bilingual blocks — always visible.
- Grammar terminology: German terms with a per-language gloss on first use — "der Kasus (case)" in En, "der Kasus (падеж)" in Ru.

### Topic article skeleton → [`docs/authoring/article-prose.md`](docs/authoring/article-prose.md)
H2 headings, in German, in this order:
1. `## Kurz gesagt` — an advance organizer: the schema the article fills in, ≤ ~100 words and ≤ 5 sentences per half, not a summary of details.
2. `## Erklärung` — the full explanation (bilingual prose, German tables).
3. `## Beispiele` — 5–10 German sentences as blockquotes, each followed by its EN/RU translation in a Bilingual block.
4. `## Häufige Fehler` — ❌/✅ pairs. The Ru half highlights Russian interference; the En half gets its own framing — English false friends where they exist, otherwise neutral rule statements.
- No Übungen/Wortschatz sections — the page template renders them from the manifest.
- **`## Erklärung` splits into `### German subsections`, one per named confusion**, plus the integrating section. The heading sits **outside** `<Bilingual>` so it stays visible in every language.
- **Each subsection keeps its table beside its prose.**
- **No paragraph over 120 words in any explanation half** (validator-enforced); target ≤ 90, one claim per paragraph. The cap is a tripwire, **never a target**. Command: `bun scripts/prose-shape.ts content/topics/<level>`.
- **A fact stated in `## Erklärung` is drilled by an item or serves an outcome**; otherwise it goes in a compact `### Feinheiten` table. A list over three members is a table or a bullet list, and prose never restates the table beside it.

### Exercise items → [`docs/authoring/item-authoring.md`](docs/authoring/item-authoring.md)

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

### Focus tags → [`docs/authoring/focus-tags.md`](docs/authoring/focus-tags.md)

The table there is an **allowlist**: `bun run validate` rejects a tag not registered in
`focusIntroducedBy` (`packages/content/src/focus-tags.ts`), and `tests/focus-tags.test.ts` holds the
two equal. Reuse an existing tag whenever possible; a new one is for a genuinely new confusion and
joins both places in the same change. Leave mixed or pure-comprehension items untagged — **a false
tag is worse than no tag**. **A `translate` probe whose tag names an *added* word** (*zu* after a
modal or *lassen*, an article before a name) **declares `focus_evidence.failed` predicates** —
`key_tokens` cannot see an insertion, so the probe would read it as retained (validator-enforced;
[`focus-tags.md`](docs/authoring/focus-tags.md#errors-that-add-a-word)).

### Vocab entries → [`docs/authoring/item-authoring.md`](docs/authoring/item-authoring.md#vocab-entries)

- Nouns need `gender` + `plural` (with article); verbs need `partizip2`, `aux`, `praesens_3sg`, and `valence` when governed. Every entry except sentence-length `phrase`s needs a reviewed `ipa`.
- **`accept` exists because `de` is three things at once** — the Wortliste key, the answer shown and the answer typed. Reflexive verbs, adjectival nouns and taught spelling variants need it. A reflexive verb's form fields carry `sich` too (validator-enforced).
- **A gloss is a concise idiomatic translation (1–4 words) — the retrieval cue, never a definition.** A disambiguating parenthetical only where two shipped cards would share a production prompt; teaching goes in `note`. Measured by `bun scripts/gloss-shape.ts`, ratcheted by `tests/gloss-shape.test.ts`.
- **A gloss is the question side of the production card, so it must never contain the answer.** Reflexivity, a governing frame or a fixed chunk goes in `note`. The headword may appear in a gloss only as the translation itself (validator-enforced). Every character of a typed answer must be on the insert bar (`GERMAN_INPUT_KEYS`, `src/lib/typing.ts`), also enforced.
- **A dual-language card explains a distinction once.** Keep `en` complete for EN-only mode; when EN and RU/UK both carry extended commentary, add a shorter `en_compact` for the dual view.
- **`cards: recognition` makes one card instead of two**, for language the learner must understand but will never produce. It is defaulted (`both`) and **never retrofitted**: the direction is in the card id, so flipping a shipped entry deletes its production history.
- **Card identity is `<vocab-file-id>::<de>::<direction>`.** Renaming a headword or file id resets the learner's SRS history — only when the entry was wrong.
- **A2 vocabulary recycles, never adopts**, and **Wortliste completion decks stay unowned** — listing one in a topic's `vocab:` buries its words behind that topic.

### Entdecken & Dokumente → [`docs/authoring/future-content-directions.md`](docs/authoring/future-content-directions.md)

Optional editorial material outside the spine (`content/discovery/<level>/<id>.mdx`): **no mastery,
no review debt, no completion bar**. Only `status: reviewed` ships. Every piece passes the editorial
test in that doc, which also holds the provenance contract for `images[]`, `links[]` and
`content/documents/` — real and adapted assets require `attribution` and `license`,
validator-enforced. **Viewing a document is never learning evidence.**

### Claims written into this repo

Every published figure here is earned rather than asserted, and **the same bar applies to prose**,
where no check can help:

- **A number in prose carries the command that produces it.** Where no command exists, say how it was counted.
- **A fixture proves the mechanism; only the corpus gives the magnitude.** Never let an example you wrote decide a trade-off.
- **An unmeasured deferral is a claim too.** Measure before deferring.
- **A conclusion you just reversed is more suspect, not less.** Measure it again before writing it down.
- **A new rule is not verified until you have watched it fail.** Break it deliberately, once per rule.
- **An estimate you gave is a claim you owe a correction on.** Report the miss.
- **A pasted or generated source document is an outline, never an inventory.** Check it against `data/grammar-inventory.yaml`, the Goethe Wortliste and a reference grammar before authoring from it — its gaps are the first thing to look for.

**Never write a literal NUL byte into source.** It is valid TypeScript, so every gate passes, but
`file` then reports the source as `data` and grep, ripgrep and editor search skip it silently. Use
the escape in a template literal; `tests/source-hygiene.test.ts` fails on any tracked file containing
one.

### Documents → [`docs/README.md`](docs/README.md)

- **A developer doc states the current contract, the current queue or how to do a job — never history.** Delete a finished backlog entry, a closed-finding ledger or a dated pass log; `git log` is the archive. ADRs are the exception and are superseded, never edited.
- **User documents (README, CHANGELOG, NOTICE, `docs/apps/`, `/about`, `/install`) and developer documents never restate each other.** Link across; copy nothing. A CHANGELOG entry says what a learner sees; a tooling-only release gets one plain line.

### Shipping a topic → [`docs/authoring/authoring-checklists.md`](docs/authoring/authoring-checklists.md)

A topic is not done until all nine are:

1. `content/topics/<level>/<id>.topic.yaml` — the manifest, and `<id>.mdx` beside it: the article following the skeleton, **prose only**.
2. Learning activities — exactly one 8–15-item `activity: core` Grundübung named by `primary_practice`, plus at least one productive `activity: application` in a fresh context; `extension` and `remediation` only for a coherent extra job. Every teaching set declares `stage`, `activity`, `title_de`; every item has `explain`; every `translate` has `key_tokens`. The item-mix bar is per topic. Run `bun run activity:audit`.
3. Pretest — 3 items at `<id>-pretest.yaml`, referenced via `pretest`.
4. Probe family — `probe-<id>.yaml`, listed in `elements.probes`, 3 **parallel variants**: different tasks, **one competence**, same `focus` and `outcomes`, none answerable from memory of a practice item. A further family is ordinary work — each has its own explicit `arming:` list — but **measure `armedAt` before and after**.
5. Reading — `kind: intensive`, 6–10 glosses, 3 questions. ~90–130 words is the authoring target and **no gate enforces it**: length is a cognitive-load judgement, made by the author.
6. Vocab file if the topic introduces a word field; fill `ipa` with `bun run gen:ipa`, then review it.
7. Unit slot in `content/atlas.yaml`, and 2–5 `outcomes` in the manifest. **Every outcome is measured by a `practice`/`drill` item or a reading question** — pretests, checkpoints and probes do not count.
8. New `focus` tags registered in [`docs/authoring/focus-tags.md`](docs/authoring/focus-tags.md) **and** in `focusIntroducedBy`.
9. `bun run validate` passes.

### Review rounds end when a round finds nothing material

- **Material means it changes what the learner sees, does, or is measured on** — a false fact taught, an item that rejects correct German, an outcome with no task in its mode, a mechanism that mis-measures. Everything else is a backlog line, not an edit.
- **Fix the finding, not the neighbourhood.** Grepping a false *claim* to its other instances is in scope; adding the item you wish existed is next round's findings, authored by you.
- **Precedent settles marginal calls.** When shipped units at the same level do not do the thing, it is a backlog item and the PR merges.
- **Push back when a finding is wrong.** Check the claim against the corpus and say no with the reason.
- **A reply is a verdict, a fix and its scope.** Not an essay.

### Lesson cycle (required)

Each topic implements **pretest → model → explanation → scaffold → fade → transfer → delayed check**: the pretest is diagnostic generation, not practice; the article and readings give a comprehensible model with maximal support; topic-owned practice begins blocked and explanatory; mixed training removes hints and interleaves only after the article was opened; at least one fresh-context production task checks transfer; checkpoints and probes use separate roles and never leak into ordinary training.

### Drills from progress (the personalization loop)

1. `bun run progress:audit --profile <slug>` — **never Read the raw snapshot.**
2. **Triage the grading queue first.** Rulings live in `data/grading-decisions.yaml` and must be committed. An `accept` or `constrain` is paid for in the same change (an `accept` must pass today's grader; a `constrain` adds the bilingual `instruction`), both with a `revision` bump. **Never author a drill from a pre-triage weak-focus table.**
3. Diagnose via the weak **focus tags**, not individual failed items. Write a drill set targeting that confusion, tag every item with it, and attach the set to the relevant topic's `exercises`.

Full procedure and decision rules: [`docs/authoring/authoring-checklists.md`](docs/authoring/authoring-checklists.md) and the `progress-review` skill.
