/**
 * Deutsch-Atlas service worker — source template.
 *
 * NOT bundled and NOT imported by the site. `src/integrations/pwa.ts` reads this file at
 * `astro:build:done`, substitutes the three `__…__` placeholders, and writes `dist/sw.js`.
 * Editing it therefore needs a rebuild, and `bun run build` is what proves it parses.
 *
 * Three caches, deliberately on different lifecycles:
 *
 * - **shell** (versioned): the content-hashed `_astro/` bundle, icons and the offline page.
 *   Precached on install. Dropped wholesale on activate when the version changes, which is
 *   safe precisely because those filenames are content-hashed.
 * - **documents** (versioned): HTML, network-first. Versioned because a deploy changes every
 *   page's inlined content, and serving yesterday's page from cache after an update is how a
 *   learner ends up practising a retired item.
 * - **media** (UNVERSIONED): `/audio/**`, cache-first. Deliberately outside the version, because
 *   the reviewed recordings are immutable — re-downloading 14.2 MB of MP3 on every deploy would
 *   be the single most expensive thing this worker could do.
 *
 * **Why documents are capped by bytes rather than by count.** Measured against this build
 * (`find dist -name '*.html' -exec wc -c {} +`): 162 pages, median 137 KB, p90 300 KB — but six
 * pages inline most of the corpus and run 4.6–10.7 MB (`/ueben/wortschatz` 10.7 MB,
 * `/session` 10.0 MB, `/progress` 6.1 MB, `/` 5.6 MB, `/ueben/wiederholen` 5.4 MB,
 * `/ueben/training` 4.7 MB), together 42 MB of the 68 MB total. A count cap of 40 would
 * therefore mean anything between 5 MB and 40 MB depending on which pages the learner opened.
 * A byte budget says what it means. Those six are also the pages a learner uses daily, so they
 * must be cachable rather than excluded — the page weight itself is a separate defect, filed in
 * the backlog rather than worked around here.
 */

const VERSION = '__VERSION__';
const BASE = '__BASE__';
/** Content-hashed build assets + icons + the offline page. Filled in at build time. */
const SHELL = /* __SHELL__ */ [];

const SHELL_CACHE = `da-shell-${VERSION}`;
const DOC_CACHE = `da-docs-${VERSION}`;
/** Not versioned: reviewed audio is immutable, so a deploy must not evict it. */
const MEDIA_CACHE = 'da-media-v1';

const DOC_BUDGET_BYTES = 60 * 1024 * 1024;
const MEDIA_BUDGET_BYTES = 40 * 1024 * 1024;

/** Where the byte index for a cache lives. A synthetic URL, never fetched from the network. */
const INDEX_URL = (name) => `${BASE}__sw-index/${name}`;

const OFFLINE_URL = `${BASE}offline/`;

// ---------------------------------------------------------------------------
// Install / activate
// ---------------------------------------------------------------------------

self.addEventListener('install', (event) => {
  // No skipWaiting here: an update must not swap the bundle under a learner who is
  // mid-exercise. The page asks for it explicitly (see SKIP_WAITING below).
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      // addAll is atomic-or-nothing; one 404 would leave the worker permanently uninstalled,
      // so each asset is added independently and a miss is merely logged.
      Promise.all(
        SHELL.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => {
            console.warn('[sw] precache miss', url);
          }),
        ),
      ),
    ),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL_CACHE, DOC_CACHE, MEDIA_CACHE]);
      for (const name of await caches.keys()) {
        if (name.startsWith('da-') && !keep.has(name)) await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

// ---------------------------------------------------------------------------
// Byte-budgeted caches
// ---------------------------------------------------------------------------

/**
 * Sizes of what a cache holds, as `{url: bytes}`.
 *
 * Kept beside the entries rather than recomputed, because measuring means reading every cached
 * response back — at a 60 MB budget that is 60 MB of reads per navigation.
 */
async function readIndex(cache, name) {
  const stored = await cache.match(INDEX_URL(name));
  if (!stored) return {};
  try {
    return await stored.json();
  } catch {
    return {};
  }
}

async function writeIndex(cache, name, index) {
  await cache.put(
    INDEX_URL(name),
    new Response(JSON.stringify(index), { headers: { 'content-type': 'application/json' } }),
  );
}

/**
 * Store `response` and evict oldest-first until the cache is inside `budget`.
 *
 * Eviction order is insertion order, which is **FIFO, not LRU** — the Cache API exposes no
 * access times and re-reading an entry does not reorder it. Stated rather than implied: a page
 * opened daily is still evicted ahead of one opened once, if it was cached earlier.
 */
async function putBudgeted(cacheName, indexName, request, response, budget) {
  const cache = await caches.open(cacheName);
  const bytes = (await response.clone().blob()).size;
  const key = request.url;

  await cache.put(request, response);
  const index = await readIndex(cache, indexName);
  delete index[key]; // re-inserting must move it to the end of the eviction order
  index[key] = bytes;

  let total = Object.values(index).reduce((sum, n) => sum + n, 0);
  for (const url of Object.keys(index)) {
    if (total <= budget) break;
    await cache.delete(url);
    total -= index[url];
    delete index[url];
  }
  await writeIndex(cache, indexName, index);
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache the sync API or the dev progress writer: both are the learner's live state,
  // and a stale snapshot served from cache would be merged as if it were current.
  if (url.pathname.startsWith(`${BASE}api/`) || url.pathname.startsWith('/__progress/')) return;

  if (url.pathname.startsWith(`${BASE}audio/`)) {
    event.respondWith(handleMedia(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(handleDocument(request));
    return;
  }

  event.respondWith(handleAsset(request));
});

/** Content-hashed assets: cache-first, since the name changes when the bytes do. */
async function handleAsset(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      const cache = await caches.open(SHELL_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Cache-first already missed, so there is nothing to fall back to — an image or a late
    // chunk fails on its own rather than taking the page down with it.
    return Response.error();
  }
}

/**
 * HTML: network-first, cache as fallback, offline page as last resort.
 *
 * Network-first rather than cache-first because a page's whole content is inlined at build
 * time — stale HTML is stale *course content*, not just stale chrome.
 */
async function handleDocument(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      await putBudgeted(DOC_CACHE, 'docs', request, response.clone(), DOC_BUDGET_BYTES);
    }
    return response;
  } catch {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    const offline = await caches.match(OFFLINE_URL);
    return offline ?? new Response('Offline', { status: 503, headers: { 'content-type': 'text/plain' } });
  }
}

/**
 * Reviewed audio: cache-first, with Range served from the cached body.
 *
 * Safari sends `Range: bytes=0-` for every `<audio>` element, and a cached 200 handed back to a
 * Range request is what makes offline audio silently fail on iOS — which is the one platform the
 * whole PWA route exists for. So a hit is sliced into a real 206 rather than passed through.
 */
async function handleMedia(request) {
  const cache = await caches.open(MEDIA_CACHE);
  const range = request.headers.get('range');
  // The cached entry is always the full object; the Range header must not be part of the key.
  const key = new Request(request.url, { headers: {} });

  let cached = await cache.match(key);
  if (!cached) {
    try {
      const response = await fetch(key);
      if (!response.ok) return response;
      await putBudgeted(MEDIA_CACHE, 'media', key, response.clone(), MEDIA_BUDGET_BYTES);
      cached = await cache.match(key);
      if (!cached) return response;
    } catch {
      return new Response('', { status: 504 });
    }
  }

  if (!range) return cached;
  return sliceResponse(cached, range);
}

/** Turn a cached full body into the 206 a Range request asked for. */
async function sliceResponse(response, range) {
  const buffer = await response.arrayBuffer();
  const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (!match) return new Response(buffer, { status: 200, headers: response.headers });

  const total = buffer.byteLength;
  const hasStart = match[1] !== '';
  // `bytes=-500` means the *last* 500 bytes, not "up to 500".
  const start = hasStart ? Number(match[1]) : Math.max(0, total - Number(match[2] || 0));
  const end = hasStart ? (match[2] === '' ? total - 1 : Number(match[2])) : total - 1;

  if (start >= total || start > end) {
    return new Response(null, {
      status: 416,
      headers: { 'content-range': `bytes */${total}` },
    });
  }

  const slice = buffer.slice(start, end + 1);
  return new Response(slice, {
    status: 206,
    headers: {
      'content-type': response.headers.get('content-type') ?? 'application/octet-stream',
      'content-length': String(slice.byteLength),
      'content-range': `bytes ${start}-${end}/${total}`,
      'accept-ranges': 'bytes',
    },
  });
}
