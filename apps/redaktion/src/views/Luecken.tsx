/**
 * The problem inbox: every mechanically-detected defect, one row per instance, grouped by class
 * and ranked by how many instances share a cause — so "what should I fix next" has an answer.
 */
import { Callout, Chip, Empty, Filter, Panel } from '@da/ui/primitives';
import { PROBLEM_LABELS } from '@da/content/profile';
import type { Diagnostic, GraphPayload } from '../data';
import { Quelllink, Zeilentabelle, Quer, type Spalte } from '../components/Zeilentabelle';
import { href, useQueryState } from '../router';

type Level = GraphPayload['levels'][number];
type Problem = GraphPayload['problems'][number];
type WorkItem = Problem & { diagnostic: Diagnostic; topicStatus?: string };

const SEVERITY_LABEL: Record<Diagnostic['severity'], string> = {
  blocking: 'technisch blockierend',
  attention: 'redaktionell',
  info: 'Hinweis',
};

const STATUS_LABEL: Record<string, string> = { reviewed: 'geprüft', draft: 'Entwurf', workspace: 'korpusweit' };

/** One shape for every class, so the eye keeps its place moving down thirteen groups. */
const COLUMNS = (topicTitle: (id: string) => string): Spalte<WorkItem>[] => [
  { key: 'message', head: 'Befund', cell: (p) => <span className="text-ink">{p.message}</span> },
  {
    key: 'topic',
    head: 'Thema',
    cell: (p) =>
      p.topic ? <Quer href={href('thema', p.topic)}>{topicTitle(p.topic)}</Quer> : <span className="text-ink-muted">—</span>,
  },
  { key: 'level', head: 'Niveau', cell: (p) => <span className="text-ink-muted">{p.level ?? '—'}</span> },
  {
    key: 'status',
    head: 'Status',
    cell: (p) => <Chip tone={p.diagnostic.severity === 'blocking' ? 'warn' : p.topicStatus === 'reviewed' ? 'brand' : 'neutral'}>{p.diagnostic.severity === 'blocking' ? SEVERITY_LABEL.blocking : STATUS_LABEL[p.topicStatus ?? ''] ?? SEVERITY_LABEL[p.diagnostic.severity]}</Chip>,
  },
  { key: 'file', head: 'Datei', cell: (p) => (p.file ? <Quelllink href={href('quelle', undefined, { pfad: p.file })}>{p.file}</Quelllink> : null) },
];

export function Luecken({ graph }: { graph: GraphPayload }) {
  const [levelValue, setLevel] = useQueryState('niveau', 'alle');
  const level = levelValue as Level | 'alle';
  const [kind, setKind] = useQueryState('art', 'alle');
  const [severity, setSeverity] = useQueryState('schwere', 'alle');
  const [status, setStatus] = useQueryState('status', 'alle');

  const kindOptions = [...new Set(graph.problems.map((p) => p.kind))].sort();
  const topicTitle = (id: string) => graph.topics.find((t) => t.id === id)?.title ?? id;
  const topicStatus = new Map(graph.topics.map((topic) => [topic.id, topic.status]));
  const workItems: WorkItem[] = graph.problems.map((problem, index) => ({
    ...problem,
    diagnostic: graph.diagnostics[index]!,
    topicStatus: problem.topic ? topicStatus.get(problem.topic) : undefined,
  }));

  const filtered = workItems.filter(
    (p) =>
      (level === 'alle' || p.level === level) &&
      (kind === 'alle' || p.kind === kind) &&
      (severity === 'alle' || p.diagnostic.severity === severity) &&
      (status === 'alle' || (status === 'workspace' ? !p.topicStatus : p.topicStatus === status)),
  );

  const groups = new Map<string, WorkItem[]>();
  for (const p of filtered) {
    if (!groups.has(p.kind)) groups.set(p.kind, []);
    groups.get(p.kind)!.push(p);
  }
  const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);

  return (
    <>
      <header className="mb-5">
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-ink">Qualität</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {filtered.length} von {graph.problems.length} Befunden · redaktionelle Arbeitsliste, kein Validatorbericht
        </p>
      </header>

      <Callout tone="info" eyebrow="Wie diese Liste zu lesen ist" title="„Geprüft“ beschreibt den Themenstatus, nicht die technische Schwere">
        Ein Befund in einem geprüften Thema ist ältere redaktionelle Schuld. Nur ein ausdrücklich als „technisch blockierend“ markierter Fehler verhindert Speichern oder Freigabe; die aktuellen Profilbefunde tun das nicht.
      </Callout>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Filter label="Niveau" value={level} options={graph.levels} onChange={setLevel} />
        <Filter label="Art" value={kind} options={kindOptions} labels={Object.fromEntries(kindOptions.map((value) => [value, PROBLEM_LABELS[value]?.de ?? value]))} onChange={setKind} />
        <Filter label="Arbeitsbereich" value={status} options={['reviewed', 'draft', 'workspace']} labels={STATUS_LABEL} onChange={setStatus} />
        <Filter label="Schwere" value={severity} options={['blocking', 'attention', 'info']} labels={SEVERITY_LABEL} onChange={setSeverity} />
      </div>

      {sorted.length === 0 ? (
        <Empty>Keine Befunde in dieser Auswahl.</Empty>
      ) : (
        sorted.map(([k, rows]) => {
          const label = PROBLEM_LABELS[k];
          return (
            <Panel
              key={k}
              tone={rows.some((row) => row.diagnostic.severity === 'blocking') ? 'warn' : 'neutral'}
              className="mb-4"
              title={
                <span className="flex items-center gap-2">
                  {label?.de ?? k}
                  <Chip tone={rows.some((row) => row.diagnostic.severity === 'blocking') ? 'warn' : 'neutral'}>{rows.length}</Chip>
                </span>
              }
            >
              {/* The `why` is the half a class name cannot carry, and it is why these are labels
                  and not enum values. */}
              {label ? <p className="-mt-2 mb-3 text-xs text-ink-muted">{label.why}</p> : null}
              <Zeilentabelle
                rows={rows}
                rowKey={(p) => `${p.kind}-${p.topic ?? ''}-${p.file ?? ''}-${p.message}`}
                columns={COLUMNS(topicTitle)}
              />
            </Panel>
          );
        })
      )}
    </>
  );
}
