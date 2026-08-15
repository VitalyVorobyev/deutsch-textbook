# Deutsch-Atlas

An AI-assisted, human-directed and edited German learning system by Vitaly Vorobyev:
wiki-like textbook + interactive exercises +
FSRS flashcards. A1, A2 and all fourteen B1 units of the frozen contract
(`docs/curriculum/a2-b1.md`) are authored, and the lexical and structural denominators are closed:
Wortliste 673/673 · 1449/1449 · 3416/3416, internal grammar 28/28 · 46/46 · 32/32, DTZ structures
93/93 · 300/300 · 164/164, and **Themen 70/70** since 2026-08-15. **The one open denominator is
the one a grammar course forgets most** — Sprachhandlungen 28/41, shared by A2 and B1, and nine of
its thirteen holes are the whole of §8.3 Redeorganisation. The learner (Vitaly)
has B2 as a longer-term goal. Explanations
are bilingual **EN + RU**, with an optional **UK** half — independently authored from the
German, shipping in file-scoped waves — and, from B1
onward, an optional German-medium explanation half. The repo is
both the knowledge base (`content/`) and the Astro site that renders it.

**This file is the index and the rule digest.** Every rule the project enforces has its imperative
here, in one line. The *reasoning* — the measurement that produced the rule, the failure that
motivated it, the hazard it guards — lives in a companion doc, because it is only ever needed once
you already know which job you are doing. **A one-line rule you do not understand is a rule to go
read**, not a rule to guess at.

## Before you do X, read Y

| If you are… | Read first |
| --- | --- |
| writing or revising a **topic article** (`## Erklärung` structure, paragraph size, `Kurz gesagt`, the native-language prose-review loop) | [`docs/authoring/article-prose.md`](docs/authoring/article-prose.md) |
| authoring or editing an **exercise item** (any type, `key_tokens`, item mix, placement sets, vocab entries) | [`docs/authoring/item-authoring.md`](docs/authoring/item-authoring.md) |
| choosing or adding a **`focus` tag** | [`docs/authoring/focus-tags.md`](docs/authoring/focus-tags.md) |
| changing anything in **`src/lib/`** | [`docs/architecture/runtime-contracts.md`](docs/architecture/runtime-contracts.md) |
| adding to **`packages/`** or **`apps/redaktion`**, or asking the corpus a new question | [`docs/architecture/content-graph.md`](docs/architecture/content-graph.md) |
| using **Redaction** to inspect or edit the local corpus | [`docs/authoring/redaction-editor-guide.md`](docs/authoring/redaction-editor-guide.md) |
| touching **`worker/`**, `src/lib/sync-remote.ts` or `scripts/progress-pull.ts` (accounts, approval, snapshot sync) | [`docs/architecture/cloud-sync.md`](docs/architecture/cloud-sync.md) |
| reading or writing an **ADR**, or making an **architecture decision** | [`docs/adrs/README.md`](docs/adrs/README.md) |
| shipping a **new topic**, or writing a **drill from learner progress** | [`docs/authoring/authoring-checklists.md`](docs/authoring/authoring-checklists.md) |
| drafting or reviewing **B1.4+**, or adding a generated/simulated asset | [`.agents/skills/authorship-provenance/SKILL.md`](.agents/skills/authorship-provenance/SKILL.md) · [`docs/authoring/product-protection.md`](docs/authoring/product-protection.md) |
| touching a **coverage figure** (Wortliste `~`, grammar inventory, `/about`) | [`docs/authoring/coverage-instruments.md`](docs/authoring/coverage-instruments.md) |
| hand-editing a vocab **`ipa`** | [`docs/authoring/lautschrift.md`](docs/authoring/lautschrift.md) |
| authoring **Entdecken** material or adding a **document** | [`docs/authoring/future-content-directions.md`](docs/authoring/future-content-directions.md) |
| deciding **what A2 teaches**, in what order, with which frozen identities | [`docs/curriculum/a2-b1.md`](docs/curriculum/a2-b1.md) |
| adding a **grammar-inventory row**, a `claims:` citation or an external **Strukturenliste** | [`data/strukturenlisten/README.md`](data/strukturenlisten/README.md) · [ADR 0011](docs/adrs/0011-external-grammar-anchors.md) · [`docs/curriculum/grammar-structure-audit.md`](docs/curriculum/grammar-structure-audit.md) |
| checking a finished unit against the **quality gate** | [`docs/quality/a1-learning-audit.md`](docs/quality/a1-learning-audit.md) |
| looking for the **system map** or **the queue** | [`docs/design.md`](docs/design.md) · [`docs/backlog.md`](docs/backlog.md) |

## Commands

This project uses **Bun** as its package manager and task runner (`bun install`, `bun run <script>`; the validator runs directly on Bun's native TypeScript loader).

- `bun run dev` — dev server
- `bun run validate` — content validation (**run after every content change; it must pass before you are done**)
- `bun test` — domain regression tests
- `bun run check` — Astro/TypeScript diagnostics
- `bun run lint` — ESLint
- `bun run build` — production build (also type-checks content against schemas)
- `bun run review:gate` — read-only merge gate: non-draft PR, green CI, no unresolved actionable threads and a Codex review of current HEAD
- `bun run progress:audit --profile <slug>` — aggregate the newest learner snapshot. **Never Read a raw snapshot**: they run 300 KB+ and the audit already aggregates everything. `--pull` runs `progress:pull` for the same profile first and audits nothing if that fetch fails (missing R2 env prints its own `source setenv.sh` guidance and exits non-zero), because a stale snapshot does not look stale — it looks like an audit. `--item <set-id>:<item-id>` for focused evidence on one item. `--project <YYYY-MM-DD>` answers a different question from the retention table — not *what is the percentage* but *can there be one*: how many competences can reach the readability floor by that date, given arming dates and the interval schedule alone. Ask it **before** a gate date, not on it.
- `bun run progress:pull --profile <slug>` — fetch the learner's cloud snapshot into `progress/<profile>/<date>.json`, so `progress:audit` keeps working now that sync is not local. Needs `source setenv.sh` (it reads R2 over S3, not through the API — reasons in [`docs/architecture/cloud-sync.md`](docs/architecture/cloud-sync.md)). `--list` shows what is stored; `--account <id>` when the bucket holds more than one (the id is on `/konto`); `--date` for a specific day's copy. **It refuses to shrink an existing file** and parks the smaller state in a sibling `*.conflict-*.json` — investigate rather than delete.
- `bun run deploy:smoke` — seven checks against the live origin, for the failures no gate here can see because nothing here is wrong. **Run it after every deploy that touches `worker/` or `wrangler.toml`.** A deploy from a config without `main` strips the Worker's secrets: sign-in then dies silently, `/api/auth/session` reports `providers: []`, and the build, the tests and the Cloudflare deploy all stay green. `--origin` to point elsewhere; `--deep` also proves D1 and the migrations, and is opt-in because it is the only check that writes. Diagnosis and recovery: [`docs/architecture/cloud-sync.md`](docs/architecture/cloud-sync.md#when-sign-in-stops-working).
- `bun run gen:ipa` — fill missing `ipa` on vocab entries via espeak-ng (`brew install espeak-ng`; one-off dev tool, nothing about espeak ships). **Always review the output** — it is a good phoneme skeleton but gets compound/separable-verb stress, loanwords and unstressed vowel quality wrong. `--calibrate` diffs against a known-answer table; `--check` is a dry run; `--force` regenerates, discarding manual fixes.
- `bun scripts/coverage.ts <A1|A2|B1>` — Goethe Wortliste coverage. **All three levels are at 100% — keep them there** (A1 673/673, A2 1449/1449, B1 3416/3416). A new word belongs to exactly one deck; the manifest gains a line in the same change. A leading `~` (taught as grammar, no flashcard) **must be earned** — the validator hard-fails unless the word occurs in the taught surface. Run `--check-deck <file.yaml>` per deck before `bun run validate` on any completion pass. → [`docs/authoring/coverage-instruments.md`](docs/authoring/coverage-instruments.md)
- `bun run exam:ingest` — turn the **local-only** official Goethe exam materials (`docs/GeotheInstitute/`, gitignored) into the trainer's runtime assets under `public/exams/` (also gitignored). Nothing it reads or writes may ever enter the repo; a clean checkout builds fine and `/pruefung/goethe-a1` shows its absence state. A module's optional `cues:` (Teil/Nummer jump points, rendered in Üben only) are proposed by `bun scripts/exam-cues-scan.ts <setId>/<module>` from a silence scan and **verified by ear before pasting** — labels and boundaries are guesses, never findings. → [ADR 0009](docs/adrs/0009-official-exam-materials-local-only.md) · [`docs/architecture/exam-trainer.md`](docs/architecture/exam-trainer.md)
- `bun scripts/lang-cost.ts <file…>` — words per explanation half, and what four halves cost against two. Exists because a figure that decides a policy has to be reproducible: the `<De>` pilot's ratios reached the roadmap with no command behind them. Counting method is stated in the script.
- `bun scripts/grammar-coverage.ts <A1|A2|B1>` — structural coverage against `data/grammar-inventory.yaml`. A point counts as taught only when a `practice`/`drill` item carries the focus tag naming its confusion — not a checkpoint, pretest, probe, or `preview: true` item. **Closing a gap means lowering the number in `tests/grammar-coverage.test.ts` in the same commit**; it is a tripwire. A1 28/28, A2 46/46, B1 32/32. A denominator that only grows once the content is ready is not a denominator: A2 first got worse when the source-led rows were added, then returned to 100% only with article, scaffold, transfer and delayed-probe evidence. → [`docs/authoring/coverage-instruments.md`](docs/authoring/coverage-instruments.md)
- `bun scripts/structures.ts <A1|A2|B1> [--unclaimed-only] [--beyond]` — **the denominator's own denominator**: does `data/grammar-inventory.yaml` even contain every structure the published standard lists? Every entry of `data/strukturenlisten/` is `claimed` (some row cites it), **`unclaimed`** (a hole in the inventory) or **`beyond`** (an inventory row citing no source — legitimate, this course aims at B1, but visible rather than assumed). It exists because all three levels read 100% while the A1 list was missing four structures the exam tests; the anchors are free Goethe PDFs nobody had opened. **Read the `[audience]` the report prints before the percentage**: A2 once read 138/138 = 100% against *Fit in Deutsch 2*, which is the exam for **teenagers** — this course is for an adult. The free, current, adult, **production** standard covering A2 *and* B1 is the cumulative DTZ Prüfungshandbuch: A1 93/93, A2 300/300, **B1 164/164**. Say `100% des DTZ-Inventars`, never “all conceivable B1 grammar.” → [`data/strukturenlisten/README.md`](data/strukturenlisten/README.md)
- `bun scripts/handlungen.ts <A1|A2|B1> [--unclaimed-only] [--beyond]` — **the same question asked of the can-dos**: do the 216 `outcomes` contain every communicative function the published standard expects? (102 of them cite one.) `data/handlungslisten/` is to outcomes what `data/strukturenlisten/` is to grammar rows, and it exists because a course can teach every structure the exam tests and never ask the learner to refuse an offer. 28/41 at A2 and B1 — and **nine of the thirteen holes are the whole of §8.3 Redeorganisation**: opening and closing a turn, taking the floor, signalling you are listening, changing the subject. `beyond` is expected here and is not a gap (a grammar outcome realises no language function). → [`data/handlungslisten/README.md`](data/handlungslisten/README.md)
- `bun scripts/themen.ts <A1|A2|B1> [--unclaimed-only] [--beyond]` — **the third denominator, and the last one a course has**: is this course *about* the things an adult in Germany needs to talk about? `data/themenlisten/` is to topics what the other two lists are to grammar rows and outcomes; the claimant is a topic manifest, which is why it could not exist before [ADR 0012](docs/adrs/0012-topic-manifests.md). **70/70 (100%) since 2026-08-15**, closed by six new topics and one corrected under-claim. Read a hole here as *topic-level*, never lexical — that is what the closure proved: the vocabulary for almost every hole had already shipped in **unowned decks**, so *Wetter*, *Hund*, *Zigarette*, *Kita*, *Dieb* and *Versicherung* were words the learner met one flashcard at a time and never in a lesson. Six topics adopted those decks; no word moved between decks and no card id changed. **The assignments are editorial**: an under-claim manufactures a hole exactly as an over-claim manufactures coverage — three of the first fourteen holes were the author's, and in the closing pass two apparent under-claims (`geld-vertraege` for Versicherungen, `biografie-erfahrungen` for Studium) turned out to be genuine gaps on inspection. → [`data/themenlisten/README.md`](data/themenlisten/README.md)
- `bun scripts/anchor-check.ts [<source-id>] [--unaccounted]` — holds a transcribed inventory anchor against the PDF it came from: a `de:` label containing a word the page does not contain is a fabrication, and one shaped like a sentence is a leaked example. **Run it whenever a `data/*listen/*.yaml` changes** — neither failure is otherwise visible, because the YAML parses, `bun run validate` is green and `structures.ts` happily reports a percentage of the wrong list. Its first run found three of four files had paraphrased the source (`Indefinitpronomen: man` for the printed `Indefinit: man`). The PDFs are local-only (ADR 0009), so an absent source **skips** rather than failing. → [`data/strukturenlisten/README.md`](data/strukturenlisten/README.md)
- `bun scripts/comprehensibility.ts <level>/<topic-id>` — input load: how much of a topic's German the learner has not met yet, per section (`article`, `reading`, `items`), with the distinct ahead-of-the-learner words listed so they can be acted on. `--rank [A1|A2|B1]` ranks a level, or all three. **Read-only and deliberately without a threshold** — it hooks into no gate, and every row is read against the level MEDIAN the report computes from the corpus, never against zero. Outliers are the product. Known false positives (proper names, strong-verb ablaut, glossed reading words) are listed in the doc; nothing here may be quoted as an absolute claim about a learner. → [`docs/authoring/coverage-instruments.md`](docs/authoring/coverage-instruments.md)
- `bun scripts/grammar-depth.ts [<level>] [--thin] [--by-point] [--no-probe]` — **how much practice stands behind each confusion**, the number coverage cannot express. Per focus tag: teaching items, of which production, distinct practice files (a tag in one file is met once and never interleaved), probe items. **Deliberately no threshold** — every row is read against the level median the report prints, the `comprehensibility.ts` discipline — while `tests/grammar-depth.test.ts` ratchets today's measured values so they may only improve. Median items per confusion: **A1 13 · A2 9 · B1 6**; production 9 · 6 · 4. The A2 median fell to 8 when three real, newly taught confusions entered the distribution, and the A2 quality wave carried it back to 9 — a median moves for both reasons, so read it beside the tail. **The tail is what the median hides**, and it is where B1 lived until the Themen wave: nine tags at ≤3 items and ten in a single practice file — met once, never interleaved again. Closing the Themen denominator with topics that *recycled* those thin tags rather than inventing new ones took B1 to two and one, and the corpus-wide ceilings from 15/16 to 7/7. Breadth work can pay off depth debt when the tags are chosen from `--thin` instead of from the vocabulary. **Breadth and depth are two numbers and neither substitutes for the other.**
- `bun run redaktion` — **Redaction**, the German editorial workbench (`apps/redaktion`, React/Vite at :4330). Its IA is Übersicht · Grammatikatlas · Themen · Materialien · Qualität · Referenzen · Einstellungen; the Grammatikatlas uses explicit tracks and a separate A1–C2 CEFR contract, with unsupported cells labelled `nicht kartiert`. Every figure comes from `@da/content`, never recomputed in a view. The browser transport watches `content/` and `data/`, loads heavy item/vocab/text chunks on demand, reads exact source bytes, and accepts explicit revision-checked atomic saves only for existing text sources below those two roots. File-local YAML/MDX/schema errors block Save; corpus-invalid drafts may remain visible, while `reviewed` still uses the strict allowlisted splice plus full rollback gate. GitHub is a secondary source action, not the primary reader. `bun run redaktion:desktop` builds the Bun sidecar and launches the standalone Tauri app; its webview gets one narrow stdio RPC plus the folder picker, never general filesystem/shell access. Editor tutorial: [`docs/authoring/redaction-editor-guide.md`](docs/authoring/redaction-editor-guide.md). Architecture and exclusions: [ADR 0013](docs/adrs/0013-redaction-repository-workbench.md).
- `bun run redaktion:audit` — the editorial app's layout rules, measured in a real browser (boots its own dev server; `bunx playwright install chromium` once). **It exists because a shared package can be invisible to Tailwind and nothing will say so**: `@da/ui` sat outside the scan path — Tailwind v4 auto-detects from the *Vite root*, which is `apps/redaktion` — so `Panel`'s `p-5` computed to **`padding: 0px`**, `Callout`'s `border-l-4` to `0px`, and `StatGroup`'s `sm:grid-cols-2` to one column, all while the classes sat correctly in the DOM and the build, the types, ESLint and `bun test` stayed green. One `@source` line fixed it; `tests/design-tokens.test.ts` fails if a `.tsx` in the package ever falls outside those globs again. The audit then holds the geometry: every route resolves (the router's fallback makes a broken route render a working-looking page), permalinks survive reload, **no request leaves the origin**, row raggedness ≤ 2× the median, ≤ 1 primary link per row. Not in `bun test` — it needs a dev server and a Chromium, and the unit suite may depend on neither.
- `bun tauri dev` / `bun tauri build` — desktop app (thin Tauri v2 shell in `src-tauri/`; needs a Rust toolchain). Release: push a plain `vX.Y.Z` tag → `.github/workflows/release.yml` builds Windows, Linux and macOS (unsigned) installers into a GitHub Release; the tag is stamped as the version. Keep the site base-path-agnostic. Tauri JS APIs only behind the `isTauri()` runtime check (`src/lib/syncdir.ts`).

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
| `content/atlas.yaml` | the `groups:` taxonomy **and the curriculum spine** (`units:`) — what belongs to the whole graph rather than to one topic |
| `progress/<profile>/*.json` | learner snapshots, one folder per local profile |
| `packages/schema/src/index.ts` | Zod schemas — the single source of truth for all content shapes |

**Where the code lives.** A Bun workspace. `content/` and `data/` stay at the repo root because
they belong to no single app, and the learner app is the **root package** — Astro requires its
content collections to live under the project root, so moving the app under `apps/` was tried on
2026-08-14 and reverted (it built zero pages; the reason is recorded beside the `workspaces` field
in `package.json`). Four packages, and the boundary between them is what may be imported where:

| Package | What it is | May it touch `node:fs`? |
| --- | --- | --- |
| `@da/schema` | content shapes (Zod), gloss markup, letter-set checks, item-type classification | **no** — imported by React islands |
| `@da/grading` | does this answer count: `cloze`, `production`, `worddiff` | **no** |
| `@da/content` | reads the corpus: the graph, elements, all measurements, the payload | yes |
| `@da/ui` | Tailwind tokens + shared React primitives | **no** |

`@da/content` exports **per module, never a barrel** — `@da/content/focus-tags` must cost a browser
importer nothing. A pure value that lives in an fs-opening module leaks the filesystem into the
client bundle, Vite externalises it silently, and the page keeps working: that happened once with
`PRODUCTION_TYPES` and is why it now lives in `@da/schema`.

**`contentGraph()` (`packages/content/src/graph.ts`) is the one pass over the corpus.** It replaced
eight independent walks. It is memoised per root, and it **degrades a malformed file to a `note`
rather than throwing**, because it is the model an editor reads *while* authoring. Every artifact
becomes an **`Element`** with its lesson `stage`, pedagogical `activity`, derived delivery `medium`
and the `touches` it delivers. The activity contract is [ADR
0014](docs/adrs/0014-learning-activity-architecture.md): purpose (`core`, `extension`,
`application`, `remediation`) must not be confused with media (`mixed`, `listening`, `document`) or
with a source-file count. `packages/content/src/profile.ts` turns that into per-topic checks and a
ranked problem list, **with no composite score** — every distributional figure is read against the
level median it prints, never an invented threshold.

**The spine and the manifests carry five rules worth stating here**, because breaking one is
silent: `units:` file order **is** the recommended path (insert, never renumber); every topic lives
in exactly one unit of its own level, never before a prerequisite; a `deepens:` edge **must share a
focus tag the base topic drills**, because the tag is the edge's only runtime channel — an edge
without one is inert; every manifest declares 2–5 learner-facing `outcomes`; and **`elements:` is
closed** — a set or reading whose `topic:` names a topic that does not list it is an error, not an
invisibility. Two of those elements used to be conventions rather than fields, and both were
load-bearing: **`primary_practice`** decides what completing a Lernpfad step means (it was "the
first practice set in the array", so reordering the page moved it), and **`probes`** is the delayed
check (a probe used to attach itself to a topic by existing). `elements.exercises` is **one ordered
list on purpose** — 14 of the 49 topics interleave practice and drill, which is the scaffold→fade
arc written down. All of it is validated.

## Runtime invariants

Load-bearing, and each one silent when broken. Mechanism and history: [`docs/architecture/runtime-contracts.md`](docs/architecture/runtime-contracts.md).

- **`planReview()` (`src/lib/decks.ts`) is the ONE rule for what a review queue contains.** New cards are rationed **per day, not per queue** (`DAILY_NEW_CARDS = 15`) — `planReview` re-runs on every mount, so a per-queue cap alone dealt a reloading learner 75 new cards and months of review debt. Fresh-card ties break at random, never by card id.
- **Never mount a React island per table row.** In `.astro` templates use `src/components/SpeakButton.astro` — one hoisted, delegated listener for the whole page.
- **Probe state is derived from the attempt log, never stored.** A due probe opens the session as step 0, *before* review and training. `MAX_PROBES_PER_SESSION = 5`.
- **Checkpoints and placements are data, not wiring** — discovered by role, level read off the directory. Shipping the next level's is one new YAML file and no code. One of each per level.
- **A passed placement is a third evidence class**: green, real, and it **never raises the measured tier**. Do not add a placement branch to `topicTier`/`effectiveTier`; never fold placed topics into a mastery counter; add no fifth chip to `EvidenceChips`. Nothing is written until the learner presses *Ergebnis übernehmen*.
- **Navigation asks a different question than the badge.** `pathDone` is mastered *or* primary practice completed *or* self-rated `learned`. **Never derive a badge from `pathDone`** — a self-rating is not evidence. And never gate the path on item-level completion alone.
- **Unverified practice never raises measured mastery.** `write` and `speak` are minimal-ceremony: attempt → model answer → done. Their `requirements`/`checklist` render as guidance, **never as gated forms** — the app cannot verify free production, so it must not charge steps for feedback it cannot give.
- **There is no default profile and no name is ever assumed.** Nothing may create a database before discovery has run. The last remaining profile cannot be deleted. An OAuth display name may *prefill* the first-run field and nothing more.
- **The sync server stores opaque bytes and never merges.** `/api/sync/snapshot` (`worker/`) does not parse, validate or migrate a snapshot — merging is `mergeSnapshot` on the client, so a new snapshot version needs no Worker deploy. Two rules follow: an **unconditional PUT does not exist** (no `If-Match`/`If-None-Match` → 428; a lost race → 412 → pull, merge locally, retry), and **signing in grants nothing** — a new account is `pending` until the owner approves it on `/konto`, so an unapproved account costs one D1 row and zero bytes. A **device token grants sync only**, never admin — and it **cannot approve a device pairing**, or one leaked string would renew itself. Pairing is the desktop's way in (`/api/pair/*`, RFC 8628's shape): the app shows a short code and a **cookie session on an approved account** grants it; the learner **types** that code rather than following a link carrying it, which is the whole anti-phishing argument. → [`docs/adrs/0003-opaque-snapshot-sync-and-approval-accounts.md`](docs/adrs/0003-opaque-snapshot-sync-and-approval-accounts.md) · [`docs/architecture/cloud-sync.md`](docs/architecture/cloud-sync.md)
- **Every figure on `/about` is computed from content at build time.** Never hand-write a count there, and never claim a level is more finished than it is.
- Legacy or mismatched-revision attempts keep their logged result and are **never replayed** against a current key. Snapshot migrations v1–v7 are explicit (`src/lib/snapshot-schema.ts`).
- **No input is sized, capped or captioned from the answer it is waiting for.** A cloze gap drawn at `answers[0].length + 2` made the box a ruler: `Es gibt hier ___ Supermarkt.` fitted only *einen* of *einen/eine/ein*, and the item scored a width judgement as accusative mastery. Every gap rests at one width and grows with what the **learner** typed (`gapWidthCh`, `Cloze.tsx`); `maxLength`, `placeholder` and `size` are the same hazard. No gate can see this class — the validator sees a well-formed item and the grader a correct answer.
- `localStorage` keys with persisted user choices (e.g. `da:topics-view`) — **migrate old values** rather than stranding a learner on a state that no longer exists.

## Authoring rules (content quality is the product)

### Language discipline
- German orthography must be perfect: ä/ö/ü/ß always (never ae/oe/ue/ss substitutes), nouns capitalized.
- Russian and English explanation text must be complete and idiomatic — never machine-translation-ese, never transliteration.
- **A half that mirrors a sibling half's rhetoric sentence-for-sentence is a calque, and no gate can see it.** Diagnose with the `textbook-text-reviewer` skill, repair with `textbook-text-editor`; when to run the loop and the repo bindings the skills cannot know: [`docs/authoring/article-prose.md`](docs/authoring/article-prose.md).
- **CEFR discipline**: in a topic at level X, German example sentences and exercise items may only use grammar and vocabulary at or below level X. An A2 article must be fully readable by an A2 learner.
- Every German example sentence gets EN and RU translations.

### Bilingual voice
- Explanations are wrapped in `<Bilingual><En>…</En><Ru>…</Ru></Bilingual>` (components are injected; no imports needed in MDX). Two optional halves may join them: `<Uk>` (Ukrainian — an independently authored half written from the German, never translated from a sibling half; ships in file-scoped waves, per-file all-or-none, validator-enforced) and `<De>` (the German-medium explanation for advanced learners — authored from B1 onward, never backfilled to A1/A2). A missing half falls back to EN at render time.
- EN and RU halves are each a complete, self-sufficient explanation of the same point — write both from scratch. They **may diverge** where it helps their reader: the RU half may contrast German with Russian («быть», падежи); the EN half may contrast with English ("must not" ≠ *muss nicht*) or use German-internal hooks (the wem?-question test). Never assume an EN reader knows Russian or vice versa.
- **No Cyrillic and no references to Russian inside `<En>…</En>` or any `en`/`*_en` YAML field.** Likewise no Cyrillic in `de`/`*_de` fields, no Ukrainian-only letters (і/ї/є/ґ) in `ru` fields, no Russian-only letters (ы/э/ъ/ё) in `uk` fields. Enforced by `bun run validate`.
- **The EN surface never assumes RU or UK** — this binds *rendering code*, not just authored fields: under explanation language `en`, a learner sees English (and German) only. Never hardcode a combined `en · ru` string; a card's meaning-side second half goes through `pickSecond` (`src/lib/prefs.ts`), which returns the gloss of the *chosen* language and `undefined` under `en`/`de`. RU and UK modes stay dual with EN (`en · ru`, `en · uk`). The one language selector is **Lernsprache** in the ProfileSwitcher dropdown (per-profile `ExplainLang`); the chrome is pinned German — deliberate immersion, one-line reversible (`resolveUiLang`).
- German content (examples, tables, headings like "Beispiele") stays outside Bilingual blocks — it is always visible.
- Grammar terminology: use German terms with a per-language gloss on first use — in En blocks "der Kasus (case)", in Ru blocks "der Kasus (падеж)".

### Topic article skeleton → [`docs/authoring/article-prose.md`](docs/authoring/article-prose.md)
Section order (H2 headings, in German):
1. `## Kurz gesagt` — an advance organizer: the schema the article will fill in, ≤ ~100 words and ≤ 5 sentences per half, not a summary of its details (bilingual).
2. `## Erklärung` — the full explanation with tables (bilingual prose, German tables).
3. `## Beispiele` — 5–10 German sentences as blockquotes, each with EN/RU translation in a Bilingual block right after.
4. `## Häufige Fehler` — typical mistakes (❌/✅ pairs). The Ru half highlights Russian-interference errors; the En half gets its own framing — English false friends where they exist ("must not"), otherwise neutral rule statements. Never Russian-framed English.
- Do **not** add Übungen/Wortschatz sections in the article — the page template renders them from the manifest (`elements.exercises`, `elements.vocab`).
- **`## Erklärung` splits into `### German subsections`, one per named confusion** — at least one per grammar point the unit owns, plus the integrating section. The heading is German and sits **outside** `<Bilingual>`, so it stays visible under `en`, `ru`, `uk` and `de`. A bolded lead sentence is not a heading: it cannot be navigated to and cannot carry a table with it.
- **Each subsection keeps its table beside its prose.** A paradigm the reader must hold in memory across another subsection has been separated from what explains it.
- **No paragraph over 120 words in any explanation half** (validator-enforced, `packages/content/src/prose-shape.ts`); target ≤ 90, one claim per paragraph. The cap is a tripwire, **never a target** — trimming the reasons and the L1 contrast trades a shape defect for a teaching one. Command: `bun scripts/prose-shape.ts content/topics/<level>`.
- **A fact stated in `## Erklärung` is drilled by an item or serves an outcome**; otherwise it goes in a compact `### Feinheiten` table. A list over three members is a table or a bullet list, never a semicolon chain — and prose never restates what the table beside it already enumerates.

### Exercise items → [`docs/authoring/item-authoring.md`](docs/authoring/item-authoring.md)

- Topic `id` equals the filename; kebab-case ASCII. Exercise refs are path-ids like `a2/perfekt-haben-sein`.
- **Item ids are stable.** Increment `revision` only when prompts, accepted answers, scoring, outcomes or focus semantics change — explanation-only polish does not.
- Every set declares `role: pretest|practice|drill|checkpoint|probe|placement`.
- **Every topic owns at least one `role: practice` set**, and names one of them `elements.primary_practice` — completing it advances the Lernpfad, **so its item list must not grow later.** Add practice to a non-primary set instead.
- Every item declares `outcomes:`; every item should have a bilingual `explain` (it is where the teaching happens); every item that drills one nameable confusion gets a `focus` tag. `preview: true` only for an intentional forward reference.
- **Pretests are never weakness evidence, never training, never `Geübt`.** The `-pretest` filename is validator-enforced in both directions, because an attempt records no role.
- **Item mix, per topic, over `role: practice` sets:** ≥ 2 `translate`; `mc` ≤ ⅓; `mc`+`match`+`order` ≤ 45%. Plus `order` ≤ 2 **per set** — it is scaffolding, not a test, and it saturates. The ratios count **written items only**: `audio-comprehension` is on neither side, because the bar's argument is that the learner never has to *produce*, and production is what a listening task cannot ask for. Counting it in the denominator alone let every recorded item buy a topic more room for written recognition.
- **`key_tokens` on a `translate` item are the tokens whose exact form the item's `focus` grades.** Four rules, each of which has been got wrong here: pin **both ends** of a word-order rule (the finite verb alone grades the word the error leaves in place); **only pin what the tag grades**; **never pin nothing** (an empty list blanket-attributes every error to the tag); and a token repeated in the defining rendering **grades both occurrences** — rewrite the sentence.
- **An item may never grade which word the author had in mind, and it must stay determinate when served alone and in every prompt language it ships** — mixed training strips the topic context that made it look determinate, and `prompt_en`/`prompt_ru`/`prompt_uk` are written independently, so they do not fix the same things. A cloze gap asking for a lexical verb names the infinitive; a `translate` item pinning one of two interchangeable connectors (*denn*/*weil*) either names it in the `instruction` or accepts the sibling — **which one depends on whether the connector carries the `focus`**, and the same test settles a determiner a bare Russian noun leaves free («лампу» fixes neither *eine* nor *die Lampe*); a `table` answer key continues a `…` stub rather than repeating it, and the learner may do either — both are graded, because no authoring rule can reach an ambiguity that lives in the rendering.
- `mc` has exactly one correct answer. A `match` meaning-side right is a `{en, ru, uk?}` record, **never a mixed `"en / ru"` string**. `listen` text is ≤ ~10 words with numbers written as words. An `audio-comprehension` item may name a reviewed `recording`; its `source.turns` are both the recorded script and the TTS fallback, and the validator holds them equal. Playback is never evidence. Readings gloss 6–10 phrases as `[[de::en::ru]]`.
- **Placement sets are held to seven stricter rules** than practice — a guessed placement item retires a lesson the learner never sees again.

### Focus tags → [`docs/authoring/focus-tags.md`](docs/authoring/focus-tags.md)

The table there is an **allowlist**: `bun run validate` rejects a tag not registered in
`focusIntroducedBy` (`packages/content/src/focus-tags.ts`) with the topic that introduces it — `tests/focus-tags.test.ts` holds the doc table and the allowlist equal in both directions. Use an existing tag
whenever possible; a new one is for a genuinely new confusion and joins both places in the same
change. Leave genuinely mixed or pure-comprehension items untagged — **a false tag is worse than no
tag**, because it sends training and drill authoring after a confusion the learner does not have.

### Vocab entries → [`docs/authoring/item-authoring.md`](docs/authoring/item-authoring.md#vocab-entries)

- Nouns need `gender` + `plural` (with article); verbs need `partizip2`, `aux`, `praesens_3sg`, and `valence` when governed. Every entry except sentence-length `phrase`s needs a reviewed `ipa`.
- **`accept` exists because `de` is three things at once** — the Wortliste key, the answer shown, and the answer typed. Reflexive verbs, adjectival nouns and course-taught spelling variants need it, or the card marks correct German **wrong**. A reflexive verb's form fields must carry `sich` too (validator-enforced when reflexivity is declared).
- **A gloss is the question side of the production card, so it must never contain the answer.** A usage hint — reflexivity, a governing frame, a fixed chunk — goes in `note`, which renders on the card back. The headword may appear in a gloss only as the translation itself (`Kiosk` → "kiosk"); inside a parenthetical or an em-dash aside it is validator-rejected. Every character of a typed answer must also be on the insert bar (`GERMAN_INPUT_KEYS`, `src/lib/typing.ts`), likewise enforced — `Ä/Ö/Ü` were missing for eleven cards and made them a permanent soft miss.
- **A dual-language card explains a distinction once.** Keep `en` complete for EN-only mode; when EN and RU/UK both carry extended parenthetical/dash commentary, add a plain, shorter `en_compact` for the dual view. The selected RU/UK gloss keeps the retrieval cue, while `note` adds answer-side teaching instead of restating it.
- **`cards: recognition` makes one card instead of two**, for language the learner must understand but will never produce. It is **defaulted (`both`) and never retrofitted**: the direction is in the card id, so flipping a shipped entry deletes its production-card SRS history. Use it in new decks — B1's Wortliste tail is what it exists for.
- **Card identity is `<vocab-file-id>::<de>::<direction>`.** Renaming a headword or file id resets the learner's SRS history — avoid unless the entry was wrong.
- **A2 vocabulary recycles, never adopts**, and **Wortliste completion decks stay unowned** — listing one in a topic's `vocab:` flips its fresh-card gate and buries hundreds of words behind that topic.

### Entdecken & Dokumente → [`docs/authoring/future-content-directions.md`](docs/authoring/future-content-directions.md)

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
- **A pasted or generated source document is an outline, never an inventory.** Before authoring from it, check its completeness against `data/grammar-inventory.yaml`, the Goethe Wortliste and a reference grammar — the gaps in the source are the first thing to look for, and "found none" is itself a claim. The place-preposition topic shipped its system table without *an* (2026-08-12) because a ChatGPT draft's omission was reformatted instead of vetted.

One mechanical hazard in the same family — silently wrong, and no gate catches it: **never write a literal NUL byte into source.** It is valid TypeScript, so tests, `astro check`, ESLint and the build all pass, but `file` reports the source as `data` and grep, ripgrep and editor search then **skip the file without saying so**. Two files sat that way. Use the escape in a template literal instead; `tests/source-hygiene.test.ts` fails on any tracked file containing one.

### Shipping a topic → [`docs/authoring/authoring-checklists.md`](docs/authoring/authoring-checklists.md)

A topic is not done until all nine are:

1. `content/topics/<level>/<id>.topic.yaml` — the manifest, and `<id>.mdx` beside it: the article following the skeleton, **prose only**.
2. Learning activities — every topic owns exactly one 8–15-item `activity: core` Grundübung named by
   `primary_practice`, plus at least one productive `activity: application` in a fresh context.
   `extension` and `remediation` exist only for a coherent extra job. Every teaching set declares
   `stage`, `activity`, `title_de`; every item has `explain`; every `translate` has `key_tokens`.
   The item-mix bar is per topic, never per file. Run `bun run activity:audit`.
3. Pretest — 3 items at `<id>-pretest.yaml`, referenced via `pretest`.
4. Probe family — `probe-<id>.yaml`, listed in `elements.probes`, 3 **parallel variants**: different tasks, **one competence**, same `focus` and `outcomes`, none answerable from memory of a practice item. A second family on a topic is ordinary work since P19-4 gave every family its own explicit `arming:` list — it cannot move an existing family's clock — but **still measure `armedAt` before and after**, because a source reading is not a measurement.
5. Reading — `kind: intensive`, 6–10 glosses, 3 questions. **90–130 words is the authoring target and no gate enforces it**: the profile check was retired on 2026-08-15 after it reported 17 findings, because a coherent 84-word notice and a purposeful 145-word narrative are not defects by arithmetic. Length is a cognitive-load judgement — make it, do not let a validator make it for you. Today's intensive texts run to ~150 words at the top and none fall short of 90.
6. Vocab file if the topic introduces a word field; fill `ipa` with `bun run gen:ipa`, then review it.
7. Unit slot in `content/atlas.yaml`, and 2–5 `outcomes` in the manifest. **Every outcome must be measured by a `practice`/`drill` item or a reading question** — pretests, checkpoints and probes deliberately do not count, because an outcome only ever tested was never practised.
8. New `focus` tags registered in [`docs/authoring/focus-tags.md`](docs/authoring/focus-tags.md) **and** in `focusIntroducedBy`.
9. `bun run validate` passes.

### Review rounds end when a round finds nothing material

Three rounds on one PR (#115) is what the alternative looks like: every fix was correct, and every
fix was new reviewable surface for the next round.

- **Material means it changes what the learner sees, does, or is measured on** — a false fact
  taught, an item that rejects correct German, an outcome with no task in the mode it names, a
  mechanism that mis-measures. Everything else is a backlog line, not an edit.
- **Fix the finding, not the neighbourhood.** Grepping a false *claim* to its other instances is the
  same defect and is in scope. Adding the item you wish existed, tightening adjacent prose, or
  closing a gap the finding merely reminded you of is not — that is next round's findings, authored
  by you.
- **Precedent settles marginal calls.** When shipped units at the same level do not do the thing,
  it is a backlog item and the PR merges: B1.4 gained an `audio-comprehension` item that three of
  the four B1 units then shipped were without, in the same round that filed the backlog entry
  saying so.
- **Push back when a finding is wrong.** A reviewer's confidence is not evidence — check the claim
  against the corpus, and say no with the reason when it does not hold. Conceding every finding is
  its own way of never converging.
- **A reply is a verdict, a fix and its scope.** Not an essay.

### Lesson cycle (required)

Each topic implements **pretest → model → explanation → scaffold → fade → transfer → delayed check**: the pretest is diagnostic generation, not practice; the article and readings give a comprehensible model with maximal support; topic-owned practice begins blocked and explanatory; mixed training removes hints and interleaves only after the article was opened; at least one fresh-context production task checks transfer; checkpoints and probes use separate roles and never leak into ordinary training.

### Drills from progress (the personalization loop)

1. `bun run progress:audit --profile <slug>` — **never Read the raw snapshot.**
2. **Triage the grading queue first.** Rulings live in `data/grading-decisions.yaml` and must be committed, or the same rendering returns for review forever. An `accept` or `constrain` is paid for in the same change (an `accept` must pass today's grader; a `constrain` adds the bilingual `instruction`), both with a `revision` bump. **Never author a drill from a pre-triage weak-focus table** — rule the queue, rerun the audit, then read the table.
3. Diagnose via the weak **focus tags**, not individual failed items. Write a drill set targeting that confusion, tag every item with it, and attach the set to the relevant topic's `exercises`.

Full procedure, including what each `decision` means and how attribution is recomputed: [`docs/authoring/authoring-checklists.md`](docs/authoring/authoring-checklists.md) and the `progress-review` skill.
