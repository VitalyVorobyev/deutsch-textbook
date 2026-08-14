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
  /**
   * Filter state, so a *scoped* list is addressable and not only a node. The map cell that reads
   * `nominalgruppe A1 3/6` has to be able to hand the reader those six rows, and a view whose
   * filters live only in `useState` can be linked to but never linked *into*.
   */
  query: Record<string, string>;
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
  const [path = '', search = ''] = hash.replace(/^#\/?/, '').split('?');
  const [view = '', id] = path.split('/');
  const query: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(search)) query[key] = value;
  return { view: view || 'uebersicht', id: id ? decodeURIComponent(id) : undefined, query };
}

export function href(view: string, id?: string, query?: Record<string, string | undefined>): string {
  const path = id ? `#/${view}/${encodeURIComponent(id)}` : `#/${view}`;
  const entries = Object.entries(query ?? {}).filter((e): e is [string, string] => e[1] !== undefined);
  return entries.length ? `${path}?${new URLSearchParams(entries).toString()}` : path;
}

export function useRoute(): [Route, (view: string, id?: string, query?: Record<string, string | undefined>) => void] {
  const hash = useSyncExternalStore(subscribe, getSnapshot, () => '');
  const go = useCallback((view: string, id?: string, query?: Record<string, string | undefined>) => {
    window.location.hash = href(view, id, query).slice(1);
  }, []);
  return [parseRoute(hash), go];
}

/**
 * Filter state that lives in the URL instead of beside it.
 *
 * The alternative — `useState` seeded from the route in an effect — is what this replaced, and it
 * was wrong twice over: ESLint rejects `setState` inside an effect, and the two copies drift the
 * moment the reader uses the back button. Here the hash IS the state, so a scoped list is
 * addressable, shareable and survives a reload for free.
 */
export function useQueryState(
  key: string,
  fallback: string,
): [string, (next: string) => void] {
  const [route, go] = useRoute();
  const set = useCallback(
    (next: string) => go(route.view, route.id, { ...route.query, [key]: next === fallback ? undefined : next }),
    [go, route.view, route.id, route.query, key, fallback],
  );
  return [route.query[key] ?? fallback, set];
}

/** Scroll to the top on every navigation — a long table left mid-scroll reads as a broken link. */
export function useScrollReset(key: string): void {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [key]);
}
