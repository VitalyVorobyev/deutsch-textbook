/**
 * The browser half of the write controller.
 *
 * Two rules shape it, and both are about not being clever:
 *
 * **The writable surface is fetched, never declared here.** `/__writable` returns the controller's
 * own allowlist, so a field can appear in the interface only after it exists in
 * `@da/content/write` — a UI that carried its own copy of the enum would be one refactor away from
 * offering an edit the server refuses, which is the worst kind of control to put in front of an
 * editor.
 *
 * **Nothing is optimistic.** On success the dev server's watcher sees the file change and pushes
 * `redaktion:corpus-changed`, which `useCorpus` turns into a refetch — so the value on screen is
 * always the value on disk. A local `setState` would be a second source of truth for the one thing
 * this app exists to report faithfully.
 */
import { useEffect, useState } from 'react';
import { corpusClient, type WritableField } from './data';

export type { WritableField } from './data';

export type WriteOutcome = { ok: true; changed: boolean } | { ok: false; error: string };

/** The allowlist, fetched once per session. Empty until it arrives — no control renders meanwhile. */
export function useWritable(): WritableField[] {
  const [fields, setFields] = useState<WritableField[]>([]);
  useEffect(() => {
    let cancelled = false;
    corpusClient.writableFields()
      .then((next) => {
        if (!cancelled) setFields(next);
      })
      .catch(() => {
        /* No endpoint means no editing. The report is the product; the edit is the extra. */
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return fields;
}

export async function writeField(patch: {
  file: string;
  field: string;
  value: string | null;
}): Promise<WriteOutcome> {
  try {
    const body = await corpusClient.writeField(patch);
    if (!body.ok) return body;
    return { ok: true, changed: body.changed };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
