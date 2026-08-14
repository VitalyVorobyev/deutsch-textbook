/**
 * The problem inbox: every mechanically-detected defect, one row per instance, grouped by class
 * and ranked by how many instances share a cause — so "what should I fix next" has an answer.
 */
import { useState } from 'react';
import { Card, Chip, Empty, Filter, Heading, Table } from '@da/ui/primitives';
import { PROBLEM_LABELS } from '@da/content/profile';
import type { GraphPayload } from '../data';
import { href } from '../router';

type Level = GraphPayload['levels'][number];
type Problem = GraphPayload['problems'][number];

const GITHUB = 'https://github.com/VitalyVorobyev/deutsch-textbook/blob/main';

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
      <Heading sub={`${filtered.length} von ${graph.problems.length} Befunden`}>Lücken</Heading>

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
            <Card key={k} className="mb-4">
              <h2 className="mb-1 flex items-center gap-2 text-sm font-medium text-ink">
                {label?.de ?? k}
                <Chip tone="warn">{rows.length}</Chip>
              </h2>
              {label ? <p className="mb-3 text-xs text-ink-muted">{label.why}</p> : null}
              <Table
                rows={rows}
                rowKey={(p) => `${p.kind}-${p.topic ?? ''}-${p.file ?? ''}-${p.message}`}
                columns={[
                  {
                    key: 'topic',
                    head: 'Thema',
                    cell: (p) =>
                      p.topic ? (
                        <a className="text-info hover:underline" href={href('thema', p.topic)}>
                          {topicTitle(p.topic)}
                        </a>
                      ) : (
                        <span className="text-ink-muted">—</span>
                      ),
                  },
                  { key: 'level', head: 'Niveau', cell: (p) => p.level ?? '—' },
                  { key: 'message', head: 'Befund', cell: (p) => p.message },
                  {
                    key: 'file',
                    head: 'Datei',
                    cell: (p) =>
                      p.file ? (
                        <a
                          className="text-info hover:underline"
                          href={`${GITHUB}/${p.file}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {p.file}
                        </a>
                      ) : null,
                  },
                ]}
              />
            </Card>
          );
        })
      )}
    </>
  );
}
