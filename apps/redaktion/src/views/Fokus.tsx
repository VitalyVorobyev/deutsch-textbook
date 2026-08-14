/**
 * Fokus-Tags: every confusion this course can name, and how much stands behind each.
 *
 * WHAT WAS WRONG WITH THE OLD ONE WAS NOT ITS SHAPE. Measured at 1440×900 it was perfectly
 * regular — 102 rows, every one 21 px, raggedness 1.0. Its defect was that three of its six
 * columns were entirely blue (a median of three anchors per row, so **over three hundred links on
 * one screen**), and that the single most important thing it knew was a red `0` in the fifth
 * column, printed a hundred and two times and findable only by scanning. A finding that has to be
 * spotted is a finding the tool did not report.
 *
 * So: one primary link per row, the counts carry a scale, and the defect classes are a strip at the
 * top that **filters the list** — `18 ohne Probe` is a control, not a caption. A tag that is
 * drilled and never re-asked is the thing this page exists to surface (§1 retrieval, §2 spacing:
 * the delayed check is what closes the cycle), and it now leads.
 */
import { useState } from 'react';
import { Callout, Chip, Empty, Filter, Label, Panel, SearchBox, Section, Stat, StatGroup } from '@da/ui/primitives';
import { PROBLEM_LABELS } from '@da/content/profile';
import type { GraphPayload } from '../data';
import { Befundleiste } from '../components/Befundleiste';
import { Extern, Gruppentabelle, Mehrere, Primaer, Quer, Zahl, Zeilentabelle, type Spalte } from '../components/Zeilentabelle';
import { href } from '../router';

type Level = GraphPayload['levels'][number];
type Tag = GraphPayload['tags'][number];
type Element = GraphPayload['elements'][number];

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

export function Fokus({ graph, id }: { graph: GraphPayload; id?: string }) {
  return id ? <FokusDetail graph={graph} id={id} /> : <FokusListe graph={graph} />;
}

function FokusListe({ graph }: { graph: GraphPayload }) {
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState<Level | 'alle'>('alle');
  const [befund, setBefund] = useState<string | undefined>();
  const q = search.trim().toLowerCase();
  const topicTitle = (tid: string) => graph.topics.find((t) => t.id === tid)?.title ?? tid;

  /**
   * Findings are read, never re-derived: the two tag-level classes carry the tag in `message`, so
   * scoping the table is a lookup rather than a second implementation of the rule. A number here
   * that disagrees with `bun scripts/grammar-depth.ts` would mean this file is wrong.
   */
  const TAG_KINDS = ['tag-ohne-probe', 'tag-ohne-aufgabe'];
  const befunde = graph.problems.filter((p) => TAG_KINDS.includes(p.kind));
  const kindsOf = new Map<string, string[]>();
  for (const b of befunde) kindsOf.set(b.message, [...(kindsOf.get(b.message) ?? []), b.kind]);

  const filtered = graph.tags.filter(
    (t) =>
      (level === 'alle' || t.level === level) &&
      (!q || t.tag.toLowerCase().includes(q)) &&
      (!befund || (kindsOf.get(t.tag) ?? []).includes(befund)),
  );

  const maxTeaching = Math.max(1, ...graph.tags.map((t) => t.teaching));

  const columns: Spalte<Tag>[] = [
    { key: 'tag', head: 'Tag', sort: (t) => t.tag, cell: (t) => <Primaer href={href('fokus', t.tag)}>{t.tag}</Primaer> },
    {
      key: 'introducedBy',
      head: 'eingeführt von',
      sort: (t) => (t.introducedBy ? topicTitle(t.introducedBy) : 'ÿ'),
      cell: (t) =>
        t.introducedBy ? (
          <Quer href={href('thema', t.introducedBy)}>{topicTitle(t.introducedBy)}</Quer>
        ) : (
          <span className="text-warn-ink" title="Nicht in focusIntroducedBy — kein Thema führt ihn ein">
            nicht registriert
          </span>
        ),
    },
    { key: 'level', head: 'Niveau', sort: (t) => t.level ?? 'ÿ', cell: (t) => t.level ?? '—' },
    {
      key: 'teaching',
      head: 'Lehre',
      numeric: true,
      sort: (t) => t.teaching,
      cell: (t) => <Zahl value={t.teaching} max={maxTeaching} warnBei={0} />,
    },
    {
      key: 'probes',
      head: 'Proben',
      numeric: true,
      sort: (t) => t.probes,
      cell: (t) => (
        <span
          className={`tabular ${t.probes ? 'text-ink' : 'text-warn-ink'}`}
          title={t.probes ? undefined : PROBLEM_LABELS['tag-ohne-probe']?.why}
        >
          {t.probes}
        </span>
      ),
    },
    {
      key: 'points',
      head: 'Strukturen',
      sort: (t) => t.points.length,
      cell: (t) => (
        <Mehrere>
          {t.points.map((p) => (
            <Quer key={p} href={href('struktur', p)}>
              {p}
            </Quer>
          ))}
        </Mehrere>
      ),
    },
  ];

  return (
    <>
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Fokus-Tags</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {filtered.length} von {graph.tags.length} benannten Verwechslungen
        </p>
      </header>

      <Befundleiste befunde={befunde} aktiv={befund} onWaehlen={setBefund} leer="jeder Tag wird später erneut gefragt" />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="min-w-56 flex-1">
          <SearchBox value={search} onChange={setSearch} placeholder="Tag suchen …" />
        </div>
        <Filter label="Niveau" value={level} options={graph.levels} onChange={setLevel} />
      </div>

      <Zeilentabelle rows={filtered} rowKey={(t) => t.tag} columns={columns} sortKey="tag" />
    </>
  );
}

function FokusDetail({ graph, id }: { graph: GraphPayload; id: string }) {
  const tag = graph.tags.find((t) => t.tag === id);
  if (!tag) return <Empty>Kein Fokus-Tag „{id}“.</Empty>;

  const points = graph.inventory.filter((p) => tag.points.includes(p.id));
  const elements = graph.elements.filter((e) => e.focus.includes(id));
  const topicTitle = (tid: string) => graph.topics.find((t) => t.id === tid)?.title ?? tid;

  // Distinct practice files, because a confusion drilled in one sitting is met once and never
  // interleaved again — the number `grammar-depth.ts` exists to make visible.
  const files = new Set(elements.filter((e) => e.kind === 'praxis' || e.kind === 'drill').map((e) => e.file));

  const gruppen = [...new Set(elements.map((e) => e.topic))].map((tid) => ({
    id: tid,
    label: (
      <a href={href('thema', tid)} className="text-ink hover:text-brand-ink hover:underline">
        {topicTitle(tid)}
      </a>
    ),
    rows: elements.filter((e) => e.topic === tid),
  }));

  const columns: Spalte<Element>[] = [
    { key: 'kind', head: 'Art', cell: (e) => <span className="text-ink-muted">{e.kind}</span> },
    { key: 'stage', head: 'Stufe', cell: (e) => <Chip>{STAGE_LABEL[e.stage] ?? e.stage}</Chip> },
    { key: 'items', head: 'Aufgaben', numeric: true, cell: (e) => e.depth.items || '' },
    { key: 'prod', head: 'produktiv', numeric: true, cell: (e) => e.depth.production || '' },
    { key: 'file', head: 'Datei', cell: (e) => <Extern href={`${GITHUB}/${e.file}`}>{e.id.split('#')[0]}</Extern> },
  ];

  return (
    <>
      <header className="mb-5">
        <Label>
          {tag.level ?? 'kein Niveau ermittelt'} · eingeführt von{' '}
          {tag.introducedBy ? topicTitle(tag.introducedBy) : 'niemandem'}
        </Label>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">{tag.tag}</h1>
      </header>

      {tag.teaching > 0 && tag.probes === 0 ? (
        <Callout tone="warn" eyebrow="Befund" title="Geübt, aber nie erneut gefragt">
          {PROBLEM_LABELS['tag-ohne-probe']?.why}
        </Callout>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <Panel title="Tiefe">
          <StatGroup columns={3}>
            <Stat label="Lehre" value={tag.teaching} hint="praxis + drill" tone={tag.teaching ? 'neutral' : 'warn'} />
            <Stat label="Proben" value={tag.probes} tone={tag.probes ? 'neutral' : 'warn'} />
            <Stat label="Dateien" value={files.size} hint={files.size === 1 ? 'nur eine Sitzung' : undefined} tone={files.size === 1 ? 'warn' : 'neutral'} />
          </StatGroup>
        </Panel>

        <Panel title={`Strukturen (${points.length})`} tone={points.length ? 'neutral' : 'leer'} className="md:col-span-2">
          {points.length ? (
            <ul className="space-y-1 text-sm">
              {points.map((p) => (
                <li key={p.id}>
                  <a href={href('struktur', p.id)} className="text-ink hover:text-brand-ink hover:underline">
                    {p.de}
                  </a>
                  <span className="text-xs text-ink-muted"> · {p.id}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-ink-muted">
              Gehört zu keiner Inventarzeile — die Verwechslung wird geübt, aber keine Struktur nennt sie.
            </p>
          )}
        </Panel>
      </div>

      <Section count={elements.length}>Elemente</Section>
      <Gruppentabelle gruppen={gruppen} columns={columns} rowKey={(e) => e.id} empty="Kein Element trägt diesen Tag." />
    </>
  );
}
