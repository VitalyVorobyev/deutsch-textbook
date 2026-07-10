import { useMemo } from 'react';
import { dailyActivity, activeDateSet, currentStreak, mondayOf, addDays } from '../../lib/trends';
import { localDateString, type Attempt, type CardStates, type SessionLogEntry } from '../../lib/store';
import { useExplainLang } from '../hooks';

const WEEKS = 13;

function intensity(total: number): string {
  if (total <= 0) return 'bg-stone-100 dark:bg-stone-800';
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
  const start = addDays(mondayOf(today), -(WEEKS - 1) * 7);
  const weeks: string[][] = [];
  for (let w = 0; w < WEEKS; w++) {
    const col: string[] = [];
    for (let d = 0; d < 7; d++) col.push(localDateString(addDays(start, w * 7 + d)));
    weeks.push(col);
  }

  const t = (en: string, ru: string) => (lang === 'ru' ? ru : en);

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-stone-600 dark:text-stone-300">
          {t('Activity', 'Активность')}
        </h2>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          🔥{' '}
          <span className="font-semibold tabular-nums">{streak}</span>{' '}
          {t(streak === 1 ? 'day streak' : 'day streak', 'дн. подряд')}
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
                  : `${date}: ${day?.attempts ?? 0} ${t('exercises', 'упр.')}, ${Math.max(day?.reviewed ?? 0, day?.cardReviews ?? 0)} ${t('cards', 'карт.')}`;
                return <div key={date} title={title} className={`h-3 w-3 rounded-sm ${cls}`} />;
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
