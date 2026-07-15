import { useState, type ReactElement } from 'react';
import type { ExerciseItem, ExerciseSet as ExerciseSetData, VisualDocument } from '../../lib/schemas';
import { logAttempt } from '../../lib/store';
import { attemptScore, formatScore } from '../../lib/scoring';
import { clearResume, loadResume, saveResume } from '../../lib/resume';
import { pick } from '../../lib/prefs';
import { t } from '../../lib/strings';
import { useExplainLang, useUiLang } from '../hooks';
import { Cloze } from './Cloze';
import { Listen } from './Listen';
import { Match } from './Match';
import { MultipleChoice } from './MultipleChoice';
import { Order } from './Order';
import { TableFill } from './TableFill';
import { Translate } from './Translate';
import { Write } from './Write';
import { Speak } from './Speak';
import { AudioComprehension } from './AudioComprehension';
import type { ItemResult } from './shared';
import { focusForAttempt, responseModeForItem } from '../../lib/evidence';
import DocumentStimulus from './DocumentStimulus';

interface Props {
  setId: string;
  set: ExerciseSetData;
  document?: VisualDocument;
}

/** Explanation-language strings — one hoisted record per file (docs/i18n-design.md). */
const UI = {
  practiceSaved: {
    en: 'Practice saved; there is no automatic score.',
    ru: 'Практика сохранена; автоматической оценки нет.',
  },
  scoreHigh: { en: 'Great — this topic is sinking in.', ru: 'Отлично! Тема усваивается.' },
  scoreLow: {
    en: 'Worth re-reading the article and trying again.',
    ru: 'Стоит повторить материал и попробовать ещё раз.',
  },
  tryAgain: { en: 'Try again', ru: 'Ещё раз' },
  results: { en: 'Results', ru: 'Результат' },
} as const satisfies Record<string, { en: string; ru: string }>;

interface Answered {
  itemId: string;
  correct: boolean;
  /** attemptScore of the answer — parts-weighted for multi-part items */
  score: number;
  evidence?: 'verified' | 'practice';
}

interface ItemProps {
  item: ExerciseItem;
  lang: 'en' | 'ru';
  onResult: (r: ItemResult) => void;
  locked: boolean;
  onNext: () => void;
  nextLabel: string;
  storageKey?: string;
}

/**
 * Renders a single exercise item of any type and reports the learner's answer.
 *
 * Exported for reuse outside ExerciseSet (e.g. a mixed-training page):
 * - `item` — any ExerciseItem from the content schema (discriminated by `type`).
 * - `instanceKey` — the item's identity; see below.
 * - `lang` — explanation language, usually obtained via useExplainLang().
 * - `onResult` — called exactly once when the learner submits, with
 *   `{ correct, given }` (`given` = the answer serialized for the attempt log).
 *   Persistence is the caller's job — ItemView does not log attempts itself.
 * - `locked` — set true after submission to freeze the item's inputs.
 * - `onNext` / `nextLabel` — the advance action. The item renders it itself, in the
 *   same slot as its Prüfen button, so checking an answer never moves the button.
 *
 * An item keeps its answer in local state (the typed value, the `checked` flag), and a
 * remount is the ONLY thing that clears it. `instanceKey` is that remount: it must be
 * unique per item *and* change when the same item is presented afresh — which is what
 * ExerciseSet's `round` counter is for. ItemView applies it as the React key on the item
 * itself, so the requirement is a **type error** rather than a convention a caller can
 * quietly skip. One did: ProbeStep advanced with no key, so the next probe opened holding
 * the previous answer, already graded against the new item's answer key — and being
 * `checked`, it could not be answered at all and never reported a result.
 */
export function ItemView({
  instanceKey,
  ...props
}: ItemProps & { instanceKey: string }): ReactElement {
  return <ItemBody key={instanceKey} {...props} />;
}

function ItemBody({
  item,
  lang,
  onResult,
  locked,
  onNext,
  nextLabel,
  storageKey,
  // explicit return type so a forgotten case fails the type check
}: ItemProps): ReactElement {
  const props = { lang, onResult, locked, onNext, nextLabel };
  switch (item.type) {
    case 'mc':
      return <MultipleChoice item={item} {...props} />;
    case 'cloze':
      return <Cloze item={item} {...props} />;
    case 'match':
      return <Match item={item} {...props} />;
    case 'order':
      return <Order item={item} {...props} />;
    case 'table':
      return <TableFill item={item} {...props} />;
    case 'translate':
      return <Translate item={item} {...props} />;
    case 'listen':
      return <Listen item={item} {...props} />;
    case 'write':
      return <Write item={item} storageKey={storageKey ?? item.id} {...props} />;
    case 'speak':
      return <Speak item={item} {...props} />;
    case 'audio-comprehension':
      return <AudioComprehension item={item} {...props} />;
  }
}

export default function ExerciseSet({ setId, set, document }: Props) {
  const lang = useExplainLang();
  const uiLang = useUiLang();
  const items = set.items;
  const resumeSurface = `exset:${setId}`;
  // Resume today's run at the first unanswered item (a reload — mobile tab
  // discard, navigation — would otherwise restart the set from scratch).
  const [answered, setAnswered] = useState<Answered[]>(() => {
    const saved = loadResume<{ answered: Answered[] }>(resumeSurface);
    if (!saved || !Array.isArray(saved.answered) || saved.answered.length > items.length) return [];
    // stale if the set's items changed since the state was saved (or pre-score shape)
    if (!saved.answered.every((a, i) => a.itemId === items[i]?.id && typeof a.score === 'number'))
      return [];
    return saved.answered;
  });
  const [index, setIndex] = useState(answered.length);
  const [currentDone, setCurrentDone] = useState(false);
  const [round, setRound] = useState(0);

  const finished = index >= items.length;
  const item = items[index];

  function handleResult(result: ItemResult) {
    if (!item) return;
    setCurrentDone(true);
    const next = [
      ...answered,
      {
        itemId: item.id,
        correct: result.correct,
        score: attemptScore(result),
        evidence: result.evidence,
      },
    ];
    setAnswered(next);
    saveResume(resumeSurface, { answered: next });
    void logAttempt({
      setId,
      itemId: item.id,
      itemType: item.type,
      itemRevision: item.revision,
      correct: result.correct,
      ...(result.totalParts !== undefined
        ? { correctParts: result.correctParts, totalParts: result.totalParts }
        : {}),
      given: result.given,
      focus: focusForAttempt(item, result),
      evidence: result.evidence,
      responseMode: result.responseMode ?? responseModeForItem(item),
      outcomes: item.outcomes,
      practice: result.practice,
      ts: Date.now(),
    });
  }

  function next() {
    setIndex((i) => i + 1);
    setCurrentDone(false);
  }

  function restart() {
    clearResume(resumeSurface);
    setIndex(0);
    setAnswered([]);
    setCurrentDone(false);
    setRound((r) => r + 1);
  }

  if (finished) {
    const verified = answered.filter((a) => a.evidence !== 'practice');
    const score = verified.reduce((s, a) => s + a.score, 0);
    const pct = verified.length ? Math.round((score / verified.length) * 100) : 0;
    return (
      <div className="rounded-lg border border-stone-200 bg-white p-4 text-center dark:border-stone-700 dark:bg-stone-800 sm:p-6">
        <p className="text-3xl font-bold">
          {formatScore(score, lang)} / {verified.length}
        </p>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          {verified.length === 0
            ? pick(lang, UI.practiceSaved)
            : pct >= 80
            ? pick(lang, UI.scoreHigh)
            : pick(lang, UI.scoreLow)}
        </p>
        <button
          type="button"
          onClick={restart}
          className="mt-4 min-h-11 rounded-md bg-amber-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 sm:min-h-0"
        >
          {pick(lang, UI.tryAgain)}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-800 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        {set.title && (
          <p className="text-sm font-semibold text-stone-600 dark:text-stone-300">
            {pick(lang, set.title)}
          </p>
        )}
        <div className="ml-auto flex items-center gap-1" aria-label="progress">
          {items.map((it, i) => {
            const a = answered[i];
            return (
              <span
                key={`${round}-${it.id}`}
                className={`h-2 w-2 rounded-full ${
                  a ? (a.correct ? 'bg-green-500' : 'bg-red-400') : i === index ? 'bg-amber-500' : 'bg-stone-300 dark:bg-stone-600'
                }`}
              />
            );
          })}
        </div>
      </div>

      {item && <div className={document ? 'grid gap-5 lg:grid-cols-[minmax(18rem,0.85fr)_1.15fr]' : ''}>
        {document && <div className="lg:sticky lg:top-4 lg:self-start"><DocumentStimulus document={document} /></div>}
        <ItemView
          instanceKey={`${round}-${item.id}`}
          item={item}
          lang={lang}
          onResult={handleResult}
          locked={currentDone}
          onNext={next}
          nextLabel={
            index + 1 < items.length ? t('action.next', uiLang) : pick(lang, UI.results)
          }
          storageKey={`${setId}::${item.id}`}
        />
      </div>}
    </div>
  );
}
