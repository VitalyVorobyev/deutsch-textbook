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
  if (listeners.size === 0) {
    // The address the app is *showing* — recorded here, at the moment anything starts reading the
    // route, rather than at module load. A module-level snapshot taken at import time is a hash
    // nobody has rendered yet, and restoring to it would send a declined navigation to `#/`.
    letzterHash = window.location.hash;
    window.addEventListener('hashchange', notify);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('hashchange', notify);
  };
}

/**
 * Navigating away from an unsaved draft, and the one way this router can stop it.
 *
 * The links in this app are ordinary `<a href="#/…">`, which is what makes them shareable and
 * middle-clickable — and what means there is no click to intercept: by the time anything runs, the
 * hash has already changed. So the guard runs *after* the change and puts the address back with
 * `replaceState`, which does not fire a second `hashchange` and therefore cannot loop.
 *
 * The cost is honest and small: a declined navigation replaces the new history entry instead of
 * popping it, so the forward button loses one step. The alternative — a router that owns every
 * link — is Redaktion's, and it is the right trade there because Redaktion has a real history
 * stack to protect. Tonwerk has four routes.
 */
const sperren = new Set<() => boolean>();

/** Register a guard. It returns `true` to allow the navigation. */
export function sperreNavigation(darf: () => boolean): () => void {
  sperren.add(darf);
  return () => {
    sperren.delete(darf);
  };
}

let letzterHash = '';

function notify(): void {
  const neu = window.location.hash;
  if (neu !== letzterHash && sperren.size > 0 && ![...sperren].every((darf) => darf())) {
    const zurueck = letzterHash;
    window.history.replaceState(window.history.state, '', zurueck || '#/');
    letzterHash = zurueck;
  } else {
    letzterHash = neu;
  }
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
