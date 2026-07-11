import {
  masteryGaps,
  topicCompletion,
  topicSetIds,
  type TopicContext,
  type TopicNode,
} from '../../lib/mastery';
import { TierBadge } from '../topic/TierBadge';
import { useExplainLang } from '../hooks';

function Seg({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      lang="de"
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
        on
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200'
          : 'bg-stone-100 text-stone-400 dark:bg-stone-700 dark:text-stone-500'
      }`}
    >
      {on ? '✓ ' : ''}
      {label}
    </span>
  );
}

export function TopicProgressList({ nodes, ctx }: { nodes: TopicNode[]; ctx: TopicContext }) {
  const lang = useExplainLang();
  const rows = [...nodes].sort(
    (a, b) => a.level.localeCompare(b.level) || a.title_de.localeCompare(b.title_de, 'de'),
  );

  return (
    <div>
      <h2 className="text-sm font-semibold text-stone-600 dark:text-stone-300">
        {lang === 'ru' ? 'Прогресс по темам' : 'Progress by topic'}
      </h2>
      <ul className="mt-3">
        {rows.map((n) => {
          const done = topicCompletion(n, ctx);
          const setIds = new Set(topicSetIds(n));
          const exAttempts = ctx.attempts.filter((a) => setIds.has(a.setId)).length;
          const read = !!ctx.topics[n.id]?.readAt;
          const cardsReviewed = Object.keys(ctx.cards).filter(
            (k) => n.vocabIds.some((v) => k.startsWith(`${v}::`)) && (ctx.cards[k]?.reps ?? 0) > 0,
          ).length;
          // Practice must span ≥2 days to count as mastered — without this chip a row
          // could show all-green next to a "Geübt" badge and look like a bug.
          const spaced = masteryGaps(n, ctx).find((g) => g.req === 'days')?.met ?? false;
          return (
            <li
              key={n.id}
              className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-stone-100 py-2 dark:border-stone-700"
            >
              <a
                href={n.path}
                lang="de"
                className="font-medium text-stone-800 hover:text-amber-700 dark:text-stone-100 dark:hover:text-amber-400"
              >
                {n.title_de}
              </a>
              <span className="text-xs text-stone-400">{n.level}</span>
              <div className="ml-auto flex items-center gap-1.5">
                <Seg on={read} label="Gelesen" />
                <Seg on={exAttempts > 0} label="Geübt" />
                <Seg on={spaced} label="2 Tage" />
                {n.vocabIds.length > 0 && <Seg on={cardsReviewed > 0} label="Vokabeln" />}
                <TierBadge tier={done.tier} manual={!!done.manual} className="ml-1" />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
