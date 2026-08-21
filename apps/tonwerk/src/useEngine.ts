/**
 * Reading from the engine, and pointing an element at its bytes.
 *
 * Two hooks, both small, both existing because the alternative is the pattern this app replaces:
 * a `fetch` in a component, no abort, and `location.reload()` as the refresh story.
 */
import { createContext, useContext, useEffect, useState } from 'react';
import type { Api } from './api';

export const ApiContext = createContext<Api | null>(null);

export function useApi(): Api {
  const api = useContext(ApiContext);
  if (!api) throw new Error('useApi outside ApiContext');
  return api;
}

export interface Resource<T> {
  data: T | null;
  error: Error | null;
  laedt: boolean;
}

/**
 * One read, aborted when the view leaves.
 *
 * `keys` is the dependency list spelled out by the caller rather than inferred from `load`, because
 * an inline arrow is a new function on every render and would re-fetch forever. An abort on unmount
 * matters more here than usual: `/api/registry` walks 437 exercise files and two project tables, so
 * a fast click through the nav can otherwise leave three of them in flight.
 */
export function useEngineRead<T>(load: (signal: AbortSignal) => Promise<T>, keys: readonly unknown[]): Resource<T> {
  const [state, setState] = useState<Resource<T>>({ data: null, error: null, laedt: true });
  const [gemerkt, setGemerkt] = useState<readonly unknown[]>(keys);

  // Resetting to "loading" happens **during render**, not in the effect. React's own guidance for
  // "adjust state when an input changes", and here it is also the only correct order: an effect
  // resets one paint too late, so the new route would flash the previous route's table first.
  if (!gleich(gemerkt, keys)) {
    setGemerkt(keys);
    setState({ data: null, error: null, laedt: true });
  }

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setState({ data, error: null, laedt: false });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setState({ data: null, error: error instanceof Error ? error : new Error(String(error)), laedt: false });
      },
    );
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, keys);

  return state;
}

function gleich(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
}

/**
 * A blob URL for one authenticated binary endpoint — a portrait, a demo take, a master.
 *
 * The engine wants `Authorization: Bearer` and `<img src>`/`<audio src>` cannot send a header, so
 * the bytes are fetched and wrapped. The revoke on unmount is not hygiene: the Figuren roster holds
 * up to 48 demo takes, and a page that leaks them all keeps every WAV alive for the session.
 *
 * `path` may be null, which is how a character with no selected portrait asks for nothing.
 */
export function useEngineBlob(path: string | null): string | null {
  const api = useApi();
  const [url, setUrl] = useState<string | null>(null);
  const [fuer, setFuer] = useState<string | null>(path);

  // Same render-phase adjustment as above: a card whose portrait changed must not show the previous
  // character's face for one paint.
  if (fuer !== path) {
    setFuer(path);
    setUrl(null);
  }

  useEffect(() => {
    if (!path) return;
    let revoked: string | null = null;
    let cancelled = false;
    const controller = new AbortController();
    api.objectUrl(path, controller.signal).then(
      (created) => {
        if (cancelled) {
          URL.revokeObjectURL(created);
          return;
        }
        revoked = created;
        setUrl(created);
      },
      () => {
        // A missing portrait or demo is a 404, and a 404 here is an empty state rather than an
        // error: the roster is meant to be readable before every asset has been generated.
        if (!cancelled) setUrl(null);
      },
    );
    return () => {
      cancelled = true;
      controller.abort();
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [api, path]);

  return url;
}
