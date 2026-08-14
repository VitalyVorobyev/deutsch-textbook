import { useState } from 'react';
import { Button, Chip, Label, Panel } from '@da/ui/primitives';
import { corpusClient, type WorkspaceInfo } from '../data';

export function Einstellungen({ workspace }: { workspace?: WorkspaceInfo }) {
  const [path, setPath] = useState(workspace?.root ?? '');
  const [message, setMessage] = useState('');
  const desktop = workspace?.transport === 'tauri';
  const choose = async () => {
    const { open: openDialog } = await import('@tauri-apps/plugin-dialog');
    const selected = await openDialog({ directory: true, multiple: false, title: 'Deutsch-Atlas Checkout wählen' });
    if (typeof selected === 'string') setPath(selected);
  };
  const open = async () => {
    try {
      const next = await corpusClient.openWorkspace(path);
      setPath(next.root);
      setMessage('Checkout geöffnet.');
      window.location.hash = '#/uebersicht';
      window.location.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
  };
  return (
    <>
      <header className="mb-6"><Label>Lokale Arbeitsumgebung</Label><h1 className="mt-1 font-serif text-3xl font-semibold text-ink">Einstellungen</h1></header>
      <Panel title="Deutsch-Atlas Checkout" className="max-w-3xl">
        <label className="block text-sm text-ink"><span className="mb-1 block text-xs text-ink-muted">Absoluter Pfad</span><input value={path} onChange={(event) => setPath(event.target.value)} disabled={!desktop} className="w-full rounded-md border border-border-subtle bg-surface px-3 py-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60" /></label>
        <div className="mt-3 flex flex-wrap items-center gap-3"><Button onClick={() => void choose()} disabled={!desktop}>Ordner wählen</Button><Button onClick={() => void open()} disabled={!desktop || !path}>Checkout öffnen</Button><Chip tone={workspace?.writable ? 'ok' : 'warn'}>{workspace?.writable ? 'schreibbar' : 'nur lesbar'}</Chip></div>
        {!desktop ? <p className="mt-4 text-xs text-ink-muted">Im Browser wird der Checkout vom laufenden Vite-Prozess festgelegt. Die Auswahl steht in der Desktop-App zur Verfügung.</p> : null}
        {message ? <p className="mt-3 text-sm text-ink-muted">{message}</p> : null}
      </Panel>
    </>
  );
}
