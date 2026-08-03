/**
 * The shipped service worker — `src/integrations/service-worker.js` + `src/integrations/pwa.ts`.
 *
 * These tests evaluate the **template with its placeholders substituted**, exactly as
 * `astro:build:done` writes it, rather than a re-implementation of its logic. The two behaviours
 * covered are the two that cannot be seen failing anywhere except on a real device:
 *
 * - **Range slicing.** Safari sends `Range: bytes=0-` for every `<audio>` element. A cached 200
 *   handed back to a Range request is why offline audio silently fails on iOS — the one platform
 *   the PWA route exists for.
 * - **Byte-budgeted eviction.** Six pages in this build run 4.6–10.7 MB, so an unbudgeted
 *   document cache is between 5 MB and 40 MB depending on where the learner went.
 *
 * The Cache Storage fake is deliberately thin, but it keeps the two properties the worker's logic
 * actually rests on: `keys()` returns insertion order, and re-`put`ting a key does not reorder it.
 */
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { webManifest } from '../src/integrations/pwa';

// ---------------------------------------------------------------------------
// Load the worker the way the build writes it
// ---------------------------------------------------------------------------

const TEMPLATE = readFileSync(
  new URL('../src/integrations/service-worker.js', import.meta.url),
  'utf8',
);

function substitute(shell: string[], { version = 'testbuild', base = '/' } = {}): string {
  return TEMPLATE.replace("'__VERSION__'", JSON.stringify(version))
    .replace("'__BASE__'", JSON.stringify(base))
    .replace('/* __SHELL__ */ []', JSON.stringify(shell));
}

class FakeCache {
  entries = new Map<string, Response>();
  async put(request: Request | string, response: Response) {
    const key = typeof request === 'string' ? request : request.url;
    // Map preserves insertion order and re-setting an existing key does NOT move it — the same
    // contract the Cache API gives, and what putBudgeted's explicit `delete` before re-insert
    // exists to work around.
    this.entries.set(key, response);
  }
  async match(request: Request | string) {
    const key = typeof request === 'string' ? request : request.url;
    const hit = this.entries.get(key);
    return hit ? hit.clone() : undefined;
  }
  async delete(request: Request | string) {
    const key = typeof request === 'string' ? request : request.url;
    return this.entries.delete(key);
  }
  async keys() {
    return [...this.entries.keys()].map((url) => new Request(url));
  }
}

class FakeCacheStorage {
  caches = new Map<string, FakeCache>();
  async open(name: string) {
    let cache = this.caches.get(name);
    if (!cache) this.caches.set(name, (cache = new FakeCache()));
    return cache;
  }
  async keys() {
    return [...this.caches.keys()];
  }
  async delete(name: string) {
    return this.caches.delete(name);
  }
  async match(request: Request | string) {
    for (const cache of this.caches.values()) {
      const hit = await cache.match(request);
      if (hit) return hit;
    }
    return undefined;
  }
}

interface Harness {
  fetchHandler: (event: { request: Request; respondWith: (r: Promise<Response>) => void }) => void;
  handle: (request: Request) => Promise<Response | undefined>;
  storage: FakeCacheStorage;
  network: Map<string, () => Response>;
}

/** Evaluate the substituted worker against a fake ServiceWorkerGlobalScope. */
function load(shell: string[] = [], base = '/'): Harness {
  const storage = new FakeCacheStorage();
  const network = new Map<string, () => Response>();
  const listeners = new Map<string, (event: unknown) => void>();

  const self = {
    addEventListener: (type: string, fn: (event: unknown) => void) => listeners.set(type, fn),
    location: { origin: 'https://atlas.vitavision.dev' },
    clients: { claim: async () => {} },
    skipWaiting: () => {},
  };

  const fetchImpl = async (input: Request | string) => {
    const url = typeof input === 'string' ? input : input.url;
    const make = network.get(new URL(url).pathname);
    if (!make) throw new Error(`no route: ${url}`);
    return make();
  };

  new Function('self', 'caches', 'fetch', 'console', substitute(shell, { base }))(
    self,
    storage,
    fetchImpl,
    { warn: () => {} },
  );

  const fetchHandler = listeners.get('fetch') as Harness['fetchHandler'];
  return {
    fetchHandler,
    storage,
    network,
    handle(request) {
      let answered: Promise<Response> | undefined;
      fetchHandler({ request, respondWith: (r) => (answered = r) });
      return answered ?? Promise.resolve(undefined);
    },
  };
}

const ORIGIN = 'https://atlas.vitavision.dev';

/**
 * A navigation request.
 *
 * `new Request(url, { mode: 'navigate' })` is forbidden by the Fetch spec — only a browser may
 * mint one — so the mode is defined onto a real Request rather than the whole object being
 * faked. Everything else (url, method, headers) stays genuine.
 */
function navigation(url: string): Request {
  const request = new Request(url);
  Object.defineProperty(request, 'mode', { value: 'navigate' });
  return request;
}

// ---------------------------------------------------------------------------

describe('web app manifest', () => {
  test('every URL carries the base', () => {
    const root = webManifest('/');
    expect(root.start_url).toBe('/');
    expect(root.icons.map((i) => i.src)).toContain('/icons/icon-512.png');

    const sub = webManifest('/deutsch-textbook/');
    expect(sub.start_url).toBe('/deutsch-textbook/');
    expect(sub.scope).toBe('/deutsch-textbook/');
    expect(sub.icons.map((i) => i.src)).toContain('/deutsch-textbook/icons/icon-512.png');
    expect(sub.shortcuts.map((s) => s.url)).toContain('/deutsch-textbook/topics');
  });

  test('exactly one maskable icon is declared', () => {
    // Android falls back to a badge if none is maskable, and crops the artwork if every icon
    // claims to be — so this is one, not zero and not all three.
    const maskable = webManifest('/').icons.filter((i) => i.purpose === 'maskable');
    expect(maskable).toHaveLength(1);
  });
});

describe('template substitution', () => {
  test('the template is valid JavaScript before substitution', () => {
    // `/* __SHELL__ */ []` and the quoted placeholders exist so the source lints and parses as
    // shipped. A bare `__SHELL__` identifier passed this only after the build had run.
    expect(() => new Function(TEMPLATE)).not.toThrow();
  });

  test('every placeholder is consumed', () => {
    const out = substitute(['/favicon.png']);
    expect(out).not.toContain('__VERSION__');
    expect(out).not.toContain('__BASE__');
    expect(out).not.toContain('__SHELL__');
    expect(out).toContain('const SHELL = ["/favicon.png"]');
  });
});

describe('media: cache-first with Range', () => {
  const URL_MP3 = `${ORIGIN}/audio/ls-wohnen-umzug-01.mp3`;
  const BODY = new Uint8Array(Array.from({ length: 1000 }, (_, i) => i % 256));

  function withAudio() {
    const h = load();
    h.network.set('/audio/ls-wohnen-umzug-01.mp3', () =>
      new Response(BODY, { status: 200, headers: { 'content-type': 'audio/mpeg' } }),
    );
    return h;
  }

  test('a plain request is fetched once and served from cache after', async () => {
    const h = withAudio();
    const first = await h.handle(new Request(URL_MP3));
    expect(first!.status).toBe(200);
    expect((await first!.arrayBuffer()).byteLength).toBe(1000);

    // Second time the network is gone entirely — a cache miss would throw.
    h.network.clear();
    const second = await h.handle(new Request(URL_MP3));
    expect((await second!.arrayBuffer()).byteLength).toBe(1000);
  });

  test('Range gets a real 206 with the right bytes', async () => {
    const h = withAudio();
    await h.handle(new Request(URL_MP3));
    h.network.clear();

    const res = await h.handle(new Request(URL_MP3, { headers: { range: 'bytes=10-19' } }));
    expect(res!.status).toBe(206);
    expect(res!.headers.get('content-range')).toBe('bytes 10-19/1000');
    expect(res!.headers.get('content-length')).toBe('10');
    expect(new Uint8Array(await res!.arrayBuffer())).toEqual(BODY.slice(10, 20));
  });

  test("Safari's open-ended `bytes=0-` returns the whole body as 206", async () => {
    const h = withAudio();
    await h.handle(new Request(URL_MP3));
    h.network.clear();

    const res = await h.handle(new Request(URL_MP3, { headers: { range: 'bytes=0-' } }));
    expect(res!.status).toBe(206);
    expect(res!.headers.get('content-range')).toBe('bytes 0-999/1000');
    expect((await res!.arrayBuffer()).byteLength).toBe(1000);
  });

  test('a suffix range means the last N bytes, not the first N', async () => {
    const h = withAudio();
    await h.handle(new Request(URL_MP3));
    h.network.clear();

    const res = await h.handle(new Request(URL_MP3, { headers: { range: 'bytes=-100' } }));
    expect(res!.status).toBe(206);
    expect(res!.headers.get('content-range')).toBe('bytes 900-999/1000');
    expect(new Uint8Array(await res!.arrayBuffer())).toEqual(BODY.slice(900));
  });

  test('a range past the end is 416, not a truncated 206', async () => {
    const h = withAudio();
    await h.handle(new Request(URL_MP3));
    h.network.clear();

    const res = await h.handle(new Request(URL_MP3, { headers: { range: 'bytes=5000-6000' } }));
    expect(res!.status).toBe(416);
    expect(res!.headers.get('content-range')).toBe('bytes */1000');
  });

  test('the Range header is not part of the cache key', async () => {
    // Otherwise every distinct range Safari asks for would be cached as its own full entry and
    // the media budget would be spent on duplicates of one recording.
    const h = withAudio();
    await h.handle(new Request(URL_MP3, { headers: { range: 'bytes=0-9' } }));
    const media = h.storage.caches.get('da-media-v1')!;
    const keys = [...media.entries.keys()].filter((k) => !k.includes('__sw-index'));
    expect(keys).toEqual([URL_MP3]);
  });
});

describe('documents: network-first with an offline fallback', () => {
  test('a reachable page is served from the network and cached', async () => {
    const h = load([]);
    h.network.set('/topics/a2/wohnen-umzug/', () => new Response('<html>fresh</html>', { status: 200 }));
    const res = await h.handle(
      navigation(`${ORIGIN}/topics/a2/wohnen-umzug/`),
    );
    expect(await res!.text()).toBe('<html>fresh</html>');

    h.network.clear();
    const offlineHit = await h.handle(
      navigation(`${ORIGIN}/topics/a2/wohnen-umzug/`),
    );
    expect(await offlineHit!.text()).toBe('<html>fresh</html>');
  });

  test('an unvisited page falls back to the precached offline page', async () => {
    const h = load([]);
    const shell = await h.storage.open('da-shell-testbuild');
    await shell.put('/offline/', new Response('<html>offline</html>'));

    const res = await h.handle(navigation(`${ORIGIN}/topics/b1/never-opened/`));
    expect(await res!.text()).toBe('<html>offline</html>');
  });

  test('the sync API is never cached', async () => {
    // A stale snapshot served from cache would be merged as if it were current.
    const h = load([]);
    let answered = false;
    h.fetchHandler({
      request: new Request(`${ORIGIN}/api/sync/snapshot`),
      respondWith: () => (answered = true),
    });
    expect(answered).toBe(false);
  });

  test('cross-origin requests are not intercepted', async () => {
    const h = load([]);
    let answered = false;
    h.fetchHandler({
      request: new Request('https://example.com/thing.js'),
      respondWith: () => (answered = true),
    });
    expect(answered).toBe(false);
  });
});

describe('byte-budgeted eviction', () => {
  test('the document cache evicts oldest-first once the budget is exceeded', async () => {
    const h = load([]);
    // 25 MB each against the worker's 60 MB document budget: three fit, the fourth evicts one.
    const big = 25 * 1024 * 1024;
    for (const slug of ['a', 'b', 'c']) {
      h.network.set(`/p/${slug}/`, () => new Response(new Uint8Array(big), { status: 200 }));
      await h.handle(navigation(`${ORIGIN}/p/${slug}/`));
    }

    const docs = h.storage.caches.get('da-docs-testbuild')!;
    const pages = () =>
      [...docs.entries.keys()].filter((k) => !k.includes('__sw-index')).map((k) => new URL(k).pathname);

    // 75 MB asked, 60 MB budget — the first page is already gone.
    expect(pages()).toEqual(['/p/b/', '/p/c/']);

    h.network.set('/p/d/', () => new Response(new Uint8Array(big), { status: 200 }));
    await h.handle(navigation(`${ORIGIN}/p/d/`));
    expect(pages()).toEqual(['/p/c/', '/p/d/']);
  });

  test('re-visiting a page moves it to the back of the eviction order', async () => {
    // putBudgeted deletes the key before re-inserting precisely for this: without it, Map (and
    // the real Cache API) keeps the original position and a page you open daily is evicted
    // ahead of one you opened once.
    const h = load([]);
    const big = 25 * 1024 * 1024;
    for (const slug of ['a', 'b']) {
      h.network.set(`/p/${slug}/`, () => new Response(new Uint8Array(big), { status: 200 }));
      await h.handle(navigation(`${ORIGIN}/p/${slug}/`));
    }
    await h.handle(navigation(`${ORIGIN}/p/a/`)); // revisit a

    h.network.set('/p/c/', () => new Response(new Uint8Array(big), { status: 200 }));
    await h.handle(navigation(`${ORIGIN}/p/c/`));

    const docs = h.storage.caches.get('da-docs-testbuild')!;
    const pages = [...docs.entries.keys()]
      .filter((k) => !k.includes('__sw-index'))
      .map((k) => new URL(k).pathname);
    expect(pages).toEqual(['/p/a/', '/p/c/']); // b evicted, not the freshly revisited a
  });
});
