import { useEffect, useMemo, useState } from 'react';
import type { Outcome } from '../../lib/schemas';
import { getAttempts, getCardStates, getTopicsState } from '../../lib/store';
import {
  recommendedNext,
  topicCompletion,
  type Completion,
  type TopicContext,
  type TopicNode,
} from '../../lib/mastery';
import { useExplainLang } from '../hooks';
import { TierBadge } from '../topic/TierBadge';

export interface CourseTopic extends TopicNode {
  outcomes: Outcome[];
  deepens: string[];
}

export interface CourseUnit {
  id: string;
  level: string;
  title_de: string;
  title_en: string;
  title_ru: string;
  topics: CourseTopic[];
}

interface Props {
  units: CourseUnit[];
  spine: string[];
}

type View = 'path' | 'relations';
type LevelFilter = 'all' | 'A1' | 'A2';

const actionLabel: Record<string, string> = {
  untouched: 'Starten',
  read: 'Fortsetzen',
  practiced: 'Weiter üben',
  mastered: 'Wiederholen',
};

function SelfRatingText() {
  return (
    <span lang="de" className="text-xs text-stone-400" title="Selbsteinschätzung; ändert den gemessenen Stand nicht">
      ✎ selbst eingeschätzt
    </span>
  );
}

export default function CurriculumPath({ units, spine }: Props) {
  const lang = useExplainLang();
  const topics = useMemo(() => units.flatMap((unit) => unit.topics), [units]);
  const byId = useMemo(() => new Map(topics.map((topic) => [topic.id, topic])), [topics]);
  const [ctx, setCtx] = useState<TopicContext | null>(null);
  const [view, setView] = useState<View>('path');
  const [level, setLevel] = useState<LevelFilter | null>(null);
  const [selectedId, setSelectedId] = useState('');

  useEffect(() => {
    const savedView = localStorage.getItem('da:topics-view');
    const savedLevel = localStorage.getItem('da:topics-level');
    queueMicrotask(() => {
      if (savedView === 'relations') setView('relations');
      if (savedLevel === 'A1' || savedLevel === 'A2' || savedLevel === 'all') setLevel(savedLevel);
    });
    void Promise.all([getAttempts(), getCardStates(), getTopicsState()]).then(
      ([attempts, cards, topicState]) => setCtx({ attempts, cards, topics: topicState }),
    );
  }, []);

  const completions = useMemo(() => {
    if (!ctx) return new Map<string, Completion>();
    return new Map(topics.map((topic) => [topic.id, topicCompletion(topic, ctx)]));
  }, [ctx, topics]);
  const recommended = ctx ? recommendedNext(spine, topics, ctx) : topics[0];
  const next = recommended ? byId.get(recommended.id) : undefined;
  const currentUnit = units.find((unit) => unit.topics.some((topic) => topic.id === next?.id));

  function changeView(nextView: View) {
    setView(nextView);
    localStorage.setItem('da:topics-view', nextView);
  }

  function changeLevel(nextLevel: LevelFilter) {
    setLevel(nextLevel);
    localStorage.setItem('da:topics-level', nextLevel);
  }

  const effectiveLevel = level ?? (next?.level === 'A2' ? 'A2' : 'A1');
  const visibleUnits = units.filter((unit) => effectiveLevel === 'all' || unit.level === effectiveLevel);
  const selected = byId.get(selectedId || next?.id || spine[0] || '') ?? topics[0];
  const prerequisites = selected
    ? (selected.prerequisites.map((id) => byId.get(id)).filter(Boolean) as CourseTopic[])
    : [];
  const unlocks = selected
    ? topics.filter((topic) => topic.prerequisites.includes(selected.id))
    : [];
  const bases = selected
    ? (selected.deepens.map((id) => byId.get(id)).filter(Boolean) as CourseTopic[])
    : [];
  const deepenedBy = selected ? topics.filter((topic) => topic.deepens.includes(selected.id)) : [];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-md border border-stone-300 p-0.5 text-sm dark:border-stone-600" role="group" aria-label="Themenansicht">
          {([['path', 'Lernpfad'], ['relations', 'Zusammenhänge']] as const).map(([id, label]) => (
            <button key={id} type="button" aria-pressed={view === id} onClick={() => changeView(id)}
              className={`rounded px-3 py-1.5 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${view === id ? 'bg-stone-800 text-white dark:bg-stone-200 dark:text-stone-900' : 'text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'}`}>
              {label}
            </button>
          ))}
        </div>
        {view === 'path' && (
          <div className="inline-flex gap-1" role="group" aria-label="Niveau filtern">
            {([['A1', 'A1'], ['A2', 'A2'], ['all', 'Alle']] as const).map(([id, label]) => (
              <button key={id} type="button" aria-pressed={effectiveLevel === id} onClick={() => changeLevel(id)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${effectiveLevel === id ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-100' : 'text-stone-500 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800'}`}>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {view === 'path' ? (
        <>
          {next && currentUnit && (
            <section className="mt-6 border-l-4 border-amber-500 bg-amber-50 px-5 py-5 dark:bg-amber-950/25" aria-labelledby="continue-heading">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300">Weiter lernen · {next.level}</p>
                  <h2 id="continue-heading" lang="de" className="mt-1 text-2xl font-bold text-stone-900 dark:text-stone-100">{next.title_de}</h2>
                  <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">{lang === 'ru' ? next.title_ru : next.title_en} · {lang === 'ru' ? currentUnit.title_ru : currentUnit.title_en}</p>
                  {next.outcomes[0] && <p className="mt-3 max-w-2xl text-sm text-stone-600 dark:text-stone-300">{lang === 'ru' ? next.outcomes[0].ru : next.outcomes[0].en}</p>}
                </div>
                <a href={next.path} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-md bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 sm:min-h-0">
                  {actionLabel[completions.get(next.id)?.tier ?? 'untouched']} →
                </a>
              </div>
            </section>
          )}

          <div className="mt-8 space-y-3">
            {visibleUnits.map((unit, index) => {
              const unitDone = unit.topics.map((topic) => completions.get(topic.id));
              const mastered = unitDone.filter((done) => done?.tier === 'mastered').length;
              const unitNext = unit.topics.find((topic) => completions.get(topic.id)?.tier !== 'mastered') ?? unit.topics[0];
              const current = unit.topics.some((topic) => topic.id === next?.id);
              const outcome = unit.topics[0]?.outcomes[0];
              return (
                <section key={unit.id} className={`rounded-lg border bg-white px-4 py-4 dark:bg-stone-800 sm:px-5 ${current ? 'border-amber-400 dark:border-amber-600' : 'border-stone-200 dark:border-stone-700'} ${mastered === unit.topics.length ? 'opacity-75' : ''}`}>
                  <div className="grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-center">
                    <div className="flex items-center gap-2 sm:block sm:text-center">
                      <span className="text-xs font-semibold text-stone-400">{unit.level}</span>
                      <span className="ml-1 text-sm tabular-nums text-stone-400">{index + 1}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 lang="de" className="text-lg font-semibold text-stone-900 dark:text-stone-100">{unit.title_de}</h2>
                        {current && <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">aktuell</span>}
                      </div>
                      <p className="mt-0.5 text-sm text-stone-500 dark:text-stone-400">{lang === 'ru' ? unit.title_ru : unit.title_en}</p>
                      {outcome && <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">{lang === 'ru' ? outcome.ru : outcome.en}</p>}
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-stone-400">
                        <span>{mastered} von {unit.topics.length} gemeistert</span>
                        {unit.topics.some((topic) => completions.get(topic.id)?.manual === 'learned') && <SelfRatingText />}
                      </div>
                    </div>
                    {unitNext && (
                      <div className="flex items-center gap-3 sm:justify-end">
                        {completions.get(unitNext.id) && <TierBadge tier={completions.get(unitNext.id)!.tier} />}
                        <a href={unitNext.path} className={`rounded-md px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${current ? 'bg-amber-600 text-white hover:bg-amber-700' : 'border border-stone-300 text-stone-700 hover:border-amber-400 dark:border-stone-600 dark:text-stone-200'}`}>
                          {actionLabel[completions.get(unitNext.id)?.tier ?? 'untouched']}
                        </a>
                      </div>
                    )}
                  </div>
                  {unit.topics.length > 1 && (
                    <details className="mt-4 border-t border-stone-100 pt-3 dark:border-stone-700">
                      <summary className="cursor-pointer text-sm font-medium text-stone-600 dark:text-stone-300">Themen in dieser Einheit</summary>
                      <ul className="mt-2 divide-y divide-stone-100 dark:divide-stone-700">
                        {unit.topics.map((topic) => <li key={topic.id} className="flex items-center justify-between gap-3 py-2"><a href={topic.path} lang="de" className="hover:text-amber-700 hover:underline dark:hover:text-amber-300">{topic.title_de}</a>{completions.get(topic.id) && <TierBadge tier={completions.get(topic.id)!.tier} />}</li>)}
                      </ul>
                    </details>
                  )}
                </section>
              );
            })}
          </div>
        </>
      ) : selected ? (
        <section className="mt-6" aria-labelledby="relations-heading">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="relations-heading" className="text-xl font-bold">Zusammenhänge</h2>
              <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">Nur die direkten Beziehungen eines Themas — ohne unlesbares Gesamtnetz.</p>
            </div>
            <label className="text-sm font-medium text-stone-600 dark:text-stone-300">Thema{' '}
              <select value={selected.id} onChange={(e) => setSelectedId(e.target.value)} className="ml-2 rounded-md border border-stone-300 bg-white px-3 py-2 dark:border-stone-600 dark:bg-stone-800">
                {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.level} · {topic.title_de}</option>)}
              </select>
            </label>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-[1fr_1.15fr_1fr] md:items-stretch">
            <RelationColumn title="Voraussetzungen" empty="Keine Voraussetzungen" topics={prerequisites} />
            <article className="rounded-lg border-2 border-amber-400 bg-amber-50 p-5 dark:border-amber-600 dark:bg-amber-950/25">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">Ausgewähltes Thema · {selected.level}</p>
              <h3 lang="de" className="mt-2 text-xl font-bold">{selected.title_de}</h3>
              <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{lang === 'ru' ? selected.title_ru : selected.title_en}</p>
              <a href={selected.path} className="mt-4 inline-block text-sm font-semibold text-amber-800 hover:underline dark:text-amber-300">Thema öffnen →</a>
            </article>
            <RelationColumn title="Baut darauf auf" empty="Noch keine Folgethemen" topics={unlocks} />
          </div>
          {(bases.length > 0 || deepenedBy.length > 0) && (
            <div className="mt-4 rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-800">
              <h3 className="text-sm font-semibold">Spiralförmige Vertiefung</h3>
              {bases.length > 0 && <RelationLinks label="Vertieft" topics={bases} />}
              {deepenedBy.length > 0 && <RelationLinks label="Wird später vertieft durch" topics={deepenedBy} />}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}

function RelationColumn({ title, empty, topics }: { title: string; empty: string; topics: CourseTopic[] }) {
  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-800">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-400">{title}</h3>
      {topics.length ? <ul className="mt-2 space-y-2">{topics.map((topic) => <li key={topic.id}><a href={topic.path} lang="de" className="text-sm font-medium hover:text-amber-700 hover:underline dark:hover:text-amber-300">{topic.title_de}</a><span className="ml-2 text-xs text-stone-400">{topic.level}</span></li>)}</ul> : <p className="mt-2 text-sm text-stone-400">{empty}</p>}
    </section>
  );
}

function RelationLinks({ label, topics }: { label: string; topics: CourseTopic[] }) {
  return <p className="mt-2 text-sm text-stone-600 dark:text-stone-300"><span className="font-medium">{label}:</span>{' '}{topics.map((topic, i) => <span key={topic.id}>{i > 0 && ', '}<a href={topic.path} lang="de" className="hover:text-amber-700 hover:underline dark:hover:text-amber-300">{topic.title_de}</a></span>)}</p>;
}
