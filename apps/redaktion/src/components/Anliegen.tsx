/**
 * The shared queue in the editor's hands (ADR 0014): file an entry on a file, an item, a topic or a
 * kind of material; read a thread; reply; close. Every write goes through `ownerQueueAction`, and
 * none of them rebuilds the graph.
 */
import { useState } from 'react';
import { toast } from '@vitavision/ui';
import { Button, Chip, Panel } from '@da/ui/primitives';
import { corpusClient, type QueueEntry } from '../data';
import { href } from '../router';
import { useReviews } from '../reviews';

type Target = QueueEntry['target'];
type Type = QueueEntry['type'];

export const TYPE_LABEL: Record<Type, string> = {
  finding: 'Befund',
  request: 'Wunsch',
  question: 'Frage',
};

const controlClass =
  'rounded-control border border-line bg-surface px-2 py-1.5 text-sm text-fg focus-visible:outline-2 focus-visible:outline-signal';

/** The form for a new entry. `items` offers the ids of a file's items, so an entry can name one. */
export function AnliegenForm({
  target,
  items = [],
  onDone,
}: {
  target: Target;
  items?: string[];
  onDone: () => void;
}) {
  const { reload } = useReviews();
  const [type, setType] = useState<Type>('finding');
  const [item, setItem] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      const result = await corpusClient.queueAction({
        action: 'file',
        type,
        target: item && target.file ? { file: target.file, item } : target,
        text,
      });
      if (result.ok) {
        toast({ tone: 'success', title: `${result.entry?.id ?? 'Anliegen'} abgelegt` });
        reload();
        onDone();
      } else toast({ tone: 'error', title: 'Nicht abgelegt', description: result.error });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel tone="brand" title="Anliegen an Claude" className="mb-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="anliegen-art">
          Art
        </label>
        <select
          id="anliegen-art"
          className={controlClass}
          value={type}
          onChange={(event) => setType(event.target.value as Type)}
        >
          {(Object.keys(TYPE_LABEL) as Type[]).map((value) => (
            <option key={value} value={value}>
              {TYPE_LABEL[value]}
            </option>
          ))}
        </select>
        {items.length ? (
          <>
            <label className="sr-only" htmlFor="anliegen-aufgabe">
              Aufgabe
            </label>
            <select
              id="anliegen-aufgabe"
              className={controlClass}
              value={item}
              onChange={(event) => setItem(event.target.value)}
            >
              <option value="">die ganze Datei</option>
              {items.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </>
        ) : null}
      </div>
      <label className="sr-only" htmlFor="anliegen-text">
        Text
      </label>
      <textarea
        id="anliegen-text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={3}
        placeholder="Was ist falsch, was soll anders werden, was ist unklar? In jeder Sprache."
        className={`mt-2 w-full ${controlClass}`}
      />
      <div className="mt-2 flex gap-2">
        <Button stark onClick={() => void submit()} disabled={busy || !text.trim()}>
          Ablegen
        </Button>
        <Button onClick={onDone}>Abbrechen</Button>
      </div>
    </Panel>
  );
}

function targetLink(target: Target): { label: string; href: string } {
  if (target.topic) return { label: `Thema ${target.topic}`, href: href('thema', target.topic) };
  if (target.kind) return { label: `alle: ${target.kind}`, href: href('materialien') };
  return {
    label: `${target.file}${target.item ? ` · ${target.item}` : ''}`,
    href: href('quelle', undefined, { pfad: target.file }),
  };
}

/** One thread, with reply and close when it is the owner's turn — or at any time, to withdraw it. */
export function AnliegenEintrag({ entry }: { entry: QueueEntry }) {
  const { reload } = useReviews();
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const link = targetLink(entry.target);
  const act = async (input: Parameters<typeof corpusClient.queueAction>[0], done: string) => {
    setBusy(true);
    try {
      const result = await corpusClient.queueAction(input);
      if (result.ok) {
        toast({ tone: 'success', title: done, description: entry.id });
        setReply('');
        reload();
      } else toast({ tone: 'error', title: 'Nicht gespeichert', description: result.error });
    } finally {
      setBusy(false);
    }
  };
  const mine = entry.waiting === 'owner';
  return (
    <Panel
      tone={mine ? 'brand' : 'neutral'}
      title={
        <span className="flex flex-wrap items-center gap-2">
          <span className="tabular">{entry.id}</span>
          <Chip>{TYPE_LABEL[entry.type]}</Chip>
          <Chip tone={mine ? 'brand' : 'neutral'}>{mine ? 'wartet auf dich' : 'bei Claude'}</Chip>
        </span>
      }
      action={
        <Button
          onClick={() => void act({ action: 'close', id: entry.id }, 'Erledigt')}
          disabled={busy}
        >
          Erledigt
        </Button>
      }
    >
      <p className="text-xs">
        <a className="text-signal underline underline-offset-2" href={link.href}>
          {link.label}
        </a>
      </p>
      <ol className="mt-2 space-y-2">
        {entry.thread.map((note, index) => (
          <li key={index} className="max-w-3xl text-sm">
            <span className="text-xs text-fg-muted">
              {note.from === 'owner' ? 'du' : 'Claude'} · {note.at}
            </span>
            <p className="whitespace-pre-wrap text-fg">{note.text}</p>
          </li>
        ))}
      </ol>
      <div className="mt-3 flex flex-wrap items-start gap-2">
        <label className="sr-only" htmlFor={`antwort-${entry.id}`}>
          Antwort
        </label>
        <textarea
          id={`antwort-${entry.id}`}
          value={reply}
          onChange={(event) => setReply(event.target.value)}
          rows={1}
          placeholder={mine ? 'Antworten …' : 'Ergänzen …'}
          className={`min-w-0 flex-1 ${controlClass}`}
        />
        <Button
          onClick={() =>
            void act({ action: 'reply', id: entry.id, text: reply }, 'An Claude zurückgegeben')
          }
          disabled={busy || !reply.trim()}
        >
          Senden
        </Button>
      </div>
    </Panel>
  );
}

/**
 * Entries as one row each, for a list long enough that full threads would bury the page. `voll`
 * shows each text whole; otherwise it is cut to two lines, with the whole text on hover.
 */
export function AnliegenZeilen({
  entries,
  voll = false,
}: {
  entries: QueueEntry[];
  voll?: boolean;
}) {
  return (
    <ul className="divide-y divide-line rounded-panel border border-line bg-surface">
      {entries.map((entry) => {
        const link = targetLink(entry.target);
        return (
          <li key={entry.id} className="flex items-baseline gap-3 px-4 py-2 text-sm">
            <span className="tabular shrink-0 text-xs text-fg-muted">{entry.id}</span>
            <a
              className="shrink-0 text-xs text-signal underline underline-offset-2"
              href={link.href}
            >
              {link.label}
            </a>
            <span
              className={`min-w-0 flex-1 text-fg ${voll ? '' : 'line-clamp-2'}`}
              title={voll ? undefined : entry.thread[0]!.text}
            >
              {entry.thread[0]!.text}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** The entries about a set of files and topics — what a topic page or a source page shows. */
export function entriesAbout(
  queue: QueueEntry[] | undefined,
  scope: { files?: string[]; topic?: string },
): QueueEntry[] {
  const files = new Set(scope.files ?? []);
  return (queue ?? []).filter(
    (entry) =>
      (entry.target.file && files.has(entry.target.file)) ||
      (scope.topic && entry.target.topic === scope.topic),
  );
}
