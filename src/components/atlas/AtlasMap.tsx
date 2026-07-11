import { useEffect, useMemo, useState } from 'react';
import { getAttempts, getCardStates, getTopicsState } from '../../lib/store';
import {
  recommendedNext,
  topicCompletion,
  type Completion,
  type TopicContext,
  type TopicNode,
} from '../../lib/mastery';
import {
  BAND_LABEL_H,
  PAD_X,
  layoutAtlas,
  type LayoutGraphNode,
  type LayoutUnit,
} from '../../lib/atlas-layout';
import { SelfAssessedMark, TierBadge } from '../topic/TierBadge';
import { useExplainLang } from '../hooks';

interface Props {
  /** curriculum units in spine order (getCurriculum().units, trimmed) */
  units: LayoutUnit[];
  /** graph nodes with prerequisite + deepens edges (getCurriculum().nodes, trimmed) */
  graph: LayoutGraphNode[];
  /** topic ids in recommended-path order (getCurriculum().spine) */
  spine: string[];
  /** topic nodes with server-computed hrefs (getTopicNodes()) */
  topics: TopicNode[];
}

const EDGE_STYLE: Record<string, { cls: string; dash?: string; marker: string }> = {
  prerequisite: { cls: 'stroke-stone-300 dark:stroke-stone-600', marker: 'atlas-arrow-prereq' },
  deepens: {
    cls: 'stroke-violet-400 dark:stroke-violet-500',
    dash: '6 4',
    marker: 'atlas-arrow-deepens',
  },
};

/**
 * The Atlas map: level bands × unit columns from the pure layout module, with
 * the same measured tiers as the Fortschritt dashboard (topicCompletion over
 * the live store) and the recommendedNext() topic highlighted. The map itself
 * renders immediately from server-passed props; the learner-state adornments
 * (badges, "Weiter lernen") appear once the store has been read.
 */
export default function AtlasMap({ units, graph, spine, topics }: Props) {
  const lang = useExplainLang();
  const [ctx, setCtx] = useState<TopicContext | null>(null);

  useEffect(() => {
    void Promise.all([getAttempts(), getCardStates(), getTopicsState()]).then(
      ([attempts, cards, tp]) => setCtx({ attempts, cards, topics: tp }),
    );
  }, []);

  const layout = useMemo(() => layoutAtlas(units, graph), [units, graph]);
  const byId = useMemo(() => new Map(topics.map((t) => [t.id, t])), [topics]);
  const completion = useMemo(() => {
    if (!ctx) return new Map<string, Completion>();
    return new Map(topics.map((t) => [t.id, topicCompletion(t, ctx)]));
  }, [ctx, topics]);
  const next = ctx ? recommendedNext(spine, topics, ctx) : undefined;

  return (
    <div className="overflow-x-auto pb-2" role="region" aria-label="Themenkarte">
      <div className="relative" style={{ width: layout.width, height: layout.height }}>
        <svg
          width={layout.width}
          height={layout.height}
          className="absolute inset-0"
          aria-hidden="true"
        >
          <defs>
            <marker
              id="atlas-arrow-prereq"
              viewBox="0 0 8 8"
              refX="7"
              refY="4"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 8 4 L 0 8 z" className="fill-stone-300 dark:fill-stone-600" />
            </marker>
            <marker
              id="atlas-arrow-deepens"
              viewBox="0 0 8 8"
              refX="7"
              refY="4"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 8 4 L 0 8 z" className="fill-violet-400 dark:fill-violet-500" />
            </marker>
          </defs>
          {layout.bands.map((band) => (
            <rect
              key={band.level}
              x={0}
              y={band.y}
              width={layout.width}
              height={band.height}
              rx={12}
              className="fill-stone-100/70 dark:fill-stone-800/60"
            />
          ))}
          {layout.edges.map((edge) => {
            const style = EDGE_STYLE[edge.kind];
            return (
              <path
                key={`${edge.kind}:${edge.from}->${edge.to}`}
                d={edge.d}
                fill="none"
                strokeWidth={1.5}
                strokeDasharray={style.dash}
                markerEnd={`url(#${style.marker})`}
                className={style.cls}
                data-atlas-edge={edge.kind}
              />
            );
          })}
        </svg>
        {layout.bands.map((band) => (
          <span
            key={band.level}
            className="absolute rounded-md bg-amber-500 px-2 py-0.5 text-sm font-black text-white"
            style={{ left: PAD_X, top: band.y + (BAND_LABEL_H - 28) / 2 }}
          >
            {band.level}
          </span>
        ))}
        {layout.nodes.map((n) => {
          const topic = byId.get(n.id);
          if (!topic) return null;
          const done = completion.get(n.id);
          const isNext = next?.id === n.id;
          const selfLearned = done?.manual === 'learned';
          return (
            <a
              key={n.id}
              href={topic.path}
              data-atlas-node={n.id}
              title={topic.title_de}
              className={`absolute flex flex-col justify-between rounded-lg border p-2 ${
                isNext
                  ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-500 dark:border-amber-400 dark:bg-stone-800 dark:ring-amber-400'
                  : 'border-stone-200 bg-white hover:border-amber-400 dark:border-stone-600 dark:bg-stone-800 dark:hover:border-amber-500'
              }`}
              style={{ left: n.x, top: n.y, width: n.w, height: n.h }}
            >
              {isNext && (
                <span
                  lang="de"
                  className="absolute -top-2.5 left-2 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white"
                >
                  Weiter lernen
                </span>
              )}
              <p lang="de" className="truncate text-sm font-semibold text-stone-800 dark:text-stone-100">
                {topic.title_de}
              </p>
              <p className="truncate text-[11px] text-stone-500 dark:text-stone-400">
                {lang === 'ru' ? topic.title_ru : topic.title_en}
              </p>
              <span className="flex min-h-[18px] flex-wrap items-center gap-1">
                {done && (done.tier !== 'untouched' || selfLearned) && (
                  <>
                    <TierBadge tier={done.tier} manual={done.manual === 'reopened'} />
                    {selfLearned && <SelfAssessedMark />}
                  </>
                )}
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
