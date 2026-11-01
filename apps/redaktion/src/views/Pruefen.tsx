/**
 * Prüfen — the owner's review inbox (ADR 0014).
 *
 * Two kinds of file are waiting: one Claude handed over (`claude-reviewed`, with a note saying what
 * to look at), and one reviewed before whose bytes have changed since (`geaendert`). Each opens to a
 * diff from the revision the owner last accepted, and one action marks it `owner-reviewed` at the
 * revision the owner just read. A file that changed after it was opened is refused, so a mark never
 * covers bytes nobody saw.
 *
 * The ledger is fetched here, not with the graph: a mark touches no content and rebuilds nothing.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from '@vitavision/ui';
import { Button, Chip, Empty, Label, Panel, Stat, StatGroup } from '@da/ui/primitives';
import { corpusClient, type FileReview, type GraphPayload } from '../data';
import { Reiter } from '../components/Hinweis';
import { Quelllink } from '../components/Zeilentabelle';
import { Zeilendiff } from '../components/Zeilendiff';
import { href, useQueryState } from '../router';

type Status = FileReview['status'];

const STATUS: Record<Status, { label: string; tone: 'neutral' | 'brand' | 'ok' | 'warn' }> = {
  entwurf: { label: 'Entwurf', tone: 'neutral' },
  'claude-reviewed': { label: 'von Claude übergeben', tone: 'brand' },
  'owner-reviewed': { label: 'von dir geprüft', tone: 'ok' },
  geaendert: { label: 'seit Prüfung geändert', tone: 'warn' },
};

type Ansicht = 'offen' | 'geprueft' | 'entwuerfe';

/** The revision a diff starts from: what the owner last accepted. */
function baseline(review: FileReview): string | undefined {
  if (!review.entry) return undefined;
  if (review.status === 'geaendert')
    return review.entry.state === 'owner-reviewed' ? review.entry.revision : review.entry.since;
  return review.entry.since;
}

function Eintrag({
  review,
  label,
  onMarked,
}: {
  review: FileReview;
  label: string;
  onMarked: () => void;
}) {
  const [offen, setOffen] = useState(false);
  const [busy, setBusy] = useState(false);
  const status = STATUS[review.status];
  const mark = async () => {
    if (!review.current) return;
    setBusy(true);
    try {
      const result = await corpusClient.markReviewed(review.file, review.current);
      if (result.ok) {
        toast({ tone: 'success', title: 'Als geprüft markiert', description: review.file });
        onMarked();
      } else toast({ tone: 'error', title: 'Nicht markiert', description: result.error });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel
      tone={review.status === 'geaendert' ? 'warn' : 'brand'}
      title={
        <span className="flex flex-wrap items-center gap-2">
          <span>{label}</span>
          <Chip tone={status.tone}>{status.label}</Chip>
        </span>
      }
      action={
        <span className="flex items-center gap-2">
          <Button onClick={() => setOffen(!offen)} pressed={offen}>
            {offen ? 'Diff schließen' : 'Diff zeigen'}
          </Button>
          <Button stark onClick={() => void mark()} disabled={busy || !review.current}>
            Als geprüft markieren
          </Button>
        </span>
      }
    >
      <p className="text-xs">
        <Quelllink href={href('quelle', undefined, { pfad: review.file })}>{review.file}</Quelllink>
      </p>
      {review.entry?.note ? (
        <p className="mt-2 max-w-3xl text-sm text-fg">{review.entry.note}</p>
      ) : null}
      {review.entry ? (
        <p className="mt-1 text-xs text-fg-muted">
          {review.entry.by} · {review.entry.at}
        </p>
      ) : null}
      {offen ? (
        <div className="mt-3">
          <Zeilendiff file={review.file} fromRevision={baseline(review)} />
        </div>
      ) : null}
    </Panel>
  );
}

export function Pruefen({ graph }: { graph: GraphPayload }) {
  const [reviews, setReviews] = useState<FileReview[] | null>(null);
  const [error, setError] = useState<string>();
  const [ansichtValue, setAnsicht] = useQueryState('ansicht', 'offen');
  const ansicht = (['offen', 'geprueft', 'entwuerfe'] as const).includes(ansichtValue as Ansicht)
    ? (ansichtValue as Ansicht)
    : 'offen';

  const load = useCallback(() => {
    corpusClient
      .reviewStatuses()
      .then((rows) => {
        setReviews(rows);
        setError(undefined);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);
  useEffect(load, [load]);

  // A file's name in the course: the titles of the elements it holds, or the topic it defines.
  const labels = useMemo(() => {
    const byFile = new Map<string, string>();
    for (const topic of graph.topics) byFile.set(topic.file, `${topic.title} · Manifest`);
    for (const element of graph.elements)
      if (!byFile.has(element.file) && element.title) byFile.set(element.file, element.title);
    return byFile;
  }, [graph]);

  if (error) return <Empty>Das Prüfprotokoll ließ sich nicht lesen: {error}</Empty>;
  if (!reviews) return <Empty>Prüfprotokoll wird gelesen …</Empty>;

  const count = (status: Status) => reviews.filter((r) => r.status === status).length;
  const shown = reviews.filter((r) =>
    ansicht === 'offen'
      ? r.status === 'claude-reviewed' || r.status === 'geaendert'
      : ansicht === 'geprueft'
        ? r.status === 'owner-reviewed'
        : r.status === 'entwurf',
  );

  return (
    <div>
      <header className="mb-5">
        <Label>Redaktion</Label>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-fg">Prüfen</h1>
        <p className="mt-1 max-w-3xl text-sm text-fg-muted">
          Was Claude übergeben hat und was sich seit deiner Prüfung geändert hat. Jede Markierung
          gilt genau der Fassung, die du gelesen hast; ändert sich die Datei, wird sie wieder offen.
        </p>
      </header>

      <Panel className="mb-6">
        <StatGroup columns={4}>
          <Stat label="offen" value={count('claude-reviewed') + count('geaendert')} tone="brand" />
          <Stat label="seit Prüfung geändert" value={count('geaendert')} tone="warn" />
          <Stat label="von dir geprüft" value={count('owner-reviewed')} tone="ok" />
          <Stat
            label="Entwürfe"
            value={count('entwurf')}
            hint={`von ${reviews.length} Dateien im Bestand`}
          />
        </StatGroup>
      </Panel>

      <div className="mb-4">
        <Reiter
          ariaLabel="Prüfansicht"
          value={ansicht}
          onChange={setAnsicht}
          options={[
            { id: 'offen', label: 'Offen', count: count('claude-reviewed') + count('geaendert') },
            { id: 'geprueft', label: 'Geprüft', count: count('owner-reviewed') },
            { id: 'entwuerfe', label: 'Entwürfe', count: count('entwurf') },
          ]}
        />
      </div>

      {shown.length === 0 ? (
        <Empty>
          {ansicht === 'offen'
            ? 'Nichts wartet auf dich. Was Claude übergibt, erscheint hier.'
            : ansicht === 'geprueft'
              ? 'Noch keine Datei von dir geprüft.'
              : 'Keine Entwürfe.'}
        </Empty>
      ) : ansicht === 'offen' ? (
        <div className="space-y-3">
          {shown.map((review) => (
            <Eintrag
              key={review.file}
              review={review}
              label={labels.get(review.file) ?? review.file}
              onMarked={load}
            />
          ))}
        </div>
      ) : (
        <ul className="divide-y divide-line rounded-panel border border-line bg-surface">
          {shown.map((review) => (
            <li key={review.file} className="flex flex-wrap items-baseline gap-3 px-4 py-2 text-sm">
              <span className="min-w-0 flex-1 text-fg">
                {labels.get(review.file) ?? review.file}
              </span>
              <Quelllink href={href('quelle', undefined, { pfad: review.file })}>
                {review.file}
              </Quelllink>
              {review.entry ? (
                <span className="text-xs text-fg-muted">
                  {review.entry.by} · {review.entry.at}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
