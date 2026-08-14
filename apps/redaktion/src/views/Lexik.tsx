/**
 * Lexical coverage: the Goethe Wortliste percentage per level, then the two artifact types that
 * actually teach vocabulary — decks and readings — with the bands CLAUDE.md states and no gate
 * enforces (an intensive reading's 90–130 word band).
 */
import { useState } from 'react';
import { Filter, Heading, Table } from '@da/ui/primitives';
import type { GraphPayload } from '../data';
import { href } from '../router';

type Level = GraphPayload['levels'][number];
type LevelReport = GraphPayload['reports'][number];

export function Lexik({ graph }: { graph: GraphPayload }) {
  const [level, setLevel] = useState<Level | 'alle'>('alle');
  const [owned, setOwned] = useState<'ja' | 'nein' | 'alle'>('alle');

  const topicTitle = (id: string) => graph.topics.find((t) => t.id === id)?.title ?? id;

  const wortlisteRows = graph.reports.filter(
    (r): r is LevelReport & { wortliste: NonNullable<LevelReport['wortliste']> } => !!r.wortliste,
  );

  const decks = graph.decks.filter(
    (d) =>
      (level === 'alle' || d.level === level) &&
      (owned === 'alle' || (owned === 'ja' ? d.owners.length > 0 : d.owners.length === 0)),
  );

  return (
    <>
      <Heading sub="Wortliste, Decks und Lesetexte — die Lexis, gemessen statt behauptet.">Lexik</Heading>

      <h2 className="mb-2 text-sm font-medium text-ink">Wortliste</h2>
      <Table
        rows={wortlisteRows}
        rowKey={(r) => r.level}
        columns={[
          { key: 'level', head: 'Niveau', cell: (r) => r.level },
          { key: 'percent', head: 'Anteil', numeric: true, cell: (r) => `${r.wortliste.percent}%` },
          { key: 'cards', head: 'Karten', numeric: true, cell: (r) => r.wortliste.cards },
          { key: 'grammar', head: 'als Grammatik', numeric: true, cell: (r) => r.wortliste.grammar },
          { key: 'missing', head: 'fehlt', numeric: true, cell: (r) => r.wortliste.missing },
          {
            key: 'unearned',
            head: 'unverdiente ~',
            numeric: true,
            cell: (r) => (
              <span className={r.wortliste.unearned.length ? 'text-warn' : 'text-ink'}>
                {r.wortliste.unearned.length}
              </span>
            ),
          },
        ]}
      />

      <h2 className="mb-2 mt-8 text-sm font-medium text-ink">Decks</h2>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Filter label="Niveau" value={level} options={graph.levels} onChange={setLevel} />
        <Filter label="mit Thema" value={owned} options={['ja', 'nein'] as const} onChange={setOwned} />
      </div>
      <Table
        rows={decks}
        rowKey={(d) => d.id}
        columns={[
          { key: 'id', head: 'Kennung', cell: (d) => d.id },
          { key: 'title', head: 'Titel', cell: (d) => d.title },
          { key: 'level', head: 'Niveau', cell: (d) => d.level },
          { key: 'entries', head: 'Einträge', numeric: true, cell: (d) => d.entries },
          { key: 'productive', head: 'produktiv', numeric: true, cell: (d) => d.productive },
          {
            key: 'owners',
            head: 'Themen',
            cell: (d) =>
              d.owners.length ? (
                <span className="flex flex-wrap gap-1 text-xs">
                  {d.owners.map((t) => (
                    <a key={t} className="text-info hover:underline" href={href('thema', t)}>
                      {topicTitle(t)}
                    </a>
                  ))}
                </span>
              ) : (
                <span className="text-ink-muted">Wortlisten-Ergänzungsdeck</span>
              ),
          },
        ]}
      />

      <h2 className="mb-2 mt-8 text-sm font-medium text-ink">Lesetexte</h2>
      <Table
        rows={graph.readings}
        rowKey={(r) => r.id}
        columns={[
          { key: 'title', head: 'Titel', cell: (r) => r.title },
          {
            key: 'topic',
            head: 'Thema',
            cell: (r) => (
              <a className="text-info hover:underline" href={href('thema', r.topic)}>
                {topicTitle(r.topic)}
              </a>
            ),
          },
          { key: 'level', head: 'Niveau', cell: (r) => r.level },
          { key: 'kind', head: 'Art', cell: (r) => r.kind },
          {
            key: 'words',
            head: 'Wörter',
            numeric: true,
            cell: (r) => {
              const offBand = r.kind === 'intensive' && (r.words < 90 || r.words > 130);
              return <span className={offBand ? 'text-warn' : 'text-ink'}>{r.words}</span>;
            },
          },
          { key: 'glosses', head: 'Glossen', numeric: true, cell: (r) => r.glosses },
          { key: 'questions', head: 'Fragen', numeric: true, cell: (r) => r.questions },
        ]}
      />
    </>
  );
}
