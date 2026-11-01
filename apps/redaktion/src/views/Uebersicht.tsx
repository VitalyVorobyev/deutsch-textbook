/**
 * The front page: the state of the course and what is waiting, on one screen at a full window.
 *
 * Every block answers "is something waiting for me?" — findings, files to review, the review state
 * per level. A block with nothing to say is not drawn: an all-clear callout or a card reading "0"
 * pushes what does need attention below the fold.
 */
import { Bar, Button, Callout, Chip, Label, Panel, Stat, StatGroup } from '@da/ui/primitives';
import type { GraphPayload, WorkspaceInfo } from '../data';
import { href } from '../router';
import { useReviews } from '../reviews';

export function Uebersicht({
  graph,
  workspace,
}: {
  graph: GraphPayload;
  workspace?: WorkspaceInfo;
}) {
  const count = (severity: GraphPayload['diagnostics'][number]['severity']) =>
    graph.diagnostics.filter((item) => item.severity === severity).length;
  const reviews = useReviews();
  const reviewedIds = new Set(
    [...reviews.topics.values()].filter((review) => review.reviewed).map((review) => review.topic),
  );
  const reviewed = reviewedIds.size;
  const reviewedDebt = graph.problems.filter(
    (problem) => problem.topic && reviewedIds.has(problem.topic),
  ).length;
  const draftDebt = graph.problems.filter(
    (problem) => problem.topic && !reviewedIds.has(problem.topic),
  ).length;
  const workspaceDebt = graph.problems.filter((problem) => !problem.topic).length;
  const thin = graph.tags.filter((tag) => tag.teaching > 0 && tag.teaching <= 3).length;
  const files = reviews.files ?? [];
  const handedOver = files.filter((file) => file.status === 'claude-reviewed').length;
  const changed = files.filter((file) => file.status === 'geaendert').length;
  const ownerReviewed = files.filter((file) => file.status === 'owner-reviewed').length;
  const forOwner = (reviews.queue ?? []).filter((entry) => entry.waiting === 'owner').length;

  return (
    <>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Label>Redaktioneller Arbeitsraum</Label>
          <h1 className="mt-1 font-serif text-2xl font-semibold tracking-tight text-fg">
            Deutsch-Atlas im Überblick
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-fg-muted">
            Katalog, Belege und Quellen bleiben getrennte Aussagen. Eine grüne Abdeckung ist kein
            Beweis für Tiefe oder Behalten.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip tone={workspace?.writable ? 'ok' : 'warn'}>
            {workspace?.writable ? 'lokal schreibbar' : 'nur lesbar'}
          </Chip>
          <Chip>{workspace?.transport ?? 'vite'}</Chip>
        </div>
      </header>

      {count('blocking') ? (
        <div className="mb-4">
          <Callout
            tone="warn"
            eyebrow="Technische Sperre"
            title={`${count('blocking')} tatsächlich blockierende Befunde`}
            action={
              <Button href={href('qualitaet', undefined, { schwere: 'blocking' })}>
                Arbeitsliste öffnen
              </Button>
            }
          >
            Diese Fehler verhindern Speichern oder Freigabe und müssen zuerst behoben werden.
          </Callout>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Panel title="Kurszustand">
          <StatGroup columns={4}>
            <Stat label="Themen" value={graph.topics.length} hint={`${reviewed} geprüft`} />
            <Stat label="Materialien" value={graph.elements.length} />
            <Stat
              label="Grammatikpunkte"
              value={graph.inventory.length}
              hint={`${graph.grammarTracks.length} Linien`}
            />
            <Stat
              label="dünne Fokus-Tags"
              value={thin}
              hint="höchstens 3 Lehraufgaben"
              tone={thin ? 'warn' : 'neutral'}
            />
          </StatGroup>
          <div className="mt-5 border-t border-line pt-4">
            <Label>Geprüfte Themen je Niveau</Label>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {graph.levels.map((level) => {
                const ids = graph.topics.filter((topic) => topic.level === level);
                if (!ids.length) return null;
                const done = ids.filter((topic) => reviewedIds.has(topic.id)).length;
                return (
                  <div key={level} className="flex items-center gap-2">
                    <span className="w-6 text-xs font-semibold text-fg">{level}</span>
                    <Bar value={done} max={ids.length} tone="ok" label={`${done}/${ids.length}`} />
                  </div>
                );
              })}
            </div>
          </div>
        </Panel>

        <Panel
          title="Prüfen"
          tone={handedOver + changed + forOwner ? 'brand' : 'neutral'}
          action={<Button href={href('pruefen')}>Inbox öffnen</Button>}
        >
          <StatGroup columns={4}>
            <Stat label="übergeben" value={handedOver} tone={handedOver ? 'brand' : 'neutral'} />
            <Stat label="Anliegen" value={forOwner} tone={forOwner ? 'brand' : 'neutral'} />
            <Stat label="geändert" value={changed} tone={changed ? 'warn' : 'neutral'} />
            <Stat label="geprüft" value={ownerReviewed} hint={`von ${files.length} Dateien`} />
          </StatGroup>
        </Panel>
      </div>

      <Panel title="Befunde" className="mt-4">
        <ul className="grid gap-x-6 gap-y-2 md:grid-cols-3">
          <Queue
            title="In geprüften Themen"
            count={reviewedDebt}
            href={href('qualitaet', undefined, { status: 'reviewed' })}
          >
            ältere Qualitätslücken, nach Ursache geordnet
          </Queue>
          <Queue
            title="In Entwürfen"
            count={draftDebt}
            href={href('qualitaet', undefined, { status: 'draft' })}
          >
            vor der nächsten Prüfung zu bearbeiten
          </Queue>
          <Queue
            title="Korpusweit"
            count={workspaceDebt}
            href={href('qualitaet', undefined, { status: 'workspace' })}
          >
            Fokus-Tags, Inventar und Quellen ohne Eigentümerthema
          </Queue>
        </ul>
      </Panel>
    </>
  );
}

function Queue({
  title,
  count,
  href: target,
  children,
}: {
  title: string;
  count: number;
  href: string;
  children: string;
}) {
  return (
    <li>
      <a
        href={target}
        className="flex items-baseline justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-raised"
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-fg">{title}</span>
          <span className="block text-xs text-fg-muted">{children}</span>
        </span>
        <span
          className={`tabular text-xl font-semibold ${count ? 'text-signal' : 'text-fg-muted'}`}
        >
          {count}
        </span>
      </a>
    </li>
  );
}
