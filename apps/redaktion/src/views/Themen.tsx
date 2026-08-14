/**
 * The curriculum spine as a list: every unit in teaching order, every topic inside it, and per
 * topic the one number that says whether it clears the level median — `met`, the completeness
 * count `Thema.tsx` explains in full.
 *
 * `graph.topics` already arrives sorted by `spine`, so grouping by `unitTitle` in that same order
 * reproduces the recommended path without re-deriving it.
 */
import { useState } from 'react';
import { Empty, Filter, Heading, SearchBox, Table } from '@da/ui/primitives';
import type { GraphPayload } from '../data';
import { href } from '../router';

type Level = GraphPayload['levels'][number];
type TopicSummary = GraphPayload['topics'][number];

export function Themen({ graph }: { graph: GraphPayload }) {
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState<Level | 'alle'>('alle');
  const [status, setStatus] = useState<string | 'alle'>('alle');

  const statusOptions = [...new Set(graph.topics.map((t) => t.status))].sort();
  const q = search.trim().toLowerCase();

  const filtered = graph.topics.filter(
    (t) =>
      (level === 'alle' || t.level === level) &&
      (status === 'alle' || t.status === status) &&
      (!q || t.title.toLowerCase().includes(q) || t.id.toLowerCase().includes(q)),
  );

  const elementCounts = new Map<string, number>();
  for (const e of graph.elements) elementCounts.set(e.topic, (elementCounts.get(e.topic) ?? 0) + 1);
  const profileByTopic = new Map(graph.profiles.map((p) => [p.topic, p]));
  const medianMetByLevel = new Map(graph.reports.map((r) => [r.level, r.medians?.met]));

  const groups = new Map<string, TopicSummary[]>();
  for (const t of filtered) {
    const key = t.unitTitle ?? 'ohne Einheit';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }

  return (
    <>
      <Heading sub={`${filtered.length} von ${graph.topics.length} Themen`}>Einheiten &amp; Themen</Heading>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="min-w-64 flex-1">
          <SearchBox value={search} onChange={setSearch} placeholder="Titel oder Kennung suchen …" />
        </div>
        <Filter label="Niveau" value={level} options={graph.levels} onChange={setLevel} />
        <Filter label="Status" value={status} options={statusOptions} onChange={setStatus} />
      </div>

      {groups.size === 0 ? (
        <Empty>Keine Themen in dieser Auswahl.</Empty>
      ) : (
        [...groups.entries()].map(([unitTitle, topics]) => (
          <section key={unitTitle} className="mb-6">
            <h2 className="mb-2 text-sm font-medium text-ink">{unitTitle}</h2>
            <Table
              rows={topics}
              rowKey={(t) => t.id}
              columns={[
                { key: 'spine', head: '#', numeric: true, cell: (t) => t.spine },
                {
                  key: 'title',
                  head: 'Titel',
                  cell: (t) => (
                    <a className="text-info hover:underline" href={href('thema', t.id)}>
                      {t.title}
                    </a>
                  ),
                },
                { key: 'level', head: 'Niveau', cell: (t) => t.level },
                { key: 'kind', head: 'Art', cell: (t) => t.kind },
                { key: 'status', head: 'Status', cell: (t) => t.status },
                {
                  key: 'elements',
                  head: 'Elemente',
                  numeric: true,
                  cell: (t) => elementCounts.get(t.id) ?? 0,
                },
                {
                  key: 'met',
                  head: 'erfüllt',
                  numeric: true,
                  cell: (t) => {
                    const profile = profileByTopic.get(t.id);
                    if (!profile) return '–';
                    const median = medianMetByLevel.get(t.level);
                    const below = median !== undefined && profile.met < median;
                    return (
                      <span className={below ? 'text-warn' : 'text-ink'}>
                        {profile.met}/{profile.total}
                      </span>
                    );
                  },
                },
              ]}
            />
          </section>
        ))
      )}
    </>
  );
}
