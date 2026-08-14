/**
 * The grammar inventory: every structure this course claims to teach, and what stands behind it.
 *
 * THIS IS THE VIEW THE REDESIGN WAS CALLED IN OVER. Measured on the old build at 1440×900: a
 * median row height of 40 px, a **maximum of 224 px**, and a median of four anchors per row rising
 * to sixteen. One relation caused all of it — `Themen` rendered *every* topic whose elements carry
 * any of a structure's focus tags, which for `verbzweit` is twenty of the forty-nine. A
 * one-to-many relation with a fat tail is not a table column, so it is bounded now: two topics and
 * a count, expandable where the reader wants it.
 *
 * The list is also reachable *scoped*, which it was not before. A cell on the Sprachkarte reading
 * `nominalgruppe A1 3/6` links here with `?strang=nominalgruppe&niveau=A1`, so the map can hand
 * over exactly the rows it was pointing at.
 */
import { useState } from 'react';
import { Button, Callout, Chip, Empty, Filter, Label, Panel, Section } from '@da/ui/primitives';
import { PROBLEM_LABELS } from '@da/content/profile';
import type { GraphPayload } from '../data';
import { Extern, Gruppentabelle, Mehrere, Primaer, Quer, Zeilentabelle, type Spalte } from '../components/Zeilentabelle';
import { href, useQueryState } from '../router';

type Level = GraphPayload['levels'][number];
type GrammarPoint = GraphPayload['inventory'][number];
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

function production(p: GrammarPoint): Level | undefined {
  return p.level?.production ?? p.standard_level;
}
function reception(p: GrammarPoint): Level | undefined {
  return p.level?.reception ?? production(p);
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
  // The hash IS the filter state, so a Sprachkarte cell can hand over exactly its own rows and the
  // reader can send that list to someone. `useState` seeded from the route would be a second copy
  // that drifts on the back button.
  const [strand, setStrand] = useQueryState('strang', 'alle');
  const [level, setLevel] = useQueryState('niveau', 'alle');
  const [nurUngelehrt, setNurUngelehrt] = useState(false);

  const taught = new Set(graph.elements.flatMap((e) => e.focus));
  const isTaught = (p: GrammarPoint) => (p.focus ?? []).some((tag) => taught.has(tag));

  const strandOptions = [
    ...new Set(graph.inventory.map((p) => p.strand).filter((s): s is NonNullable<typeof s> => !!s)),
  ].sort();

  const filtered = graph.inventory.filter(
    (p) =>
      (strand === 'alle' || p.strand === strand) &&
      (level === 'alle' || production(p) === (level as Level)) &&
      (!nurUngelehrt || !isTaught(p)),
  );

  const untaught = graph.inventory.filter((p) => !isTaught(p)).length;
  const topicTitle = (tid: string) => graph.topics.find((t) => t.id === tid)?.title ?? tid;

  const columns: Spalte<GrammarPoint>[] = [
    {
      key: 'de',
      head: 'Struktur',
      sort: (p) => p.de,
      cell: (p) => (
        <span className="flex items-center gap-2">
          {!isTaught(p) ? <span className="h-2 w-2 shrink-0 rounded-[2px] border border-warn/70" title="ungelehrt" /> : null}
          <Primaer href={href('struktur', p.id)}>{p.de}</Primaer>
        </span>
      ),
    },
    { key: 'id', head: 'Kennung', sort: (p) => p.id, cell: (p) => <span className="text-xs text-ink-muted">{p.id}</span> },
    { key: 'strand', head: 'Strang', sort: (p) => p.strand ?? '', cell: (p) => <span className="text-ink-muted">{p.strand ?? '—'}</span> },
    {
      key: 'level',
      head: 'Niveau',
      sort: (p) => production(p) ?? '',
      cell: (p) => {
        const prod = production(p);
        const rec = reception(p);
        return (
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="text-ink">{prod ?? '—'}</span>
            {rec && rec !== prod ? (
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
        <Mehrere>
          {(p.focus ?? []).map((tag) => (
            <Quer key={tag} href={href('fokus', tag)}>
              {tag}
            </Quer>
          ))}
        </Mehrere>
      ),
    },
    {
      key: 'topics',
      head: 'Themen',
      numeric: false,
      sort: (p) => teachingTopics(graph, p).length,
      // Bounded on purpose — see the header comment. This one cell used to make the row 224 px.
      cell: (p) => (
        <Mehrere>
          {teachingTopics(graph, p).map((t) => (
            <Quer key={t} href={href('thema', t)}>
              {topicTitle(t)}
            </Quer>
          ))}
        </Mehrere>
      ),
    },
  ];

  return (
    <>
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Strukturen</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {filtered.length} von {graph.inventory.length} Zeilen des Grammatikinventars
        </p>
      </header>

      {untaught ? (
        <Callout
          tone="warn"
          eyebrow="Befund"
          title={`${untaught} Strukturen unterrichtet kein Thema`}
          action={
            <Button onClick={() => setNurUngelehrt((v) => !v)} pressed={nurUngelehrt}>
              {nurUngelehrt ? 'Filter aufheben' : 'nur diese zeigen'}
            </Button>
          }
        >
          {PROBLEM_LABELS['punkt-ohne-thema']?.why}
        </Callout>
      ) : null}

      <div className="my-5 flex flex-wrap items-center gap-3">
        <Filter label="Strang" value={strand} options={strandOptions} onChange={setStrand} />
        <Filter label="Produktionsniveau" value={level as Level | 'alle'} options={graph.levels} onChange={setLevel} />
      </div>

      <Zeilentabelle rows={filtered} rowKey={(p) => p.id} columns={columns} sortKey="de" />
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
  const topicTitle = (tid: string) => graph.topics.find((t) => t.id === tid)?.title ?? tid;

  const columns: Spalte<Element>[] = [
    { key: 'kind', head: 'Art', cell: (e) => <span className="text-ink-muted">{e.kind}</span> },
    { key: 'stage', head: 'Stufe', cell: (e) => <Chip>{STAGE_LABEL[e.stage] ?? e.stage}</Chip> },
    { key: 'items', head: 'Aufgaben', numeric: true, cell: (e) => e.depth.items || '' },
    { key: 'file', head: 'Datei', cell: (e) => <Extern href={`${GITHUB}/${e.file}`}>{e.id.split('#')[0]}</Extern> },
  ];

  return (
    <>
      <header className="mb-5">
        <Label>
          {point.strand ?? 'kein Strang'} · {point.id}
        </Label>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">{point.de}</h1>
        <p className="mt-1 text-sm text-ink-muted">{point.en}</p>
      </header>

      {!topics.length ? (
        <Callout tone="warn" eyebrow="Befund" title="Kein Thema unterrichtet diese Struktur">
          {PROBLEM_LABELS['punkt-ohne-thema']?.why}
        </Callout>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <Panel title="Niveau">
          <dl className="grid grid-cols-2 gap-y-1 text-sm">
            <dt className="text-ink-muted">Produktion</dt>
            <dd className="text-ink">{prod ?? '—'}</dd>
            <dt className="text-ink-muted">Rezeption</dt>
            <dd className={rec && rec !== prod ? 'text-info-ink' : 'text-ink'}>{rec ?? '—'}</dd>
          </dl>
          {point.note ? <p className="mt-3 border-t border-border-subtle pt-2 text-xs text-ink-muted">{point.note}</p> : null}
        </Panel>

        <Panel title="Fokus-Tags">
          {point.focus?.length ? (
            <span className="flex flex-wrap gap-1">
              {point.focus.map((tag) => (
                <Quer key={tag} href={href('fokus', tag)}>
                  {tag}
                </Quer>
              ))}
            </span>
          ) : (
            <p className="text-xs text-warn-ink">Keine — nichts kann diese Struktur einer Übung zuordnen.</p>
          )}
          {point.deepens?.length ? (
            <>
              <p className="mb-1 mt-3 border-t border-border-subtle pt-2 text-xs text-ink-muted">vertieft</p>
              <ul className="space-y-0.5 text-xs">
                {point.deepens.map((d) => (
                  <li key={d}>
                    <a href={href('struktur', d)} className="text-ink hover:text-brand-ink hover:underline">
                      {d}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </Panel>

        <Panel title={`Belege (${claims.length})`} tone={claims.length ? 'neutral' : 'leer'}>
          {claims.length === 0 ? (
            // Legitimate — this course aims at B1 and the standards stop where they stop — but
            // visible rather than assumed, which is the whole argument of `structures.ts`.
            <p className="text-xs text-ink-muted">Keine externe Quelle zitiert (‚beyond‘).</p>
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
                      <>
                        <span className="text-ink">{entry.de}</span>
                        <span className="text-ink-muted">
                          {' '}
                          — {source.source.title}
                          {section?.page ? ` (S. ${section.page})` : ''}
                        </span>
                      </>
                    ) : (
                      <span className="text-warn-ink">{ref} — nicht auflösbar</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <Section count={elements.length}>Elemente</Section>
      <Gruppentabelle
        gruppen={topics.map((tid) => ({
          id: tid,
          label: (
            <a href={href('thema', tid)} className="text-ink hover:text-brand-ink hover:underline">
              {topicTitle(tid)}
            </a>
          ),
          rows: elements.filter((e) => e.topic === tid),
        }))}
        columns={columns}
        rowKey={(e) => e.id}
        empty="Kein Element trägt einen ihrer Fokus-Tags."
      />
    </>
  );
}
