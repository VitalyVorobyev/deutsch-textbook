import { useEffect, useState } from 'react';
import type { Level } from '../../lib/schemas';
import { getAttempts, getCardStates, getTopicsState, logAttempt } from '../../lib/store';
import { attemptScore, formatScore } from '../../lib/scoring';
import { clearResume, loadResume, saveResume } from '../../lib/resume';
import { recommendedNext, type TopicNode } from '../../lib/mastery';
import {
  buildSession,
  eligibleTrainingSets,
  resumedQueueIsEligible,
  type SessionItem,
  type TrainingSet,
} from '../../lib/training';
import { withBase } from '../../lib/url';
import { useExplainLang } from '../hooks';
import { ItemView } from '../exercises/ExerciseSet';
import type { ItemResult } from '../exercises/shared';
import { focusForAttempt, responseModeForItem } from '../../lib/evidence';

// re-exported so the pages and SessionFlow keep importing it from here
export type { TrainingSet } from '../../lib/training';

const SESSION_SIZE = 15;

interface Answered {
  uid: string;
  correct: boolean;
  /** attemptScore of the answer — parts-weighted for multi-part items */
  score: number;
  evidence?: 'verified' | 'practice';
}

interface TrainingResume {
  /** the built queue, by item uid — restored instead of rebuilding, which
      would pick different items */
  uids: string[];
  answered: Answered[];
}

/** Rebuilds a saved session from item uids; null when any item is gone
    (content changed) or the saved shape is inconsistent — build fresh then. */
function restoreSession(
  sets: TrainingSet[],
  surface: string,
): { session: SessionItem[]; answered: Answered[] } | null {
  const saved = loadResume<TrainingResume>(surface);
  if (!saved || !Array.isArray(saved.uids) || !Array.isArray(saved.answered)) return null;
  // an empty queue must rebuild — eligibility may have changed since it was saved
  if (saved.uids.length === 0) return null;
  if (saved.answered.length > saved.uids.length) return null;
  if (!saved.answered.every((a, i) => a.uid === saved.uids[i] && typeof a.score === 'number'))
    return null;

  const byUid = new Map<string, SessionItem>();
  for (const s of sets) {
    for (const item of s.items) {
      byUid.set(`${s.setId}::${item.id}`, {
        uid: `${s.setId}::${item.id}`,
        setId: s.setId,
        topicId: s.topicId,
        title_de: s.title_de,
        level: s.level,
        item,
      });
    }
  }

  const session: SessionItem[] = [];
  for (const uid of saved.uids) {
    const entry = byUid.get(uid);
    if (!entry) return null;
    session.push(entry);
  }
  return { session, answered: saved.answered };
}

interface MixedTrainingProps {
  sets: TrainingSet[];
  /** topic ids in recommended-path order (getCurriculum().spine) */
  spine: string[];
  /** the topic graph — eligibility and the empty-state suggestion need it */
  nodes: TopicNode[];
  /** number of items per session */
  count?: number;
  /** when provided, the end screen shows a "Weiter →" button that calls this
      (instead of the standalone "Nochmal" restart) with the actual counts;
      `correct` is the parts-weighted score sum */
  onFinished?: (result: { answered: number; correct: number }) => void;
  /** called when the built session has no items (nothing eligible yet) —
      an empty session can never reach onFinished */
  onEmpty?: () => void;
  /** when provided, today's in-progress run is persisted under this key and
      resumed after a reload (mobile tab discard, navigation) */
  resumeKey?: string;
}

export default function MixedTraining({
  sets,
  spine,
  nodes,
  count = SESSION_SIZE,
  onFinished,
  onEmpty,
  resumeKey,
}: MixedTrainingProps) {
  const lang = useExplainLang();

  const surface = resumeKey ? `training:${resumeKey}` : null;
  // Only the initial mount may resume; the eligibility check below decides
  // whether the saved queue is still safe. An explicit restart always rebuilds.
  const [restored] = useState(() => (surface ? restoreSession(sets, surface) : null));

  // A saved queue is not rendered until its topics are revalidated against
  // the current profile state; old queues must not bypass eligibility changes.
  const [session, setSession] = useState<SessionItem[] | null>(null);
  const [suggestion, setSuggestion] = useState<TopicNode | null>(null);
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState<Answered[]>([]);
  const [currentDone, setCurrentDone] = useState(false);
  const [round, setRound] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([getAttempts(), getCardStates(), getTopicsState()]).then(
      ([attempts, cards, topics]) => {
        if (cancelled) return;
        const ctx = { attempts, cards, topics };
        const eligible = eligibleTrainingSets(sets, spine, nodes, ctx);
        if (round === 0 && restored) {
          if (resumedQueueIsEligible(restored.session, eligible)) {
            setSession(restored.session);
            setAnswered(restored.answered);
            setIndex(restored.answered.length);
            setSuggestion(recommendedNext(spine, nodes, ctx) ?? null);
            return;
          }
          if (surface) clearResume(surface);
        }
        const s = buildSession(eligible, count, attempts);
        setSession(s);
        setSuggestion(recommendedNext(spine, nodes, ctx) ?? null);
        if (surface && s.length > 0)
          saveResume<TrainingResume>(surface, { uids: s.map((x) => x.uid), answered: [] });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [sets, spine, nodes, count, round, surface, restored]);

  // an empty session can never finish by answering — let the owner advance
  const empty = session !== null && session.length === 0;
  useEffect(() => {
    if (empty) onEmpty?.();
  }, [empty, onEmpty]);

  function handleResult(result: ItemResult) {
    const entry = session?.[index];
    if (!entry || !session) return;
    setCurrentDone(true);
    const next = [
      ...answered,
      {
        uid: entry.uid,
        correct: result.correct,
        score: attemptScore(result),
        evidence: result.evidence,
      },
    ];
    setAnswered(next);
    if (surface) {
      saveResume<TrainingResume>(surface, { uids: session.map((s) => s.uid), answered: next });
    }
    void logAttempt({
      setId: entry.setId,
      itemId: entry.item.id,
      itemType: entry.item.type,
      correct: result.correct,
      ...(result.totalParts !== undefined
        ? { correctParts: result.correctParts, totalParts: result.totalParts }
        : {}),
      given: result.given,
      focus: focusForAttempt(entry.item, result),
      evidence: result.evidence,
      responseMode: result.responseMode ?? responseModeForItem(entry.item),
      outcomes: entry.item.outcomes,
      ts: Date.now(),
    });
  }

  function next() {
    setIndex((i) => i + 1);
    setCurrentDone(false);
  }

  function restart() {
    if (surface) clearResume(surface);
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
    // inside the guided session the owner auto-advances (onEmpty) — brief note only
    if (onFinished) {
      return (
        <p className="rounded-lg border border-stone-200 bg-white p-6 text-center text-sm text-stone-600 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300">
          <span lang="de">Noch keine Übungen — weiter zum nächsten Schritt …</span>
        </p>
      );
    }
    return (
      <div className="rounded-lg border border-stone-200 bg-white p-8 text-center dark:border-stone-700 dark:bg-stone-800">
        <p lang="de" className="font-semibold">
          Noch nichts zu üben
        </p>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          {lang === 'ru'
            ? 'Откройте тему и прочитайте статью — её упражнения появятся в тренировке.'
            : 'Open a topic and read its article — its exercises will show up in training.'}
        </p>
        {suggestion && (
          <a
            href={suggestion.path}
            className="mt-5 inline-block rounded-md bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-700"
          >
            <span lang="de">{suggestion.title_de}</span> · {suggestion.level}
          </a>
        )}
      </div>
    );
  }

  const finished = index >= session.length;

  if (finished) {
    const verified = answered.filter((a) => a.evidence !== 'practice');
    const score = verified.reduce((s, a) => s + a.score, 0);

    // per-topic breakdown, in first-appearance order
    const byTopic = new Map<
      string,
      { title_de: string; level: Level; score: number; allCorrect: boolean; total: number }
    >();
    answered.forEach((a, i) => {
      const entry = session[i];
      if (!entry) return;
      const row = byTopic.get(entry.topicId) ?? {
        title_de: entry.title_de,
        level: entry.level,
        score: 0,
        allCorrect: true,
        total: 0,
      };
      if (a.evidence !== 'practice') {
        row.total += 1;
        row.score += a.score;
        row.allCorrect &&= a.correct;
      }
      byTopic.set(entry.topicId, row);
    });

    return (
      <div className="rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-800 sm:p-6">
        <p className="text-center text-3xl font-bold">
          {formatScore(score, lang)} / {verified.length}
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
                  row.allCorrect
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-stone-600 dark:text-stone-300'
                }`}
              >
                {row.total > 0 ? `${formatScore(row.score, lang)} / ${row.total}` : lang === 'ru' ? 'практика' : 'practice'}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-5 text-center">
          {onFinished ? (
            <button
              type="button"
              onClick={() => {
                if (surface) clearResume(surface);
                onFinished({ answered: answered.length, correct: score });
              }}
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
          instanceKey={`${round}-${entry.uid}`}
          item={entry.item}
          lang={lang}
          onResult={handleResult}
          locked={currentDone}
          onNext={next}
          nextLabel={
            index + 1 < session.length ? 'Weiter →' : lang === 'ru' ? 'Результат' : 'Results'
          }
          storageKey={entry.uid}
        />
      )}
    </div>
  );
}
