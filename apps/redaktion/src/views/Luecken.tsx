/**
 * The problem inbox: every mechanically-detected defect, one row per instance, grouped by class
 * and ranked by how many instances share a cause — so "what should I fix next" has an answer.
 */
import { useState } from 'react';
import { Chip, Empty, Filter, Panel } from '@da/ui/primitives';
import { PROBLEM_LABELS } from '@da/content/profile';
import type { GraphPayload } from '../data';
import { Extern, Zeilentabelle, Quer, type Spalte } from '../components/Zeilentabelle';
import { href } from '../router';

type Level = GraphPayload['levels'][number];
type Problem = GraphPayload['problems'][number];

const GITHUB = 'https://github.com/VitalyVorobyev/deutsch-textbook/blob/main';

/** One shape for every class, so the eye keeps its place moving down thirteen groups. */
const COLUMNS = (topicTitle: (id: string) => string): Spalte<Problem>[] => [
  { key: 'message', head: 'Befund', cell: (p) => <span className="text-ink">{p.message}</span> },
  {
    key: 'topic',
    head: 'Thema',
    cell: (p) =>
      p.topic ? <Quer href={href('thema', p.topic)}>{topicTitle(p.topic)}</Quer> : <span className="text-ink-muted">—</span>,
  },
  { key: 'level', head: 'Niveau', cell: (p) => <span className="text-ink-muted">{p.level ?? '—'}</span> },
  { key: 'file', head: 'Datei', cell: (p) => (p.file ? <Extern href={`${GITHUB}/${p.file}`}>{p.file}</Extern> : null) },
];

export function Luecken({ graph }: { graph: GraphPayload }) {
  const [level, setLevel] = useState<Level | 'alle'>('alle');
  const [kind, setKind] = useState<string | 'alle'>('alle');

  const kindOptions = [...new Set(graph.problems.map((p) => p.kind))].sort();
  const topicTitle = (id: string) => graph.topics.find((t) => t.id === id)?.title ?? id;

  const filtered = graph.problems.filter(
    (p) => (level === 'alle' || p.level === level) && (kind === 'alle' || p.kind === kind),
  );

  const groups = new Map<string, Problem[]>();
  for (const p of filtered) {
    if (!groups.has(p.kind)) groups.set(p.kind, []);
    groups.get(p.kind)!.push(p);
  }
  const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);

  return (
    <>
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Lücken</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {filtered.length} von {graph.problems.length} Befunden, nach Häufigkeit der Ursache
        </p>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Filter label="Niveau" value={level} options={graph.levels} onChange={setLevel} />
        <Filter label="Art" value={kind} options={kindOptions} onChange={setKind} />
      </div>

      {sorted.length === 0 ? (
        <Empty>Keine Befunde in dieser Auswahl.</Empty>
      ) : (
        sorted.map(([k, rows]) => {
          const label = PROBLEM_LABELS[k];
          return (
            <Panel
              key={k}
              tone="warn"
              className="mb-4"
              title={
                <span className="flex items-center gap-2">
                  {label?.de ?? k}
                  <Chip tone="warn">{rows.length}</Chip>
                </span>
              }
            >
              {/* The `why` is the half a class name cannot carry, and it is why these are labels
                  and not enum values. */}
              {label ? <p className="-mt-2 mb-3 text-xs text-ink-muted">{label.why}</p> : null}
              <Zeilentabelle
                rows={rows}
                rowKey={(p) => `${p.kind}-${p.topic ?? ''}-${p.file ?? ''}-${p.message}`}
                columns={COLUMNS(topicTitle)}
              />
            </Panel>
          );
        })
      )}
    </>
  );
}
