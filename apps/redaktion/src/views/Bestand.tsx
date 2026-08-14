/**
 * The material: everything this course is made of, by kind.
 *
 * WHAT WAS MISSING. `contentGraph()` reads **every** artifact type — 336 exercise sets, 129 decks,
 * 84 listening files, 77 readings, 12 Entdecken pieces, 10 Wortnetze, 5 documents, 7 reference
 * files — and classifies all of them into fifteen `ElementKind`s. The first editorial app had a
 * `Lexik` route covering two of the fifteen (decks and readings) and no way to see the rest at all.
 * A listening file, an Entdecken piece and a Wortnetz existed in the model and appeared on no
 * screen.
 *
 * WHAT THIS ONE ASKS. *What do we have, and which of it is out of band?* One kind at a time,
 * because the columns worth showing are different for each — a deck is judged on entries and
 * productive cards, a reading on its word count against the band its `kind` implies, an exercise
 * set on items and types. A single table over all fifteen would be fifteen tables with most of the
 * cells empty.
 *
 * The bands come from `CLAUDE.md` and are shown as findings rather than enforced here: an intensive
 * reading is 90–130 words and an extensive one 250–400, and `graph.problems` already carries the
 * ones outside. Nothing on this page recomputes a figure — `graph.decks`, `graph.readings` and
 * `graph.elements` are what the corpus measured.
 */
import { useState } from 'react';
import { Empty, Filter, Label, Panel, SearchBox, Stat, StatGroup } from '@da/ui/primitives';
import { Reiter } from '../components/Hinweis';
import type { GraphPayload } from '../data';
import { Extern, Mehrere, Primaer, Quer, Zeilentabelle, type Spalte } from '../components/Zeilentabelle';
import { href } from '../router';

type Level = GraphPayload['levels'][number];
type Element = GraphPayload['elements'][number];
type Deck = GraphPayload['decks'][number];
type Reading = GraphPayload['readings'][number];

const GITHUB = 'https://github.com/VitalyVorobyev/deutsch-textbook/blob/main';

/** Word bands `CLAUDE.md` states for each reading kind, and no gate enforces. */
const BANDS: Record<string, [number, number]> = { intensive: [90, 130], extensive: [250, 400] };

type Art =
  | 'wortschatz'
  | 'uebungen'
  | 'lesetexte'
  | 'hoertexte'
  | 'artikel'
  | 'dokumente'
  | 'entdecken'
  | 'wortnetze';

/** Which `ElementKind`s each tab collects, and what to call it. */
const ARTEN: { id: Art; label: string; kinds: string[] }[] = [
  { id: 'wortschatz', label: 'Wortschatz', kinds: ['wortschatz'] },
  { id: 'uebungen', label: 'Übungen', kinds: ['pretest', 'praxis', 'drill', 'probe', 'checkpoint', 'einstufung'] },
  { id: 'lesetexte', label: 'Lesetexte', kinds: ['lesetext-intensiv', 'lesetext-extensiv'] },
  { id: 'hoertexte', label: 'Hörtexte', kinds: ['hoertext'] },
  { id: 'artikel', label: 'Artikel', kinds: ['artikel'] },
  { id: 'dokumente', label: 'Dokumente', kinds: ['dokument'] },
  { id: 'entdecken', label: 'Entdecken', kinds: ['entdecken', 'referenz'] },
  { id: 'wortnetze', label: 'Wortnetze', kinds: ['wortnetz', 'wortfeld'] },
];

export function Bestand({ graph }: { graph: GraphPayload }) {
  const [art, setArt] = useState<Art>('wortschatz');
  const [level, setLevel] = useState<Level | 'alle'>('alle');
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();

  const topicTitle = (id: string) => graph.topics.find((t) => t.id === id)?.title ?? id;
  const byLevel = <T extends { level: string }>(xs: T[]) => xs.filter((x) => level === 'alle' || x.level === level);
  const counts = new Map(ARTEN.map((a) => [a.id, graph.elements.filter((e) => a.kinds.includes(e.kind)).length]));

  return (
    <>
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Bestand</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {graph.elements.length} Elemente in {ARTEN.length} Materialarten · jede Zahl kommt aus dem Korpus
        </p>
      </header>

      <div className="mb-5 grid gap-4 md:grid-cols-4">
        <Panel>
          <StatGroup columns={2}>
            <Stat label="Karten" value={graph.decks.reduce((n, d) => n + d.entries, 0)} hint="Einträge in Decks" />
            <Stat label="Aufgaben" value={graph.elements.reduce((n, e) => n + (e.depth.items || 0), 0)} />
          </StatGroup>
        </Panel>
        <div className="md:col-span-3">
          <Panel>
            <Label>Wortliste je Niveau</Label>
            <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              {graph.reports
                .filter((r) => r.wortliste)
                .map((r) => (
                  <li key={r.level} className="tabular text-ink-muted">
                    <span className="font-semibold text-ink">{r.level}</span> {r.wortliste!.percent}% ·{' '}
                    {r.wortliste!.cards} Karten · {r.wortliste!.grammar} als Grammatik
                  </li>
                ))}
            </ul>
          </Panel>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-full overflow-x-auto">
          <Reiter
            ariaLabel="Materialart"
            value={art}
            onChange={setArt}
            options={ARTEN.map((a) => ({ id: a.id, label: a.label, count: counts.get(a.id) }))}
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="w-56">
            <SearchBox value={search} onChange={setSearch} placeholder="Suchen …" />
          </div>
          <Filter label="Niveau" value={level} options={graph.levels} onChange={setLevel} />
        </div>
      </div>

      {art === 'wortschatz' ? (
        <Decks
          decks={byLevel(graph.decks).filter((d) => !q || d.title.toLowerCase().includes(q) || d.id.includes(q))}
          topicTitle={topicTitle}
        />
      ) : art === 'lesetexte' ? (
        <Lesetexte
          readings={byLevel(graph.readings).filter((r) => !q || r.title.toLowerCase().includes(q) || r.id.includes(q))}
          topicTitle={topicTitle}
        />
      ) : (
        <Elemente
          elements={byLevel(
            graph.elements.filter((e) => ARTEN.find((a) => a.id === art)!.kinds.includes(e.kind)),
          ).filter((e) => !q || e.id.toLowerCase().includes(q) || (e.title ?? '').toLowerCase().includes(q))}
          topicTitle={topicTitle}
          art={art}
        />
      )}
    </>
  );
}

function Decks({ decks, topicTitle }: { decks: Deck[]; topicTitle: (id: string) => string }) {
  const max = Math.max(1, ...decks.map((d) => d.entries));
  const columns: Spalte<Deck>[] = [
    { key: 'id', head: 'Deck', sort: (d) => d.title, cell: (d) => <Primaer href={`${GITHUB}/${d.file}`}>{d.title}</Primaer> },
    { key: 'level', head: 'Niveau', sort: (d) => d.level, cell: (d) => d.level },
    { key: 'entries', head: 'Einträge', numeric: true, sort: (d) => d.entries, cell: (d) => d.entries },
    {
      key: 'productive',
      head: 'produktiv',
      numeric: true,
      sort: (d) => d.productive,
      // `cards: recognition` makes one card instead of two, for language the learner must
      // understand and will never produce. A deck where that number is far below `entries` is a
      // deliberate choice at B1 and a mistake at A1 — which is why both are shown, not the ratio.
      cell: (d) => (
        <span className={d.productive === 0 ? 'text-ink-muted' : ''}>{d.productive}</span>
      ),
    },
    {
      key: 'owners',
      head: 'Themen',
      // A Wortliste completion deck is deliberately unowned: listing one in a topic's `vocab:`
      // flips its fresh-card gate and buries hundreds of words behind that topic.
      cell: (d) =>
        d.owners.length ? (
          <Mehrere>
            {d.owners.map((o) => (
              <Quer key={o} href={href('thema', o)}>
                {topicTitle(o)}
              </Quer>
            ))}
          </Mehrere>
        ) : (
          <span className="text-ink-muted" title="Wortlisten-Deck: bewusst ohne Thema">
            frei
          </span>
        ),
    },
  ];
  void max;
  return <Zeilentabelle rows={decks} rowKey={(d) => d.id} columns={columns} sortKey="id" empty="Kein Deck." />;
}

function Lesetexte({ readings, topicTitle }: { readings: Reading[]; topicTitle: (id: string) => string }) {
  const columns: Spalte<Reading>[] = [
    { key: 'id', head: 'Text', sort: (r) => r.title, cell: (r) => <Primaer href={`${GITHUB}/${r.file}`}>{r.title}</Primaer> },
    { key: 'level', head: 'Niveau', sort: (r) => r.level, cell: (r) => r.level },
    { key: 'kind', head: 'Art', sort: (r) => r.kind, cell: (r) => r.kind },
    {
      key: 'words',
      head: 'Wörter',
      numeric: true,
      sort: (r) => r.words,
      cell: (r) => {
        const band = BANDS[r.kind];
        const out = band && (r.words < band[0] || r.words > band[1]);
        return (
          <span className={out ? 'text-warn-ink' : ''} title={band ? `Band ${band[0]}–${band[1]}` : undefined}>
            {r.words}
          </span>
        );
      },
    },
    { key: 'glosses', head: 'Glossen', numeric: true, sort: (r) => r.glosses, cell: (r) => r.glosses },
    { key: 'questions', head: 'Fragen', numeric: true, sort: (r) => r.questions, cell: (r) => r.questions },
    {
      key: 'topic',
      head: 'Thema',
      cell: (r) => <Quer href={href('thema', r.topic)}>{topicTitle(r.topic)}</Quer>,
    },
  ];
  return <Zeilentabelle rows={readings} rowKey={(r) => r.id} columns={columns} sortKey="id" empty="Kein Lesetext." />;
}

function Elemente({
  elements,
  topicTitle,
  art,
}: {
  elements: Element[];
  topicTitle: (id: string) => string;
  art: Art;
}) {
  const columns: Spalte<Element>[] = [
    {
      key: 'id',
      head: 'Element',
      sort: (e) => e.id,
      cell: (e) => <Primaer href={`${GITHUB}/${e.file}`}>{e.title ?? e.id.split('#')[0]}</Primaer>,
    },
    { key: 'level', head: 'Niveau', sort: (e) => e.level, cell: (e) => e.level },
    { key: 'kind', head: 'Art', sort: (e) => e.kind, cell: (e) => <span className="text-ink-muted">{e.kind}</span> },
    ...(art === 'uebungen'
      ? ([
          { key: 'items', head: 'Aufgaben', numeric: true, sort: (e) => e.depth.items, cell: (e) => e.depth.items || '' },
          {
            key: 'prod',
            head: 'produktiv',
            numeric: true,
            sort: (e) => e.depth.production,
            cell: (e) => e.depth.production || '',
          },
        ] as Spalte<Element>[])
      : []),
    {
      key: 'topic',
      head: 'Thema',
      cell: (e) => <Quer href={href('thema', e.topic)}>{topicTitle(e.topic)}</Quer>,
    },
    {
      key: 'focus',
      head: 'Fokus',
      cell: (e) => (
        <Mehrere>
          {e.focus.map((tag) => (
            <Quer key={tag} href={href('fokus', tag)}>
              {tag}
            </Quer>
          ))}
        </Mehrere>
      ),
    },
  ];
  if (!elements.length) return <Empty>Nichts von dieser Art auf diesem Niveau.</Empty>;
  return <Zeilentabelle rows={elements} rowKey={(e) => e.id} columns={columns} sortKey="id" />;
}

/** Kept out of the table: an external file link that is not the row's primary target. */
export { Extern };
