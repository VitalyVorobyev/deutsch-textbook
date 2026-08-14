/**
 * One topic, and everything it is made of.
 *
 * This is the view the whole model was built for: open a topic and see every element it owns, laid
 * out along the lesson cycle, with the checks it meets and the ones it does not — instead of
 * opening five directories and remembering which filename convention finds the probe family.
 *
 * The completeness figure is a count of yes/no checks, never a score. What it is read against is
 * the level median, which the header shows beside it.
 */
import { Bar, Card, Chip, Empty, Heading, Table, type Tone } from '@da/ui/primitives';
import { defaultStage } from '@da/content/elements';
import type { GraphPayload } from '../data';
import { Feldwahl } from '../components/Feldwahl';
import { href } from '../router';
import { useWritable } from '../write';

const STATUS_LABEL: Record<string, string> = { draft: 'Entwurf', reviewed: 'geprüft' };

const STAGE_LABEL: Record<string, string> = {
  pretest: 'Pretest',
  modell: 'Modell',
  geruest: 'Gerüst',
  ausblenden: 'Ausblenden',
  transfer: 'Transfer',
  nachpruefung: 'Nachprüfung',
  keine: 'außerhalb des Zyklus',
};

/** The arc, in order. Rendered even where empty — an absent stage is the finding. */
const ARC = ['pretest', 'modell', 'geruest', 'ausblenden', 'transfer', 'nachpruefung'] as const;

const TOUCH_LABEL: Record<string, string> = {
  input: 'Input',
  abruf: 'Abruf',
  interaktion: 'Interaktion',
  produktion: 'Produktion',
};

const GITHUB = 'https://github.com/VitalyVorobyev/deutsch-textbook/blob/main';

export function Thema({ graph, id }: { graph: GraphPayload; id: string }) {
  // The allowlist comes from the controller, so a control exists here only if a write would be
  // accepted there. No endpoint (a built bundle, a server without the plugin) means no controls.
  const writable = useWritable();
  const topic = graph.topics.find((t) => t.id === id);
  const profile = graph.profiles.find((p) => p.topic === id);
  if (!topic || !profile) return <Empty>Kein Thema mit der Kennung „{id}“.</Empty>;

  const stageField = writable.find((f) => f.class === 'exercise-set' && f.field === 'stage');
  const statusField = writable.find((f) => f.class === 'topic-manifest' && f.field === 'status');

  const elements = graph.elements.filter((e) => e.topic === id);
  const median = graph.reports.find((r) => r.level === topic.level)?.medians;
  const problems = graph.problems.filter((p) => p.topic === id);

  return (
    <>
      <Heading
        sub={
          <>
            {topic.level} · {topic.unitTitle ?? 'ohne Einheit'} ·{' '}
            <a className="text-info hover:underline" href={`${GITHUB}/${topic.file}`} target="_blank" rel="noreferrer">
              {topic.file}
            </a>
          </>
        }
      >
        {topic.title}
      </Heading>

      <div className="mb-4 flex items-center gap-2 text-xs">
        <span className="text-ink-muted">Status</span>
        {statusField ? (
          <Feldwahl
            file={topic.file}
            field="status"
            value={topic.status}
            options={statusField.values}
            labels={STATUS_LABEL}
            width="w-28"
            ariaLabel={`Status von ${topic.title}`}
          />
        ) : (
          <Chip tone={topic.status === 'reviewed' ? 'ok' : 'warn'}>{STATUS_LABEL[topic.status] ?? topic.status}</Chip>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <h2 className="mb-2 text-sm font-medium text-ink">Erfüllte Anforderungen</h2>
          <p className="tabular text-3xl text-ink">
            {profile.met}
            <span className="text-lg text-ink-muted">/{profile.total}</span>
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Median auf {topic.level}: {median?.met ?? '–'}/{profile.total}
          </p>
        </Card>

        <Card>
          <h2 className="mb-2 text-sm font-medium text-ink">Lernzyklus</h2>
          <ul className="space-y-1">
            {ARC.map((stage) => {
              const n = profile.arc[stage] ?? 0;
              return (
                <li key={stage} className="flex items-center justify-between gap-2 text-xs">
                  <span className={n ? 'text-ink' : 'text-warn'}>{STAGE_LABEL[stage]}</span>
                  <Chip tone={n ? 'ok' : 'warn'}>{n || '—'}</Chip>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <h2 className="mb-2 text-sm font-medium text-ink">Berührungen</h2>
          <ul className="space-y-2">
            {(['input', 'abruf', 'interaktion', 'produktion'] as const).map((touch) => (
              <li key={touch} className="flex items-center justify-between gap-2 text-xs">
                <span className={profile.touches[touch] ? 'text-ink' : 'text-warn'}>{TOUCH_LABEL[touch]}</span>
                <Bar
                  value={profile.touches[touch] ?? 0}
                  max={elements.length}
                  tone={profile.touches[touch] ? 'brand' : 'warn'}
                  label={String(profile.touches[touch] ?? 0)}
                />
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-muted">
            {profile.depth.items} Übungsaufgaben, davon {profile.depth.production} produktiv · Median{' '}
            {median?.items ?? '–'} / {median?.production ?? '–'}
          </p>
        </Card>
      </div>

      <h2 className="mb-2 mt-6 text-sm font-medium text-ink">Elemente ({elements.length})</h2>
      <Table
        rows={elements}
        rowKey={(e) => e.id}
        columns={[
          {
            key: 'stage',
            head: 'Stufe',
            // Only an exercise set has a `stage:` to declare; an article or a deck has a stage the
            // corpus computes and no file to write it into.
            cell: (e) =>
              stageField && e.file.startsWith('content/exercises/') ? (
                <Feldwahl
                  file={e.file}
                  field="stage"
                  value={e.stageDeclared ? e.stage : null}
                  options={stageField.values}
                  labels={STAGE_LABEL}
                  derived={defaultStage(e.kind)}
                  ariaLabel={`Stufe von ${e.id.split('#')[0]}`}
                />
              ) : (
                <Chip>{STAGE_LABEL[e.stage]}</Chip>
              ),
          },
          { key: 'kind', head: 'Art', cell: (e) => <span className="text-ink">{e.kind}</span> },
          {
            key: 'id',
            head: 'Element',
            cell: (e) => (
              <a className="text-info hover:underline" href={`${GITHUB}/${e.file}`} target="_blank" rel="noreferrer">
                {e.id.split('#')[0]}
              </a>
            ),
          },
          { key: 'items', head: 'Aufgaben', numeric: true, cell: (e) => e.depth.items || '' },
          { key: 'prod', head: 'produktiv', numeric: true, cell: (e) => e.depth.production || '' },
          {
            key: 'focus',
            head: 'Fokus',
            cell: (e) => (
              <span className="flex flex-wrap gap-1">
                {e.focus.map((tag) => (
                  <a key={tag} href={href('fokus', tag)}>
                    <Chip tone="info">{tag}</Chip>
                  </a>
                ))}
              </span>
            ),
          },
        ]}
      />

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-2 text-sm font-medium text-ink">Prüfungen</h2>
          <ul className="space-y-1.5 text-xs">
            {profile.checks.map((check) => (
              <li key={check.id} className="flex items-start gap-2">
                <Chip tone={check.ok ? 'ok' : 'warn'}>{check.ok ? '✓' : '✗'}</Chip>
                <span>
                  <span className={check.ok ? 'text-ink' : 'text-ink'}>{check.label}</span>
                  {check.detail ? <span className="text-ink-muted"> — {check.detail}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-4">
          <Card>
            <h2 className="mb-2 text-sm font-medium text-ink">Erklärung — Abschnitte</h2>
            {topic.subsections.length ? (
              <ol className="list-inside list-decimal space-y-0.5 text-xs text-ink">
                {topic.subsections.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            ) : (
              <p className="text-xs text-warn">
                Keine ###-Abschnitte. Die benannten Verwechslungen haben keine Stelle, auf die ein Link zeigen kann.
              </p>
            )}
          </Card>

          <Card>
            <h2 className="mb-2 text-sm font-medium text-ink">Outcomes ({topic.outcomes.length})</h2>
            <ul className="space-y-1 text-xs">
              {topic.outcomes.map((outcome) => (
                <li key={outcome.id}>
                  <Chip tone={profile.modesDelivered.includes(outcome.mode) ? 'neutral' : 'warn'}>{outcome.mode}</Chip>{' '}
                  <span className="text-ink">{outcome.de}</span>
                </li>
              ))}
            </ul>
          </Card>

          {problems.length ? (
            <Card>
              <h2 className="mb-2 text-sm font-medium text-ink">Befunde ({problems.length})</h2>
              <ul className="space-y-1 text-xs">
                {problems.map((p, i) => (
                  <li key={`${p.kind}-${i}`}>
                    <a href={href('luecken')}>
                      <Chip tone={'warn' as Tone}>{p.kind}</Chip>
                    </a>{' '}
                    <span className="text-ink-muted">{p.message}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
