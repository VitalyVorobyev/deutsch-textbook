import { useEffect, useMemo, useState } from 'react';
import type { AtlasGroup } from '../../lib/schemas';
import { topicEvidence, type Completion, type Tier, type TopicContext, type TopicEvidence } from '../../lib/mastery';
import { pick, type ExplainLang } from '../../lib/prefs';
import { t, type StringKey } from '../../lib/strings';
import { useUiLang } from '../hooks';
import { EvidenceChipRow } from '../topic/EvidenceChips';
import { TierBadge } from '../topic/TierBadge';
import { Filter, TopicDetail } from './TopicDetail';
import { foldableMasteredRun, overviewChips, type ActiveGoal, type CourseTopic, type CourseUnit, type LevelFilter, type StatusFilter } from './course';

/** Chrome keys for the per-tier next-action label (was `actionLabel` in course.ts). */
export const TIER_ACTION_KEYS: Record<Tier, StringKey> = {
  untouched: 'topics.actionStart',
  read: 'topics.actionContinue',
  practiced: 'topics.actionPractice',
  mastered: 'topics.actionReview',
};

interface Props {
  units: CourseUnit[];
  groups: AtlasGroup[];
  /** null until IndexedDB resolves — the chips render empty rather than jumping */
  ctx: TopicContext | null;
  completions: Map<string, Completion>;
  /** the recommended topic — marked ★ aktuell */
  nextId?: string;
  goal?: ActiveGoal;
  routeIds: Set<string>;
  query: string;
  lang: ExplainLang;
  onQuery: (value: string) => void;
  onSelect: (id: string) => void;
  onGoal: (id?: string) => Promise<void>;
}

const NO_EVIDENCE: TopicEvidence = {
  read: false, practiced: false, spaced: false, hasVocab: false, vocab: false,
};

const STATUSES: Array<readonly [StatusFilter, StringKey]> = [
  ['all', 'filter.all'], ['open', 'topics.statusOpen'], ['untouched', 'topics.statusNew'],
  ['read', 'topics.statusRead'], ['practiced', 'topics.statusPracticed'], ['mastered', 'topics.statusMastered'],
];

/** localStorage: 'folded' | 'expanded' — whether the leading mastered run of
    each level group is collapsed into its summary row. Default folded. */
const FOLD_KEY = 'da:topics-fold-mastered';

/**
 * Every topic of the course, in curriculum order, with the status the learner
 * has earned on it — the one place to answer "where am I, and what is left".
 * Expanding a row reveals how the topic hangs together with the others.
 *
 * Sections are levels, not units: content/atlas.yaml currently holds one topic
 * per unit, so a unit heading per row would double the page with pure chrome.
 * When a unit grows past a single topic, group `rows` by `unit` instead.
 */
export default function OverviewTable({
  units, groups, ctx, completions, nextId, goal, routeIds, query, lang, onQuery, onSelect, onGoal,
}: Props) {
  const uiLang = useUiLang();
  const [level, setLevel] = useState<LevelFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [expandedId, setExpandedId] = useState<string>();
  const [folded, setFolded] = useState(true);

  // localStorage is client-only; the island may render on the server first.
  // queueMicrotask defers the restore out of the effect body — the same idiom
  // CurriculumPath uses for the saved tab.
  useEffect(() => {
    const saved = localStorage.getItem(FOLD_KEY);
    queueMicrotask(() => {
      if (saved === 'expanded') setFolded(false);
    });
  }, []);

  function toggleFold() {
    const next = !folded;
    setFolded(next);
    localStorage.setItem(FOLD_KEY, next ? 'folded' : 'expanded');
  }

  // units.flatMap IS the spine (see getCurriculum) — deriving the order here
  // rather than taking a second `spine` prop keeps the numbering honest.
  const topics = useMemo(() => units.flatMap((unit) => unit.topics), [units]);
  const evidence = useMemo(
    () => new Map(topics.map((t) => [t.id, ctx ? topicEvidence(t, ctx) : NO_EVIDENCE])),
    [topics, ctx],
  );

  const q = query.trim().toLocaleLowerCase('de');
  const matches = (topic: CourseTopic) => {
    const tier = completions.get(topic.id)?.tier ?? 'untouched';
    if (level !== 'all' && topic.level !== level) return false;
    if (status === 'open' ? tier === 'mastered' : status !== 'all' && tier !== status) return false;
    return !q || `${topic.title_de} ${topic.title_en} ${topic.title_ru} ${topic.title_uk ?? ''}`.toLocaleLowerCase('de').includes(q);
  };

  const shown = topics.filter(matches);
  const mastered = topics.filter((t) => completions.get(t.id)?.tier === 'mastered').length;
  const levels = [...new Set(topics.map((t) => t.level))];
  // A search or a non-default filter means the learner asked for specific rows —
  // folding away part of the answer would make the result look incomplete.
  const foldActive = !q && level === 'all' && status === 'all';

  function toggle(topic: CourseTopic) {
    const open = expandedId === topic.id;
    setExpandedId(open ? undefined : topic.id);
    if (!open) onSelect(topic.id);
  }

  return <div className="mt-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-wrap items-center gap-4">
        <Filter label={t('filter.level', uiLang)} value={level} onChange={setLevel} options={[['all', t('filter.all', uiLang)], ['A1', 'A1'], ['A2', 'A2']]} />
        <Filter label={t('filter.status', uiLang)} value={status} onChange={setStatus} options={STATUSES.map(([id, key]) => [id, t(key, uiLang)] as const)} />
        <label className="text-sm font-medium text-stone-500">
          <span className="sr-only">{t('topics.search', uiLang)}</span>
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder={`${t('topics.search', uiLang)}…`}
            className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-stone-800 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100"
          />
        </label>
      </div>
      <p lang={uiLang} className="text-sm text-stone-500 dark:text-stone-400">
        {shown.length === topics.length
          ? t('topics.countAll', uiLang).replace('{n}', String(topics.length))
          : t('topics.countFiltered', uiLang).replace('{shown}', String(shown.length)).replace('{total}', String(topics.length))}
        {' · '}<strong className="font-semibold text-emerald-700 dark:text-emerald-400">{t('topics.masteredCount', uiLang).replace('{n}', String(mastered))}</strong>
      </p>
    </div>

    {shown.length === 0
      ? <p className="mt-8 text-stone-500">{t('topics.emptyFilter', uiLang)}</p>
      : <div className="mt-5 overflow-hidden rounded-xl border border-stone-200 dark:border-stone-700">
        {levels.map((lvl) => {
          const rows = shown.filter((t) => t.level === lvl);
          if (!rows.length) return null;
          const lvlMastered = topics.filter((t) => t.level === lvl && completions.get(t.id)?.tier === 'mastered').length;
          const lvlTotal = topics.filter((t) => t.level === lvl).length;
          const run = foldActive
            ? foldableMasteredRun(rows.map((t) => completions.get(t.id)?.tier ?? 'untouched'))
            : 0;
          const visibleRows = run > 0 && folded ? rows.slice(run) : rows;
          return <section key={lvl} aria-labelledby={`overview-${lvl}`}>
            <h2
              id={`overview-${lvl}`}
              lang={uiLang}
              className="flex items-baseline gap-2 border-b border-stone-200 bg-stone-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-stone-500 dark:border-stone-700 dark:bg-stone-900/60 dark:text-stone-400"
            >
              {lvl}
              <span className="font-normal normal-case tracking-normal text-stone-400">
                {t('topics.masteredOf', uiLang).replace('{done}', String(lvlMastered)).replace('{total}', String(lvlTotal))}
              </span>
            </h2>
            <ul>
              {/* The folded leading mastered run: one quiet summary row instead
                  of n badge-only ones. Row numbers stay true to curriculum
                  position — after a fold of 7 the first visible row shows 8. */}
              {run > 0 && <li className="border-t border-stone-200 bg-stone-50/80 first:border-t-0 dark:border-stone-700 dark:bg-stone-900/40">
                <button
                  type="button"
                  onClick={toggleFold}
                  aria-expanded={!folded}
                  lang={uiLang}
                  className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
                >
                  <span aria-hidden="true" className="w-6 shrink-0 text-right text-emerald-600 dark:text-emerald-400">✓</span>
                  <span className="font-medium text-emerald-700 dark:text-emerald-400">
                    {t('topics.masteredCount', uiLang).replace('{n}', String(run))}
                  </span>
                  <span className="font-semibold text-amber-700 hover:underline dark:text-amber-400">
                    — {t(folded ? 'topics.foldShow' : 'topics.foldHide', uiLang)}
                  </span>
                </button>
              </li>}
              {visibleRows.map((topic) => <Row
                key={topic.id}
                topic={topic}
                index={topics.indexOf(topic) + 1}
                topics={topics}
                groups={groups}
                completion={completions.get(topic.id)}
                evidence={evidence.get(topic.id) ?? NO_EVIDENCE}
                current={topic.id === nextId}
                isGoal={goal?.topicId === topic.id}
                onRoute={routeIds.has(topic.id)}
                expanded={expandedId === topic.id}
                lang={lang}
                onToggle={() => toggle(topic)}
                onGoal={onGoal}
              />)}
            </ul>
          </section>;
        })}
      </div>}
  </div>;
}

interface RowProps {
  topic: CourseTopic;
  index: number;
  topics: CourseTopic[];
  groups: AtlasGroup[];
  completion?: Completion;
  evidence: TopicEvidence;
  current: boolean;
  isGoal: boolean;
  onRoute: boolean;
  expanded: boolean;
  lang: ExplainLang;
  onToggle: () => void;
  onGoal: (id?: string) => Promise<void>;
}

function Row({ topic, index, topics, groups, completion, evidence, current, isGoal, onRoute, expanded, lang, onToggle, onGoal }: RowProps) {
  const uiLang = useUiLang();
  const tier = completion?.tier ?? 'untouched';
  // Per-tier chip filtering (overviewChips): mastered rows are badge-only,
  // practiced rows show only what is still open.
  const chips = overviewChips(tier, evidence);
  const panelId = `overview-panel-${topic.id}`;
  const tabId = `overview-row-${topic.id}`;
  return <li className={`border-t border-stone-200 first:border-t-0 dark:border-stone-700 ${current ? 'bg-amber-50/60 dark:bg-amber-950/20' : 'bg-white dark:bg-stone-800'}`}>
    {/* The action link is a sibling of the toggle, never nested inside it. */}
    {/* Column count must match the children below, or the last one wraps to its
        own grid row: title | badge | chips (md+) | action. A chipless row drops
        the md chip column with its child, or the action link would sit one gap
        short of the right edge. */}
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:grid sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:gap-x-4 ${chips.length > 0 ? 'md:grid-cols-[minmax(0,1fr)_auto_auto_auto]' : ''}`}>
      {/* On a phone the title owns its line — sharing it with the badge and the
          action link squeezed it down to "Prä…". Both wrap underneath instead. */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        id={tabId}
        className="flex w-full min-w-0 items-center gap-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 sm:w-auto sm:flex-1"
      >
        <span className="w-6 shrink-0 text-right text-xs tabular-nums text-stone-400">{index}</span>
        <span className="min-w-0">
          <span lang="de" className="flex items-center gap-1.5 font-medium">
            <span className="truncate">{topic.title_de}</span>
            {current && <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-900 dark:text-amber-200">{t('topics.current', uiLang)}</span>}
            {isGoal && <span className="shrink-0 rounded border border-amber-400 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">{t('topics.goal', uiLang)}</span>}
            {onRoute && !current && <span aria-hidden="true" className="shrink-0 text-amber-600">◆</span>}
          </span>
          <span className="block truncate text-xs text-stone-500 dark:text-stone-400">
            {pick(lang, { en: topic.title_en, ru: topic.title_ru, uk: topic.title_uk })}
          </span>
        </span>
        <span aria-hidden="true" className="ml-auto shrink-0 text-stone-400 sm:hidden">{expanded ? '−' : '+'}</span>
      </button>
      {/* No level column: the rows already sit under their level's heading. */}
      <TierBadge tier={tier} manual={completion?.manual === 'reopened'} />
      {/* Below md the chips would force the row to wrap awkwardly; the expanded
          panel repeats them, so nothing is lost — only relocated. */}
      <EvidenceChipRow chips={chips} className="hidden md:flex" />
      <a
        href={topic.path}
        lang={uiLang}
        className="shrink-0 whitespace-nowrap text-sm font-semibold text-amber-700 hover:underline focus-visible:outline-2 focus-visible:outline-amber-500 dark:text-amber-400"
      >
        {t(TIER_ACTION_KEYS[tier], uiLang)} →
      </a>
    </div>
    {expanded && <div
      id={panelId}
      role="region"
      aria-labelledby={tabId}
      className="border-t border-stone-100 bg-stone-50 py-4 dark:border-stone-700 dark:bg-stone-900/40"
    >
      <EvidenceChipRow chips={chips} className="flex-wrap px-5 pb-3 md:hidden" />
      <TopicDetail
        topic={topic}
        topics={topics}
        groups={groups}
        completion={completion}
        lang={lang}
        isGoal={isGoal}
        onGoal={onGoal}
        embedded
      />
    </div>}
  </li>;
}
