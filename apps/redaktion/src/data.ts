/**
 * The corpus, in the browser.
 *
 * One fetch of `/__graph` on mount, and a re-fetch whenever the dev server says a file under
 * `content/` or `data/` changed — so the editor is never showing a stale corpus, which is the
 * defect the previous generated console could not avoid by construction.
 *
 * The bulk tiers (`items`, `vocab`, `texts` — eight megabytes together) are fetched by the views
 * that need them and cached for the session.
 */
import { useEffect, useState } from 'react';
import type { GraphPayload } from '@da/content/payload';

export type { GraphPayload };

const chunkCache = new Map<string, Promise<unknown>>();

export function loadChunk<T>(name: 'items' | 'vocab' | 'texts'): Promise<T> {
  let pending = chunkCache.get(name);
  if (!pending) {
    pending = fetch(`/__chunk/${name}`).then((r) => r.json());
    chunkCache.set(name, pending);
  }
  return pending as Promise<T>;
}

export interface CorpusState {
  graph?: GraphPayload;
  error?: string;
  /** Bumped when the dev server reports a change; views can key off it. */
  revision: number;
}

export function useCorpus(): CorpusState {
  const [state, setState] = useState<CorpusState>({ revision: 0 });

  useEffect(() => {
    let cancelled = false;
    const load = (revision: number) => {
      fetch('/__graph')
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status} ${r.statusText}`))))
        .then((graph: GraphPayload) => {
          if (!cancelled) setState({ graph, revision });
        })
        .catch((e: unknown) => {
          if (!cancelled) setState({ error: e instanceof Error ? e.message : String(e), revision });
        });
    };
    load(0);

    // Vite's HMR channel carries the watcher event from plugin/corpus.ts.
    let revision = 0;
    const onChange = () => {
      chunkCache.clear();
      load((revision += 1));
    };
    import.meta.hot?.on('redaktion:corpus-changed', onChange);
    return () => {
      cancelled = true;
      import.meta.hot?.off?.('redaktion:corpus-changed', onChange);
    };
  }, []);

  return state;
}
