/**
 * Service-worker registration, update detection and storage persistence.
 *
 * Three deliberate refusals to register:
 *
 * - **In dev.** `src/integrations/pwa.ts` only emits at `astro:build:done`, so there is no
 *   `sw.js` to register — and a worker that outlived a dev restart would serve the previous
 *   build's HTML while looking exactly like a broken hot reload.
 * - **In the Tauri shell.** The desktop app already ships every asset locally; a cache layer
 *   over `tauri://` buys nothing and adds a second source of stale content.
 * - **Without `navigator.serviceWorker`.** Notably iOS Safari in a private window.
 *
 * The update path is explicit on purpose. `sw.js` never calls `skipWaiting()` on its own: a
 * learner mid-exercise whose bundle is swapped underneath them loses the attempt they were
 * about to log. The new worker waits; `onUpdateReady` tells the UI; the learner decides.
 */
import { isTauri } from './syncdir';
import { withBase } from './url';

export type UpdateHandler = () => void;

let updateReady = false;
const listeners = new Set<UpdateHandler>();
let waitingWorker: ServiceWorker | null = null;

function announce(worker: ServiceWorker): void {
  waitingWorker = worker;
  updateReady = true;
  for (const listener of listeners) listener();
}

/** Subscribe to "a new version is installed and waiting". Fires immediately if it already is. */
export function onUpdateReady(handler: UpdateHandler): () => void {
  listeners.add(handler);
  if (updateReady) handler();
  return () => listeners.delete(handler);
}

/**
 * Activate the waiting worker and reload once it has taken over.
 *
 * `controllerchange` rather than an immediate `location.reload()`: reloading before the new
 * worker controls the page just re-fetches everything from the old one, and the prompt comes
 * straight back.
 */
export function applyUpdate(): void {
  if (!waitingWorker) {
    location.reload();
    return;
  }
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return; // Chrome fires this more than once
    reloaded = true;
    location.reload();
  });
  waitingWorker.postMessage('SKIP_WAITING');
}

export function shouldRegister(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    !import.meta.env.DEV &&
    !isTauri()
  );
}

export async function registerServiceWorker(): Promise<void> {
  if (!shouldRegister()) return;
  try {
    const registration = await navigator.serviceWorker.register(withBase('/sw.js'), {
      scope: withBase('/'),
    });

    // Installed while this page was loading, or on a previous visit.
    if (registration.waiting && navigator.serviceWorker.controller) announce(registration.waiting);

    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        // No controller means this is the first install, not an update — nothing to prompt for.
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          announce(installing);
        }
      });
    });
  } catch (err) {
    // A failed registration must never break the page: everything still works online.
    console.warn('[pwa] service worker registration failed', err);
  }
}

/**
 * Ask the browser to keep this origin's storage.
 *
 * Worth a line about why: iOS evicts IndexedDB for a *non-installed* site after roughly seven
 * days without a visit, and every attempt, card state and session this app owns lives there.
 * Chrome grants persistence on engagement heuristics; Safari grants it once the site is
 * installed to the home screen. Either way the request is free and the failure is silent, so
 * it is fire-and-forget — and it is one of the two real arguments for signing in.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
