/**
 * The front door: the whole grammatical map, and how much of it this course has built.
 *
 * WHAT THE FIRST ONE DID. It printed every structure id into a table cell — ten rows, up to
 * twenty-one links in one of them, coloured green or red. Every fact was present and the shape was
 * not: comparing ten strands across four levels meant reading ninety-eight identifiers. Measured on
 * that build, the widest row ran 116 px against a 68 px median and one cell held 21 anchors.
 *
 * WHAT THIS ONE ASKS. *Where is this course thin?* — answered in one glance by area, then
 * descended into. The matrix geometry comes from the corpus rather than from taste: 10 strands ×
 * 4 levels, 23 non-empty cells, at most 12 structures in one (`satzverbindung` at B1), so every
 * cell reserves twelve slots and a thin strand looks thin.
 *
 * B2 IS AN EMPTY COLUMN ON PURPOSE, and it is the reason this view is worth having. It is 0/0 in
 * all ten strands. A level with no inventory rows renders as a column of dots rather than being
 * dropped, because the size of the remaining job is the one thing a coverage percentage can never
 * show: every instrument in this repo reports A1, A2 and B1 and would happily read 100% while the
 * course stops where it stops.
 *
 * Every figure below is read, never recomputed — `graph.reports[]` is exactly what
 * `bun scripts/grammar-coverage.ts`, `coverage.ts`, `structures.ts` and `grammar-depth.ts` measure.
 * A number here that disagrees with those commands means this file is wrong.
 */
import { Bar, Button, Callout, Label, Panel, Section, Stat, StatGroup } from '@da/ui/primitives';
import { PROBLEM_LABELS } from '@da/content/profile';
import { DichteLegende, Matrix, type Zelle } from '../components/Dichte';
import type { GraphPayload } from '../data';
import { href } from '../router';

type Level = GraphPayload['levels'][number];
type GrammarPoint = GraphPayload['inventory'][number];

function production(p: GrammarPoint): Level | undefined {
  return p.level?.production ?? p.standard_level;
}

export function Sprachkarte({ graph }: { graph: GraphPayload }) {
  const taught = new Set(graph.elements.flatMap((e) => e.focus));
  const isTaught = (p: GrammarPoint) => (p.focus ?? []).some((tag) => taught.has(tag));

  const strands = [
    ...new Set(graph.inventory.map((p) => p.strand).filter((s): s is NonNullable<typeof s> => !!s)),
  ].sort();

  const cellPoints = (strand: string, level: string) =>
    graph.inventory.filter((p) => p.strand === strand && production(p) === level);

  // The slot count is the matrix-wide maximum: alignment across columns IS the comparison, so a
  // cell must never size itself.
  const slots = Math.max(
    1,
    ...strands.flatMap((s) => graph.levels.map((l) => cellPoints(s, l).length)),
  );

  const untaught = graph.problems.filter((p) => p.kind === 'punkt-ohne-thema');
  // The standard expects understanding a level before producing — a real fact with its own home on
  // the Struktur page. It is a count here, never a third fill: one glyph answering two questions
  // answers neither.
  const late = graph.inventory.filter((p) => {
    const rec = p.level?.reception ?? production(p);
    return rec && rec !== production(p);
  }).length;

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Sprachkarte</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {graph.inventory.length} Strukturen in {strands.length} Strängen · {late} davon erwarten Rezeption
          ein Niveau vor der Produktion
        </p>
      </header>

      {untaught.length ? (
        <Callout
          tone="warn"
          eyebrow="Lücke im Inventar"
          title={`${untaught.length} Strukturen unterrichtet kein Thema`}
          action={<Button href={href('luecken')}>im Befundeingang öffnen</Button>}
        >
          {PROBLEM_LABELS['punkt-ohne-thema']?.why}
        </Callout>
      ) : (
        <Callout tone="ok" eyebrow="Inventar" title="Jede Struktur wird von einem Thema unterrichtet" />
      )}

      <Section>Gelehrt und ungelehrt</Section>
      <Matrix
        rows={strands.map((s) => ({ id: s, label: s }))}
        columns={[...graph.levels]}
        slots={slots}
        columnNote={(level) =>
          cellPoints('', level).length === 0 &&
          graph.inventory.every((p) => production(p) !== level) ? (
            <p className="mt-0.5 max-w-24 text-[0.65rem] leading-tight text-ink-muted">
              das Inventar führt hier nichts
            </p>
          ) : null
        }
        cell={(row, level): Zelle => {
          const points = cellPoints(row.id, level);
          return {
            items: points.map((p) => ({ id: p.id, label: p.de, on: isTaught(p) })),
            // The cell hands over its own six rows rather than the whole inventory — the point of
            // making filter state addressable.
            href: points.length ? href('struktur', undefined, { strang: row.id, niveau: level }) : undefined,
          };
        }}
      />
      <div className="mt-4">
        <DichteLegende />
      </div>

      <Section>Wie weit jedes Niveau ist</Section>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {/* Levels that have topics. B2 belongs in the matrix above, where its emptiness is the
            finding, and not here, where a card of dashes says nothing. */}
        {graph.reports
          .filter((r) => (r.medians?.topics ?? 0) > 0)
          .map((report) => (
            <NiveauPanel key={report.level} report={report} />
          ))}
      </div>
    </>
  );
}

/**
 * One level's four instruments, read straight off `graph.reports`. Where a level has no external
 * anchor the panel says so in words rather than printing a percentage measured against the course's
 * own inventory — a number with nothing behind it is worse than no number.
 */
function NiveauPanel({ report }: { report: GraphPayload['reports'][number] }) {
  const { level, grammar, wortliste, structures, depth, medians } = report;
  return (
    <Panel title={level} action={<span className="text-xs text-ink-muted">{medians?.topics ?? 0} Themen</span>}>
      <StatGroup columns={2}>
        <Stat
          label="Wortliste"
          value={wortliste ? `${wortliste.percent}%` : '–'}
          hint={wortliste ? `${wortliste.cards} von ${wortliste.total} als Karte` : 'kein Manifest'}
          tone={wortliste && wortliste.percent >= 100 ? 'ok' : 'neutral'}
        />
        <Stat
          label="Grammatik"
          value={grammar ? `${grammar.covered}/${grammar.total}` : '–'}
          hint="Punkte, die eine Übung trägt"
          tone={grammar && grammar.missing > 0 ? 'warn' : 'neutral'}
        />
      </StatGroup>

      <div className="mt-4 border-t border-border-subtle pt-3">
        <Label>Strukturen gegen den Standard</Label>
        {structures?.anchored ? (
          <>
            <div className="mt-1.5">
              <Bar value={structures.claimed.length} max={structures.total} tone="info" />
            </div>
            <p className="tabular mt-1 text-xs text-ink-muted">
              {structures.claimed.length}/{structures.total} · {structures.percent}%
            </p>
            {/* Load-bearing, not decoration: A2 read 138/138 = 100% for a day against the exam for
                teenagers, and nothing in the report said whose exam it was. */}
            {structures.sources.map((s) => s.audience).filter(Boolean).length ? (
              <p className="mt-0.5 text-xs text-ink-muted">
                {[...new Set(structures.sources.map((s) => s.audience).filter(Boolean))].join(' · ')}
              </p>
            ) : null}
          </>
        ) : (
          <p className="mt-1.5 text-xs text-warn-ink">kein externer Anker — also keine Zahl</p>
        )}
      </div>

      <div className="mt-3 border-t border-border-subtle pt-3">
        <Label>Median je Verwechslung</Label>
        <p className="tabular mt-1 text-xs text-ink-muted">
          {depth?.medianTeaching ?? '–'} Aufgaben · {depth?.medianProduction ?? '–'} produktiv ·{' '}
          {depth?.medianFiles ?? '–'} Dateien
          {depth?.pointsWithoutProbe ? (
            <span className="text-warn-ink"> · {depth.pointsWithoutProbe} ohne Probe</span>
          ) : null}
        </p>
      </div>
    </Panel>
  );
}
