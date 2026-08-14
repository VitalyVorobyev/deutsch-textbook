/**
 * The grammar inventory: every structure this course claims to teach, its reception/production
 * split, the confusions that name it, and the sources and topics behind it — read straight off
 * `graph.inventory`, `graph.sources` and `graph.elements`, never re-scored.
 */
import { useState } from 'react';
import { Card, Chip, Empty, Filter, Heading, Table } from '@da/ui/primitives';
import type { GraphPayload } from '../data';
import { href } from '../router';

type Level = GraphPayload['levels'][number];
type GrammarPoint = GraphPayload['inventory'][number];

const GITHUB = 'https://github.com/VitalyVorobyev/deutsch-textbook/blob/main';

function production(p: GrammarPoint): Level | undefined {
  return p.level?.production ?? p.standard_level;
}
function reception(p: GrammarPoint): Level | undefined {
  return p.level?.reception ?? production(p);
}
function topicTitle(graph: GraphPayload, id: string): string {
  return graph.topics.find((t) => t.id === id)?.title ?? id;
}
function teachingTopics(graph: GraphPayload, point: GrammarPoint): string[] {
  const tags = new Set(point.focus ?? []);
  if (!tags.size) return [];
  return [...new Set(graph.elements.filter((e) => e.focus.some((f) => tags.has(f))).map((e) => e.topic))];
}

export function Struktur({ graph, id }: { graph: GraphPayload; id?: string }) {
  return id ? <StrukturDetail graph={graph} id={id} /> : <StrukturListe graph={graph} />;
}

function StrukturListe({ graph }: { graph: GraphPayload }) {
  const [strand, setStrand] = useState<string>('alle');
  const [level, setLevel] = useState<Level | 'alle'>('alle');

  const strandOptions = [
    ...new Set(graph.inventory.map((p) => p.strand).filter((s): s is NonNullable<typeof s> => !!s)),
  ].sort();

  const filtered = graph.inventory.filter(
    (p) => (strand === 'alle' || p.strand === strand) && (level === 'alle' || production(p) === level),
  );

  return (
    <>
      <Heading sub={`${filtered.length} von ${graph.inventory.length} Strukturen`}>Strukturen</Heading>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Filter label="Strang" value={strand} options={strandOptions} onChange={setStrand} />
        <Filter label="Produktionsniveau" value={level} options={graph.levels} onChange={setLevel} />
      </div>

      <Table
        rows={filtered}
        rowKey={(p) => p.id}
        columns={[
          {
            key: 'id',
            head: 'Kennung',
            cell: (p) => (
              <a className="text-info hover:underline" href={href('struktur', p.id)}>
                {p.id}
              </a>
            ),
          },
          { key: 'de', head: 'Bezeichnung', cell: (p) => p.de },
          { key: 'strand', head: 'Strang', cell: (p) => p.strand ?? '—' },
          {
            key: 'level',
            head: 'Niveau',
            cell: (p) => {
              const prod = production(p);
              const rec = reception(p);
              const differs = rec && rec !== prod;
              return (
                <span className="flex items-center gap-1">
                  <span className="text-ink">{prod ?? '—'}</span>
                  {differs ? (
                    <Chip tone="info" title="Der Standard erwartet Verstehen ein Niveau vor der Produktion">
                      Rez. {rec}
                    </Chip>
                  ) : null}
                </span>
              );
            },
          },
          {
            key: 'focus',
            head: 'Fokus',
            cell: (p) => (
              <span className="flex flex-wrap gap-1">
                {(p.focus ?? []).map((tag) => (
                  <a key={tag} href={href('fokus', tag)}>
                    <Chip tone="info">{tag}</Chip>
                  </a>
                ))}
              </span>
            ),
          },
          {
            key: 'topics',
            head: 'Themen',
            cell: (p) => (
              <span className="flex flex-wrap gap-2 text-xs">
                {teachingTopics(graph, p).map((t) => (
                  <a key={t} className="text-info hover:underline" href={href('thema', t)}>
                    {topicTitle(graph, t)}
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

function StrukturDetail({ graph, id }: { graph: GraphPayload; id: string }) {
  const point = graph.inventory.find((p) => p.id === id);
  if (!point) return <Empty>Keine Struktur mit der Kennung „{id}“.</Empty>;

  const prod = production(point);
  const rec = reception(point);
  const topics = teachingTopics(graph, point);
  const focusTags = new Set(point.focus ?? []);
  const elements = graph.elements.filter((e) => e.focus.some((f) => focusTags.has(f)));
  const claims = point.claims ?? [];

  return (
    <>
      <Heading sub={`${point.id} · ${point.strand ?? 'kein Strang'}`}>{point.de}</Heading>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-2 text-sm font-medium text-ink">Erklärung</h2>
          <p className="text-sm text-ink">{point.de}</p>
          <p className="mt-1 text-sm text-ink-muted">{point.en}</p>
          {point.note ? <p className="mt-2 text-xs text-ink-muted">{point.note}</p> : null}
          <div className="mt-3 grid grid-cols-2 gap-1 text-xs">
            <span className="text-ink-muted">Produktion</span>
            <span className="text-ink">{prod ?? '—'}</span>
            <span className="text-ink-muted">Rezeption</span>
            <span className={rec && rec !== prod ? 'text-info' : 'text-ink'}>{rec ?? '—'}</span>
          </div>
        </Card>

        <Card>
          <h2 className="mb-2 text-sm font-medium text-ink">Fokus-Tags</h2>
          <span className="flex flex-wrap gap-1">
            {(point.focus ?? []).map((tag) => (
              <a key={tag} href={href('fokus', tag)}>
                <Chip tone="info">{tag}</Chip>
              </a>
            ))}
          </span>
          {point.deepens?.length ? (
            <>
              <h2 className="mb-1 mt-3 text-sm font-medium text-ink">vertieft</h2>
              <ul className="space-y-1 text-xs">
                {point.deepens.map((d) => (
                  <li key={d}>
                    <a className="text-info hover:underline" href={href('struktur', d)}>
                      {d}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </Card>
      </div>

      <h2 className="mb-2 mt-6 text-sm font-medium text-ink">Belege ({claims.length})</h2>
      {claims.length === 0 ? (
        <Empty>Keine externe Quelle zitiert.</Empty>
      ) : (
        <ul className="space-y-1.5 text-xs">
          {claims.map((ref) => {
            const [sourceId, ...rest] = ref.split(':');
            const key = rest.join(':');
            const source = graph.sources.find((s) => s.source.id === sourceId);
            const section = source?.sections.find((sec) => sec.entries.some((entry) => entry.key === key));
            const entry = section?.entries.find((e) => e.key === key);
            return (
              <li key={ref}>
                {entry && source ? (
                  <span className="text-ink">
                    <span className="text-ink-muted">{source.source.title}</span> — {entry.de}
                    {section?.page ? <span className="text-ink-muted"> (S. {section.page})</span> : null}
                  </span>
                ) : (
                  <span className="text-warn">{ref} — nicht auflösbar</span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <h2 className="mb-2 mt-6 text-sm font-medium text-ink">Themen ({topics.length})</h2>
      {topics.length === 0 ? (
        <Empty>Kein Thema unterrichtet diese Struktur.</Empty>
      ) : (
        topics.map((topicId) => (
          <section key={topicId} className="mb-4">
            <h3 className="mb-1 text-xs font-medium text-ink-muted">
              <a className="text-info hover:underline" href={href('thema', topicId)}>
                {topicTitle(graph, topicId)}
              </a>
            </h3>
            <Table
              rows={elements.filter((e) => e.topic === topicId)}
              rowKey={(e) => e.id}
              columns={[
                { key: 'kind', head: 'Art', cell: (e) => e.kind },
                { key: 'stage', head: 'Stufe', cell: (e) => e.stage },
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
