/**
 * One topic: where it stands, what it is made of, what backs it, and what is wrong with it.
 *
 * WHAT CHANGED, AND WHY IT IS NOT COSMETIC. The first version opened with three stat cards and a
 * table of files — everything the topic *contains* and nothing about where it sits. All four graph
 * edges (`prerequisites`, `neededBy`, `deepens`, `deepenedBy`) had been in the payload since the
 * manifests landed and **not one reached a screen**. That is the half of "context" a file listing
 * cannot give, and it is the half that decides whether a topic may be reordered, retired or taught
 * earlier. It leads now.
 *
 * The rest is four tabs rather than one scroll of equally-weighted sections. The old page set every
 * heading — the card titles, `Elemente (7)`, the group labels — in `text-sm font-medium`, so
 * nothing on it contained anything else.
 *
 * The completeness figure is a count of yes/no checks, never a score, and it is read against the
 * level median the header prints beside it.
 */
import { useState } from 'react';
import { Bar, Callout, Chip, Empty, Label, Panel, Stat, StatGroup, type Tone } from '@da/ui/primitives';
import { defaultStage } from '@da/content/elements';
import { PROBLEM_LABELS } from '@da/content/profile';
import { Reiter } from '../components/Hinweis';
import type { GraphPayload } from '../data';
import { Feldwahl } from '../components/Feldwahl';
import { Kontextleiste, type Nachbar } from '../components/Kontextleiste';
import { Extern, Gruppentabelle, Quer, type Spalte } from '../components/Zeilentabelle';
import { href } from '../router';
import { useWritable } from '../write';

type Element = GraphPayload['elements'][number];

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

type ReiterId = 'ueberblick' | 'elemente' | 'pruefungen' | 'befunde';

export function Thema({ graph, id }: { graph: GraphPayload; id: string }) {
  const [reiter, setReiter] = useState<ReiterId>('ueberblick');
  const topic = graph.topics.find((t) => t.id === id);
  const profile = graph.profiles.find((p) => p.topic === id);
  if (!topic || !profile) return <Empty>Kein Thema mit der Kennung „{id}“.</Empty>;

  const elements = graph.elements.filter((e) => e.topic === id);
  const median = graph.reports.find((r) => r.level === topic.level)?.medians;
  const problems = graph.problems.filter((p) => p.topic === id);
  const offen = profile.checks.filter((c) => !c.ok);

  const tagsOf = (topicId: string) =>
    new Set(graph.elements.filter((e) => e.topic === topicId).flatMap((e) => e.focus));
  const mine = tagsOf(id);
  const nachbar = (otherId: string, withTags: boolean): Nachbar => {
    const other = graph.topics.find((t) => t.id === otherId);
    return {
      id: otherId,
      title: other?.title ?? otherId,
      href: href('thema', otherId),
      sharedTags: withTags ? [...tagsOf(otherId)].filter((t) => mine.has(t)) : undefined,
    };
  };

  return (
    <>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Label>
            {topic.level} · {topic.unitTitle ?? 'ohne Einheit'}
          </Label>
          <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight text-ink">{topic.title}</h1>
          <p className="mt-1 text-sm">
            <Extern href={href('quelle', undefined, { pfad: topic.file })}>{topic.file}</Extern>
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-ink-muted">Status</span>
          <StatusFeld graph={graph} topic={topic} />
        </div>
      </header>

      <Kontextleiste
        titel={topic.title}
        level={topic.level}
        voraussetzungen={topic.prerequisites.map((p) => nachbar(p, false))}
        gebrauchtVon={topic.neededBy.map((p) => nachbar(p, false))}
        vertieft={topic.deepens.map((p) => nachbar(p, true))}
        vertieftVon={topic.deepenedBy.map((p) => nachbar(p, true))}
      />

      <div className="mb-5">
        <Reiter
          ariaLabel="Ansicht des Themas"
          value={reiter}
          onChange={setReiter}
          options={[
            { id: 'ueberblick', label: 'Überblick' },
            { id: 'elemente', label: 'Elemente', count: elements.length },
            { id: 'pruefungen', label: 'Prüfungen', count: offen.length || undefined },
            { id: 'befunde', label: 'Befunde', count: problems.length || undefined },
          ]}
        />
      </div>

      {reiter === 'ueberblick' ? (
        <Ueberblick graph={graph} topic={topic} profile={profile} median={median} elements={elements} />
      ) : null}
      {reiter === 'elemente' ? <Elemente graph={graph} elements={elements} /> : null}
      {reiter === 'pruefungen' ? <Pruefungen profile={profile} /> : null}
      {reiter === 'befunde' ? <Befunde problems={problems} /> : null}
    </>
  );
}

/**
 * The write control exists only if the controller would accept the write — the allowlist is
 * fetched, never copied. No endpoint (a built bundle, a server without the plugin) means a chip.
 */
function StatusFeld({ graph, topic }: { graph: GraphPayload; topic: GraphPayload['topics'][number] }) {
  void graph;
  return (
    <span className="inline-flex items-center gap-2">
      <Chip tone={topic.status === 'reviewed' ? 'ok' : 'warn'}>{STATUS_LABEL[topic.status] ?? topic.status}</Chip>
      {topic.status !== 'reviewed' ? (
        <a className="text-xs text-info-ink underline underline-offset-2" href={href('quelle', undefined, { pfad: topic.file })}>
          Gate öffnen
        </a>
      ) : null}
    </span>
  );
}

function Ueberblick({
  graph,
  topic,
  profile,
  median,
  elements,
}: {
  graph: GraphPayload;
  topic: GraphPayload['topics'][number];
  profile: GraphPayload['profiles'][number];
  median?: GraphPayload['reports'][number]['medians'];
  elements: Element[];
}) {
  const fehlend = ARC.filter((s) => !(profile.arc[s] ?? 0));
  return (
    <>
      {fehlend.length ? (
        <Callout
          tone="warn"
          eyebrow="Lernzyklus"
          title={`${fehlend.length} Stufe${fehlend.length === 1 ? '' : 'n'} ohne Element`}
        >
          Es fehlt: {fehlend.map((s) => STAGE_LABEL[s]).join(', ')}. Der Zyklus verlangt jede Stufe einmal —
          ein Thema, das beim Üben endet, wird nie in einem neuen Kontext verlangt.
        </Callout>
      ) : (
        <Callout tone="ok" eyebrow="Lernzyklus" title="Jede Stufe hat mindestens ein Element" />
      )}

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <Panel title="Erfüllte Anforderungen">
          <StatGroup columns={2}>
            <Stat
              label="dieses Thema"
              value={
                <>
                  {profile.met}
                  <span className="text-base font-normal text-ink-muted">/{profile.total}</span>
                </>
              }
              tone={median?.met !== undefined && profile.met < median.met ? 'warn' : 'neutral'}
            />
            <Stat label={`Median auf ${topic.level}`} value={median?.met ?? '–'} />
          </StatGroup>
        </Panel>

        <Panel title="Lernzyklus">
          <ul className="space-y-1.5">
            {ARC.map((stage) => {
              const n = profile.arc[stage] ?? 0;
              return (
                <li key={stage} className="flex items-center justify-between gap-2 text-xs">
                  <span className={n ? 'text-ink' : 'text-warn-ink'}>{STAGE_LABEL[stage]}</span>
                  <span className={`tabular ${n ? 'text-ink-muted' : 'text-warn-ink'}`}>{n || '—'}</span>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel title="Berührungen">
          <ul className="space-y-2">
            {(['input', 'abruf', 'interaktion', 'produktion'] as const).map((touch) => (
              <li key={touch} className="flex items-center justify-between gap-2 text-xs">
                <span className={profile.touches[touch] ? 'text-ink' : 'text-warn-ink'}>{TOUCH_LABEL[touch]}</span>
                <Bar
                  value={profile.touches[touch] ?? 0}
                  max={elements.length}
                  tone={profile.touches[touch] ? 'brand' : 'warn'}
                  label={String(profile.touches[touch] ?? 0)}
                />
              </li>
            ))}
          </ul>
          <p className="tabular mt-3 border-t border-border-subtle pt-2 text-xs text-ink-muted">
            {profile.depth.items} Aufgaben, davon {profile.depth.production} produktiv · Median{' '}
            {median?.items ?? '–'} / {median?.production ?? '–'}
          </p>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Panel title={`Outcomes (${topic.outcomes.length})`}>
          <ul className="space-y-1.5 text-xs">
            {topic.outcomes.map((outcome) => (
              <li key={outcome.id} className="flex items-start gap-2">
                <Chip tone={profile.modesDelivered.includes(outcome.mode) ? 'neutral' : 'warn'}>{outcome.mode}</Chip>
                <span className="text-ink">{outcome.de}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Erklärung — Abschnitte" tone={topic.subsections.length ? 'neutral' : 'warn'}>
          {topic.subsections.length ? (
            <ol className="list-inside list-decimal space-y-0.5 text-xs text-ink">
              {topic.subsections.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          ) : (
            <p className="text-xs text-warn-ink">{PROBLEM_LABELS['artikel-ohne-abschnitte']?.why}</p>
          )}
          <p className="mt-3 border-t border-border-subtle pt-2 text-xs">
            <Extern href={href('quelle', undefined, { pfad: graph.elements.find((e) => e.topic === topic.id && e.kind === 'artikel')?.file ?? topic.file })}>
              Artikel öffnen
            </Extern>
          </p>
        </Panel>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Panel title="Grammatiklinien und Fokus">
          <div className="flex flex-wrap gap-1.5">
            {[...new Set(profile.points.map((id) => graph.inventory.find((point) => point.id === id)?.track).filter((id): id is string => !!id))].map((track) => <Chip key={track} tone="brand">{graph.grammarTracks.find((item) => item.id === track)?.de ?? track}</Chip>)}
            {profile.focus.map((tag) => <a key={tag} href={href('fokus', tag)}><Chip>{tag}</Chip></a>)}
          </div>
          {topic.tags.length ? <p className="mt-3 text-xs text-ink-muted">Themen-Tags: {topic.tags.join(' · ')}</p> : null}
        </Panel>
        <Panel title="Referenzansprüche" tone={topic.claims.length ? 'neutral' : 'leer'}>
          {topic.claims.length ? <ul className="space-y-1 text-xs text-ink">{topic.claims.map((claim) => <li key={claim}>{claim}</li>)}</ul> : <p className="text-xs text-ink-muted">Keine Themenliste beansprucht; bei reinen Grammatikthemen ist das erwartbar.</p>}
          <p className="mt-3"><a href={href('referenzen')} className="text-xs text-info-ink underline underline-offset-2">in Referenzen prüfen</a></p>
        </Panel>
      </div>
    </>
  );
}

function Elemente({ graph, elements }: { graph: GraphPayload; elements: Element[] }) {
  const stageField = useWritableField('exercise-set', 'stage');
  void graph;

  const columns: Spalte<Element>[] = [
    {
      key: 'stage',
      head: 'Stufe',
      // Only an exercise set has a `stage:` to declare; an article or a deck has one the corpus
      // computes and no file to write it into.
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
          <span className="text-ink-muted">{STAGE_LABEL[e.stage]}</span>
        ),
    },
    { key: 'kind', head: 'Art', cell: (e) => <span className="text-ink-muted">{e.kind}</span> },
    { key: 'id', head: 'Element', cell: (e) => <Extern href={href('quelle', undefined, { pfad: e.file })}>{e.id.split('#')[0]}</Extern> },
    { key: 'items', head: 'Aufgaben', numeric: true, cell: (e) => e.depth.items || '' },
    { key: 'prod', head: 'produktiv', numeric: true, cell: (e) => e.depth.production || '' },
    {
      key: 'focus',
      head: 'Fokus',
      cell: (e) => (
        <span className="flex flex-wrap gap-1">
          {e.focus.map((tag) => (
            <Quer key={tag} href={href('fokus', tag)}>
              {tag}
            </Quer>
          ))}
        </span>
      ),
    },
  ];

  // Grouped by lesson-cycle stage, in arc order, so the page reads as the cycle rather than as a
  // directory. `keine` collects what sits outside it (checkpoints, placements).
  const order = [...ARC, 'keine'];
  const gruppen = order
    .map((stage) => ({
      id: stage,
      label: (
        <span className="flex items-center gap-2">
          {STAGE_LABEL[stage]}
          <span className="tabular text-xs font-normal text-ink-muted">
            {elements.filter((e) => e.stage === stage).length}
          </span>
        </span>
      ),
      rows: elements.filter((e) => e.stage === stage),
    }))
    .filter((g) => g.rows.length);

  return <Gruppentabelle gruppen={gruppen} columns={columns} rowKey={(e) => e.id} />;
}

function Pruefungen({ profile }: { profile: GraphPayload['profiles'][number] }) {
  return (
    <ul className="space-y-2">
      {profile.checks.map((check) => (
        <li key={check.id} className="flex items-start gap-2.5 text-sm">
          <Chip tone={check.ok ? ('ok' as Tone) : ('warn' as Tone)}>{check.ok ? '✓' : '✗'}</Chip>
          <span className="min-w-0">
            <span className="text-ink">{check.label}</span>
            {check.detail ? <span className="text-ink-muted"> — {check.detail}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Befunde({ problems }: { problems: GraphPayload['problems'] }) {
  if (!problems.length) return <Empty>Keine Befunde für dieses Thema.</Empty>;
  return (
    <ul className="space-y-3">
      {problems.map((p, i) => (
        <li key={`${p.kind}-${i}`}>
          <p className="text-sm font-medium text-warn-ink">{PROBLEM_LABELS[p.kind]?.de ?? p.kind}</p>
          <p className="text-sm text-ink">{p.message}</p>
          <p className="mt-0.5 text-xs text-ink-muted">{PROBLEM_LABELS[p.kind]?.why}</p>
          {p.file ? (
            <p className="mt-0.5 text-xs">
              <Extern href={href('quelle', undefined, { pfad: p.file })}>{p.file}</Extern>
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** The allowlist, narrowed to one (class, field). Keeps `useWritable` out of four call sites. */
function useWritableField(klass: string, field: string) {
  return useWritable().find((f) => f.class === klass && f.field === field);
}
