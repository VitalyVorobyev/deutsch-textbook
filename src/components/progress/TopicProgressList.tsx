import { topicCompletion, topicEvidence, type TopicContext, type TopicNode } from '../../lib/mastery';
import { pick } from '../../lib/prefs';
import { EvidenceChips } from '../topic/EvidenceChips';
import { SelfAssessedMark, TierBadge } from '../topic/TierBadge';
import { useExplainLang } from '../hooks';

/** Explanation-language strings — one hoisted record per file (docs/i18n-design.md). */
const UI = {
  title: { en: 'Progress by topic', ru: 'Прогресс по темам' },
} as const satisfies Record<string, { en: string; ru: string }>;

export function TopicProgressList({ nodes, ctx }: { nodes: TopicNode[]; ctx: TopicContext }) {
  const lang = useExplainLang();
  const rows = [...nodes].sort(
    (a, b) => a.level.localeCompare(b.level) || a.title_de.localeCompare(b.title_de, 'de'),
  );

  return (
    <div>
      <h2 className="text-sm font-semibold text-stone-600 dark:text-stone-300">
        {pick(lang, UI.title)}
      </h2>
      <ul className="mt-3">
        {rows.map((n) => {
          const done = topicCompletion(n, ctx);
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
                <EvidenceChips evidence={topicEvidence(n, ctx)} />
                <TierBadge tier={done.tier} manual={done.manual === 'reopened'} className="ml-1" />
                {done.manual === 'learned' && <SelfAssessedMark />}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
