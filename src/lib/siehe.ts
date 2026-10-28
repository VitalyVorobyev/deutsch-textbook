/**
 * The way back from a `<Siehe>` link (`src/components/Siehe.astro`).
 *
 * A learner following "Auf A2 stand der Komparativ nach *ist*" to the A2 article wants to come
 * back to that sentence, not to the top of the B1 page. The browser's own back button does that
 * only when the page is restored from memory, which the desktop shell does not guarantee. So a
 * click records the origin and the link's position, the target page shows one "Zurück zu …"
 * pill, and the origin scrolls the link back into view — opening a folded `<details>` around it.
 *
 * sessionStorage, not the profile: this is navigation state for one tab, never progress.
 */

export const SIEHE_KEY = 'da:siehe-return';

export interface SieheReturn {
  /** origin path + search + `#siehe-<n>` */
  back: string;
  /** what the pill names: the origin page's heading */
  title: string;
  /** the pathname the link leads to; the pill shows there and nowhere else */
  target: string;
}

const LINK = 'a[data-siehe]';
const samePath = (a: string, b: string) => a.replace(/\/+$/, '') === b.replace(/\/+$/, '');

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function readReturn(storage: StorageLike): SieheReturn | null {
  try {
    const value: unknown = JSON.parse(storage.getItem(SIEHE_KEY) ?? 'null');
    if (!value || typeof value !== 'object') return null;
    const r = value as Record<string, unknown>;
    return typeof r.back === 'string' && typeof r.title === 'string' && typeof r.target === 'string'
      ? { back: r.back, title: r.title, target: r.target }
      : null;
  } catch {
    return null;
  }
}

/** Wire one page: number its links, record clicks, restore a return, show the pill. */
export function initSiehe(doc: Document = document, storage: StorageLike = sessionStorage): void {
  const links = [...doc.querySelectorAll<HTMLAnchorElement>(LINK)];
  links.forEach((link, index) => {
    if (!link.id) link.id = `siehe-${index}`;
    link.addEventListener('click', () => {
      const location = doc.defaultView!.location;
      const title = doc.querySelector('main h1')?.textContent?.trim() || doc.title;
      const record: SieheReturn = {
        back: `${location.pathname}${location.search}#${link.id}`,
        title,
        target: new URL(link.href, location.href).pathname,
      };
      try {
        storage.setItem(SIEHE_KEY, JSON.stringify(record));
      } catch {
        /* storage refused: the link still works, only the way back is lost */
      }
    });
  });

  const location = doc.defaultView!.location;
  const hash = decodeURIComponent(location.hash.slice(1));
  if (hash.startsWith('siehe-')) {
    // Back at the origin: open any fold around the link, bring it back and mark it once.
    const link = doc.getElementById(hash);
    if (link) {
      for (let el = link.parentElement; el; el = el.parentElement)
        if (el instanceof doc.defaultView!.HTMLDetailsElement) el.open = true;
      link.classList.add('siehe-returned');
      keepInView(doc, link, 'center');
    }
  }

  const pending = readReturn(storage);
  if (!pending) return;
  if (!samePath(pending.target, location.pathname)) {
    // Back at the origin, or somewhere else entirely: the way back has been used or abandoned.
    storage.removeItem(SIEHE_KEY);
    return;
  }
  const pill = doc.createElement('a');
  pill.href = pending.back;
  pill.className = 'siehe-return';
  pill.lang = 'de';
  pill.textContent = `← Zurück zu „${pending.title}“`;
  pill.addEventListener('click', () => storage.removeItem(SIEHE_KEY));
  doc.body.append(pill);
  // Arrived at the heading the link named: hold it in place while the page settles.
  const heading = hash ? doc.getElementById(hash) : null;
  if (heading) keepInView(doc, heading, 'start');
}

/**
 * Scroll `el` into view and keep it there while the layout settles. The islands above an
 * article (the pretest, the progress card) mount after the browser has jumped to an anchor and
 * push it down by a screen or more. Following stops after 2 s, or at once when the learner
 * scrolls, taps or types on their own.
 */
function keepInView(doc: Document, el: Element, block: ScrollLogicalPosition): void {
  el.scrollIntoView({ block });
  const view = doc.defaultView!;
  if (typeof view.ResizeObserver !== 'function') return;
  const follow = new view.ResizeObserver(() => el.scrollIntoView({ block }));
  const stop = () => follow.disconnect();
  follow.observe(doc.body);
  for (const type of ['wheel', 'touchstart', 'keydown', 'mousedown'])
    view.addEventListener(type, stop, { once: true, passive: true });
  view.setTimeout(stop, 2000);
}
