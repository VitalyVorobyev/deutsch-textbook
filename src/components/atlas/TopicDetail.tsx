import type { AtlasGroup, Outcome } from '../../lib/schemas';
import type { Completion } from '../../lib/mastery';
import { groupBreadcrumb } from '../../lib/atlas';
import { TierBadge } from '../topic/TierBadge';
import { STRANDS, type CourseTopic } from './course';

interface TopicDetailProps {
  topic: CourseTopic;
  topics: CourseTopic[];
  groups: AtlasGroup[];
  completion?: Completion;
  lang: string;
  isGoal: boolean;
  onGoal: (id?: string) => Promise<void>;
  /** drop the card chrome — the host (drawer, expanded row) provides it, and owns
      the top padding: the drawer needs room for its close buttons, a row does not */
  embedded?: boolean;
}

/** A topic's place in the atlas: outcomes, and what it needs / feeds / deepens. */
export function TopicDetail({ topic, topics, groups, completion, lang, isGoal, onGoal, embedded = false }: TopicDetailProps) {
  const prereqs = topic.prerequisites
    .map((id) => topics.find((candidate) => candidate.id === id))
    .filter((candidate): candidate is CourseTopic => !!candidate);
  const unlocks = topics.filter((t: CourseTopic) => t.prerequisites.includes(topic.id));
  const bases = topic.deepens.map((id) => topics.find((candidate) => candidate.id === id)).filter((candidate): candidate is CourseTopic => !!candidate);
  const deepenedBy = topics.filter((candidate) => candidate.deepens.includes(topic.id));
  const related = topic.related.map((id) => topics.find((candidate) => candidate.id === id)).filter((candidate): candidate is CourseTopic => !!candidate);
  const breadcrumb = groupBreadcrumb(topic.group, groups);
  return <aside className={`${embedded ? 'px-5' : 'rounded-lg border border-stone-200 bg-white p-5 dark:border-stone-700 dark:bg-stone-800'}`}>
    <div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wide text-stone-400">{topic.level} · {STRANDS.find(([id]) => id === topic.strand)?.[1]}</span><TierBadge tier={completion?.tier ?? 'untouched'} /></div>
    <p className="mt-2 text-xs text-stone-400">{breadcrumb.map((part) => part.title_de).join(' › ')}</p>
    <h2 className="mt-2 text-xl font-bold">{topic.title_de}</h2><p className="mt-1 text-sm text-stone-500">{lang === 'ru' ? topic.title_ru : topic.title_en}</p>
    <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-stone-600 dark:text-stone-300">{topic.outcomes.map((o: Outcome) => <li key={o.id}>{lang === 'ru' ? o.ru : o.en}</li>)}</ul>
    <div className="mt-5 grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3"><RelationSummary label="Voraussetzungen" topics={prereqs} /><RelationSummary label="Baut darauf auf" topics={unlocks} /><RelationSummary label="Vertieft" topics={bases} /><RelationSummary label="Wird vertieft durch" topics={deepenedBy} /><RelationSummary label="Verwandte Themen" topics={related} /></div>
    <div className="mt-5 flex flex-wrap gap-2"><a href={topic.path} className="rounded-md bg-amber-600 px-3 py-2 text-sm font-semibold text-white">Thema öffnen</a>{!isGoal && <button onClick={() => void onGoal(topic.id)} className="rounded-md border border-stone-300 px-3 py-2 text-sm font-semibold dark:border-stone-600">Als Ziel setzen</button>}</div>
  </aside>;
}

export function RelationSummary({ label, topics }: { label: string; topics: CourseTopic[] }) {
  return <div className="mt-4 text-sm"><h3 className="text-xs font-semibold uppercase tracking-wide text-stone-400">{label}</h3>{topics.length ? <ul className="mt-1 space-y-1">{topics.map((topic) => <li key={topic.id}><a href={topic.path} className="font-medium text-stone-700 hover:text-amber-700 hover:underline focus-visible:outline-2 focus-visible:outline-amber-500 dark:text-stone-200 dark:hover:text-amber-300">{topic.title_de}</a></li>)}</ul> : <p className="mt-1 text-stone-400">Keine</p>}</div>;
}

export function Filter<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (value: T) => void; options: Array<readonly [T, string]> }) {
  return <label className="text-sm font-medium text-stone-500">{label} <select value={value} onChange={(e) => onChange(e.target.value as T)} className="ml-2 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-stone-800 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100">{options.map(([id, text]) => <option key={id} value={id}>{text}</option>)}</select></label>;
}
