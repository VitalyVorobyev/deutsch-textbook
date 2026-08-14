/**
 * Every published list this course measures itself against, entry by entry.
 *
 * This is the denominator's own denominator: `structures.ts` can only report a percentage of the
 * list it was given, and all three levels read 100% for a while against an A1 list that was missing
 * four structures the exam tests. So the lists themselves get a page.
 *
 * TWO THINGS ARE DELIBERATELY PROMINENT, because both have already been got wrong here:
 *
 *   - **`audience`.** For one day A2 read 138/138 = 100%, and the list it was 100% of was *Fit in
 *     Deutsch 2* — the exam for teenagers. This course is for an adult. The audience now sits in
 *     the source header rather than in a YAML field nobody opens.
 *   - **`cumulative`.** A source that levels nothing is not a source that covers every level
 *     equally, and reading it as one is how B1 could look anchored while nothing anchored it.
 *
 * The old page stacked all six sources as one scroll of mega-tables — 93 + 277 + 164 + 138 + … rows
 * with no way to see only what is unclaimed, which is the only thing anyone comes here for.
 */
import { useState } from 'react';
import { Chip, Empty, Label, Panel, Stat, StatGroup } from '@da/ui/primitives';
import { Reiter } from '../components/Hinweis';
import type { GraphPayload } from '../data';
import { Extern, Zeilentabelle, type Spalte } from '../components/Zeilentabelle';

type Source = GraphPayload['sources'][number];
type Entry = Source['sections'][number]['entries'][number] & { section: string; page?: number };

function entryRef(sourceId: string, key: string): string {
  return `${sourceId}:${key}`;
}

export function Quellen({ graph }: { graph: GraphPayload }) {
  const [active, setActive] = useState(graph.sources[0]?.source.id ?? '');
  const [nurOffen, setNurOffen] = useState(false);

  if (!graph.sources.length) return <Empty>Keine externen Quellen im Korpus.</Empty>;

  const claimedRefs = new Set(graph.inventory.flatMap((p) => p.claims ?? []));
  const src = graph.sources.find((s) => s.source.id === active) ?? graph.sources[0]!;
  const meta = src.source;

  const entries: Entry[] = src.sections.flatMap((sec) =>
    sec.entries.map((e) => ({ ...e, section: sec.de, page: sec.page })),
  );
  const claimed = (e: Entry) => claimedRefs.has(entryRef(meta.id, e.key));
  const open = entries.filter((e) => !claimed(e));
  const shown = nurOffen ? open : entries;

  const uncovered = graph.levels.filter((l) => !graph.sources.some((s) => s.source.levels.includes(l)));

  const columns: Spalte<Entry>[] = [
    { key: 'de', head: 'Bezeichnung', sort: (e) => e.de, cell: (e) => <span className="text-ink">{e.de}</span> },
    { key: 'section', head: 'Abschnitt', sort: (e) => e.section, cell: (e) => <span className="text-ink-muted">{e.section}</span> },
    { key: 'key', head: 'Schlüssel', sort: (e) => e.key, cell: (e) => <span className="text-xs text-ink-muted">{e.key}</span> },
    { key: 'level', head: 'Niveau', sort: (e) => e.level ?? '', cell: (e) => e.level ?? '—' },
    {
      key: 'status',
      head: 'Status',
      sort: (e) => (claimed(e) ? 1 : 0),
      cell: (e) => (claimed(e) ? <Chip tone="ok">beansprucht</Chip> : <Chip tone="warn">offen</Chip>),
    },
  ];

  return (
    <>
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Quellen</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {graph.sources.length} veröffentlichte Listen · das Inventar wird gegen sie gemessen, nicht gegen sich selbst
        </p>
      </header>

      {uncovered.length ? (
        <Panel tone="warn" className="mb-5">
          <Label>ohne externen Anker</Label>
          <p className="mt-1 text-sm text-ink">
            {uncovered.join(', ')} — für diese Niveaus existiert keine Quelle, also gibt es auch keine Zahl.
          </p>
        </Panel>
      ) : null}

      <div className="mb-4 max-w-full overflow-x-auto">
        <Reiter
          ariaLabel="Quelle"
          value={active}
          onChange={setActive}
          options={graph.sources.map((s) => ({ id: s.source.id, label: s.source.id }))}
        />
      </div>

      <Panel className="mb-5" title={meta.title}>
        <StatGroup columns={4}>
          <Stat label="Einträge" value={entries.length} hint={`${src.sections.length} Abschnitte`} />
          <Stat label="beansprucht" value={entries.length - open.length} tone="ok" />
          <Stat label="offen" value={open.length} tone={open.length ? 'warn' : 'neutral'} />
          <Stat
            label="Niveaus"
            value={meta.levels.join(' ')}
            hint={meta.cumulative ? 'kumulativ — die Liste stuft nichts ein' : 'je Eintrag eingestuft'}
          />
        </StatGroup>

        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-t border-border-subtle pt-3 text-xs">
          {/* Load-bearing, not documentation — see the header comment. */}
          <dt className="text-ink-muted">Publikum</dt>
          <dd className={meta.audience ? 'font-medium text-ink' : 'text-warn-ink'}>
            {meta.audience ?? 'nicht angegeben — wessen Prüfung ist das?'}
          </dd>
          <dt className="text-ink-muted">Verlag</dt>
          <dd className="text-ink">{meta.publisher ?? '—'}</dd>
          <dt className="text-ink-muted">Ausgabe</dt>
          <dd className="text-ink">
            {meta.edition ?? '—'}
            {meta.status === 'retired' ? <Chip tone="warn"> abgelöst</Chip> : null}
          </dd>
          <dt className="text-ink-muted">Seiten</dt>
          <dd className="text-ink">{meta.pages ?? '—'}</dd>
          <dt className="text-ink-muted">Modus</dt>
          <dd className="text-ink">{meta.mode ?? 'unstated'}</dd>
          {meta.url ? (
            <>
              <dt className="text-ink-muted">Quelle</dt>
              <dd>
                <Extern href={meta.url}>{meta.url}</Extern>
              </dd>
            </>
          ) : null}
        </dl>
      </Panel>

      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">
          {shown.length} von {entries.length} Einträgen
        </p>
        <button
          type="button"
          aria-pressed={nurOffen}
          onClick={() => setNurOffen((v) => !v)}
          className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${
            nurOffen ? 'border-warn bg-warn text-white' : 'border-border-subtle text-ink-muted hover:text-ink'
          }`}
        >
          nur offene ({open.length})
        </button>
      </div>

      <Zeilentabelle rows={shown} rowKey={(e) => `${meta.id}:${e.key}`} columns={columns} sortKey="de" />
    </>
  );
}
