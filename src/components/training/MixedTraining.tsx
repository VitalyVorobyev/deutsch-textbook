import { useEffect, useState } from 'react';
import type { ExerciseItem, Level } from '../../lib/schemas';
import { getAttempts, logAttempt } from '../../lib/store';
import { weakFocuses } from '../../lib/weakness';
import { withBase } from '../../lib/url';
import { shuffle } from '../../lib/shuffle';
import { useExplainLang } from '../hooks';
import { ItemView } from '../exercises/ExerciseSet';
import type { ItemResult } from '../exercises/shared';

/** One exercise set flattened for training, with its owning topic's metadata. */
export interface TrainingSet {
  /** exercise set id, e.g. "a2/perfekt-haben-sein" — attempts are logged under this */
  setId: string;
  topicId: string;
  /** German title of the owning topic */
  title_de: string;
  level: Level;
  items: ExerciseItem[];
}

interface SessionItem {
  /** `${setId}::${itemId}` — matches how attempts are keyed for priority lookup */
  uid: string;
  setId: string;
  topicId: string;
  title_de: string;
  level: Level;
  item: ExerciseItem;
}

const SESSION_SIZE = 15;

/**
 * Builds an interleaved session from all items across all sets.
 *
 * Priority bands (filled in order until `count`):
 *   1. items whose most recent attempt was wrong,
 *   2. items whose `focus` tag is currently weak (per weakFocuses over the
 *      whole attempt log) and that are not already in band 1,
 *   3. items never attempted,
 *   4. the rest, least-recently-attempted first.
 * Bands 1–3 are shuffled; band 4 keeps its recency ordering.
 * Afterwards adjacency is repaired so no two consecutive items share a set
 * (best effort — impossible if one set dominates the selection).
 */
async function buildSession(sets: TrainingSet[], count: number): Promise<SessionItem[]> {
  const attempts = await getAttempts();

  // most recent attempt per item
  const lastAttempt = new Map<string, { correct: boolean; ts: number }>();
  for (const a of attempts) {
    const key = `${a.setId}::${a.itemId}`;
    const prev = lastAttempt.get(key);
    if (!prev || a.ts >= prev.ts) lastAttempt.set(key, { correct: a.correct, ts: a.ts });
  }

  const weak = new Set(weakFocuses(attempts).map((w) => w.focus));

  const pool: SessionItem[] = sets.flatMap((s) =>
    s.items.map((item) => ({
      uid: `${s.setId}::${item.id}`,
      setId: s.setId,
      topicId: s.topicId,
      title_de: s.title_de,
      level: s.level,
      item,
    })),
  );

  const lastWrong: SessionItem[] = [];
  const weakFocus: SessionItem[] = [];
  const untried: SessionItem[] = [];
  const seen: { entry: SessionItem; ts: number }[] = [];
  for (const p of pool) {
    const a = lastAttempt.get(p.uid);
    if (a && !a.correct) lastWrong.push(p);
    else if (p.item.focus && weak.has(p.item.focus)) weakFocus.push(p);
    else if (!a) untried.push(p);
    else seen.push({ entry: p, ts: a.ts });
  }

  const ordered = [
    ...shuffle(lastWrong),
    ...shuffle(weakFocus),
    ...shuffle(untried),
    ...seen.sort((a, b) => a.ts - b.ts).map((s) => s.entry),
  ].slice(0, count);

  return repairAdjacency(ordered);
}

/**
 * Swaps items until no two consecutive entries come from the same set
 * (or no swap improves things anymore). Each accepted swap strictly
 * reduces the number of adjacent same-set pairs, so this terminates.
 */
function repairAdjacency(items: SessionItem[]): SessionItem[] {
  const out = [...items];
  const conflicts = (arr: readonly SessionItem[]): number => {
    let n = 0;
    for (let i = 1; i < arr.length; i++) if (arr[i]!.setId === arr[i - 1]!.setId) n++;
    return n;
  };

  let current = conflicts(out);
  let improved = true;
  while (current > 0 && improved) {
    improved = false;
    outer: for (let i = 1; i < out.length; i++) {
      if (out[i]!.setId !== out[i - 1]!.setId) continue;
      for (let j = 0; j < out.length; j++) {
        if (j === i) continue;
        [out[i], out[j]] = [out[j]!, out[i]!];
        const c = conflicts(out);
        if (c < current) {
          current = c;
          improved = true;
          break outer;
        }
        [out[i], out[j]] = [out[j]!, out[i]!]; // revert
      }
    }
  }
  return out;
}

interface Answered {
  uid: string;
  correct: boolean;
}

interface MixedTrainingProps {
  sets: TrainingSet[];
  /** number of items per session */
  count?: number;
  /** when provided, the end screen shows a "Weiter →" button that calls this
      (instead of the standalone "Nochmal" restart) with the actual counts */
  onFinished?: (result: { answered: number; correct: number }) => void;
}

export default function MixedTraining({ sets, count = SESSION_SIZE, onFinished }: MixedTrainingProps) {
  const lang = useExplainLang();
  const [session, setSession] = useState<SessionItem[] | null>(null);
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState<Answered[]>([]);
  const [currentDone, setCurrentDone] = useState(false);
  const [round, setRound] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void buildSession(sets, count).then((s) => {
      if (!cancelled) setSession(s);
    });
    return () => {
      cancelled = true;
    };
  }, [sets, count, round]);

  function handleResult(result: ItemResult) {
    const entry = session?.[index];
    if (!entry) return;
    setCurrentDone(true);
    setAnswered((a) => [...a, { uid: entry.uid, correct: result.correct }]);
    void logAttempt({
      setId: entry.setId,
      itemId: entry.item.id,
      itemType: entry.item.type,
      correct: result.correct,
      given: result.given,
      focus: entry.item.focus,
      ts: Date.now(),
    });
  }

  function next() {
    setIndex((i) => i + 1);
    setCurrentDone(false);
  }

  function restart() {
    setSession(null);
    setIndex(0);
    setAnswered([]);
    setCurrentDone(false);
    setRound((r) => r + 1);
  }

  if (!session) {
    return (
      <p className="text-sm text-stone-500 dark:text-stone-400">
        {lang === 'ru' ? 'Собираем тренировку…' : 'Building your session…'}
      </p>
    );
  }

  if (session.length === 0) {
    return (
      <p className="text-sm text-stone-500 dark:text-stone-400">
        {lang === 'ru' ? 'Пока нет упражнений для тренировки.' : 'No exercises to train with yet.'}
      </p>
    );
  }

  const finished = index >= session.length;

  if (finished) {
    const correct = answered.filter((a) => a.correct).length;

    // per-topic breakdown, in first-appearance order
    const byTopic = new Map<string, { title_de: string; level: Level; correct: number; total: number }>();
    answered.forEach((a, i) => {
      const entry = session[i];
      if (!entry) return;
      const row = byTopic.get(entry.topicId) ?? {
        title_de: entry.title_de,
        level: entry.level,
        correct: 0,
        total: 0,
      };
      row.total += 1;
      if (a.correct) row.correct += 1;
      byTopic.set(entry.topicId, row);
    });

    return (
      <div className="rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-800 sm:p-6">
        <p className="text-center text-3xl font-bold">
          {correct} / {session.length}
        </p>
        <p className="mt-1 text-center text-sm text-stone-500 dark:text-stone-400">
          {lang === 'ru' ? 'Результат по темам:' : 'Breakdown by topic:'}
        </p>
        <ul className="mx-auto mt-4 max-w-md divide-y divide-stone-100 text-sm dark:divide-stone-700">
          {[...byTopic.entries()].map(([topicId, row]) => (
            <li key={topicId} className="flex items-center gap-2 py-2">
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                {row.level}
              </span>
              <a
                href={withBase(`/topics/${topicId}`)}
                lang="de"
                className="truncate font-medium text-stone-700 hover:underline dark:text-stone-200"
              >
                {row.title_de}
              </a>
              <span
                className={`ml-auto font-semibold tabular-nums ${
                  row.correct === row.total
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-stone-600 dark:text-stone-300'
                }`}
              >
                {row.correct} / {row.total}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-5 text-center">
          {onFinished ? (
            <button
              type="button"
              onClick={() => onFinished({ answered: answered.length, correct })}
              className="min-h-11 rounded-md bg-amber-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 sm:min-h-0"
            >
              Weiter →
            </button>
          ) : (
            <button
              type="button"
              onClick={restart}
              className="min-h-11 rounded-md bg-amber-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 sm:min-h-0"
            >
              Nochmal
            </button>
          )}
        </div>
      </div>
    );
  }

  const entry = session[index];

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-800 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        {entry && (
          <p className="flex min-w-0 items-center gap-2 text-sm">
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-900 dark:text-amber-200">
              {entry.level}
            </span>
            <span lang="de" className="truncate font-semibold text-stone-600 dark:text-stone-300">
              {entry.title_de}
            </span>
          </p>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1" aria-label="progress">
          {session.map((s, i) => {
            const a = answered[i];
            return (
              <span
                key={`${round}-${s.uid}`}
                className={`h-2 w-2 rounded-full ${
                  a ? (a.correct ? 'bg-green-500' : 'bg-red-400') : i === index ? 'bg-amber-500' : 'bg-stone-300 dark:bg-stone-600'
                }`}
              />
            );
          })}
        </div>
      </div>

      {entry && (
        <ItemView
          key={`${round}-${entry.uid}`}
          item={entry.item}
          lang={lang}
          onResult={handleResult}
          locked={currentDone}
        />
      )}

      {currentDone && (
        <div className="mt-4 text-right">
          <button
            type="button"
            onClick={next}
            className="min-h-11 rounded-md bg-stone-800 px-4 py-1.5 text-sm font-semibold text-white hover:bg-stone-700 sm:min-h-0 dark:bg-stone-200 dark:text-stone-900 dark:hover:bg-stone-300"
          >
            {index + 1 < session.length ? 'Weiter →' : lang === 'ru' ? 'Результат' : 'Results'}
          </button>
        </div>
      )}
    </div>
  );
}
