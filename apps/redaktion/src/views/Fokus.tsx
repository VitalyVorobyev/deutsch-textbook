/**
 * Fokus-Tags: the confusions the course can name. Without an id, every tag the corpus knows,
 * however well or badly it is taught; with one, that tag's own record — where it comes from,
 * which grammar points name it, and every element that carries it.
 */
import { useState } from 'react';
import { Card, Chip, Empty, Filter, Heading, SearchBox, Table } from '@da/ui/primitives';
import type { GraphPayload } from '../data';
import { href } from '../router';

type Level = GraphPayload['levels'][number];
type ElementRow = GraphPayload['elements'][number];

const GITHUB = 'https://github.com/VitalyVorobyev/deutsch-textbook/blob/main';

const STAGE_LABEL: Record<string, string> = {
  pretest: 'Pretest',
  modell: 'Modell',
  geruest: 'Gerüst',
  ausblenden: 'Ausblenden',
  transfer: 'Transfer',
  nachpruefung: 'Nachprüfung',
  keine: 'außerhalb des Zyklus',
};

function topicTitle(graph: GraphPayload, id: string): string {
  return graph.topics.find((t) => t.id === id)?.title ?? id;
}

export function Fokus({ graph, id }: { graph: GraphPayload; id?: string }) {
  return id ? <FokusDetail graph={graph} id={id} /> : <FokusListe graph={graph} />;
}

function FokusListe({ graph }: { graph: GraphPayload }) {
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState<Level | 'alle'>('alle');
  const q = search.trim().toLowerCase();

  const filtered = graph.tags.filter(
    (t) => (level === 'alle' || t.level === level) && (!q || t.tag.toLowerCase().includes(q)),
  );

  return (
    <>
      <Heading sub={`${filtered.length} von ${graph.tags.length} Fokus-Tags`}>Fokus-Tags</Heading>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="min-w-64 flex-1">
          <SearchBox value={search} onChange={setSearch} placeholder="Tag suchen …" />
        </div>
        <Filter label="Niveau" value={level} options={graph.levels} onChange={setLevel} />
      </div>

      <Table
        rows={filtered}
        rowKey={(t) => t.tag}
        columns={[
          {
            key: 'tag',
            head: 'Tag',
            cell: (t) => (
              <a className="text-info hover:underline" href={href('fokus', t.tag)}>
                {t.tag}
              </a>
            ),
          },
          {
            key: 'introducedBy',
            head: 'eingeführt von',
            cell: (t) =>
              t.introducedBy ? (
                <a className="text-info hover:underline" href={href('thema', t.introducedBy)}>
                  {topicTitle(graph, t.introducedBy)}
                </a>
              ) : (
                <span className="text-warn">nicht registriert</span>
              ),
          },
          { key: 'level', head: 'Niveau', cell: (t) => t.level ?? '—' },
          { key: 'teaching', head: 'Lehre', numeric: true, cell: (t) => t.teaching },
          {
            key: 'probes',
            head: 'Proben',
            numeric: true,
            cell: (t) => <span className={t.probes ? 'text-ink' : 'text-warn'}>{t.probes}</span>,
          },
          {
            key: 'points',
            head: 'Strukturen',
            cell: (t) => (
              <span className="flex flex-wrap gap-1">
                {t.points.map((p) => (
                  <a key={p} href={href('struktur', p)}>
                    <Chip tone="info">{p}</Chip>
                  </a>
                ))}
              </span>
            ),
          },
        ]}
      />
    </>
  );
}

function FokusDetail({ graph, id }: { graph: GraphPayload; id: string }) {
  const tag = graph.tags.find((t) => t.tag === id);
  if (!tag) return <Empty>Kein Fokus-Tag „{id}“.</Empty>;

  const points = graph.inventory.filter((p) => tag.points.includes(p.id));
  const elements = graph.elements.filter((e) => e.focus.includes(id));

  const groups = new Map<string, ElementRow[]>();
  for (const e of elements) {
    if (!groups.has(e.topic)) groups.set(e.topic, []);
    groups.get(e.topic)!.push(e);
  }

  return (
    <>
      <Heading
        sub={
          tag.level
            ? `${tag.level} · eingeführt von ${tag.introducedBy ? topicTitle(graph, tag.introducedBy) : '—'}`
            : 'kein Niveau ermittelt — kein Element trägt diesen Tag'
        }
      >
        {tag.tag}
      </Heading>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <h2 className="mb-2 text-sm font-medium text-ink">Lehre</h2>
          <p className="tabular text-3xl text-ink">{tag.teaching}</p>
          <p className="mt-1 text-xs text-ink-muted">Aufgaben in praxis-/drill-Sets</p>
        </Card>
        <Card>
          <h2 className="mb-2 text-sm font-medium text-ink">Proben</h2>
          <p className={`tabular text-3xl ${tag.probes ? 'text-ink' : 'text-warn'}`}>{tag.probes}</p>
          <p className="mt-1 text-xs text-ink-muted">
            {tag.probes ? 'wird später erneut gefragt' : 'geübt, aber nie erneut gefragt'}
          </p>
        </Card>
        <Card>
          <h2 className="mb-2 text-sm font-medium text-ink">Strukturen ({points.length})</h2>
          {points.length ? (
            <ul className="space-y-1 text-xs">
              {points.map((p) => (
                <li key={p.id}>
                  <a className="text-info hover:underline" href={href('struktur', p.id)}>
                    {p.de}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-ink-muted">gehört zu keiner Inventarzeile</p>
          )}
        </Card>
      </div>

      <h2 className="mb-2 mt-6 text-sm font-medium text-ink">Elemente ({elements.length})</h2>
      {groups.size === 0 ? (
        <Empty>Kein Element trägt diesen Tag.</Empty>
      ) : (
        [...groups.entries()].map(([topicId, rows]) => (
          <section key={topicId} className="mb-4">
            <h3 className="mb-1 text-xs font-medium text-ink-muted">
              <a className="text-info hover:underline" href={href('thema', topicId)}>
                {topicTitle(graph, topicId)}
              </a>
            </h3>
            <Table
              rows={rows}
              rowKey={(e) => e.id}
              columns={[
                { key: 'kind', head: 'Art', cell: (e) => e.kind },
                { key: 'stage', head: 'Stufe', cell: (e) => <Chip>{STAGE_LABEL[e.stage] ?? e.stage}</Chip> },
                { key: 'items', head: 'Aufgaben', numeric: true, cell: (e) => e.depth.items || '' },
                {
                  key: 'file',
                  head: 'Datei',
                  cell: (e) => (
                    <a
                      className="text-info hover:underline"
                      href={`${GITHUB}/${e.file}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {e.id.split('#')[0]}
                    </a>
                  ),
                },
              ]}
            />
          </section>
        ))
      )}
    </>
  );
}
