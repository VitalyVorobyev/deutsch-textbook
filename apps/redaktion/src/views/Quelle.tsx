import { useEffect, useMemo, useState } from 'react';
import YAML from 'yaml';
import { Button, Chip, Empty, Label, Panel } from '@da/ui/primitives';
import { ArticlePreview } from '@da/renderers/article';
import { ExerciseSetPreview } from '@da/renderers/exercises';
import { ReadingPreview, VocabPreview } from '@da/renderers/material';
import type { ContentLanguage, PreviewPayload } from '@da/content/preview';
import { corpusClient, type FileSnapshot, type GraphPayload, type ValidationRun } from '../data';
import { blockNavigation, href } from '../router';
import { FILE_STATUS, markFile, useReviews } from '../reviews';

const GITHUB = 'https://github.com/VitalyVorobyev/deutsch-textbook/blob/main';
const LANGUAGE_LABEL: Record<ContentLanguage, string> = { de: 'DE', en: 'EN', ru: 'RU', uk: 'UK' };
const CONTENT_LANGUAGES = Object.keys(LANGUAGE_LABEL) as ContentLanguage[];

/**
 * The kinds with a preview of what the learner meets. Every other file is data whose clearest
 * rendering is its own source, so it gets the full width rather than a restatement of itself.
 */
const PREVIEWS = new Set<FileSnapshot['kind']>([
  'topic-article',
  'discovery',
  'exercise-set',
  'reading',
  'vocabulary',
]);

export function Quelle({ graph, path }: { graph: GraphPayload; path?: string }) {
  const reviews = useReviews();
  const [snapshot, setSnapshot] = useState<FileSnapshot>();
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [validation, setValidation] = useState<ValidationRun>();
  const [language, setLanguage] = useState<ContentLanguage>(() => {
    try {
      const stored = localStorage.getItem('da:redaktion-preview-language');
      return CONTENT_LANGUAGES.includes(stored as ContentLanguage)
        ? (stored as ContentLanguage)
        : 'en';
    } catch {
      return 'en';
    }
  });
  const [preview, setPreview] = useState<PreviewPayload>();

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    corpusClient
      .readFile(path)
      .then((next) => {
        if (!cancelled) {
          setSnapshot(next);
          setText(next.text);
          setError('');
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  useEffect(() => {
    if (!path || !snapshot || !['topic-article', 'discovery'].includes(snapshot.kind)) {
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void corpusClient
        .renderSource({ path, text, language })
        .then((result) => {
          if (!cancelled) setPreview(result);
        })
        .catch((reason: unknown) => {
          if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
        });
    }, 160);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [language, path, snapshot, text]);

  const chooseLanguage = (next: ContentLanguage) => {
    setLanguage(next);
    try {
      localStorage.setItem('da:redaktion-preview-language', next);
    } catch {
      /* non-persistent private mode */
    }
  };

  const dirty = !!snapshot && text !== snapshot.text;
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => {
    if (!dirty) return;
    return blockNavigation(() =>
      window.confirm('Ungespeicherte Änderungen verwerfen und die Quelle verlassen?'),
    );
  }, [dirty]);

  if (!path) return <Empty>Keine Quelldatei gewählt.</Empty>;
  if (error) return <Empty>Die Quelle ließ sich nicht öffnen: {error}</Empty>;
  if (!snapshot) return <Empty>Quelle wird gelesen …</Empty>;

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const result = await corpusClient.saveFile({
        path,
        text,
        expectedRevision: snapshot.revision,
      });
      if (result.ok) {
        setSnapshot(result.snapshot);
        setText(result.snapshot.text);
        if (result.changed) reviews.reload();
      } else if (result.conflict)
        setError(
          'Die Datei wurde außerhalb der Redaktion geändert. Neu laden oder die Änderungen manuell zusammenführen.',
        );
      else setError(result.diagnostics.map((item) => item.message).join('\n'));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setSaving(false);
    }
  };

  const validate = async () => {
    setValidation(undefined);
    setValidation(await corpusClient.validateWorkspace());
  };
  const topic = graph.topics.find((item) => item.file === path);
  const review = reviews.byFile.get(path);
  const markReviewed = async () => {
    if (!review) return;
    setSaving(true);
    try {
      if (await markFile(review)) reviews.reload();
    } finally {
      setSaving(false);
    }
  };
  const previewable = PREVIEWS.has(snapshot.kind);

  return (
    <>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Label>{snapshot.kind}</Label>
          <h1 className="mt-1 break-all font-serif text-2xl font-semibold text-fg">
            {path.split('/').at(-1)}
          </h1>
          <p className="mt-1 break-all text-xs text-fg-muted">{path}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {review ? (
            <Chip tone={FILE_STATUS[review.status].tone}>{FILE_STATUS[review.status].label}</Chip>
          ) : null}
          <Chip tone={dirty ? 'warn' : 'ok'}>{dirty ? 'ungespeichert' : 'gespeichert'}</Chip>
          <Button onClick={() => void validate()}>Korpus prüfen</Button>
          {review && review.status !== 'owner-reviewed' ? (
            <Button onClick={() => void markReviewed()} disabled={dirty || saving}>
              Als geprüft markieren
            </Button>
          ) : null}
          <Button onClick={() => void save()} disabled={!dirty || saving}>
            {saving ? 'Speichert …' : 'Speichern'}
          </Button>
        </div>
      </header>

      {error ? (
        <p
          role="alert"
          className="mb-4 whitespace-pre-wrap border-l-4 border-defect bg-defect/12 p-3 text-sm text-defect"
        >
          {error}
        </p>
      ) : null}
      {validation ? (
        <details
          className={`mb-4 border-l-4 p-3 text-sm ${validation.ok ? 'border-normal bg-normal/12' : 'border-defect bg-defect/12'}`}
          open={!validation.ok}
        >
          <summary className="cursor-pointer font-medium text-fg">
            {validation.ok ? 'Der Korpus ist gültig' : 'Die Korpusprüfung ist rot'}
          </summary>
          <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap text-xs text-fg-muted">
            {validation.output || 'Keine Ausgabe.'}
          </pre>
        </details>
      ) : null}

      {topic ? (
        <p className="mb-3 text-sm text-fg-muted">
          Das Manifest von{' '}
          <a className="text-signal underline underline-offset-2" href={href('thema', topic.id)}>
            {topic.title}
          </a>{' '}
          — Lernziele, Bausteine und Prüfstand zeigt die Themenseite.
        </p>
      ) : null}
      <div className={`grid min-h-[68vh] gap-4 ${previewable ? 'xl:grid-cols-2' : ''}`}>
        {previewable ? (
          <Panel title="Vorschau" className="min-h-0 overflow-auto">
            <EditorialPreview
              kind={snapshot.kind}
              text={text}
              language={language}
              preview={
                preview?.path === path && preview.language === language ? preview : undefined
              }
              onLanguage={chooseLanguage}
            />
          </Panel>
        ) : null}
        <section className="flex min-h-[68vh] min-w-0 flex-col overflow-hidden rounded-lg border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-4 py-2">
            <Label>Quelle</Label>
            <a
              className="text-xs text-signal underline underline-offset-2"
              href={`${GITHUB}/${path}`}
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
          </div>
          <textarea
            aria-label={`Quelltext von ${path}`}
            value={text}
            onChange={(event) => setText(event.target.value)}
            spellCheck={snapshot.kind === 'topic-article' || snapshot.kind === 'discovery'}
            className="min-h-[62vh] flex-1 resize-none bg-ground p-4 font-mono text-[0.78rem] leading-5 text-fg outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal"
          />
        </section>
      </div>
    </>
  );
}

function EditorialPreview({
  kind,
  text,
  language,
  preview,
  onLanguage,
}: {
  kind: FileSnapshot['kind'];
  text: string;
  language: ContentLanguage;
  preview?: PreviewPayload;
  onLanguage: (language: ContentLanguage) => void;
}) {
  const parsed = useMemo(() => {
    if (kind === 'topic-article' || kind === 'discovery') return undefined;
    try {
      const value = YAML.parse(text) as unknown;
      return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
    } catch {
      return undefined;
    }
  }, [kind, text]);

  if (kind === 'topic-article' || kind === 'discovery') {
    return (
      <div>
        <LanguageSwitch language={language} preview={preview} onLanguage={onLanguage} />
        {preview ? <ArticlePreview payload={preview} /> : <Empty>Vorschau wird aufgebaut …</Empty>}
      </div>
    );
  }
  if (!parsed) return <Empty>Die Quelle ist kein gültiges YAML; die Vorschau wartet.</Empty>;
  return (
    <div>
      <LanguageSwitch language={language} onLanguage={onLanguage} />
      {kind === 'exercise-set' ? (
        <ExerciseSetPreview value={parsed} language={language} />
      ) : kind === 'reading' ? (
        <ReadingPreview value={parsed} language={language} />
      ) : (
        <VocabPreview value={parsed} language={language} />
      )}
    </div>
  );
}

function LanguageSwitch({
  language,
  preview,
  onLanguage,
}: {
  language: ContentLanguage;
  preview?: PreviewPayload;
  onLanguage: (language: ContentLanguage) => void;
}) {
  return (
    <div
      className="mb-5 flex flex-wrap items-center gap-1.5 border-b border-line pb-3"
      role="group"
      aria-label="Vorschausprache"
    >
      {CONTENT_LANGUAGES.map((entry) => {
        const coverage = preview?.languages.find((item) => item.language === entry);
        const unsupported = coverage?.status === 'unsupported';
        return (
          <button
            key={entry}
            type="button"
            onClick={() => onLanguage(entry)}
            aria-pressed={language === entry}
            title={coverage ? `${coverage.authored}/${coverage.required} Sprachblöcke` : undefined}
            className={`rounded border px-2 py-1 text-[0.68rem] font-semibold ${language === entry ? 'border-signal bg-signal/12 text-signal' : unsupported ? 'border-line text-fg-muted opacity-55' : 'border-line text-fg hover:bg-raised'}`}
          >
            {LANGUAGE_LABEL[entry]}
            {coverage
              ? ` · ${coverage.status === 'complete' ? 'vollständig' : coverage.status === 'partial' ? 'teilweise' : 'fehlt'}`
              : ''}
          </button>
        );
      })}
    </div>
  );
}
