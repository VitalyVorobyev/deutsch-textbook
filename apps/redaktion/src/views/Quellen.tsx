/**
 * Every external structure list this course cites, and how much of it the inventory has claimed
 * — the denominator's own denominator, in its own room. `graph.sources` is the raw
 * `data/strukturenlisten/` corpus; claimed/unclaimed here is a direct join against
 * `graph.inventory[].claims`, the same relation `structureCoverage()` measures per level.
 */
import { Card, Chip, Empty, Heading, Table } from '@da/ui/primitives';
import type { GraphPayload } from '../data';

function entryRef(sourceId: string, key: string): string {
  return `${sourceId}:${key}`;
}

export function Quellen({ graph }: { graph: GraphPayload }) {
  const claimedRefs = new Set(graph.inventory.flatMap((p) => p.claims ?? []));
  const uncoveredLevels = graph.levels.filter(
    (level) => !graph.sources.some((s) => s.source.levels.includes(level)),
  );

  return (
    <>
      <Heading sub={`${graph.sources.length} externe Strukturenlisten`}>Quellen</Heading>

      {graph.sources.length === 0 ? (
        <Empty>Keine externen Quellen im Korpus.</Empty>
      ) : (
        graph.sources.map((src) => {
          const entries = src.sections.flatMap((sec) => sec.entries);
          const claimed = entries.filter((entry) => claimedRefs.has(entryRef(src.source.id, entry.key)));
          const unclaimed = entries.length - claimed.length;
          return (
            <Card key={src.source.id} className="mb-6">
              <h2 className="text-base font-semibold text-ink">{src.source.title}</h2>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs md:grid-cols-4">
                <span className="text-ink-muted">Verlag</span>
                <span className="text-ink">{src.source.publisher ?? '—'}</span>
                <span className="text-ink-muted">Ausgabe</span>
                <span className="text-ink">{src.source.edition ?? '—'}</span>
                <span className="text-ink-muted">Seiten</span>
                <span className="text-ink">{src.source.pages ?? '—'}</span>
                <span className="text-ink-muted">Modus</span>
                <span className="text-ink">{src.source.mode ?? 'unstated'}</span>
                <span className="text-ink-muted">Niveaus</span>
                <span className="text-ink">{src.source.levels.join(', ')}</span>
                <span className="text-ink-muted">Abschnitte</span>
                <span className="text-ink">{src.sections.length}</span>
                <span className="text-ink-muted">beansprucht</span>
                <span className="text-ok">{claimed.length}</span>
                <span className="text-ink-muted">unbeansprucht</span>
                <span className={unclaimed > 0 ? 'text-warn' : 'text-ink'}>{unclaimed}</span>
              </div>
              {src.source.url ? (
                <a
                  className="mt-2 inline-block text-xs text-info hover:underline"
                  href={src.source.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {src.source.url}
                </a>
              ) : null}

              <div className="mt-4">
                <Table
                  rows={entries}
                  rowKey={(entry) => `${src.source.id}:${entry.key}`}
                  columns={[
                    { key: 'key', head: 'Schlüssel', cell: (entry) => entry.key },
                    { key: 'level', head: 'Niveau', cell: (entry) => entry.level },
                    { key: 'de', head: 'Bezeichnung', cell: (entry) => entry.de },
                    {
                      key: 'status',
                      head: 'Status',
                      cell: (entry) =>
                        claimedRefs.has(entryRef(src.source.id, entry.key)) ? (
                          <Chip tone="ok">beansprucht</Chip>
                        ) : (
                          <Chip tone="warn">unbeansprucht</Chip>
                        ),
                    },
                  ]}
                />
              </div>
            </Card>
          );
        })
      )}

      {uncoveredLevels.length ? (
        <Card>
          <h2 className="mb-1 text-sm font-medium text-warn">ohne externen Anker</h2>
          <p className="text-xs text-ink-muted">
            {uncoveredLevels.join(', ')} — für diese Niveaus existiert keine Quelle; sie werden nur gegen das
            eigene Inventar gemessen.
          </p>
        </Card>
      ) : null}
    </>
  );
}
