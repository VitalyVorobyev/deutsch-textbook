import { Bar, Button, Callout, Chip, Label, Panel, Section, Stat, StatGroup } from '@da/ui/primitives';
import type { ReactNode } from 'react';
import type { GraphPayload, WorkspaceInfo } from '../data';
import { href } from '../router';

export function Uebersicht({ graph, workspace }: { graph: GraphPayload; workspace?: WorkspaceInfo }) {
  const count = (severity: GraphPayload['diagnostics'][number]['severity']) => graph.diagnostics.filter((item) => item.severity === severity).length;
  const topics = graph.topics.length;
  const reviewed = graph.topics.filter((topic) => topic.status === 'reviewed').length;
  const thin = graph.tags.filter((tag) => tag.teaching > 0 && tag.teaching <= 3).length;
  return (
    <>
      <header className="mb-7">
        <Label>Redaktioneller Arbeitsraum</Label>
        <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight text-ink">Deutsch-Atlas im Überblick</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">Katalog, Belege und Quellen bleiben getrennte Aussagen. Eine grüne Abdeckung ist kein Beweis für Tiefe oder Behalten.</p>
      </header>

      {count('blocking') ? (
        <Callout tone="warn" eyebrow="Vor der nächsten Freigabe" title={`${count('blocking')} blockierende Befunde`} action={<Button href={href('qualitaet', undefined, { schwere: 'blocking' })}>Arbeitsliste öffnen</Button>}>
          Bereits geprüfte Themen tragen offene strukturelle Befunde. Der Status und der Korpus widersprechen einander.
        </Callout>
      ) : <Callout tone="ok" eyebrow="Freigabegate" title="Kein blockierender Befund" />}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Kurszustand">
          <StatGroup columns={4}>
            <Stat label="Themen" value={topics} hint={`${reviewed} geprüft`} />
            <Stat label="Materialien" value={graph.elements.length} />
            <Stat label="Grammatikpunkte" value={graph.inventory.length} hint={`${graph.grammarTracks.length} Linien`} />
            <Stat label="dünne Fokus-Tags" value={thin} hint="höchstens 3 Lehraufgaben" tone={thin ? 'warn' : 'neutral'} />
          </StatGroup>
          <div className="mt-6 border-t border-border-subtle pt-4">
            <Label>Redaktioneller Status</Label>
            <div className="mt-2"><Bar value={reviewed} max={topics} tone="brand" label={`${reviewed}/${topics}`} /></div>
          </div>
        </Panel>
        <Panel title="Arbeitsumgebung">
          <p className="break-all text-sm text-ink">{workspace?.root ?? graph.root}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Chip tone={workspace?.writable ? 'ok' : 'warn'}>{workspace?.writable ? 'lokal schreibbar' : 'nur lesbar'}</Chip>
            <Chip>{workspace?.transport ?? 'vite'}</Chip>
            <Chip>{workspace?.platform ?? 'browser'}</Chip>
          </div>
          <p className="mt-4 text-xs leading-5 text-ink-muted">Der Checkout ist die einzige Inhaltsquelle. Redaktion speichert keine zweite Fassung in einer Datenbank.</p>
        </Panel>
      </div>

      <Section>Arbeitslisten</Section>
      <div className="grid gap-4 md:grid-cols-3">
        <Queue title="Blockierend" count={count('blocking')} tone="warn" href={href('qualitaet', undefined, { schwere: 'blocking' })}>Widersprüche in bereits geprüften Themen.</Queue>
        <Queue title="Zu bearbeiten" count={count('attention')} tone="brand" href={href('qualitaet', undefined, { schwere: 'attention' })}>Bekannte Lücken in Entwürfen und Materialien.</Queue>
        <Queue title="Hinweise" count={count('info')} tone="info" href={href('qualitaet', undefined, { schwere: 'info' })}>Bewusste Ausnahmen und Kontext.</Queue>
      </div>
    </>
  );
}

function Queue({ title, count, tone, href: target, children }: { title: string; count: number; tone: 'warn' | 'brand' | 'info'; href: string; children: ReactNode }) {
  return <Panel title={title} tone={tone} action={<span className="tabular text-2xl font-semibold text-ink">{count}</span>}><p className="text-sm leading-5 text-ink-muted">{children}</p><p className="mt-4"><Button href={target}>öffnen</Button></p></Panel>;
}
