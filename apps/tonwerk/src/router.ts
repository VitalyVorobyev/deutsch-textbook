/**
 * A hash router, hand-rolled, in about sixty lines.
 *
 * **Hash and not history**, for the same reason Redaktion uses one: this app is served from a Vite
 * dev server today and may be opened from a built bundle or a desktop shell tomorrow, and a hash
 * route survives all three with no rewrite rule anywhere.
 *
 * **No router dependency.** The whole contract is "read the hash, split it, subscribe to changes",
 * and a library would bring a route-matching DSL Tonwerk has no use for — there are four routes and
 * one of them takes an id.
 *
 * **Filter state lives in the URL, not beside it.** The registry is 130 rows and the useful views of
 * it are slices: every stale B1 row, every listening row waiting on a human. A filter kept in
 * `useState` can be linked *to* but never linked *into*, and drifts from the URL the moment the
 * back button is used. So `useQueryState` writes through the hash and reads back out of it, and the
 * hash is the only copy.
 */
import { useCallback, useEffect, useSyncExternalStore } from 'react';

export interface Route {
  /** `uebersicht` · `szenen` · `szene` · `figuren` */
  view: string;
  /** The node the view addresses, when it addresses one. */
  id?: string;
  /** Filter state, so a *scoped* list has an address of its own. */
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

const snapshot = (): string => window.location.hash;

export function parseRoute(hash: string): Route {
  const [path = '', search = ''] = hash.replace(/^#\/?/, '').split('?');
  const [view = '', id] = path.split('/');
  const query: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(search)) query[key] = value;
  return { view: view || 'uebersicht', id: id ? decodeURIComponent(id) : undefined, query };
}

export function href(view: string, id?: string, query?: Record<string, string | undefined>): string {
  const path = id ? `#/${view}/${encodeURIComponent(id)}` : `#/${view}`;
  const entries = Object.entries(query ?? {}).filter((entry): entry is [string, string] => Boolean(entry[1]));
  return entries.length ? `${path}?${new URLSearchParams(entries).toString()}` : path;
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, snapshot, () => '');
  return parseRoute(hash);
}

export function navigate(target: string): void {
  if (target === window.location.hash) return;
  window.location.hash = target;
}

/**
 * One filter value, stored in the hash.
 *
 * Setting it back to the fallback removes the key rather than writing `?ebene=alle`: the default
 * view and the explicitly-defaulted view are the same view, and two URLs for one state is two
 * things to keep equal.
 */
export function useQueryState(key: string, fallback: string): [string, (next: string) => void] {
  const route = useRoute();
  const set = useCallback(
    (next: string) => {
      navigate(href(route.view, route.id, { ...route.query, [key]: next === fallback ? undefined : next }));
    },
    [route.view, route.id, route.query, key, fallback],
  );
  return [route.query[key] ?? fallback, set];
}

/** A long table left mid-scroll after a navigation reads as a broken link. */
export function useScrollReset(key: string): void {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [key]);
}
