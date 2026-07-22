# Deutsch-Atlas — how to build with these components

Deutsch-Atlas is a German-learning app for English- and Russian-speaking learners.
These 20 components are the presentational surface of it: the exercise item
renderers a learner answers, the badges that report measured progress, and the
primitives they compose from.

## Setup: there is none

**No provider, no theme wrapper, no context.** Every component here renders from
its props alone. Import from the bundle and render:

```jsx
import { TierBadge } from 'deutsch-atlas';
<TierBadge tier="mastered" />
```

Two globals affect appearance, both set on the root element, neither required:

- **Dark mode is `data-theme="dark"`** on `<html>` — *not* a `dark` class.
  `<html data-theme="dark">` switches every `dark:` utility below.
- `data-explain-lang` / `data-ui-lang` exist in the stylesheet but drive Astro
  markup only. **No React component here reads them.** Ignore them.

## The two languages, and which one is a prop

German is content; everything else is explanation. They are controlled
differently, and conflating them is the most likely mistake:

- **Explanation text is the `lang` prop**: `'en' | 'ru' | 'uk' | 'de'`. It picks
  which half of every bilingual field (`instruction`, `explain`, `translation`)
  renders. Pass it explicitly — there is no context fallback.
- **German content never switches.** Prompts, options, table cells and answers
  stay German under every `lang`.
- **Chrome is pinned German and is not configurable.** Buttons render *Prüfen*,
  *Weiter →*, *Richtig!*, *Leider falsch*; badges render *Neu*, *Gelesen*,
  *Geübt*, *Gemeistert*. This is deliberate immersion. **Do not translate these
  and do not look for a prop that changes them** — there isn't one.

Mark your own German text with `lang="de"` so it hyphenates and is spoken
correctly; the components already do this internally.

## Styling idiom: stock Tailwind v4 utilities

There is **no bespoke class vocabulary and no custom token layer** — no
`bg-surface-1`, no `--ds-*` variables. Style your own layout with ordinary
Tailwind utilities and stay inside the palette the components already use, or
your glue will not match them:

| Family | What it means here |
| --- | --- |
| `stone` | every surface, border and body text — `bg-stone-50`, `text-stone-800`, `border-stone-300`, and `dark:bg-stone-900` / `dark:text-stone-200` |
| `amber` | the primary action and the accent — `bg-amber-600` (Prüfen), `text-amber-700` (links, disclosure), `border-amber-400` (German example blockquotes) |
| `emerald` | earned evidence and mastery — `bg-emerald-100` / `text-emerald-700` |
| `sky` | the *read* tier — `bg-sky-100` / `text-sky-700` |
| `green` / `red` | answer verdicts only — `bg-green-50` / `bg-red-50`. Do not reuse them for status; that is `emerald` and `stone`. |

Type is the system sans stack (`--font-sans`); no brand font ships, so don't
reference one. For long-form article bodies there is one real class,
`.article-prose`, which applies the typographic scale and the amber-bordered
blockquote treatment used for German example sentences.

## Where the truth is

Read `styles.css` and its imports for the compiled utilities, and each
component's `<Name>.d.ts` and `<Name>.prompt.md` for its real contract. Two
sharp edges the types now spell out but that are easy to trip over:

- On `Order`, `Listen` and `Translate` items, **`accept` is required even when
  empty** (`accept: []`), and `Translate` also requires `key_tokens`. The schema
  defaults them, and the components dereference them while rendering, so
  omitting them throws.
- `Feedback`'s `correctAnswerLabel` is concatenated straight onto the answer —
  pass `"Partizip II: "`, not `"Partizip II"`.

## An idiomatic composition

All eight item renderers (`Cloze`, `MultipleChoice`, `Match`, `Order`,
`TableFill`, `Translate`, `Listen`, plus `DocumentStimulus`) share one contract,
so a runner swaps them freely:

```jsx
import { MultipleChoice } from 'deutsch-atlas';

<div className="mx-auto max-w-xl rounded-lg border border-stone-200 bg-white p-5 dark:border-stone-700 dark:bg-stone-800">
  <MultipleChoice
    item={{
      id: 'mc-nach-hause',
      type: 'mc',
      prompt: 'Ich ___ gestern nach Hause gegangen.',
      options: ['habe', 'bin', 'ist'],
      correct: 1,
      instruction: { en: 'Choose the correct auxiliary.', ru: 'Выберите правильный вспомогательный глагол.' },
      translation: { en: 'I went home yesterday.', ru: 'Вчера я пошёл домой.' },
    }}
    lang="en"
    locked={false}
    nextLabel="Weiter →"
    onResult={(r) => save(r)}
    onNext={() => advance()}
  />
</div>
```

`onResult` fires once on submit; the component owns its own answered state, so
don't try to drive it from outside. `locked` blocks submission but changes
nothing visually.
