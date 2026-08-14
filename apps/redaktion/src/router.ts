/**
 * A hash router in forty lines.
 *
 * Hash rather than history, because this app is served from a dev server today and may be opened
 * from a built bundle tomorrow; a hash route survives both without a server rewrite rule. Every
 * node in the graph gets an address — `#/thema/perfekt-haben-sein`, `#/fokus/wo-wohin`,
 * `#/struktur/dativ-verben` — so a finding can be sent to someone rather than described.
 *
 * No router dependency: the whole contract is "read the hash, split it, subscribe to changes".
 */
import { useCallback, useEffect, useSyncExternalStore } from 'react';

export interface Route {
  /** The view: `themen`, `thema`, `fokus`, `struktur`, `luecken`, … */
  view: string;
  /** The node id, when the view addresses one. */
  id?: string;
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) window.addEventListener('hashchange', notify);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('hashchange', notify);
  };
}

function notify(): void {
  for (const listener of listeners) listener();
}

const getSnapshot = (): string => window.location.hash;

export function parseRoute(hash: string): Route {
  const [view = '', id] = hash.replace(/^#\/?/, '').split('/');
  return { view: view || 'ueberblick', id: id ? decodeURIComponent(id) : undefined };
}

export const href = (view: string, id?: string): string =>
  id ? `#/${view}/${encodeURIComponent(id)}` : `#/${view}`;

export function useRoute(): [Route, (view: string, id?: string) => void] {
  const hash = useSyncExternalStore(subscribe, getSnapshot, () => '');
  const go = useCallback((view: string, id?: string) => {
    window.location.hash = href(view, id).slice(1);
  }, []);
  return [parseRoute(hash), go];
}

/** Scroll to the top on every navigation — a long table left mid-scroll reads as a broken link. */
export function useScrollReset(key: string): void {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [key]);
}
