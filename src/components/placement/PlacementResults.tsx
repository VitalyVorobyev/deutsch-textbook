import { useCallback, useEffect, useState } from 'react';
import { placementResults, type PlacementTopicResult } from '../../lib/placement';
import type { CheckpointItemRef } from '../../lib/checkpoint';
import {
  ATTEMPT_EVENT,
  getAttempts,
  getCardStates,
  getTopicsState,
  setTopicPlacement,
  type Attempt,
} from '../../lib/store';
import { levelPathDone, type TopicContext, type TopicNode } from '../../lib/mastery';
import { barColor } from '../../lib/bars';
import { pick } from '../../lib/prefs';
import { t } from '../../lib/strings';
import { useExplainLang, useUiLang } from '../hooks';

interface Props {
  setId: string;
  level: string;
  items: CheckpointItemRef[];
  /** outcome id → topic id, from content/atlas.yaml */
  outcomeTopics: Record<string, string>;
  /** topic id → its German title, for the result rows */
  topicTitles: Record<string, string>;
  /** every topic of this level — needed to ask levelPathDone whether the level is behind them */
  nodes: TopicNode[];
  /** where to go once the result is applied */
  nextPath: string;
  /** the next level's placement test, if one exists; offered only once this level is done */
  nextLevel?: { level: string; path: string };
}

/** Explanation-language strings — one hoisted record per file (docs/i18n-design.md). */
const UI = {
  heading: { en: 'Your result', ru: 'Ваш результат' },
  lead: {
    en: 'Answer every task, then apply the result. Topics you pass leave the recommended path — you can still open and practice them any time.',
    ru: 'Ответьте на все задания, затем примените результат. Пройденные темы уходят с рекомендованного пути — открыть и порешать их можно в любой момент.',
  },
  willPlace: {
    en: '{n} of {total} topics would be marked as known. The rest stay on your path.',
    ru: 'Тем будет зачтено: {n} из {total}. Остальные останутся на вашем пути.',
  },
  none: {
    en: 'No topic reached the pass mark yet — that is useful information, not failure. Every {level} lesson stays on your path.',
    ru: 'Пока ни одна тема не набрала проходной балл — это полезная информация, а не провал. Все уроки уровня {level} остаются на вашем пути.',
  },
  incomplete: {
    en: '{n} task(s) still unanswered. A topic is only marked as known once all of its tasks are answered.',
    ru: 'Осталось заданий без ответа: {n}. Тема засчитывается, только когда отвечены все её задания.',
  },
  appliedNote: {
    en: 'Applied. Your path now starts at the first topic you did not place out of.',
    ru: 'Применено. Ваш путь теперь начинается с первой темы, которую вы не сдали.',
  },
  toPath: { en: 'To my path →', ru: 'К моему пути →' },
  nextLevel: {
    en: 'You placed out of every {level} topic. Continue with the {next} placement test →',
    ru: 'Вы сдали все темы уровня {level}. Продолжить тестом уровня {next} →',
  },
  passed: { en: 'known', ru: 'зачтено' },
  stays: { en: 'stays on your path', ru: 'остаётся на пути' },
} as const satisfies Record<string, { en: string; ru: string }>;

function TopicRow({ row, title }: { row: PlacementTopicResult; title: string }) {
  const lang = useExplainLang();
  const pct = Math.round(row.ratio * 100);
  return (
    <li className="text-sm">
      <div className="flex items-baseline justify-between gap-3">
        <span lang="de" className="text-stone-700 dark:text-stone-200">
          {title}
        </span>
        <span className="shrink-0 tabular-nums text-xs text-stone-400">
          {pct}% · {row.placed ? pick(lang, UI.passed) : pick(lang, UI.stays)}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-700">
        <div className={`h-full ${barColor(row.ratio)}`} style={{ width: `${pct}%` }} />
      </div>
    </li>
  );
}

/**
 * The placement test's own results panel, rendered under the test on /einstufung/<level>.
 *
 * Two deliberate properties:
 *
 *  - **Nothing is written until the learner presses "Ergebnis übernehmen".** Rewriting the
 *    recommended path the instant the last answer lands would be a side effect the learner
 *    never asked for and cannot see coming; an instrument that quietly rearranges the
 *    course underneath you is one you stop trusting. The panel shows what *would* change
 *    first, and only the button changes it.
 *  - It re-reads on `da:attempt` because the exercise set is a separate island and cannot
 *    hand state across.
 */
export default function PlacementResults({
  setId,
  level,
  items,
  outcomeTopics,
  topicTitles,
  nodes,
  nextPath,
  nextLevel,
}: Props) {
  const lang = useExplainLang();
  const uiLang = useUiLang();
  const [ctx, setCtx] = useState<TopicContext>({ attempts: [], cards: {}, topics: {} });
  const [busy, setBusy] = useState(false);

  // Returns the promise so `apply` can await it, but keeps the setState inside the `.then`
  // callback — the same shape every other island here uses, and what the effect rule wants.
  const reload = useCallback(
    () =>
      Promise.all([getAttempts(), getCardStates(), getTopicsState()]).then(
        ([attempts, cards, topics]) => setCtx({ attempts, cards, topics }),
      ),
    [],
  );

  useEffect(() => {
    void reload();
    const onAttempt = () => void reload();
    window.addEventListener(ATTEMPT_EVENT, onAttempt);
    return () => window.removeEventListener(ATTEMPT_EVENT, onAttempt);
  }, [reload]);

  const summary = placementResults(items, ctx.attempts as Attempt[], setId, level, outcomeTopics);
  if (!summary) return null;

  const passing = summary.topics.filter((row) => row.placed);
  const unanswered = summary.total - summary.answered;
  // `levelPathDone`, not "every row placed": it is the same predicate the checkpoint gate
  // uses, so the two surfaces cannot disagree about whether a level is behind the learner —
  // and it correctly counts topics already finished through lessons, not only placed ones.
  const levelDone = levelPathDone(level, nodes, ctx);

  // What applying would actually change, mirroring setTopicPlacement's own monotone rule.
  //
  // Derived every render rather than latched in a flag, and that is the point: a learner who
  // placed 6 of 10, went away and studied, then retook the test now passes topics they failed
  // the first time. A sticky "already applied" flag would hide the button and strand exactly
  // the result they came back for — which would also make setTopicPlacement's higher-score-wins
  // rule unreachable from the only screen that calls it.
  const pending = passing.filter((row) => {
    const previous = ctx.topics[row.topicId]?.placement;
    return !previous || previous.score < row.ratio;
  });
  const alreadyApplied = summary.topics.some(
    (row) => ctx.topics[row.topicId]?.placement?.setId === setId,
  );

  async function apply() {
    setBusy(true);
    for (const row of pending) {
      await setTopicPlacement(row.topicId, { setId, score: row.ratio });
    }
    await reload(); // so levelPathDone and `pending` above see what was just written
    setBusy(false);
  }

  return (
    <section className="mt-8 rounded-lg border border-stone-200 bg-white p-6 dark:border-stone-700 dark:bg-stone-800">
      <h2 className="text-lg font-bold">{pick(lang, UI.heading)}</h2>
      <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{pick(lang, UI.lead)}</p>

      <ul className="mt-5 space-y-3">
        {summary.topics.map((row) => (
          <TopicRow key={row.topicId} row={row} title={topicTitles[row.topicId] ?? row.topicId} />
        ))}
      </ul>

      <p className="mt-5 text-sm text-stone-600 dark:text-stone-300">
        {unanswered > 0
          ? pick(lang, UI.incomplete).replace('{n}', String(unanswered))
          : passing.length === 0
            ? pick(lang, UI.none).replace('{level}', level)
            : pick(lang, UI.willPlace)
                .replace('{n}', String(passing.length))
                .replace('{total}', String(summary.topics.length))}
      </p>

      {pending.length === 0 && alreadyApplied ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
            ✓ {pick(lang, UI.appliedNote)}
          </p>
          <a
            href={nextPath}
            className="inline-flex rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
          >
            {pick(lang, UI.toPath)}
          </a>
          {nextLevel && levelDone && (
            <p className="text-sm">
              <a
                href={nextLevel.path}
                className="font-medium text-amber-700 hover:underline dark:text-amber-400"
              >
                {pick(lang, UI.nextLevel)
                  .replace('{level}', level)
                  .replace('{next}', nextLevel.level)}
              </a>
            </p>
          )}
        </div>
      ) : (
        <button
          type="button"
          lang={uiLang}
          onClick={() => void apply()}
          disabled={busy || pending.length === 0}
          className="mt-4 inline-flex rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t('placement.apply', uiLang)}
        </button>
      )}
    </section>
  );
}
