# design-sync notes — Deutsch-Atlas

## What this sync is, and is not

**Deutsch-Atlas is an Astro application, not a component library.** There is no
published package, no library build, and `dist/` is the static site. This sync is
therefore a deliberately scoped subset: the **20 components that render from
props alone**, chosen so that a design agent can compose real Deutsch-Atlas
screens in claude.ai/design.

The 25 React components NOT synced are excluded because they read the IndexedDB
store at mount (`SessionFlow`, `FlashcardSession`, `MixedTraining`,
`ProgressPanel`, `DueBadge`, the `today/` widgets, …). They would render empty or
throw in a design tool. The 13 `.astro` components (`Bilingual`, `Chrome`,
`VocabTable`, `SpeakButton`, …) cannot be bundled as React at all.

To re-scope, edit **both** `componentSrcMap` in `config.json` (which decides
preview cards) and `.design-sync/ds-entry.tsx` (which decides what lands in
`window.DeutschAtlas`). They must agree.

## Repo-specific setup

- **No dist entry.** The bundle is built from a hand-written entry,
  `.design-sync/ds-entry.tsx`, passed as `--entry`. Do not let the converter fall
  back to synth-entry mode: it would `export *` every `.tsx` under `src/`,
  dragging the store, Tauri APIs and idb-keyval into the bundle.
- **No `.d.ts` tree**, so the converter's prop extractor produced
  `[key: string]: unknown` for all 20 — an empty contract, which is worse than
  none because the design agent codes against it. The real contracts are written
  by hand in **`.design-sync/dts-props.mjs`**, which injects `dtsPropsFor` into
  `config.json`. **Re-run `node .design-sync/dts-props.mjs` after changing any
  synced component's props**, then rebuild.
  They are deliberately structural (shapes inlined) rather than referencing the
  real types, because the items are `z.infer<typeof …>` and a design agent cannot
  resolve a Zod schema.
- **CSS is compiled, not scraped.** `cfg.cssEntry` points at
  `.design-sync/.cache/compiled.css`, which is **gitignored and must be
  regenerated before every build**:
  ```
  .ds-sync/node_modules/.bin/tailwindcss -i .design-sync/tailwind-entry.css -o .design-sync/.cache/compiled.css
  ```
  `tailwind-entry.css` wraps the app's own `src/styles/global.css` and adds
  `@source` for `src/components` and `.design-sync/previews`, so utility classes
  used only in previews are still generated. Skipping this step silently ships a
  stylesheet missing any class a new preview introduced.
  (The Astro build's `dist/_astro/*.css` would also work, but its filename
  carries a content hash that changes every build, so it cannot be a config path.)
- **`guidelinesGlob: []` is deliberate.** The default globs swept 17 files from
  `docs/` into `guidelines/` — those are *course-authoring* docs (item authoring,
  focus tags, CEFR curriculum), not design guidance, and a design agent reading
  them would try to apply German-teaching rules to UI work.
- **Playwright: browsers are already installed globally**; do not download 200MB.
  On macOS the cache is `~/Library/Caches/ms-playwright/` (NOT `~/.cache`), and it
  holds chromium builds 1208/1217/1223/1228. `playwright@1.60.0` pins chromium
  1223, so install just the package:
  ```
  cd .ds-sync && PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i playwright@1.60.0
  ```

## Preview authoring

Previews use **real authored course content** from `content/exercises/a2/` and
`content/documents/a2/` rather than invented data — that is what makes the cards
worth browsing. When adding a preview, take the item from a real YAML set.

- `DocumentStimulus` inlines `public/documents/a2/reisen-zugausfall.svg` as a
  base64 data URI, because `withBase()` resolves the asset against a site that
  does not exist inside a preview card.
- `TopicProgressList` derives all four tiers from a **constructed attempt log**
  (fixed timestamps, never `Date.now()`, so renders stay deterministic). It is
  given no tiers — changing the mastery thresholds in `src/lib/mastery.ts` will
  change what that card shows.
- The one variant axis worth sweeping on almost every component is the
  **explanation language** (`lang="en"` vs `lang="ru"`). Props that change no
  pixels are not worth a cell: `locked` on the item renderers, and a second
  same-language `Listen` item (its German text is hidden until submission).

## Findings in the app itself

- **`Sparkline` drew a line across buckets with no data — fixed in #96.**
  `getFocusTrends` emits `errorRate: null` for a week with no attempts and
  `WeaknessTrends` passed that straight through, so the chart interpolated a
  trend across weeks nothing was measured in, under a caption telling the learner
  a falling line means improvement. A point now starts a new subpath unless the
  bucket before it had data. `tests/sparkline.test.tsx` pins it. **If that
  behaviour is ever changed back, the synced `.d.ts` for `Sparkline` and
  `previews/Sparkline.tsx` both describe the current behaviour and must move
  with it.**
- **`accept` is dereferenced during render by `Order`, `Listen` and `Translate`**
  (and `key_tokens` by `Translate`), even though the Zod schema marks them
  `.default([])`. **This is not an app bug** — exercise sets are parsed through
  `exerciseSetSchema` at load (`src/content.config.ts`), so the default always
  applies, and `z.infer` gives the output type, which is already required. It
  only matters when an item object is built by hand, as previews do; that cost
  two `[RENDER]` failures here. The synced contracts mark those fields required
  for exactly that reason.

## Two claims in `conventions.md` that were wrong the first time

Both were caught by Codex review on the PR, not by any gate — the conventions
file is prose, and nothing checks prose against behaviour. Re-derive these on any
re-sync that changes the component set:

- **Not every component takes `lang`.** `TopicProgressList` and
  `DocumentStimulus` take no `lang` prop; they call `useExplainLang()`, which
  reads `<html data-explain-lang>` and falls back to `'en'`. The first draft told
  the design agent that no React component reads that attribute, which would have
  left those two silently pinned to English with no way to change them. Check the
  prop list, not the general rule.
- **`DocumentStimulus` is not an item renderer.** It takes `document` and nothing
  else — no `item`, no `lang`, no `onResult`. The first draft listed it as the
  eighth member of the uniform runner contract, which would have made a
  type-driven runner omit `document` and crash. Seven renderers share the
  contract; the stimulus is composed above them.

## Known render warns

None. The final run was 20/20 clean with `bad`, `thin` and `variantsIdentical`
all zero — any warn on a future run is new and should be looked at.

## Re-sync

```sh
cp -r <skill-base-dir>/{package-build.mjs,package-validate.mjs,package-capture.mjs,resync.mjs,lib,storybook} .ds-sync/
cd .ds-sync && npm i esbuild ts-morph @types/react @tailwindcss/cli && PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i playwright@1.60.0 && cd ..
node .design-sync/dts-props.mjs                 # only if component props changed
.ds-sync/node_modules/.bin/tailwindcss -i .design-sync/tailwind-entry.css -o .design-sync/.cache/compiled.css
# fetch the project's _ds_sync.json → .design-sync/.cache/remote-sync.json first
node .ds-sync/resync.mjs --config .design-sync/config.json --node-modules ./node_modules \
  --entry .design-sync/ds-entry.tsx --out ./ds-bundle --remote .design-sync/.cache/remote-sync.json
```

## Re-sync risks — what can go stale silently

- **The hand-written `dtsPropsFor` does not track the source.** If someone changes
  a synced component's props, nothing fails: the build still succeeds and the
  design agent codes against a contract that is now a lie. There is no check for
  this. Re-read the component sources named in `componentSrcMap` on any re-sync
  that follows app changes.
- **Preview data is a copy, not a reference.** The items inlined in
  `.design-sync/previews/*.tsx` were copied from `content/exercises/a2/`. If those
  YAML files are edited, the cards keep showing the old wording.
- **The inlined `DocumentStimulus` SVG is a copy** of
  `public/documents/a2/reisen-zugausfall.svg` and will not track edits to it.
- **`conventions.md` names real classes and components** — every one was verified
  against the built artifacts on 2026-07-22. If components are added or removed
  from the scope, re-run that validation rather than trusting the file.
- **`_preview/` and the bundle assume `window.React`** from `_vendor/`; React 19
  is bundled by esbuild because it ships no UMD build. A React major bump in the
  app changes the vendor files.
- Only the **20 scoped components** were ever verified. Nothing is known about how
  the other 25 would behave if someone widens the scope.
