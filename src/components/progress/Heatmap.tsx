import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  dailyActivity,
  activeDateSet,
  currentStreak,
  mondayOf,
  addDays,
  parseLocalDate,
} from '../../lib/trends';
import {
  localDateString,
  type Attempt,
  type CardStates,
  type SessionLogEntry,
} from '../../lib/store';
import { pick, type ExplainLang } from '../../lib/prefs';
import { useExplainLang } from '../hooks';

/** Explanation-language strings — one hoisted record per file (docs/adrs/0005-explanation-languages.md). */
const UI = {
  title: { en: 'Activity', ru: 'Активность' },
  dayStreak: { en: 'day streak', ru: 'дн. подряд' },
  exercises: { en: 'exercises', ru: 'упр.' },
  cards: { en: 'cards', ru: 'карт.' },
  gridLabel: {
    en: 'Activity by day — arrow keys move between days',
    ru: 'Активность по дням — стрелки переходят между днями',
    uk: 'Активність за днями — стрілки переходять між днями',
    de: 'Aktivität nach Tagen — mit den Pfeiltasten von Tag zu Tag',
  },
} as const satisfies Record<string, { en: string; ru: string; uk?: string; de?: string }>;

/** The day a square stands for, in the reader's language: "Mon, 3 November 2026". */
function heatmapDateLabel(date: string, lang: ExplainLang): string {
  return parseLocalDate(date).toLocaleDateString(lang, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

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
  for (
    let w = 0, cursor = start;
    w < WEEKS && cursor <= mondayToday;
    w++, cursor = addDays(cursor, 7)
  ) {
    const col: string[] = [];
    for (let d = 0; d < 7; d++) col.push(localDateString(addDays(cursor, d)));
    weeks.push(col);
  }

  // One tab stop for the whole grid (roving tabindex): today's square, or the one last moved to.
  // The caption under the grid shows the hovered or focused day for sighted users; a screen
  // reader hears the same text as the square's label.
  const past = weeks.flat().filter((date) => date <= todayStr);
  const [focused, setFocused] = useState<string>();
  const [shown, setShown] = useState<string>();
  const cells = useRef(new Map<string, HTMLDivElement>());
  const tabStop = focused && past.includes(focused) ? focused : past[past.length - 1];

  const label = (date: string) => {
    const day = map.get(date);
    return `${heatmapDateLabel(date, lang)}: ${day?.attempts ?? 0} ${pick(lang, UI.exercises)}, ${Math.max(day?.reviewed ?? 0, day?.cardReviews ?? 0)} ${pick(lang, UI.cards)}`;
  };

  function move(e: KeyboardEvent<HTMLDivElement>, date: string) {
    const step = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 }[e.key];
    const at = past.indexOf(date);
    let next: string | undefined;
    if (step !== undefined) next = past[at + step];
    else if (e.key === 'Home') next = past[0];
    else if (e.key === 'End') next = past[past.length - 1];
    else return;
    e.preventDefault();
    if (!next) return;
    setFocused(next);
    cells.current.get(next)?.focus();
  }

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-stone-600 dark:text-stone-300">
          {pick(lang, UI.title)}
        </h2>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          🔥 <span className="font-semibold tabular-nums">{streak}</span> {pick(lang, UI.dayStreak)}
        </p>
      </div>
      <div className="-mx-1 mt-2 overflow-x-auto p-1">
        <div
          className="flex gap-1"
          role="group"
          aria-label={pick(lang, UI.gridLabel)}
          onMouseLeave={() => setShown(focused)}
        >
          {weeks.map((col, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              {col.map((date) => {
                const day = map.get(date);
                if (date > todayStr)
                  return <div key={date} aria-hidden="true" className="h-3 w-3 rounded-sm" />;
                const text = label(date);
                return (
                  <div
                    key={date}
                    ref={(el) => {
                      if (el) cells.current.set(date, el);
                      else cells.current.delete(date);
                    }}
                    role="img"
                    aria-label={text}
                    title={text}
                    tabIndex={date === tabStop ? 0 : -1}
                    onKeyDown={(e) => move(e, date)}
                    onFocus={() => {
                      setFocused(date);
                      setShown(date);
                    }}
                    onBlur={() => setShown(undefined)}
                    onMouseEnter={() => setShown(date)}
                    className={`h-3 w-3 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${intensity(day?.total ?? 0)} ${
                      date === shown ? 'ring-1 ring-stone-500 dark:ring-stone-300' : ''
                    }`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <p
        aria-hidden="true"
        className="mt-1 min-h-4 text-xs text-stone-500 tabular-nums dark:text-stone-400"
      >
        {shown ? label(shown) : ''}
      </p>
    </div>
  );
}
