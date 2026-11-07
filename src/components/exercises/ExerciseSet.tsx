import { useState, type ReactElement } from 'react';
import {
  DEFAULT_MAX_REPLAYS,
  type ExerciseItem,
  type ExerciseSet as ExerciseSetData,
  type VisualDocument,
} from '@da/schema';
import type { RecordingScript } from '../../lib/audio';
import { logAttemptDurably } from '../../lib/write-journal';
import { attemptScore, formatScore } from '../../lib/scoring';
import { clearResume, loadResume, saveResume } from '../../lib/resume';
import { pick, type ExplainLang } from '../../lib/prefs';
import { t } from '../../lib/strings';
import { useExplainLang, useUiLang } from '../hooks';
import { Cloze } from './Cloze';
import { Listen } from './Listen';
import { Match } from './Match';
import { MultipleChoice } from './MultipleChoice';
import { Order } from './Order';
import { TableFill } from './TableFill';
import { FormFill } from './FormFill';
import { Translate } from './Translate';
import { Write } from './Write';
import { Speak } from './Speak';
import { AudioComprehension } from './AudioComprehension';
import { RecordingPlayer } from './RecordingPlayer';
import { ACTION_BUTTON, type ItemResult } from './shared';
import { focusForAttempt, responseModeForItem } from '../../lib/evidence';
import DocumentStimulus from './DocumentStimulus';
import type { Teil } from '../../lib/exam-practice';

interface Props {
  setId: string;
  set: ExerciseSetData;
  document?: VisualDocument;
  documents?: Record<string, VisualDocument>;
  /**
   * The script of the set's `recording`, when the set is a task set: one shared panel, one play
   * budget, and the transcript only once every item is answered.
   */
  recording?: RecordingScript;
  /** The exam Teile the items fall into; the progress dots are then grouped by Teil. */
  teile?: readonly Teil[] | null;
}

/** Explanation-language strings — one hoisted record per file (docs/adrs/0005-explanation-languages.md). */
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
  recording: {
    en: 'One recording for every task in this set',
    ru: 'Одна запись для всех заданий этого блока',
  },
  readFirstHint: {
    en: 'Read the questions before you listen. They stay next to the recording while you answer, so you know what to listen for.',
    ru: 'Прочитайте вопросы, прежде чем слушать. Пока вы отвечаете, они остаются рядом с записью, и вы заранее знаете, что нужно услышать.',
    uk: 'Прочитайте запитання, перш ніж слухати. Поки ви відповідаєте, вони лишаються поруч із записом, тож ви наперед знаєте, що треба почути.',
    de: 'Lesen Sie die Fragen, bevor Sie hören. Beim Antworten bleiben sie neben der Aufnahme.',
  },
  listeningQuestions: {
    en: 'The listening questions',
    ru: 'Вопросы к записи',
    uk: 'Запитання до запису',
    de: 'Die Fragen zum Hörtext',
  },
} as const satisfies Record<string, { en: string; ru: string; uk?: string; de?: string }>;

/** The line under the listening questions that announces the set's remaining items. */
function laterTasks(lang: ExplainLang, n: number): string {
  if (lang === 'ru') {
    const form = new Intl.PluralRules('ru').select(n);
    const noun = form === 'one' ? 'задание' : form === 'few' ? 'задания' : 'заданий';
    return `Затем — ещё ${n} ${noun} на языковой материал сцены.`;
  }
  if (lang === 'uk') {
    const form = new Intl.PluralRules('uk').select(n);
    const noun = form === 'many' ? 'завдань' : 'завдання';
    return `Далі — ще ${n} ${noun} на мовний матеріал сцени.`;
  }
  if (lang === 'de')
    return `Danach ${n} ${n === 1 ? 'Aufgabe' : 'Aufgaben'} zur Sprache der Szene.`;
  return `Then ${n} ${n === 1 ? 'task' : 'tasks'} on the language of the scene.`;
}

interface Answered {
  itemId: string;
  correct: boolean;
  /** attemptScore of the answer — parts-weighted for multi-part items */
  score: number;
  evidence?: 'verified' | 'practice';
}

interface ItemProps {
  item: ExerciseItem;
  lang: ExplainLang;
  onResult: (r: ItemResult) => void;
  locked: boolean;
  onNext: () => void;
  nextLabel: string;
  storageKey?: string;
  /** the set recording of the task set the item belongs to (see `AudioComprehension`) */
  recording?: RecordingScript;
  /** the set renders that recording once, beside the item, so the item renders no player */
  sharedRecording?: boolean;
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
  recording,
  sharedRecording,
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
    case 'form':
      return <FormFill item={item} {...props} />;
    case 'translate':
      return <Translate item={item} {...props} />;
    case 'listen':
      return <Listen item={item} {...props} />;
    case 'write':
      return <Write item={item} storageKey={storageKey ?? item.id} {...props} />;
    case 'speak':
      return <Speak item={item} {...props} />;
    case 'audio-comprehension':
      return (
        <AudioComprehension
          item={item}
          recording={recording}
          sharedRecording={sharedRecording}
          {...props}
        />
      );
  }
}

export default function ExerciseSet({
  setId,
  set,
  document,
  documents = {},
  recording,
  teile,
}: Props) {
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
  // A task set opens on its listening questions, as the exam does; a resumed run is past them.
  const [started, setStarted] = useState(answered.length > 0);

  const finished = index >= items.length;
  const item = items[index];
  const itemDocument = item?.stimulus ? documents[item.stimulus] : undefined;
  const activeDocument = itemDocument ?? document;
  // A task set's one stimulus: the player keeps its play budget across items because it is
  // mounted once, beside them, and is remounted only by a fresh round.
  const sharedRecording = set.recording && recording ? recording : undefined;
  /** The questions the recording answers, with their place in the set (the rest are on its language). */
  const listening = sharedRecording
    ? items.flatMap((it, i) =>
        it.type === 'audio-comprehension' ? [{ id: it.id, question: it.question, at: i }] : [],
      )
    : [];
  const laterCount = items.length - listening.length;
  const readingFirst = listening.length > 0 && !started && !finished;

  // Every slot below keeps its position whether the questions are being read first or answered,
  // so starting the items never remounts the player: a play already running keeps playing, and
  // reading the list costs no play.
  const recordingPanel = sharedRecording && (
    <section
      key={`recording-${round}`}
      className="rounded-lg border border-stone-300 bg-stone-50 p-3 dark:border-stone-600 dark:bg-stone-900/50"
      aria-label={pick(lang, UI.recording)}
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
        {pick(lang, UI.recording)}
      </p>
      {readingFirst && (
        <div className="mb-3">
          <h3 lang="de" className="text-base font-semibold text-stone-800 dark:text-stone-100">
            {t('exercise.readTasksFirst', uiLang)}
          </h3>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            {pick(lang, UI.readFirstHint)}
          </p>
        </div>
      )}
      {readingFirst && (
        <ol aria-label={pick(lang, UI.listeningQuestions)} className="mb-4 space-y-2">
          {listening.map((q) => (
            <li key={q.id} className="flex min-w-0 gap-2">
              <span className="shrink-0 font-semibold tabular-nums text-stone-400">
                {q.at + 1}.
              </span>
              <span lang="de" className="min-w-0 font-medium">
                {q.question}
              </span>
            </li>
          ))}
        </ol>
      )}
      <RecordingPlayer
        script={sharedRecording}
        maxReplays={set.max_replays ?? DEFAULT_MAX_REPLAYS}
        revealed={answered.length >= items.length}
        lang={lang}
      />
      {!readingFirst && listening.length > 0 && (
        <ol
          aria-label={pick(lang, UI.listeningQuestions)}
          className="-mt-1 mb-1 space-y-0.5 text-sm"
        >
          {listening.map((q) => {
            const a = answered[q.at];
            const current = !finished && q.at === index;
            return (
              <li
                key={q.id}
                aria-current={current ? 'step' : undefined}
                className={`flex min-w-0 gap-2 rounded px-2 py-1 ${
                  current
                    ? 'bg-amber-100 text-stone-900 dark:bg-amber-900/40 dark:text-stone-100'
                    : a
                      ? 'text-stone-400 dark:text-stone-500'
                      : 'text-stone-600 dark:text-stone-300'
                }`}
              >
                <span className="shrink-0 font-semibold tabular-nums">{q.at + 1}.</span>
                <span
                  lang="de"
                  className={`min-w-0 flex-1 ${current ? '' : 'truncate lg:whitespace-normal'}`}
                >
                  {q.question}
                </span>
                {a && (
                  <span
                    aria-hidden="true"
                    className={`shrink-0 ${a.correct ? 'text-green-600' : 'text-red-500'}`}
                  >
                    {a.correct ? '✓' : '✗'}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {readingFirst && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setStarted(true)}
            className={`${ACTION_BUTTON} bg-stone-800 text-white hover:bg-stone-700 dark:bg-stone-200 dark:text-stone-900 dark:hover:bg-stone-300`}
          >
            {t('exercise.toFirstTask', uiLang)}
          </button>
          {laterCount > 0 && (
            <p className="text-sm text-stone-500 dark:text-stone-400">
              {laterTasks(lang, laterCount)}
            </p>
          )}
        </div>
      )}
    </section>
  );

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
    void logAttemptDurably({
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
      focusEvidence: result.focusEvidence,
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
    setStarted(false);
    setRound((r) => r + 1);
  }

  if (finished) {
    const verified = answered.filter((a) => a.evidence !== 'practice');
    const score = verified.reduce((s, a) => s + a.score, 0);
    const pct = verified.length ? Math.round((score / verified.length) * 100) : 0;
    return (
      <div className="flex flex-col gap-4">
        {recordingPanel}
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
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-800 sm:p-6">
      <div className="mb-4 flex min-w-0 items-start justify-between gap-3">
        {set.title && (
          <p className="min-w-0 text-sm font-semibold text-stone-600 dark:text-stone-300">
            {pick(lang, set.title)}
          </p>
        )}
        <div
          className={`ml-auto flex max-w-[45%] flex-wrap items-center justify-end ${teile ? 'gap-x-3 gap-y-1' : 'gap-1'}`}
          aria-label="progress"
        >
          {(teile ?? [{ teil: 0, von: 0, bis: items.length }]).map((gruppe) => (
            <span
              key={`${gruppe.teil}-${gruppe.von}`}
              className="flex flex-wrap items-center gap-1"
              title={teile ? `Teil ${gruppe.teil}` : undefined}
            >
              {teile && (
                <span lang="de" className="text-[0.65rem] font-semibold text-stone-400">
                  T{gruppe.teil}
                </span>
              )}
              {items.slice(gruppe.von, gruppe.bis).map((it, offset) => {
                const i = gruppe.von + offset;
                const a = answered[i];
                return (
                  <span
                    key={`${round}-${it.id}`}
                    className={`h-2 w-2 rounded-full ${
                      a
                        ? a.correct
                          ? 'bg-green-500'
                          : 'bg-red-400'
                        : i === index
                          ? 'bg-amber-500'
                          : 'bg-stone-300 dark:bg-stone-600'
                    }`}
                  />
                );
              })}
            </span>
          ))}
        </div>
      </div>

      {item && (
        <div
          className={
            (activeDocument || recordingPanel) && !readingFirst
              ? 'grid gap-5 lg:grid-cols-[minmax(18rem,0.85fr)_1.15fr]'
              : ''
          }
        >
          {(activeDocument || recordingPanel) && (
            // min-w-0: a grid item is otherwise as wide as its longest unbroken line, and the
            // questions under the player are truncated on one line each below lg.
            <div className="min-w-0 lg:sticky lg:top-4 lg:self-start">
              {recordingPanel || <DocumentStimulus document={activeDocument!} />}
            </div>
          )}
          {!readingFirst && (
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
              sharedRecording={sharedRecording !== undefined}
            />
          )}
        </div>
      )}
    </div>
  );
}
