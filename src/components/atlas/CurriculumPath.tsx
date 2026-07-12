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
  checkpointOutcomeResults, type CheckpointSummary,
} from '../../lib/checkpoint';
import { useExplainLang } from '../hooks';
import { TierBadge } from '../topic/TierBadge';
import { crossGroupDependencies, groupBreadcrumb, leafGroups } from '../../lib/atlas';
import { Filter, TopicDetail } from './TopicDetail';
import OverviewTable from './OverviewTable';
import {
  actionLabel, STRANDS, type ActiveGoal, type CourseTopic, type CourseUnit, type LevelFilter,
  type PathCheckpoint, type View,
} from './course';

export type { CourseTopic, CourseUnit, PathCheckpoint } from './course';

interface Props { units: CourseUnit[]; groups: AtlasGroup[]; spine: string[]; checkpoints?: PathCheckpoint[] }

const NO_CHECKPOINTS: PathCheckpoint[] = [];

const VIEWS = [['path', 'Lernpfad'], ['atlas', 'Atlas'], ['overview', 'Alle Themen']] as const;

/** The tab id lived under a different name before the overview replaced the
    relations sidebar; a returning learner must not land on a tab that is gone. */
function savedView(value: string | null): View | undefined {
  const migrated = value === 'relations' ? 'overview' : value;
  return migrated === 'path' || migrated === 'atlas' || migrated === 'overview' ? migrated : undefined;
}

export default function CurriculumPath({ units, groups, spine, checkpoints = NO_CHECKPOINTS }: Props) {
  const lang = useExplainLang();
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
      <div className="inline-flex rounded-md border border-stone-300 p-0.5 text-sm dark:border-stone-600" role="tablist" aria-label="Themenansicht">
        {VIEWS.map(([id, label]) =>
          <button key={id} role="tab" aria-selected={view === id} onClick={() => changeView(id)} className={`rounded px-3 py-1.5 font-medium focus-visible:outline-2 focus-visible:outline-amber-500 ${view === id ? 'bg-stone-800 text-white dark:bg-stone-100 dark:text-stone-900' : 'text-stone-500 hover:text-stone-900 dark:hover:text-white'}`}>{label}</button>)}
      </div>
      {goal && <div className="flex items-center gap-2 text-sm"><span className="text-stone-500">Ziel:</span><button onClick={() => { setSelectedId(goal.topicId); changeView('atlas'); }} className="font-semibold text-amber-700 hover:underline dark:text-amber-300">{byId.get(goal.topicId)?.title_de}</button><button onClick={() => void chooseGoal()} aria-label="Lernziel löschen" className="text-stone-400 hover:text-red-600">×</button></div>}
    </div>

    {view === 'path' && <PathView next={next} goal={goal} route={route} completions={completions} lang={lang} checkpointCards={checkpointCards} />}
    {view === 'atlas' && <AtlasView topics={topics} groups={groups} currentId={next?.id} selected={selected} goal={goal} routeIds={routeIds} completions={completions} level={level} strand={strand} lang={lang} onLevel={setLevel} onStrand={setStrand} onSelect={setSelectedId} onGoal={chooseGoal} />}
    {view === 'overview' && <OverviewTable units={units} groups={groups} ctx={ctx} completions={completions} nextId={next?.id} goal={goal} routeIds={routeIds} query={query} lang={lang} onQuery={setQuery} onSelect={setSelectedId} onGoal={chooseGoal} />}
  </div>;
}

interface CheckpointCardData { checkpoint: PathCheckpoint; remaining: number; summary: CheckpointSummary | null }
function PathView({ next, goal, route, completions, lang, checkpointCards }: { next?: CourseTopic; goal?: ActiveGoal; route: CourseTopic[]; completions: Map<string, Completion>; lang: string; checkpointCards: CheckpointCardData[] }) {
  const cards = checkpointCards.map((card) => <CheckpointCard key={card.checkpoint.setId} checkpoint={card.checkpoint} state={card} lang={lang} />);
  if (!next) return <div className="mt-8"><p className="text-stone-500">Alle verfügbaren Themen sind gemeistert.</p>{cards}</div>;
  return <>
    <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
    <section className="border-l-4 border-amber-500 bg-amber-50 p-6 dark:bg-amber-950/25">
      <p className="text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300">Nächster Schritt · {next.level}</p>
      <h2 className="mt-2 text-2xl font-bold">{next.title_de}</h2>
      <p className="mt-1 text-sm text-stone-500">{lang === 'ru' ? next.title_ru : next.title_en}</p>
      {next.outcomes[0] && <p className="mt-4 text-sm text-stone-700 dark:text-stone-300">{lang === 'ru' ? next.outcomes[0].ru : next.outcomes[0].en}</p>}
      <a href={next.path} className="mt-5 inline-flex rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">{actionLabel[completions.get(next.id)?.tier ?? 'untouched']} →</a>
    </section>
    <section className="rounded-lg border border-stone-200 bg-white p-5 dark:border-stone-700 dark:bg-stone-800">
      <h2 className="font-semibold">{goal ? 'Weg zu deinem Ziel' : 'So funktioniert der Lernpfad'}</h2>
      {goal ? <ol className="mt-3 space-y-2">{route.map((topic, i) => <li key={topic.id} className="flex items-center gap-3 text-sm"><span className="w-5 text-right text-stone-400">{i + 1}</span><TierBadge tier={completions.get(topic.id)?.tier ?? 'untouched'} /><a href={topic.path} className="font-medium hover:text-amber-700">{topic.title_de}</a></li>)}</ol> : <p className="mt-2 text-sm text-stone-500">Der nächste Schritt folgt dem Lehrplan und deinem gemessenen Lernstand. Im Atlas kannst du stattdessen ein eigenes Ziel wählen.</p>}
    </section>
    </div>
    {cards}
  </>;
}

function CheckpointCard({ checkpoint, state, lang }: { checkpoint: PathCheckpoint; state: CheckpointCardData; lang: string }) {
  const { remaining, summary } = state;
  if (summary) {
    const pct = summary.total ? Math.round((summary.score / summary.total) * 100) : 0;
    const when = new Date(summary.lastTs).toLocaleDateString(lang === 'ru' ? 'ru' : 'en');
    return <section className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-300 bg-emerald-50/60 p-5 dark:border-emerald-800 dark:bg-emerald-950/25">
      <div>
        <h2 className="font-semibold">{checkpoint.title} ✓</h2>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">{lang === 'ru' ? `Последний результат: ${pct}% · задания: ${summary.answered}/${summary.total} · ${when}` : `Latest result: ${pct}% · ${summary.answered}/${summary.total} tasks · ${when}`}</p>
      </div>
      <a href={checkpoint.path} className="rounded-md border border-stone-300 px-3 py-2 text-sm font-semibold hover:border-amber-500 dark:border-stone-600">{lang === 'ru' ? 'Ещё раз →' : 'Retake →'}</a>
    </section>;
  }
  if (remaining > 0) {
    return <section className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-stone-300 p-5 dark:border-stone-600">
      <div>
        <h2 className="font-semibold text-stone-500 dark:text-stone-400">{checkpoint.title}</h2>
        <p className="mt-1 text-sm text-stone-500">{lang === 'ru' ? `Ещё ${remaining} ${remaining === 1 ? 'урок' : remaining < 5 ? 'урока' : 'уроков'} до контрольной точки ${checkpoint.level}.` : `${remaining} lesson${remaining === 1 ? '' : 's'} to go before the ${checkpoint.level} checkpoint.`}</p>
      </div>
      <a href={checkpoint.path} className="text-sm font-medium text-stone-400 hover:text-amber-700 hover:underline dark:hover:text-amber-300">{lang === 'ru' ? 'Всё равно открыть' : 'Open anyway'}</a>
    </section>;
  }
  return <section className="mt-6 flex flex-wrap items-center justify-between gap-3 border-l-4 border-amber-500 bg-amber-50 p-5 dark:bg-amber-950/25">
    <div>
      <h2 className="font-semibold">{checkpoint.title}</h2>
      <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">{lang === 'ru' ? `Все уроки ${checkpoint.level} пройдены — проверьте, что вы уже умеете.` : `All ${checkpoint.level} lessons done — measure what you can already do.`}</p>
    </div>
    <a href={checkpoint.path} className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">Checkpoint starten →</a>
  </section>;
}

interface AtlasViewProps {
  topics: CourseTopic[]; groups: AtlasGroup[]; currentId?: string; selected: CourseTopic; goal?: ActiveGoal; routeIds: Set<string>;
  completions: Map<string, Completion>; level: LevelFilter; strand: CurriculumStrand | 'all'; lang: string;
  onLevel: (value: LevelFilter) => void; onStrand: (value: CurriculumStrand | 'all') => void;
  onSelect: (id: string) => void; onGoal: (id?: string) => Promise<void>;
}
type DrawerState = 'closed' | 'collapsed' | 'open';
function AtlasView({ topics, groups, currentId, selected, goal, routeIds, completions, level, strand, lang, onLevel, onStrand, onSelect, onGoal }: AtlasViewProps) {
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
      <Filter label="Niveau" value={level} onChange={onLevel} options={[['all','Alle'],['A1','A1'],['A2','A2']]} />
      <Filter label="Strang" value={strand} onChange={onStrand} options={[['all','Alle'], ...STRANDS]} />
    </div>
    <div className="mt-5 overflow-hidden rounded-xl border border-stone-200 bg-stone-50 dark:border-stone-700 dark:bg-stone-900/40">
      <div className="space-y-7 p-4 sm:p-6">
        {STRANDS.map(([strandId, label]) => {
          const strandGroups = leaves.filter((group) => group.strand === strandId).filter((group) => {
            const own = topics.filter((topic) => topic.group === group.id);
            return own.some(visibleTopic);
          });
          if (!strandGroups.length) return null;
          return <section key={strandId} aria-labelledby={`strand-${strandId}`}>
            <h2 id={`strand-${strandId}`} className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">{label}</h2>
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
                    <span><span className="block text-xs text-stone-400">{groupBreadcrumb(group.id, groups).map((part) => lang === 'ru' ? part.title_ru : part.title_en).join(' › ')}</span><strong className="mt-1 block text-base">{group.title_de}</strong><span className="mt-2 block text-xs text-stone-500">{mastered}/{own.length} gemeistert{deps.incoming.length ? ` · ${deps.incoming.length} Voraussetzung${deps.incoming.length > 1 ? 'en' : ''}` : ''}{deps.outgoing.length ? ` · öffnet ${deps.outgoing.length}` : ''}</span></span>
                    <span className="flex items-center gap-2">{current && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-900 dark:text-amber-200">aktuell</span>}{route && <span className="text-amber-600">◆</span>}<span aria-hidden="true" className="text-stone-400">{expanded ? '−' : '+'}</span></span>
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
        {drawer === 'collapsed' ? <button type="button" onClick={() => setDrawer('open')} className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left"><span><strong>{selected.title_de}</strong><span className="ml-2 text-sm text-stone-400">{selected.level}</span></span><span className="text-sm text-stone-500">Details öffnen ↑</span></button> : <div className="relative pb-5 pt-12"><div className="absolute right-4 top-3 flex gap-2"><button onClick={() => setDrawer('collapsed')} className="rounded px-2 py-1 text-sm text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-700">Einklappen</button><button onClick={() => setDrawer('closed')} aria-label="Details schließen" className="rounded px-2 py-1 text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-700">×</button></div><TopicDetail topic={selected} topics={topics} groups={groups} completion={completions.get(selected.id)} lang={lang} isGoal={goal?.topicId === selected.id} onGoal={onGoal} embedded /></div>}
      </div>}
    </div>
  </div>;
}

interface MapNodeProps { topic: CourseTopic; selected: boolean; goal: boolean; route: boolean; completion?: Completion; onSelect: (id: string) => void }
function MapNode({ topic, selected, goal, route, completion, onSelect }: MapNodeProps) {
  return <button onClick={() => onSelect(topic.id)} aria-pressed={selected} className={`relative w-44 rounded-md border p-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${selected ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30' : route ? 'border-amber-300 bg-white dark:border-amber-800 dark:bg-stone-800' : 'border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-800'}`}>
    {topic.prerequisites.length > 0 && <span aria-hidden="true" className="absolute -left-3 top-1/2 text-stone-300">→</span>}
    <span className="flex justify-between text-[10px] font-semibold uppercase tracking-wide text-stone-400"><span>{topic.level}</span>{goal && <span className="text-amber-700">Ziel</span>}</span>
    <span className="mt-1 block text-sm font-semibold">{topic.title_de}</span>
    <span className="mt-2 block"><TierBadge tier={completion?.tier ?? 'untouched'} /></span>
  </button>;
}
