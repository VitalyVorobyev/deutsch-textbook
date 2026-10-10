/**
 * Leben-in-Deutschland practice (ADR 0021): due questions first, then today's new ones in
 * teaching order (`planLidPractice`), or — in `fehler` mode — every question whose last answer
 * was wrong (`lidMistakes`).
 *
 * Every answer is learning evidence and is graded by FSRS into the `lid` store key: logged
 * optimistically through the journal (`logLidAnswerDurably`, never awaited before the UI moves
 * on — a stalled write is the PersistenceAlert's job, not a frozen button) and folded into the
 * island's own copy with `applyLidAnswer`. A question answered wrong comes round again a few
 * questions later in the same sitting, as a missed flashcard does.
 *
 * Calm and factual: counts, never points or streaks.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { LidOptionKey } from '@da/schema/lid';
import { applyLidAnswer, lidMistakes, planLidPractice, type LidAnswer, type LidState } from '../../lib/lid';
import { getLidState, withReadRetry } from '../../lib/store';
import { t } from '../../lib/strings';
import { withBase } from '../../lib/url';
import { hasSeenData, logLidAnswerDurably } from '../../lib/write-journal';
import { useUiLang } from '../hooks';
import ProgressLoadError from '../ProgressLoadError';
import LidQuestion from './LidQuestion';
import { CARD, PRIMARY_BUTTON, QUIET_BUTTON, lidText, readNewPerDay, revealTop, type LidEntry } from './shared';

/** A missed question re-enters this many places later — far enough not to be an echo. */
const REQUEUE_GAP = 4;

interface Props {
  entries: LidEntry[];
  bankVersion: string;
  pdfUrl: string;
  mode?: 'practice' | 'fehler';
  /** Shuffle source for the options, injectable so a test can pin an order. */
  rng?: () => number;
}

interface Planned {
  due: number;
  fresh: number;
}

export default function LidPractice({ entries, bankVersion, pdfUrl, mode = 'practice', rng }: Props) {
  const uiLang = useUiLang();
  const ids = useMemo(() => entries.map((entry) => entry.question.id), [entries]);
  const byId = useMemo(() => new Map(entries.map((entry) => [entry.question.id, entry])), [entries]);

  const [loadRound, setLoadRound] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [lid, setLid] = useState<LidState | null>(null);
  const [queue, setQueue] = useState<string[] | null>(null);
  const [planned, setPlanned] = useState<Planned>({ due: 0, fresh: 0 });
  // One presentation per shown question — the LidQuestion key, so a re-asked question is a new
  // presentation with a fresh option order rather than the old one with its answer still on it.
  const [presentation, setPresentation] = useState(0);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const [tally, setTally] = useState({ right: 0, wrong: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void withReadRetry(() => getLidState(), { surface: mode === 'fehler' ? 'leben/fehler' : 'leben/ueben' }).then(
      (state) => {
        if (cancelled) return;
        // This profile has saved LiD answers before, and the read says there are none: a stalled
        // store or the wrong database. Dealing from it would re-teach every question as new.
        if (state.answers.length === 0 && Object.keys(state.cards).length === 0 && hasSeenData('lid')) {
          setLoadError(true);
          return;
        }
        const plan =
          mode === 'fehler'
            ? lidMistakes(state, ids)
            : planLidPractice({ questionIds: ids, state, now: new Date(), newPerDay: readNewPerDay() });
        const due = plan.filter((id) => state.cards[id]).length;
        setLoadError(false);
        setLid(state);
        setQueue(plan);
        setPlanned({ due, fresh: plan.length - due });
      },
      () => {
        if (!cancelled) setLoadError(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [ids, mode, loadRound]);

  // After Weiter, bring the next question's top back into view if the explanation had
  // scrolled it away — the learner should never have to hunt for the question they are on.
  useEffect(() => {
    if (presentation > 0) revealTop(cardRef.current);
  }, [presentation]);

  if (loadError) {
    return (
      <ProgressLoadError
        onRetry={() => {
          setLoadError(false);
          setLoadRound((r) => r + 1);
        }}
      />
    );
  }
  if (queue === null || lid === null) return <p className="text-sm text-stone-500 dark:text-stone-400">…</p>;

  const answered = tally.right + tally.wrong;
  const current = queue[0] ? byId.get(queue[0]) : undefined;

  if (!current) {
    const mistakesLeft = lidMistakes(lid, ids).length;
    return (
      <div className={`${CARD} p-6`}>
        {answered > 0 ? (
          <>
            <p className="text-lg font-semibold">{t('lid.doneTitle', uiLang)}</p>
            <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
              {lidText('lid.doneCounts', uiLang, { n: answered, right: tally.right, wrong: tally.wrong })}
            </p>
          </>
        ) : (
          <p className="text-stone-600 dark:text-stone-300">
            {mode === 'fehler' ? t('lid.noMistakes', uiLang) : t('lid.nothingDue', uiLang)}
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          <a href={withBase('/leben/pruefung')} className={PRIMARY_BUTTON}>
            {t('lid.mock', uiLang)}
          </a>
          {mistakesLeft > 0 && mode !== 'fehler' && (
            <a href={withBase('/leben/fehler')} className={QUIET_BUTTON}>
              {t('lid.mistakes', uiLang)} ({mistakesLeft})
            </a>
          )}
          <a href={withBase('/leben')} className={QUIET_BUTTON}>
            {t('lid.toOverview', uiLang)}
          </a>
        </div>
      </div>
    );
  }

  function answer(chosen: LidOptionKey, correct: boolean) {
    const record: LidAnswer = {
      q: current!.question.id,
      chosen,
      correct,
      ts: Date.now(),
      mode: 'practice',
      bank: bankVersion,
    };
    // Optimistic: the journal holds the write from here on, so the screen never waits for it.
    void logLidAnswerDurably(record);
    setLid((state) => (state ? applyLidAnswer(state, record) : state));
    setTally((s) => (correct ? { ...s, right: s.right + 1 } : { ...s, wrong: s.wrong + 1 }));
    setLastCorrect(correct);
  }

  function next() {
    const missed = lastCorrect === false;
    setQueue((q) => {
      if (!q || q.length === 0) return q;
      const [head, ...rest] = q;
      if (!missed) return rest;
      const at = Math.min(REQUEUE_GAP, rest.length);
      return [...rest.slice(0, at), head!, ...rest.slice(at)];
    });
    setLastCorrect(null);
    setPresentation((p) => p + 1);
  }

  // Position counts completed presentations, so answering never moves it — only Weiter does.
  // A missed question re-asked later is one more presentation, and the total grows to say so.
  const total = presentation + queue.length;
  const isLast = queue.length === 1 && lastCorrect !== false;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm text-stone-500 dark:text-stone-400">
        <span>
          {mode === 'fehler'
            ? lidText('lid.mistakesQueue', uiLang, { n: planned.due + planned.fresh })
            : lidText('lid.queueCounts', uiLang, { due: planned.due, fresh: planned.fresh })}
        </span>
        <span className="tabular-nums">{lidText('lid.progress', uiLang, { k: presentation + 1, n: total })}</span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={presentation}
      >
        <div className="h-full bg-amber-500" style={{ width: `${(presentation / total) * 100}%` }} />
      </div>
      <div ref={cardRef} className={`${CARD} scroll-mt-32 p-4 sm:p-6`}>
        <LidQuestion
          key={presentation}
          mode="practice"
          entry={current}
          pdfUrl={pdfUrl}
          onAnswer={answer}
          onNext={next}
          nextLabel={isLast ? t('action.doneArrow', uiLang) : t('action.next', uiLang)}
          rng={rng}
        />
      </div>
    </div>
  );
}
