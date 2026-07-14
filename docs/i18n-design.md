# Sprachen: per-profile UI language and Ukrainian

Status: design accepted 2026-07-14. Implementation is Phase 8 (P8-1…P8-5, then the C3 translation
waves) in [backlog.md](backlog.md); this document is the contract those items implement.

## The two axes, and why they never merge

The system has two language questions that look like one:

- **`UiLang`** — the chrome: navigation, buttons, section labels, empty states, the grade buttons.
  Today it is hardcoded German. It becomes `de | en | ru | uk`, chosen per profile.
- **`ExplainLang`** — the content's explanation language: which half of a `Bilingual` block is
  shown, which gloss column, which `prompt_*` field. Today `en | ru` (`src/lib/prefs.ts`); it gains
  `uk`.

They are independent and must never be conflated. A learner may want German chrome (immersion) with
Russian explanations; a Ukrainian speaker may want Ukrainian chrome with Ukrainian explanations; a
teacher demoing the app may want English chrome over any content language. **Full immersion is
simply `uiLang: 'de'`** — which is today's exact UI, and stays the default. That makes P8-1 a
zero-visual-change PR by construction: the feature ships dormant, and turning it on is a choice.

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

## P8-4 — Ukrainian content machinery

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

## P8-5 — surfaces

- **Flashcard front** becomes `${en} · ${pickSecond(card)}`, where `pickSecond` resolves the
  ru/uk gloss by explanation language. This is **display-only**: card identity is
  `<deck>::<de>::<direction>` and never carries a gloss language, so no SRS history resets —
  asserted in a test, not assumed.
- The header language toggle gains UK.
- The Über page gains a **build-time UK-coverage figure**, computed from content per the
  earned-claims rule — the page never hand-writes a count, and it never claims the translation is
  further along than the files show.

## C3 — the translation waves

A1 first (~6–8 PRs), then A2 (~10–14). The quality bar is the same one Russian carries:

- Each wave is **authored** idiomatically, never machine-translationese.
- The `uk` half may diverge where it helps its reader — contrasting German with Ukrainian
  (відмінки, «бути»-dropping) exactly as the RU half contrasts with Russian.
- Every wave passes the validator letter checks and a review before merge.

## Honest volume

**~20–27 PRs total:** ~5 machinery PRs (P8-1…P8-5) and ~15–22 content waves. The waves run
concurrent with B1 authoring and **never gate it**. One soft preference is recorded in the
roadmap's B1 gate: land P8-4 before B1 unit 1, so B1 content is authored with `uk` from day one
instead of being backfilled.
