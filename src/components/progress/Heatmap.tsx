import { useMemo } from 'react';
import { dailyActivity, activeDateSet, currentStreak, mondayOf, addDays, parseLocalDate } from '../../lib/trends';
import { localDateString, type Attempt, type CardStates, type SessionLogEntry } from '../../lib/store';
import { pick } from '../../lib/prefs';
import { useExplainLang } from '../hooks';

/** Explanation-language strings — one hoisted record per file (docs/adrs/0001-bilingual-explanation-halves.md). */
const UI = {
  title: { en: 'Activity', ru: 'Активность' },
  dayStreak: { en: 'day streak', ru: 'дн. подряд' },
  exercises: { en: 'exercises', ru: 'упр.' },
  cards: { en: 'cards', ru: 'карт.' },
} as const satisfies Record<string, { en: string; ru: string }>;

const WEEKS = 13;

function intensity(total: number): string {
  // The surrounding card is dark:bg-stone-800 — an empty cell painted the same
  // color was indistinguishable from the card background, not "no activity".
  // One step lighter than the card keeps it subtle but visible.
  if (total <= 0) return 'bg-stone-100 dark:bg-stone-700';
  if (total <= 2) return 'bg-emerald-200 dark:bg-emerald-900';
  if (total <= 5) return 'bg-emerald-300 dark:bg-emerald-800';
  if (total <= 10) return 'bg-emerald-400 dark:bg-emerald-600';
  return 'bg-emerald-500 dark:bg-emerald-400';
}

export function Heatmap({
  attempts,
  sessions,
  cards = {},
}: {
  attempts: Attempt[];
  sessions: SessionLogEntry[];
  cards?: CardStates;
}) {
  const lang = useExplainLang();
  const map = useMemo(() => dailyActivity(attempts, sessions, cards), [attempts, sessions, cards]);
  const streak = useMemo(() => currentStreak(activeDateSet(map)), [map]);

  const today = new Date();
  const todayStr = localDateString(today);
  const defaultStart = addDays(mondayOf(today), -(WEEKS - 1) * 7);
  // Never render weeks before the learner's own history — months of empty cells
  // before they existed is noise, not context. Clamped the other way too: a long
  // history never grows the grid past WEEKS weeks. No activity at all leaves
  // nothing to clamp against, so the fixed WEEKS-week window is unchanged.
  let earliestActive: string | undefined;
  for (const [date, day] of map) {
    if (day.total > 0 && (!earliestActive || date < earliestActive)) earliestActive = date;
  }
  const earliestMonday = earliestActive ? mondayOf(parseLocalDate(earliestActive)) : undefined;
  const start = earliestMonday && earliestMonday > defaultStart ? earliestMonday : defaultStart;

  const mondayToday = mondayOf(today);
  const weeks: string[][] = [];
  for (let w = 0, cursor = start; w < WEEKS && cursor <= mondayToday; w++, cursor = addDays(cursor, 7)) {
    const col: string[] = [];
    for (let d = 0; d < 7; d++) col.push(localDateString(addDays(cursor, d)));
    weeks.push(col);
  }

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-stone-600 dark:text-stone-300">
          {pick(lang, UI.title)}
        </h2>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          🔥{' '}
          <span className="font-semibold tabular-nums">{streak}</span>{' '}
          {pick(lang, UI.dayStreak)}
        </p>
      </div>
      <div className="mt-3 overflow-x-auto">
        <div className="flex gap-1">
          {weeks.map((col, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              {col.map((date) => {
                const day = map.get(date);
                const future = date > todayStr;
                const cls = future ? 'bg-transparent' : intensity(day?.total ?? 0);
                const title = future
                  ? ''
                  : `${date}: ${day?.attempts ?? 0} ${pick(lang, UI.exercises)}, ${Math.max(day?.reviewed ?? 0, day?.cardReviews ?? 0)} ${pick(lang, UI.cards)}`;
                return <div key={date} title={title} className={`h-3 w-3 rounded-sm ${cls}`} />;
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
