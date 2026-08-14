/**
 * The landing view: one card per level with topics, the four coverage instruments and both
 * median families side by side — so "how far is A2" has one answer instead of five commands.
 *
 * Every number here is read, never recomputed: each figure is exactly what
 * `graph.reports[].{grammar,wortliste,structures,depth,medians}` already measured server-side. A
 * level whose structure coverage has no external anchor says so in words — a percentage measured
 * only against the course's own inventory would be a number with nothing behind it.
 */
import { Bar, Card, Chip, Heading } from '@da/ui/primitives';
import type { GraphPayload } from '../data';
import { href } from '../router';

function problemCounts(problems: GraphPayload['problems']): [string, number][] {
  const counts = new Map<string, number>();
  for (const p of problems) counts.set(p.kind, (counts.get(p.kind) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

export function Ueberblick({ graph }: { graph: GraphPayload }) {
  const levels = graph.reports.filter((r) => (r.medians?.topics ?? 0) > 0);
  const counts = problemCounts(graph.problems);

  return (
    <>
      <Heading sub="Vier Messinstrumente, ein Kartenblatt pro Niveau — jede Zahl kommt aus dem Korpus, keine wird hier neu berechnet.">
        Überblick
      </Heading>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {levels.map((report) => {
          const { level, grammar, wortliste, structures, depth, medians } = report;
          return (
            <Card key={level}>
              <h2 className="text-lg font-semibold text-ink">{level}</h2>
              <p className="mb-3 text-xs text-ink-muted">{medians?.topics ?? 0} Themen</p>

              <ul className="space-y-3">
                <li>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-ink-muted">Grammatik</span>
                    <span className="tabular text-ink">{grammar ? `${grammar.covered}/${grammar.total}` : '–'}</span>
                  </div>
                  {grammar ? (
                    <Bar value={grammar.covered} max={grammar.total} tone="brand" />
                  ) : (
                    <p className="text-xs text-warn">keine Grammatikliste</p>
                  )}
                </li>

                <li>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-ink-muted">Wortliste</span>
                    <span className="tabular text-ink">{wortliste ? `${wortliste.percent}%` : '–'}</span>
                  </div>
                  {wortliste ? (
                    <Bar value={wortliste.percent} max={100} tone="ok" />
                  ) : (
                    <p className="text-xs text-warn">kein Wortlisten-Manifest</p>
                  )}
                </li>

                <li>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-ink-muted">Strukturen</span>
                    <span className="tabular text-ink">{structures?.anchored ? `${structures.percent}%` : ''}</span>
                  </div>
                  {structures?.anchored ? (
                    <Bar value={structures.claimed.length} max={structures.total} tone="info" />
                  ) : (
                    <p className="text-xs text-warn">kein externer Anker</p>
                  )}
                </li>
              </ul>

              <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-border-subtle pt-3 text-xs">
                <p className="col-span-2 text-ink-muted">Tiefe je Fokus-Tag (Median)</p>
                <p className="text-ink">
                  Lehre <span className="tabular text-ink-muted">{depth?.medianTeaching ?? '–'}</span>
                </p>
                <p className="text-ink">
                  produktiv <span className="tabular text-ink-muted">{depth?.medianProduction ?? '–'}</span>
                </p>
                <p className="text-ink">
                  Dateien <span className="tabular text-ink-muted">{depth?.medianFiles ?? '–'}</span>
                </p>
                <p className="text-ink">
                  ohne Probe <span className="tabular text-ink-muted">{depth?.pointsWithoutProbe ?? '–'}</span>
                </p>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-border-subtle pt-3 text-xs">
                <p className="col-span-2 text-ink-muted">pro Thema (Median)</p>
                <p className="text-ink">
                  Aufgaben <span className="tabular text-ink-muted">{medians?.items ?? '–'}</span>
                </p>
                <p className="text-ink">
                  produktiv <span className="tabular text-ink-muted">{medians?.production ?? '–'}</span>
                </p>
                <p className="text-ink">
                  Elemente <span className="tabular text-ink-muted">{medians?.elements ?? '–'}</span>
                </p>
                <p className="text-ink">
                  erfüllt <span className="tabular text-ink-muted">{medians?.met ?? '–'}</span>
                </p>
              </div>
            </Card>
          );
        })}
      </div>

      <h2 className="mb-2 mt-8 text-sm font-medium text-ink">Befunde ({graph.problems.length})</h2>
      <div className="flex flex-wrap gap-2">
        {counts.map(([kind, count]) => (
          <a key={kind} href={href('luecken')}>
            <Chip tone="warn">
              {kind} · {count}
            </Chip>
          </a>
        ))}
      </div>
    </>
  );
}
