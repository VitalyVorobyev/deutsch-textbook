import { useEffect, useMemo, useState } from 'react';
import type { AtlasGroup, CurriculumStrand, Outcome } from '../../lib/schemas';
import {
  getAttempts, getCardStates, getLearningGoal, getTopicsState, setLearningGoal,
  type LearningGoal,
} from '../../lib/store';
import {
  goalRoute, levelRemaining, recommendedForGoal, recommendedNext, topicCompletion,
  type Completion, type TopicContext, type TopicNode,
} from '../../lib/mastery';
import {
  checkpointOutcomeResults, type CheckpointItemRef, type CheckpointSummary,
} from '../../lib/checkpoint';
import { useExplainLang } from '../hooks';
import { TierBadge } from '../topic/TierBadge';
import { crossGroupDependencies, groupBreadcrumb, leafGroups } from '../../lib/atlas';

export interface CourseTopic extends TopicNode {
  strand: CurriculumStrand;
  group: string;
  outcomes: Outcome[];
  deepens: string[];
  related: string[];
}
export interface CourseUnit {
  id: string; level: string; title_de: string; title_en: string; title_ru: string; topics: CourseTopic[];
}
export interface PathCheckpoint {
  level: string;
  title: string;
  path: string;
  setId: string;
  items: CheckpointItemRef[];
}
interface Props { units: CourseUnit[]; groups: AtlasGroup[]; spine: string[]; checkpoint?: PathCheckpoint }
type ActiveGoal = LearningGoal & { topicId: string };
type View = 'path' | 'atlas' | 'relations';
type LevelFilter = 'all' | 'A1' | 'A2';

const STRANDS: Array<[CurriculumStrand, string]> = [
  ['foundations', 'Grundlagen'], ['grammar', 'Grammatik'],
  ['communication', 'Kommunikation'], ['vocabulary', 'Wortschatz'],
];
const actionLabel: Record<string, string> = {
  untouched: 'Starten', read: 'Fortsetzen', practiced: 'Weiter üben', mastered: 'Wiederholen',
};

export default function CurriculumPath({ units, groups, spine, checkpoint }: Props) {
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
    const saved = localStorage.getItem('da:topics-view');
    queueMicrotask(() => {
      if (saved === 'path' || saved === 'atlas' || saved === 'relations') setView(saved);
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
  const checkpointState = useMemo(() => {
    if (!checkpoint || !ctx) return undefined;
    return {
      remaining: levelRemaining(checkpoint.level, topics, ctx),
      summary: checkpointOutcomeResults(checkpoint.items, ctx.attempts, checkpoint.setId),
    };
  }, [checkpoint, ctx, topics]);

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
        {([['path', 'Lernpfad'], ['atlas', 'Atlas'], ['relations', 'Zusammenhänge']] as const).map(([id, label]) =>
          <button key={id} role="tab" aria-selected={view === id} onClick={() => changeView(id)} className={`rounded px-3 py-1.5 font-medium focus-visible:outline-2 focus-visible:outline-amber-500 ${view === id ? 'bg-stone-800 text-white dark:bg-stone-100 dark:text-stone-900' : 'text-stone-500 hover:text-stone-900 dark:hover:text-white'}`}>{label}</button>)}
      </div>
      {goal && <div className="flex items-center gap-2 text-sm"><span className="text-stone-500">Ziel:</span><button onClick={() => { setSelectedId(goal.topicId); changeView('atlas'); }} className="font-semibold text-amber-700 hover:underline dark:text-amber-300">{byId.get(goal.topicId)?.title_de}</button><button onClick={() => void chooseGoal()} aria-label="Lernziel löschen" className="text-stone-400 hover:text-red-600">×</button></div>}
    </div>

    {view === 'path' && <PathView next={next} goal={goal} route={route} completions={completions} lang={lang} checkpoint={checkpoint} checkpointState={checkpointState} />}
    {view === 'atlas' && <AtlasView topics={topics} groups={groups} currentId={next?.id} selected={selected} goal={goal} routeIds={routeIds} completions={completions} level={level} strand={strand} lang={lang} onLevel={setLevel} onStrand={setStrand} onSelect={setSelectedId} onGoal={chooseGoal} />}
    {view === 'relations' && <RelationsView topics={topics} groups={groups} selected={selected} query={query} lang={lang} completions={completions} onQuery={setQuery} onSelect={setSelectedId} onGoal={chooseGoal} goal={goal} />}
  </div>;
}

interface CheckpointCardState { remaining: number; summary: CheckpointSummary | null }
function PathView({ next, goal, route, completions, lang, checkpoint, checkpointState }: { next?: CourseTopic; goal?: ActiveGoal; route: CourseTopic[]; completions: Map<string, Completion>; lang: string; checkpoint?: PathCheckpoint; checkpointState?: CheckpointCardState }) {
  const checkpointCard = checkpoint && checkpointState && <CheckpointCard checkpoint={checkpoint} state={checkpointState} lang={lang} />;
  if (!next) return <div className="mt-8"><p className="text-stone-500">Alle verfügbaren Themen sind gemeistert.</p>{checkpointCard}</div>;
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
    {checkpointCard}
  </>;
}

function CheckpointCard({ checkpoint, state, lang }: { checkpoint: PathCheckpoint; state: CheckpointCardState; lang: string }) {
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
        {drawer === 'collapsed' ? <button type="button" onClick={() => setDrawer('open')} className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left"><span><strong>{selected.title_de}</strong><span className="ml-2 text-sm text-stone-400">{selected.level}</span></span><span className="text-sm text-stone-500">Details öffnen ↑</span></button> : <div className="relative"><div className="absolute right-4 top-3 flex gap-2"><button onClick={() => setDrawer('collapsed')} className="rounded px-2 py-1 text-sm text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-700">Einklappen</button><button onClick={() => setDrawer('closed')} aria-label="Details schließen" className="rounded px-2 py-1 text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-700">×</button></div><TopicDetail topic={selected} topics={topics} groups={groups} completion={completions.get(selected.id)} lang={lang} isGoal={goal?.topicId === selected.id} onGoal={onGoal} embedded /></div>}
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

interface TopicDetailProps { topic: CourseTopic; topics: CourseTopic[]; groups: AtlasGroup[]; completion?: Completion; lang: string; isGoal: boolean; onGoal: (id?: string) => Promise<void>; embedded?: boolean }
function TopicDetail({ topic, topics, groups, completion, lang, isGoal, onGoal, embedded = false }: TopicDetailProps) {
  const prereqs = topic.prerequisites
    .map((id) => topics.find((candidate) => candidate.id === id))
    .filter((candidate): candidate is CourseTopic => !!candidate);
  const unlocks = topics.filter((t: CourseTopic) => t.prerequisites.includes(topic.id));
  const bases = topic.deepens.map((id) => topics.find((candidate) => candidate.id === id)).filter((candidate): candidate is CourseTopic => !!candidate);
  const deepenedBy = topics.filter((candidate) => candidate.deepens.includes(topic.id));
  const related = topic.related.map((id) => topics.find((candidate) => candidate.id === id)).filter((candidate): candidate is CourseTopic => !!candidate);
  const breadcrumb = groupBreadcrumb(topic.group, groups);
  return <aside className={`${embedded ? 'px-5 pb-5 pt-12' : 'rounded-lg border border-stone-200 bg-white p-5 dark:border-stone-700 dark:bg-stone-800'}`}>
    <div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wide text-stone-400">{topic.level} · {STRANDS.find(([id]) => id === topic.strand)?.[1]}</span><TierBadge tier={completion?.tier ?? 'untouched'} /></div>
    <p className="mt-2 text-xs text-stone-400">{breadcrumb.map((part) => part.title_de).join(' › ')}</p>
    <h2 className="mt-2 text-xl font-bold">{topic.title_de}</h2><p className="mt-1 text-sm text-stone-500">{lang === 'ru' ? topic.title_ru : topic.title_en}</p>
    <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-stone-600 dark:text-stone-300">{topic.outcomes.map((o: Outcome) => <li key={o.id}>{lang === 'ru' ? o.ru : o.en}</li>)}</ul>
    <div className="mt-5 grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3"><RelationSummary label="Voraussetzungen" topics={prereqs} /><RelationSummary label="Baut darauf auf" topics={unlocks} /><RelationSummary label="Vertieft" topics={bases} /><RelationSummary label="Wird vertieft durch" topics={deepenedBy} /><RelationSummary label="Verwandte Themen" topics={related} /></div>
    <div className="mt-5 flex flex-wrap gap-2"><a href={topic.path} className="rounded-md bg-amber-600 px-3 py-2 text-sm font-semibold text-white">Thema öffnen</a>{!isGoal && <button onClick={() => void onGoal(topic.id)} className="rounded-md border border-stone-300 px-3 py-2 text-sm font-semibold dark:border-stone-600">Als Ziel setzen</button>}</div>
  </aside>;
}

interface RelationsViewProps {
  topics: CourseTopic[]; groups: AtlasGroup[]; selected: CourseTopic; query: string; lang: string;
  completions: Map<string, Completion>; onQuery: (value: string) => void;
  onSelect: (id: string) => void; onGoal: (id?: string) => Promise<void>; goal?: ActiveGoal;
}
function RelationsView({ topics, groups, selected, query, lang, completions, onQuery, onSelect, onGoal, goal }: RelationsViewProps) {
  const q = query.trim().toLocaleLowerCase('de');
  const shown = topics.filter((t: CourseTopic) => !q || `${t.title_de} ${t.title_en} ${t.title_ru}`.toLocaleLowerCase('de').includes(q));
  return <div className="mt-6 grid gap-6 md:grid-cols-[17rem_1fr]">
    <aside><label className="text-sm font-semibold" htmlFor="topic-search">Thema suchen</label><input id="topic-search" value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Titel…" className="mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-2 dark:border-stone-600 dark:bg-stone-800" />
      <div className="mt-3 max-h-[34rem] overflow-y-auto rounded-md border border-stone-200 dark:border-stone-700">{STRANDS.map(([id,label]) => { const group = shown.filter((t: CourseTopic) => t.strand === id); return group.length ? <section key={id}><h3 className="sticky top-0 bg-stone-100 px-3 py-1 text-[10px] font-semibold uppercase text-stone-400 dark:bg-stone-900">{label}</h3>{group.map((t: CourseTopic) => <button key={t.id} onClick={() => onSelect(t.id)} className={`flex w-full items-center justify-between border-t border-stone-100 px-3 py-2 text-left text-sm dark:border-stone-700 ${selected.id === t.id ? 'bg-amber-50 dark:bg-amber-950/30' : 'hover:bg-stone-50 dark:hover:bg-stone-800'}`}><span>{t.title_de}</span><span className="text-xs text-stone-400">{t.level}</span></button>)}</section> : null; })}</div>
    </aside><TopicDetail topic={selected} topics={topics} groups={groups} completion={completions.get(selected.id)} lang={lang} isGoal={goal?.topicId === selected.id} onGoal={onGoal} />
  </div>;
}

function Filter<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (value: T) => void; options: Array<readonly [T, string]> }) { return <label className="text-sm font-medium text-stone-500">{label} <select value={value} onChange={(e) => onChange(e.target.value as T)} className="ml-2 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-stone-800 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100">{options.map(([id,text]) => <option key={id} value={id}>{text}</option>)}</select></label>; }
function RelationSummary({ label, topics }: { label: string; topics: CourseTopic[] }) { return <div className="mt-4 text-sm"><h3 className="text-xs font-semibold uppercase tracking-wide text-stone-400">{label}</h3>{topics.length ? <ul className="mt-1 space-y-1">{topics.map((topic) => <li key={topic.id}><a href={topic.path} className="font-medium text-stone-700 hover:text-amber-700 hover:underline focus-visible:outline-2 focus-visible:outline-amber-500 dark:text-stone-200 dark:hover:text-amber-300">{topic.title_de}</a></li>)}</ul> : <p className="mt-1 text-stone-400">Keine</p>}</div>; }
