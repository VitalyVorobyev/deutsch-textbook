# Sprachen: per-profile UI language and Ukrainian

Status: design accepted 2026-07-14; P8-1 (strings module, per-profile keys, pre-paint attribute,
nav as the first chrome surface, picker in the ProfileSwitcher dropdown), the P8-2/P8-3
ternary sweep (35 components: hoisted `pick()` records; ~130 chrome keys in the strings table)
and P8-4 (the content-language machinery, extended with the German explanation half — see below)
shipped 2026-07-15; P8-5 (the card meaning side via `pickSecond`, the Über page's computed
UK-coverage figure, and the chrome residue in never-ternary components and static `.astro`
pages) shipped 2026-07-16. The machinery is complete: the only remaining implementation is the
C3 translation waves in [backlog.md](backlog.md); this document is the contract they implement.

**The objective, restated after a course correction (2026-07-15):** the point of this phase is
the *learner's* language — Ukrainian + English explanations for a Ukrainian reader the way
today's reader gets Russian + English, and German-medium explanations for advanced learners —
not the chrome. The UI-language work shipped first because it is the foundation the sweep needed,
but a Ukrainian menu over Russian unit material is not the deliverable; the translation waves
and the `de` half are.

## The two axes, and why they never merge

The system has two language questions that look like one:

- **`UiLang`** — the chrome: navigation, buttons, section labels, empty states, the grade buttons.
  Today it is hardcoded German. It becomes `de | en | ru | uk`, chosen per profile.
- **`ExplainLang`** — the content's explanation language: which half of a `Bilingual` block is
  shown, which gloss column, which `prompt_*` field. `en | ru | uk | de` (`src/lib/prefs.ts`):
  `en`/`ru` fully authored, `uk` arriving in translation waves, `de` the German-medium half
  authored from B1 onward — the optional halves fall back to `en`.

They are independent and must never be conflated. A learner may want German chrome (immersion) with
Russian explanations; a Ukrainian speaker may want Ukrainian chrome with Ukrainian explanations; a
teacher demoing the app may want English chrome over any content language. **Chrome immersion is
simply `uiLang: 'de'`** — today's exact UI, and still the default. Content immersion is
`explainLang: 'de'` — the German explanation half below, real only where content carries it
(B1 onward), an honest EN fallback everywhere else.

**Owner decision 2026-07-16 — one selector, chrome pinned German.** Two four-way selectors (the
header `ExplainLang` toggle and the ProfileSwitcher's `UiLang` picker) exposed the two axes as two
user decisions, and that was redundant clutter: nobody wants to control them independently, and the
one imagined use case (a teacher demoing in English chrome) never outweighed the cost. The UI now
has **one** selector — **Lernsprache** (the `ExplainLang`, per-profile, in the ProfileSwitcher
dropdown) — and the chrome is **pinned to German**: `resolveUiLang`/`getUiLang`/`useUiLang` return
`'de'` unconditionally, the retired `da:uilang:<profileId>` keys are ignored and never written, the
header toggle and the `.ui-*` span mechanism are gone (static chrome renders `t(key, 'de')`
directly). German-always chrome is not a loss: the default was already `'de'` for everyone, so no
learner's first-run experience changed, and the nav labels are high-frequency sight vocabulary —
the immersion argument this document already made for the default. The two-axis *architecture*
stays (the strings table keeps all four languages as dormant data; `UiLang` remains a type), so
the pin is a one-line reversal if it is ever wrong. The same ruling fixed `pickSecond`: the
meaning side of a card under `en` was still `en · ru` (P8-5's zero-visual-change reading), which
leaked Russian into the EN surface — under `en` the second half is now `undefined`, and only the
chosen language's gloss ever joins the EN one.

**The classification rule that makes the default safe: a string is chrome iff it is German
today.** The current UI is a two-tongue hybrid — German furniture (nav, `GRADE_BUTTONS`,
`VerdictChip`) plus helper text that follows the explanation language ("Reveal/Показать" in
`FlashcardSession`, section labels in `TopicProgressList`). Only the German-today strings enter
the chrome table; a string that follows `ExplainLang` today **stays an `ExplainLang` surface** —
the P8-2/P8-3 sweep moves it into a `pick()` record, never into chrome. Under that rule, default
`uiLang: 'de'` is zero-visual-change *by construction*: chrome strings render the German they
already are, helper strings keep following the explanation language, and nothing flips for a
learner who never chose a UI language. (Seeding `UiLang` from `ExplainLang` was considered and
rejected: it would flip the German furniture to EN/RU for existing users — a far larger change.)
If the owner later wants helper text German too, that is a future explicit decision, not a side
effect of this migration.

## P8-1 — the strings module

- `src/lib/strings.ts`: a table of chrome strings keyed by stable ids, `t(key, uiLang)`, and a
  `useUiLang()` hook for React islands.
- **Pre-paint attribute:** `<html data-ui-lang>` is stamped by an inline script before first paint
  (the same pattern as the existing theme and explanation-language attributes), so chrome never
  flashes German before hydration.
- **Static Astro chrome** renders all language variants as CSS-toggled spans — the same mechanism
  as the En/Ru blocks (`.lang-*` visibility keyed off the root attribute) — so a nav label never
  costs a React island.
- **Per-profile keys:** `da:uilang:<profileId>` for chrome; `ExplainLang` moves from the
  device-level `da:lang` to `da:lang:<profileId>`.
- **Migration rule:** the first read of a profile-scoped key falls back to the legacy `da:lang` and
  copies it forward into the profile key. The legacy key is **left in place as the device default
  for other profiles** — a second profile on the same device inherits the device's historical
  choice rather than resetting to English. `ProfileSwitcher` re-applies both root attributes when
  the active profile changes.

## P8-2 / P8-3 — the ternary sweep

There are ~136 inline `lang === 'ru' ? … : …` ternaries across ~35 components. The sweep is
mechanical but wide, so it runs as two PRs of roughly half the components each, leaning on
`bun run check` to catch shape errors.

The target shape is a **hoisted `pick()` record**: each inline ternary becomes
`pick(lang, STRINGS.someKey)` where the `{en, ru}` record is hoisted to module scope. The point of
the shape is P8-4: when `uk` arrives, each record gains one field **in one place**, instead of
every branch point in the codebase being touched again per language.

`GRADE_BUTTONS` and `VerdictChip` labels look like content but are chrome — they follow `UiLang`,
so they move into the strings table rather than gaining `uk` fields.

## P8-4 — Ukrainian content machinery (shipped 2026-07-15, extended with `de` — next section)

- `bilingualSchema` gains an optional `uk`, and the parallel optionals follow: `title_uk` on
  topics, `uk`/`example_uk` on vocab entries, `prompt_uk` on translate items, `uk` on atlas
  outcomes.
- **Validator letter-set checks:** the existing `CYRILLIC` regex cannot distinguish Russian from
  Ukrainian, so the validator checks letter sets instead — і/ї/є/ґ in an `ru` field fails,
  ы/э/ъ/ё in a `uk` field fails. This is **not watertight** (a short phrase can avoid all eight
  letters); its job is to catch cross-pasting, which is the realistic failure mode of a
  twenty-wave translation program.
- **Parity is per-file:** any `uk` in a file means every ru-bearing field in that file carries
  `uk`. Per-file rather than per-repo because translation lands in waves — a half-translated repo
  is the plan, but a half-translated file is a defect. `content/atlas.yaml` is one file holding
  every node, so parity there is **per node**: one topic's outcomes translate together, and the
  file as a whole may be mixed.
- **Glosses** grow to `[[de::en::ru::uk]]`: three or four `::`-separated fields, **all-or-none per
  reading** — a reading with mixed three- and four-field glosses is a half-translated artifact and
  fails validation.
- `Uk.astro` and a `.lang-uk` CSS class, mirroring `En.astro`/`Ru.astro`.
- `ExplainLang` gains `'uk'`, and `pick()` falls back **`uk → en`** where `uk` is missing.
  **Decided, with the reasoning:** English is the course's always-complete explanation axis — every
  artifact must carry EN, so the fallback always exists — and falling back to Russian would
  silently hand a Ukrainian reader Russian, a substitution the course does not intend to make.
  Honest state over silent substitution: seeing English where Ukrainian does not exist yet is also
  an accurate live indicator of how far the translation waves have progressed.

## The German explanation half (`de`)

Added to P8-4 by an owner decision (2026-07-15). The objective: advanced learners read German
explanations. A hide-the-EN/RU-prose mode was considered and **rejected** — an article stripped of
its explanation prose is not immersion, it is a table collection.

- `bilingualSchema` gains an optional `de` beside `uk`: a **German explanation half**, held to the
  same register discipline as the article's always-visible German — readable at the topic's level.
- **B1 onward only.** B1 articles and exercises are authored with `<De>` halves from day one;
  A1/A2 are never backfilled. Under `explainLang: 'de'`, A1/A2 content falls back to EN — the same
  honest-state principle as `uk → en`.
- `pick()` falls back **`de → en`**, mirroring `uk → en`.
- **No `prompt_de`** — a translate prompt exists to be translated *into* German, so `de` mode
  serves the EN prompt. **No vocab `de` gloss** — a card's meaning side is never German by
  construction (P8-5's `pickSecond` renders EN alone under `de`). **Glosses have no `de` half** —
  field 1 of `[[de::en::ru::uk]]` *is* the German phrase, so `ReadingText` destructures gloss
  records to `{en, ru, uk}` before `pick()`; under `de` the EN gloss is revealed, never the phrase
  as its own gloss. Outcome records already carry `de` — the German can-do — which under `de` mode
  is exactly the right thing to show.
- Validator: Cyrillic in a `de`/`*_de` field fails; `de` parity runs per file over the
  explanation-shaped records (an object whose keys are ⊇ `{en, ru}` and ⊆ `{en, ru, uk, de}`),
  with `content/reference-data` exempt — its `{de, en, ru}` records are German example sentences,
  not explanation records.
- The pure-CSS fallback: `[data-explain-lang="de"]` hides `.lang-ru`/`.lang-uk` everywhere and
  hides `.lang-en` only where a direct-sibling `.lang-de` exists (`:has()`), so every CSS-only
  surface (VocabTable, WordField, static pages) falls back to EN with zero component changes. The
  contract — a `.lang-uk`/`.lang-de` element must be a direct sibling of its `.lang-en` — is
  commented in `global.css`. Where `:has()` is unsupported, EN shows beside the chosen half:
  readable, not broken.

## P8-5 — surfaces (shipped 2026-07-16)

- **The meaning side of a card** becomes `${en} · ${pickSecond(card)}`, where `pickSecond`
  resolves the ru/uk gloss by explanation language — and renders EN alone under `de`, because a
  card's meaning side is never German by construction. That is the **front of the `x-de` production
  card and the back of the `de-x` recognition card** — and only those: the `de-x` front stays the
  German answer, and the Hören input mode keeps its dictation behavior, exactly as today. The
  change is **display-only**: card identity is `<deck>::<de>::<direction>` and never carries a
  gloss language, so no SRS history resets — asserted in a test, not assumed.
- ~~The header language toggle gains UK~~ — shipped with P8-4 (the toggle is EN/RU/UK/DE).
- The Über page gains a **build-time UK-coverage figure**, computed from content per the
  earned-claims rule — the page never hand-writes a count, and it never claims the translation is
  further along than the files show.

## C3 — the translation waves

A1 first in **~3 large waves**, then A2 in **~4–5** (owner decision 2026-07-15: fewer, larger
chunks — the UK version is wanted for real Ukrainian readers, not as parked machinery, and the
waves start now). Each wave carries two jobs in one review pass:

- It **authors** the `uk` half idiomatically, never machine-translationese. The `uk` half may
  diverge where it helps its reader — contrasting German with Ukrainian (відмінки,
  «бути»-dropping) exactly as the RU half contrasts with Russian.
- It **reviews and improves the existing `ru` (and `en`) prose** of the same files while they are
  open — a translation wave is also an editorial pass over what is already there.
- Every wave passes the validator letter and parity checks and a review before merge; per-file
  parity means each of a wave's files is fully translated or not started, never half.

## Honest volume

**~13 PRs total:** 5 machinery PRs (P8-1…P8-5; P8-4 shipped 2026-07-15) and ~7–8 large content
waves (A1 ~3, A2 ~4–5). The waves start immediately, run concurrent with B1 authoring and
**never gate it**. The roadmap's B1-gate soft preference is met: P8-4 landed before B1 unit 1,
so B1 content carries `uk` — and its German-medium `de` half — from day one instead of being
backfilled.
