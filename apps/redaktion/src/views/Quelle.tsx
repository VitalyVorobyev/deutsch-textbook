import { useEffect, useMemo, useState } from 'react';
import YAML from 'yaml';
import { Button, Chip, Empty, Label, Panel } from '@da/ui/primitives';
import { corpusClient, type FileSnapshot, type GraphPayload, type ValidationRun } from '../data';
import { blockNavigation } from '../router';

const GITHUB = 'https://github.com/VitalyVorobyev/deutsch-textbook/blob/main';

export function Quelle({ graph, path }: { graph: GraphPayload; path?: string }) {
  const [snapshot, setSnapshot] = useState<FileSnapshot>();
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [validation, setValidation] = useState<ValidationRun>();

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    corpusClient.readFile(path).then((next) => {
      if (!cancelled) { setSnapshot(next); setText(next.text); setError(''); }
    }).catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
    });
    return () => { cancelled = true; };
  }, [path]);

  const dirty = !!snapshot && text !== snapshot.text;
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => {
    if (!dirty) return;
    return blockNavigation(() => window.confirm('Ungespeicherte Änderungen verwerfen und die Quelle verlassen?'));
  }, [dirty]);

  if (!path) return <Empty>Keine Quelldatei gewählt.</Empty>;
  if (error) return <Empty>Die Quelle ließ sich nicht öffnen: {error}</Empty>;
  if (!snapshot) return <Empty>Quelle wird gelesen …</Empty>;

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const result = await corpusClient.saveFile({ path, text, expectedRevision: snapshot.revision });
      if (result.ok) { setSnapshot(result.snapshot); setText(result.snapshot.text); }
      else if (result.conflict) setError('Die Datei wurde außerhalb der Redaktion geändert. Neu laden oder die Änderungen manuell zusammenführen.');
      else setError(result.diagnostics.map((item) => item.message).join('\n'));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally { setSaving(false); }
  };

  const validate = async () => {
    setValidation(undefined);
    setValidation(await corpusClient.validateWorkspace());
  };
  const topic = graph.topics.find((item) => item.file === path);
  let sourceStatus: string | undefined;
  if (snapshot.kind === 'topic-manifest') {
    try { sourceStatus = (YAML.parse(text) as { status?: string }).status; } catch { /* Save will explain the syntax error. */ }
  }
  const markReviewed = async () => {
    if (!topic) return;
    setSaving(true);
    try {
      const result = await corpusClient.markTopicReviewed(topic.id, snapshot.revision);
      if (!result.ok) setError(result.error);
      else {
        const next = await corpusClient.readFile(path);
        setSnapshot(next);
        setText(next.text);
        setError('');
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally { setSaving(false); }
  };

  return (
    <>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Label>{snapshot.kind}</Label>
          <h1 className="mt-1 break-all font-serif text-2xl font-semibold text-ink">{path.split('/').at(-1)}</h1>
          <p className="mt-1 break-all text-xs text-ink-muted">{path}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={dirty ? 'warn' : 'ok'}>{dirty ? 'ungespeichert' : 'gespeichert'}</Chip>
          <Button onClick={() => void validate()}>Korpus prüfen</Button>
          {topic && sourceStatus === 'draft' ? (
            <Button onClick={() => void markReviewed()} disabled={dirty || saving}>Als geprüft markieren</Button>
          ) : null}
          <Button onClick={() => void save()} disabled={!dirty || saving}>{saving ? 'Speichert …' : 'Speichern'}</Button>
        </div>
      </header>

      {error ? <p role="alert" className="mb-4 whitespace-pre-wrap border-l-4 border-warn bg-warn-soft p-3 text-sm text-warn-ink">{error}</p> : null}
      {validation ? (
        <details className={`mb-4 border-l-4 p-3 text-sm ${validation.ok ? 'border-ok bg-ok-soft' : 'border-warn bg-warn-soft'}`} open={!validation.ok}>
          <summary className="cursor-pointer font-medium text-ink">{validation.ok ? 'Der Korpus ist gültig' : 'Die Korpusprüfung ist rot'}</summary>
          <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap text-xs text-ink-muted">{validation.output || 'Keine Ausgabe.'}</pre>
        </details>
      ) : null}

      <div className="grid min-h-[68vh] gap-4 xl:grid-cols-2">
        <Panel title="Redaktionelle Vorschau" className="min-h-0 overflow-auto">
          <EditorialPreview kind={snapshot.kind} text={text} />
        </Panel>
        <section className="flex min-h-[68vh] min-w-0 flex-col overflow-hidden rounded-lg border border-border-subtle bg-surface-raised">
          <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2">
            <Label>Quelle</Label>
            <a className="text-xs text-info-ink underline underline-offset-2" href={`${GITHUB}/${path}`} target="_blank" rel="noreferrer">GitHub</a>
          </div>
          <textarea
            aria-label={`Quelltext von ${path}`}
            value={text}
            onChange={(event) => setText(event.target.value)}
            spellCheck={snapshot.kind === 'topic-article' || snapshot.kind === 'discovery'}
            className="min-h-[62vh] flex-1 resize-none bg-stone-950 p-4 font-mono text-[0.78rem] leading-5 text-stone-100 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
          />
        </section>
      </div>
    </>
  );
}

function EditorialPreview({ kind, text }: { kind: FileSnapshot['kind']; text: string }) {
  const parsed = useMemo(() => {
    if (!['topic-article', 'discovery', 'text'].includes(kind)) {
      try { return YAML.parse(text) as unknown; } catch { return undefined; }
    }
    return undefined;
  }, [kind, text]);

  if (kind === 'topic-article' || kind === 'discovery') {
    const headings = [...text.matchAll(/^(#{1,3})\s+(.+)$/gm)].map((match) => ({ depth: match[1]!.length, text: match[2]! }));
    const prose = text.replace(/^---[\s\S]*?---\s*/m, '').replace(/<[^>]+>/g, '').split(/\n{2,}/).filter((part) => part.trim() && !part.trim().startsWith('#'));
    return (
      <article className="prose prose-stone max-w-none text-sm">
        <nav aria-label="Gliederung" className="not-prose mb-5 border-b border-border-subtle pb-4">
          <Label>Gliederung</Label>
          <ol className="mt-2 space-y-1 text-xs text-ink-muted">{headings.map((heading, index) => <li key={`${heading.text}-${index}`} style={{ paddingLeft: `${(heading.depth - 1) * 12}px` }}>{heading.text}</li>)}</ol>
        </nav>
        {prose.slice(0, 18).map((part, index) => <p key={index} className="whitespace-pre-wrap text-ink">{part}</p>)}
      </article>
    );
  }
  if (!parsed || typeof parsed !== 'object') return <Empty>Keine strukturierte Vorschau verfügbar.</Empty>;
  return <StructuredPreview value={parsed as Record<string, unknown>} />;
}

function StructuredPreview({ value }: { value: Record<string, unknown> }) {
  const items = Array.isArray(value.items) ? value.items as Record<string, unknown>[] : [];
  const entries = Array.isArray(value.entries) ? value.entries as Record<string, unknown>[] : [];
  const rows = items.length ? items : entries;
  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-1 text-xs">
        {Object.entries(value).filter(([, item]) => !Array.isArray(item) && typeof item !== 'object').slice(0, 14).map(([key, item]) => (
          <div key={key} className="contents"><dt className="text-ink-muted">{key}</dt><dd className="break-words text-ink">{String(item)}</dd></div>
        ))}
      </dl>
      {rows.length ? (
        <section>
          <Label>{items.length ? `Aufgaben (${items.length})` : `Einträge (${entries.length})`}</Label>
          <ol className="mt-2 space-y-3">
            {rows.slice(0, 80).map((row, index) => (
              <li key={String(row.id ?? row.de ?? index)} className="rounded-md border border-border-subtle bg-surface p-3">
                <p className="text-xs font-semibold text-ink">{String(row.id ?? row.de ?? `#${index + 1}`)}</p>
                <Field label="Prompt" value={row.prompt ?? row.de ?? row.text} />
                <Field label="Antwort" value={row.answer ?? row.answers ?? row.accept ?? row.correct} tone="ok" />
                <Field label="Erklärung" value={row.explain ?? row.explanation} tone="info" />
                <Field label="Fokus" value={row.focus ?? row.outcomes} />
              </li>
            ))}
          </ol>
        </section>
      ) : <pre className="overflow-auto whitespace-pre-wrap text-xs text-ink">{JSON.stringify(value, null, 2)}</pre>}
    </div>
  );
}

function Field({ label, value, tone }: { label: string; value: unknown; tone?: 'ok' | 'info' }) {
  if (value === undefined || value === null || value === '') return null;
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return <p className={`mt-2 whitespace-pre-wrap text-xs ${tone === 'ok' ? 'text-ok-ink' : tone === 'info' ? 'text-info-ink' : 'text-ink-muted'}`}><span className="font-semibold">{label}:</span> {text}</p>;
}
