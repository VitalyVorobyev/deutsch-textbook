import { useEffect, useMemo, useState } from 'react';
import type { AtlasGroup, CurriculumStrand } from '../../lib/schemas';
import {
  getAttempts, getCardStates, getLearningGoal, getTopicsState, setLearningGoal,
  type LearningGoal,
} from '../../lib/store';
import {
  goalRoute, levelRemaining, recommendedForGoal, recommendedNext, topicCompletion,
  type Completion, type TopicContext,
} from '../../lib/mastery';
import {
  blockedByEarlier, checkpointCovered, checkpointOutcomeResults, type CheckpointSummary,
} from '../../lib/checkpoint';
import { pick, type ExplainLang } from '../../lib/prefs';
import { t } from '../../lib/strings';
import { useExplainLang, useUiLang } from '../hooks';
import { TierBadge } from '../topic/TierBadge';
import { crossGroupDependencies, groupBreadcrumb, leafGroups } from '../../lib/atlas';
import { Filter, STRAND_KEYS, TopicDetail } from './TopicDetail';
import OverviewTable, { TIER_ACTION_KEYS } from './OverviewTable';
import {
  STRANDS, type ActiveGoal, type CourseTopic, type CourseUnit, type LevelFilter,
  type PathCheckpoint, type View,
} from './course';

export type { CourseTopic, CourseUnit, PathCheckpoint } from './course';

interface Props { units: CourseUnit[]; groups: AtlasGroup[]; spine: string[]; checkpoints?: PathCheckpoint[] }

const NO_CHECKPOINTS: PathCheckpoint[] = [];

const VIEWS = [['path', 'topics.tabPath'], ['atlas', 'topics.tabAtlas'], ['overview', 'topics.tabOverview']] as const;

/** Explanation-language strings — one hoisted record per file (docs/i18n-design.md).
    `{…}` placeholders are replaced by the caller. */
const UI = {
  checkpointResult: {
    en: 'Latest result: {pct}% · {answered}/{total} tasks · {when}',
    ru: 'Последний результат: {pct}% · задания: {answered}/{total} · {when}',
  },
  retake: { en: 'Retake →', ru: 'Ещё раз →' },
  blockedBy: {
    en: 'Take {title} first — the checkpoints come in order.',
    ru: 'Сначала пройдите «{title}» — контрольные точки идут по порядку.',
  },
  openAnyway: { en: 'Open anyway', ru: 'Всё равно открыть' },
  newTasks: {
    en: 'There are new tasks since your last attempt: {answered} of {total} done.',
    ru: 'С прошлой попытки здесь появились новые задания: выполнено {answered} из {total}.',
  },
  continueArrow: { en: 'Continue →', ru: 'Продолжить →' },
  allLessonsDone: {
    en: 'All {level} lessons done — measure what you can already do.',
    ru: 'Все уроки {level} пройдены — проверьте, что вы уже умеете.',
  },
} as const satisfies Record<string, { en: string; ru: string }>;

/** The tab id lived under a different name before the overview replaced the
    relations sidebar; a returning learner must not land on a tab that is gone. */
function savedView(value: string | null): View | undefined {
  const migrated = value === 'relations' ? 'overview' : value;
  return migrated === 'path' || migrated === 'atlas' || migrated === 'overview' ? migrated : undefined;
}

export default function CurriculumPath({ units, groups, spine, checkpoints = NO_CHECKPOINTS }: Props) {
  const lang = useExplainLang();
  const uiLang = useUiLang();
  const topics = useMemo(() => units.flatMap((unit) => unit.topics), [units]);
  const byId = useMemo(() => new Map(topics.map((topic) => [topic.id, topic])), [topics]);
  const [ctx, setCtx] = useState<TopicContext | null>(null);
  const [goal, setGoal] = useState<ActiveGoal>();
  const [view, setView] = useState<View>('atlas');
  const [level, setLevel] = useState<LevelFilter>('all');
  const [strand, setStrand] = useState<CurriculumStrand | 'all'>('all');
  const [selectedId, setSelectedId] = useState(spine[0] ?? '');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const saved = savedView(localStorage.getItem('da:topics-view'));
    queueMicrotask(() => {
      if (saved) setView(saved);
    });
    void Promise.all([getAttempts(), getCardStates(), getTopicsState(), getLearningGoal()]).then(
      ([attempts, cards, topicState, activeGoal]) => {
        setCtx({ attempts, cards, topics: topicState });
        if (activeGoal?.topicId && byId.has(activeGoal.topicId)) setGoal(activeGoal as ActiveGoal);
      },
    );
  }, [byId]);

  const completions = useMemo(() => new Map<string, Completion>(
    ctx ? topics.map((topic) => [topic.id, topicCompletion(topic, ctx)]) : [],
  ), [ctx, topics]);
  const normalNextNode = ctx ? recommendedNext(spine, topics, ctx) : topics[0];
  const goalNextNode = ctx && goal ? recommendedForGoal(goal.topicId, spine, topics, ctx) : undefined;
  const next = byId.get((goalNextNode ?? normalNextNode)?.id ?? '');
  const selected = byId.get(selectedId) ?? next ?? topics[0];
  const route = goal
    ? goalRoute(goal.topicId, spine, topics).map((node) => byId.get(node.id)).filter((node): node is CourseTopic => !!node)
    : [];
  const routeIds = new Set(route.map((topic) => topic.id));
  const checkpointCards = useMemo<CheckpointCardData[]>(() => {
    if (!ctx) return [];
    return checkpoints.map((checkpoint) => ({
      checkpoint,
      remaining: levelRemaining(checkpoint.level, topics, ctx),
      summary: checkpointOutcomeResults(checkpoint.items, ctx.attempts, checkpoint.setId),
      // Heute offers the lowest incomplete checkpoint (`dueCheckpoint`); the Lernpfad must
      // say the same thing, or the two screens disagree about what to do next. That means
      // asking `checkpointCovered` — the same rule `dueCheckpoint` asks — and not merely
      // whether a summary exists: a checkpoint that gained an item has a summary *and* is due.
      covered: checkpointCovered(checkpoint, ctx.attempts),
      blockedBy: blockedByEarlier(checkpoint, checkpoints, ctx),
    }));
  }, [checkpoints, ctx, topics]);

  async function chooseGoal(topicId?: string) {
    const persisted: LearningGoal = { ...(topicId ? { topicId } : {}), setAt: Date.now() };
    await setLearningGoal(persisted);
    setGoal(topicId ? persisted as ActiveGoal : undefined);
  }
  function changeView(value: View) {
    setView(value); localStorage.setItem('da:topics-view', value);
  }

  return <div>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-4 dark:border-stone-700">
      <div className="inline-flex rounded-md border border-stone-300 p-0.5 text-sm dark:border-stone-600" role="tablist" aria-label={t('topics.viewsAria', uiLang)}>
        {VIEWS.map(([id, key]) =>
          <button key={id} role="tab" aria-selected={view === id} onClick={() => changeView(id)} className={`rounded px-3 py-1.5 font-medium focus-visible:outline-2 focus-visible:outline-amber-500 ${view === id ? 'bg-stone-800 text-white dark:bg-stone-100 dark:text-stone-900' : 'text-stone-500 hover:text-stone-900 dark:hover:text-white'}`}>{t(key, uiLang)}</button>)}
      </div>
      {goal && <div className="flex items-center gap-2 text-sm"><span className="text-stone-500">{t('topics.goal', uiLang)}:</span><button onClick={() => { setSelectedId(goal.topicId); changeView('atlas'); }} className="font-semibold text-amber-700 hover:underline dark:text-amber-300">{byId.get(goal.topicId)?.title_de}</button><button onClick={() => void chooseGoal()} aria-label={t('topics.clearGoalAria', uiLang)} className="text-stone-400 hover:text-red-600">×</button></div>}
    </div>

    {view === 'path' && <PathView next={next} goal={goal} route={route} completions={completions} lang={lang} checkpointCards={checkpointCards} />}
    {view === 'atlas' && <AtlasView topics={topics} groups={groups} currentId={next?.id} selected={selected} goal={goal} routeIds={routeIds} completions={completions} level={level} strand={strand} lang={lang} onLevel={setLevel} onStrand={setStrand} onSelect={setSelectedId} onGoal={chooseGoal} />}
    {view === 'overview' && <OverviewTable units={units} groups={groups} ctx={ctx} completions={completions} nextId={next?.id} goal={goal} routeIds={routeIds} query={query} lang={lang} onQuery={setQuery} onSelect={setSelectedId} onGoal={chooseGoal} />}
  </div>;
}

interface CheckpointCardData { checkpoint: PathCheckpoint; remaining: number; summary: CheckpointSummary | null; covered: boolean; blockedBy?: PathCheckpoint }
function PathView({ next, goal, route, completions, lang, checkpointCards }: { next?: CourseTopic; goal?: ActiveGoal; route: CourseTopic[]; completions: Map<string, Completion>; lang: ExplainLang; checkpointCards: CheckpointCardData[] }) {
  const uiLang = useUiLang();
  const cards = checkpointCards.map((card) => <CheckpointCard key={card.checkpoint.setId} checkpoint={card.checkpoint} state={card} lang={lang} />);
  if (!next) return <div className="mt-8"><p className="text-stone-500">{t('topics.allMastered', uiLang)}</p>{cards}</div>;
  return <>
    <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
    <section className="border-l-4 border-amber-500 bg-amber-50 p-6 dark:bg-amber-950/25">
      <p className="text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300">{t('topics.nextStep', uiLang)} · {next.level}</p>
      <h2 className="mt-2 text-2xl font-bold">{next.title_de}</h2>
      <p className="mt-1 text-sm text-stone-500">{pick(lang, { en: next.title_en, ru: next.title_ru })}</p>
      {next.outcomes[0] && <p className="mt-4 text-sm text-stone-700 dark:text-stone-300">{pick(lang, next.outcomes[0])}</p>}
      <a href={next.path} className="mt-5 inline-flex rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">{t(TIER_ACTION_KEYS[completions.get(next.id)?.tier ?? 'untouched'], uiLang)} →</a>
    </section>
    <section className="rounded-lg border border-stone-200 bg-white p-5 dark:border-stone-700 dark:bg-stone-800">
      <h2 className="font-semibold">{goal ? t('topics.goalRouteTitle', uiLang) : t('topics.howPathTitle', uiLang)}</h2>
      {goal ? <ol className="mt-3 space-y-2">{route.map((topic, i) => <li key={topic.id} className="flex items-center gap-3 text-sm"><span className="w-5 text-right text-stone-400">{i + 1}</span><TierBadge tier={completions.get(topic.id)?.tier ?? 'untouched'} /><a href={topic.path} className="font-medium hover:text-amber-700">{topic.title_de}</a></li>)}</ol> : <p className="mt-2 text-sm text-stone-500">{t('topics.pathExplainer', uiLang)}</p>}
    </section>
    </div>
    {cards}
  </>;
}

function CheckpointCard({ checkpoint, state, lang }: { checkpoint: PathCheckpoint; state: CheckpointCardData; lang: ExplainLang }) {
  const uiLang = useUiLang();
  const { remaining, summary, covered, blockedBy } = state;
  if (summary && covered) {
    const pct = summary.total ? Math.round((summary.score / summary.total) * 100) : 0;
    const when = new Date(summary.lastTs).toLocaleDateString(lang);
    return <section className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-300 bg-emerald-50/60 p-5 dark:border-emerald-800 dark:bg-emerald-950/25">
      <div>
        <h2 className="font-semibold">{checkpoint.title} ✓</h2>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">{pick(lang, UI.checkpointResult).replace('{pct}', String(pct)).replace('{answered}', String(summary.answered)).replace('{total}', String(summary.total)).replace('{when}', when)}</p>
      </div>
      <a href={checkpoint.path} className="rounded-md border border-stone-300 px-3 py-2 text-sm font-semibold hover:border-amber-500 dark:border-stone-600">{pick(lang, UI.retake)}</a>
    </section>;
  }
  // Blocked/waiting is checked BEFORE the partial-attempt card below, and the order is the whole
  // point: `dueCheckpoint` offers the *lowest* incomplete checkpoint, so a half-finished A2 whose
  // A1 is still open is not what Heute is pointing at. Putting the actionable card first would
  // hand the learner a live "Continue →" for A2 while Heute sent them back to A1 — the very
  // cross-surface disagreement `blockedByEarlier` exists to prevent. (A *covered* checkpoint is
  // handled above and needs no gate: it is done, and saying so cannot mislead anyone.)
  if (remaining > 0 || blockedBy) {
    // The remaining-lessons line keeps its numeral logic inline: Russian needs three
    // plural forms where English needs two, so a flat `{n}` template cannot carry it.
    const waiting = remaining > 0
      ? pick(lang, {
          en: `${remaining} lesson${remaining === 1 ? '' : 's'} to go before the ${checkpoint.level} checkpoint.`,
          ru: `Ещё ${remaining} ${remaining === 1 ? 'урок' : remaining < 5 ? 'урока' : 'уроков'} до контрольной точки ${checkpoint.level}.`,
        })
      : pick(lang, UI.blockedBy).replace('{title}', blockedBy!.title);
    return <section className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-stone-300 p-5 dark:border-stone-600">
      <div>
        <h2 className="font-semibold text-stone-500 dark:text-stone-400">{checkpoint.title}</h2>
        <p className="mt-1 text-sm text-stone-500">{waiting}</p>
      </div>
      <a href={checkpoint.path} className="text-sm font-medium text-stone-400 hover:text-amber-700 hover:underline dark:hover:text-amber-300">{pick(lang, UI.openAnyway)}</a>
    </section>;
  }
  // Taken, but the set has grown since — and nothing earlier is blocking it, so this is exactly
  // what `dueCheckpoint` is offering on Heute. Say what is left rather than ticking it off.
  if (summary) {
    return <section className="mt-6 flex flex-wrap items-center justify-between gap-3 border-l-4 border-amber-500 bg-amber-50 p-5 dark:bg-amber-950/25">
      <div>
        <h2 className="font-semibold">{checkpoint.title}</h2>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">{pick(lang, UI.newTasks).replace('{answered}', String(summary.answered)).replace('{total}', String(summary.total))}</p>
      </div>
      <a href={checkpoint.path} className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">{pick(lang, UI.continueArrow)}</a>
    </section>;
  }
  return <section className="mt-6 flex flex-wrap items-center justify-between gap-3 border-l-4 border-amber-500 bg-amber-50 p-5 dark:bg-amber-950/25">
    <div>
      <h2 className="font-semibold">{checkpoint.title}</h2>
      <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">{pick(lang, UI.allLessonsDone).replace('{level}', checkpoint.level)}</p>
    </div>
    <a href={checkpoint.path} className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">{t('checkpoint.start', uiLang)}</a>
  </section>;
}

interface AtlasViewProps {
  topics: CourseTopic[]; groups: AtlasGroup[]; currentId?: string; selected: CourseTopic; goal?: ActiveGoal; routeIds: Set<string>;
  completions: Map<string, Completion>; level: LevelFilter; strand: CurriculumStrand | 'all'; lang: ExplainLang;
  onLevel: (value: LevelFilter) => void; onStrand: (value: CurriculumStrand | 'all') => void;
  onSelect: (id: string) => void; onGoal: (id?: string) => Promise<void>;
}
type DrawerState = 'closed' | 'collapsed' | 'open';
function AtlasView({ topics, groups, currentId, selected, goal, routeIds, completions, level, strand, lang, onLevel, onStrand, onSelect, onGoal }: AtlasViewProps) {
  const uiLang = useUiLang();
  const [expandedGroup, setExpandedGroup] = useState<string>();
  const [drawer, setDrawer] = useState<DrawerState>('closed');
  const leaves = leafGroups(groups);
  const groupById = new Map(groups.map((group) => [group.id, group]));
  const visibleTopic = (topic: CourseTopic) =>
    ((level === 'all' || topic.level === level) && (strand === 'all' || topic.strand === strand)) ||
    routeIds.has(topic.id) || topic.id === currentId;
  function selectTopic(topic: CourseTopic) {
    onSelect(topic.id);
    setExpandedGroup(topic.group);
    setDrawer('open');
  }
  return <div className="mt-6">
    <div className="flex flex-wrap gap-4">
      <Filter label={t('filter.level', uiLang)} value={level} onChange={onLevel} options={[['all', t('filter.all', uiLang)],['A1','A1'],['A2','A2']]} />
      <Filter label={t('filter.strand', uiLang)} value={strand} onChange={onStrand} options={[['all', t('filter.all', uiLang)], ...STRANDS.map((id) => [id, t(STRAND_KEYS[id], uiLang)] as const)]} />
    </div>
    <div className="mt-5 overflow-hidden rounded-xl border border-stone-200 bg-stone-50 dark:border-stone-700 dark:bg-stone-900/40">
      <div className="space-y-7 p-4 sm:p-6">
        {STRANDS.map((strandId) => {
          const strandGroups = leaves.filter((group) => group.strand === strandId).filter((group) => {
            const own = topics.filter((topic) => topic.group === group.id);
            return own.some(visibleTopic);
          });
          if (!strandGroups.length) return null;
          return <section key={strandId} aria-labelledby={`strand-${strandId}`}>
            <h2 id={`strand-${strandId}`} className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">{t(STRAND_KEYS[strandId], uiLang)}</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {strandGroups.map((group) => {
                const own = topics.filter((topic) => topic.group === group.id && visibleTopic(topic));
                const expanded = expandedGroup === group.id;
                const deps = crossGroupDependencies(group.id, topics);
                const route = own.some((topic) => routeIds.has(topic.id));
                const current = own.some((topic) => topic.id === currentId);
                const mastered = own.filter((topic) => completions.get(topic.id)?.tier === 'mastered').length;
                return <article key={group.id} className={`${expanded ? 'md:col-span-2 xl:col-span-3' : ''} rounded-lg border ${expanded ? 'border-amber-400 bg-white dark:border-amber-700 dark:bg-stone-800' : route || current ? 'border-amber-300 bg-white dark:border-amber-800 dark:bg-stone-800' : 'border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-800'}`}>
                  <button type="button" aria-expanded={expanded} onClick={() => setExpandedGroup(expanded ? undefined : group.id)} className="flex w-full items-start justify-between gap-3 p-4 text-left focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-amber-500">
                    <span><span className="block text-xs text-stone-400">{groupBreadcrumb(group.id, groups).map((part) => pick(lang, { en: part.title_en, ru: part.title_ru })).join(' › ')}</span><strong className="mt-1 block text-base">{group.title_de}</strong><span className="mt-2 block text-xs text-stone-500">{t('topics.masteredOf', uiLang).replace('{done}', String(mastered)).replace('{total}', String(own.length))}{deps.incoming.length ? ` · ${t(deps.incoming.length > 1 ? 'topics.prereqCountMany' : 'topics.prereqCountOne', uiLang).replace('{n}', String(deps.incoming.length))}` : ''}{deps.outgoing.length ? ` · ${t('topics.unlocksCount', uiLang).replace('{n}', String(deps.outgoing.length))}` : ''}</span></span>
                    <span className="flex items-center gap-2">{current && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-900 dark:text-amber-200">{t('topics.current', uiLang)}</span>}{route && <span className="text-amber-600">◆</span>}<span aria-hidden="true" className="text-stone-400">{expanded ? '−' : '+'}</span></span>
                  </button>
                  {expanded && <div className="border-t border-stone-200 p-4 dark:border-stone-700">
                    <div className="flex flex-wrap gap-3">{own.map((topic) => <MapNode key={topic.id} topic={topic} selected={drawer !== 'closed' && topic.id === selected.id} goal={topic.id === goal?.topicId} route={routeIds.has(topic.id)} completion={completions.get(topic.id)} onSelect={() => selectTopic(topic)} />)}</div>
                    {(deps.incoming.length > 0 || deps.outgoing.length > 0) && <div className="mt-4 flex flex-wrap gap-2 text-xs text-stone-500">{deps.incoming.map((id) => <button key={`in-${id}`} onClick={() => setExpandedGroup(id)} className="rounded border border-stone-200 px-2 py-1 hover:border-amber-400 dark:border-stone-600">← {groupById.get(id)?.title_de}</button>)}{deps.outgoing.map((id) => <button key={`out-${id}`} onClick={() => setExpandedGroup(id)} className="rounded border border-stone-200 px-2 py-1 hover:border-amber-400 dark:border-stone-600">{groupById.get(id)?.title_de} →</button>)}</div>}
                  </div>}
                </article>;
              })}
            </div>
          </section>;
        })}
      </div>
      {drawer !== 'closed' && <div className="border-t border-stone-300 bg-white dark:border-stone-600 dark:bg-stone-800">
        {drawer === 'collapsed' ? <button type="button" onClick={() => setDrawer('open')} className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left"><span><strong>{selected.title_de}</strong><span className="ml-2 text-sm text-stone-400">{selected.level}</span></span><span className="text-sm text-stone-500">{t('topics.openDetails', uiLang)}</span></button> : <div className="relative pb-5 pt-12"><div className="absolute right-4 top-3 flex gap-2"><button onClick={() => setDrawer('collapsed')} className="rounded px-2 py-1 text-sm text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-700">{t('topics.collapse', uiLang)}</button><button onClick={() => setDrawer('closed')} aria-label={t('topics.closeDetailsAria', uiLang)} className="rounded px-2 py-1 text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-700">×</button></div><TopicDetail topic={selected} topics={topics} groups={groups} completion={completions.get(selected.id)} lang={lang} isGoal={goal?.topicId === selected.id} onGoal={onGoal} embedded /></div>}
      </div>}
    </div>
  </div>;
}

interface MapNodeProps { topic: CourseTopic; selected: boolean; goal: boolean; route: boolean; completion?: Completion; onSelect: (id: string) => void }
function MapNode({ topic, selected, goal, route, completion, onSelect }: MapNodeProps) {
  const uiLang = useUiLang();
  return <button onClick={() => onSelect(topic.id)} aria-pressed={selected} className={`relative w-44 rounded-md border p-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${selected ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30' : route ? 'border-amber-300 bg-white dark:border-amber-800 dark:bg-stone-800' : 'border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-800'}`}>
    {topic.prerequisites.length > 0 && <span aria-hidden="true" className="absolute -left-3 top-1/2 text-stone-300">→</span>}
    <span className="flex justify-between text-[10px] font-semibold uppercase tracking-wide text-stone-400"><span>{topic.level}</span>{goal && <span className="text-amber-700">{t('topics.goal', uiLang)}</span>}</span>
    <span className="mt-1 block text-sm font-semibold">{topic.title_de}</span>
    <span className="mt-2 block"><TierBadge tier={completion?.tier ?? 'untouched'} /></span>
  </button>;
}
