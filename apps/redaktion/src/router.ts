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
import { useCallback, useEffect, useSyncExternalStore, type MouseEvent as ReactMouseEvent } from 'react';

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
const HISTORY_POSITION = '__redactionHistoryPosition';
let historyReady = false;
let historyPosition = 0;
let historyMaximum = 0;
let allowNextTraversal = false;
let restoreTraversal = false;
const navigationBlockers = new Set<() => boolean>();

function initialiseHistory(): void {
  if (historyReady) return;
  const state = window.history.state as Record<string, unknown> | null;
  const stored = Number(window.sessionStorage.getItem('da:redaction-history-maximum'));
  const position = Number(state?.[HISTORY_POSITION]);
  const existingEntry = Number.isFinite(position);
  historyPosition = existingEntry ? position : 0;
  historyMaximum = existingEntry && Number.isFinite(stored) ? Math.max(historyPosition, stored) : historyPosition;
  if (!existingEntry) {
    window.history.replaceState({ ...(state ?? {}), [HISTORY_POSITION]: historyPosition }, '', window.location.href);
  }
  historyReady = true;
}

function rememberMaximum(): void {
  window.sessionStorage.setItem('da:redaction-history-maximum', String(historyMaximum));
}

function navigationAllowed(): boolean {
  return [...navigationBlockers].every((blocker) => blocker());
}

function onPopState(event: PopStateEvent): void {
  initialiseHistory();
  const target = Number((event.state as Record<string, unknown> | null)?.[HISTORY_POSITION]);
  if (!Number.isFinite(target)) {
    notify();
    return;
  }
  if (restoreTraversal) {
    restoreTraversal = false;
    return;
  }
  if (!allowNextTraversal && !navigationAllowed()) {
    const delta = historyPosition - target;
    if (delta) {
      restoreTraversal = true;
      window.history.go(delta);
    }
    return;
  }
  allowNextTraversal = false;
  historyPosition = target;
  historyMaximum = Math.max(historyMaximum, historyPosition);
  rememberMaximum();
  notify();
}

function subscribe(listener: () => void): () => void {
  initialiseHistory();
  if (listeners.size === 0) window.addEventListener('popstate', onPopState);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('popstate', onPopState);
  };
}

function notify(): void {
  for (const listener of listeners) listener();
}

const getSnapshot = (): string => window.location.hash;
const getHistorySnapshot = (): string => {
  initialiseHistory();
  return `${historyPosition}:${historyMaximum}:${window.location.hash}`;
};

/** Register one editor buffer that must consent before an in-app navigation discards it. */
export function blockNavigation(blocker: () => boolean): () => void {
  navigationBlockers.add(blocker);
  return () => navigationBlockers.delete(blocker);
}

/** One path for links, filters, search and history controls, so none can bypass the draft guard. */
export function navigateHref(target: string): boolean {
  initialiseHistory();
  if (target === window.location.hash) return true;
  if (!navigationAllowed()) return false;
  historyPosition += 1;
  historyMaximum = historyPosition;
  rememberMaximum();
  window.history.pushState(
    { ...(window.history.state ?? {}), [HISTORY_POSITION]: historyPosition },
    '',
    target,
  );
  notify();
  return true;
}

/** Delegate every ordinary internal anchor click to `navigateHref`; modified clicks stay native. */
export function handleInternalLinkClick(event: ReactMouseEvent<HTMLElement>): void {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const target = event.target;
  if (!(target instanceof Element)) return;
  const anchor = target.closest('a');
  if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
  const targetHref = anchor.getAttribute('href');
  if (!targetHref?.startsWith('#/')) return;
  event.preventDefault();
  navigateHref(targetHref);
}

export interface RouteHistory {
  canBack: boolean;
  canForward: boolean;
  back(): void;
  forward(): void;
}

export function useRouteHistory(): RouteHistory {
  useSyncExternalStore(subscribe, getHistorySnapshot, () => '0:0:');
  initialiseHistory();
  const traverse = useCallback((delta: -1 | 1) => {
    const possible = delta < 0 ? historyPosition > 0 : historyPosition < historyMaximum;
    if (!possible || !navigationAllowed()) return;
    allowNextTraversal = true;
    window.history.go(delta);
  }, []);
  return {
    canBack: historyPosition > 0,
    canForward: historyPosition < historyMaximum,
    back: () => traverse(-1),
    forward: () => traverse(1),
  };
}

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
    navigateHref(href(view, id, query));
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
