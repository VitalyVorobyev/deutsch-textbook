/**
 * The whole grammatical map in one matrix: every strand this course knows against every CEFR
 * level the schema knows. Every column renders, even an empty B2 — that emptiness is the design
 * commitment, because it is the only place in the console that shows the size of the remaining
 * job at a glance rather than hiding it behind a level that simply has no cards yet.
 */
import { Card, Heading, Table, type Column } from '@da/ui/primitives';
import type { GraphPayload } from '../data';
import { href } from '../router';

type GrammarPoint = GraphPayload['inventory'][number];
type Level = GraphPayload['levels'][number];

function production(p: GrammarPoint): Level | undefined {
  return p.level?.production ?? p.standard_level;
}
function reception(p: GrammarPoint): Level | undefined {
  return p.level?.reception ?? production(p);
}

export function Sprachkarte({ graph }: { graph: GraphPayload }) {
  const strands = [...new Set(graph.inventory.map((p) => p.strand).filter((s): s is NonNullable<typeof s> => !!s))].sort();
  const taughtTags = new Set(graph.elements.flatMap((e) => e.focus));
  const isTaught = (p: GrammarPoint) => (p.focus ?? []).some((tag) => taughtTags.has(tag));

  const columns: Column<string>[] = [
    {
      key: 'strand',
      head: 'Strang',
      cell: (strand) => <span className="font-medium text-ink">{strand}</span>,
    },
    ...graph.levels.map((level) => ({
      key: level,
      head: level,
      cell: (strand: string) => {
        const points = graph.inventory.filter((p) => p.strand === strand && production(p) === level);
        if (!points.length) return <span className="text-ink-muted">—</span>;
        return (
          <span className="flex flex-wrap gap-x-2 gap-y-1">
            {points.map((p) => {
              const rec = reception(p);
              const untimely = !!rec && rec !== production(p);
              return (
                <a
                  key={p.id}
                  href={href('struktur', p.id)}
                  className={`whitespace-nowrap hover:underline ${isTaught(p) ? 'text-ok' : 'text-warn'}`}
                  title={
                    untimely
                      ? `Rezeption ab ${rec}, ein Niveau vor der Produktion erwartet`
                      : isTaught(p)
                        ? 'mindestens ein Thema unterrichtet diese Struktur'
                        : 'kein Element trägt einen ihrer Fokus-Tags'
                  }
                >
                  {p.id}
                  {untimely ? '⌛' : ''}
                </a>
              );
            })}
          </span>
        );
      },
    })),
  ];

  return (
    <>
      <Heading sub={`${strands.length} Stränge × ${graph.levels.length} Niveaus`}>Sprachkarte</Heading>

      <Table columns={columns} rows={strands} rowKey={(s) => s} />

      <Card className="mt-6">
        <h2 className="mb-2 text-sm font-medium text-ink">Legende</h2>
        <ul className="space-y-1.5 text-xs">
          <li className="flex items-center gap-2">
            <span className="text-ok">grün</span>
            <span className="text-ink-muted">mindestens ein Thema unterrichtet diese Struktur (erscheint in einem Element-Fokus)</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="text-warn">rot</span>
            <span className="text-ink-muted">im Inventar, aber kein Element trägt einen ihrer Fokus-Tags</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="text-ink">⌛</span>
            <span className="text-ink-muted">der Standard erwartet Verstehen ein Niveau vor dem Produzieren</span>
          </li>
        </ul>
      </Card>
    </>
  );
}
