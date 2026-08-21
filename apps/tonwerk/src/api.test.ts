import { describe, expect, test, vi } from 'vitest';
import { createApi, EngineError, OfflineError, ShapeError, UnauthorizedError } from './api';
import { registryFixture } from './test/fixtures';

/**
 * The fetch layer carries three rules that nothing else can enforce, and each test below is one of
 * them. They are worth testing precisely because none of them is visible when broken: a request
 * without the header gets a 401 that looks like an expired token, a 401 swallowed by a view looks
 * like an empty table, and a `<audio src="/api/…">` that skips `objectUrl` plays in the browser
 * the developer is using — where a session cookie from the legacy pages is already set.
 */

function respond(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

describe('every request carries the bearer token', () => {
  test('the token goes in the Authorization header, and nowhere else', async () => {
    const fetchImpl = vi.fn(async () => respond(registryFixture));
    const api = createApi({ token: () => 'geheim-123', fetchImpl });

    await api.registry();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/registry');
    // The engine also accepts `?token=` for its legacy HTML pages and says nothing new may be
    // built on that path. Tonwerk must never be the thing that does.
    expect(url).not.toContain('token=');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer geheim-123');
  });

  test('a slug with a slash is encoded rather than opening a new path segment', async () => {
    const fetchImpl = vi.fn(async () =>
      respond({
        project_id: 1,
        slug: 'a/b',
        kind: 'narration',
        stage: 'draft',
        revision: 1,
        scene_sha256: 'ab',
        scene: {},
        renders: [],
        history: [],
      }),
    );
    const api = createApi({ token: () => 't', fetchImpl });
    await api.scene('a/b').catch(() => undefined);
    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toBe('/api/scenes/a%2Fb');
  });
});

describe('a 401 ends the session rather than failing one request', () => {
  test('it throws UnauthorizedError carrying the engine’s own reason', async () => {
    const fetchImpl = vi.fn(async () =>
      respond({ detail: 'Invalid bearer token' }, { status: 401, statusText: 'Unauthorized' }),
    );
    const api = createApi({ token: () => 'falsch', fetchImpl });

    await expect(api.registry()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('onUnauthorized fires once, not once per in-flight request', async () => {
    // Three views mount at the same time against a dead token. The shell must return to the token
    // screen once; three reports would race three state updates and could clear a token the user
    // had just typed in between.
    const fetchImpl = vi.fn(async () => respond({ detail: 'Invalid bearer token' }, { status: 401 }));
    const onUnauthorized = vi.fn();
    const api = createApi({ token: () => 'falsch', fetchImpl, onUnauthorized });

    await Promise.allSettled([api.registry(), api.scenes(), api.characters()]);

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).toHaveBeenCalledWith('Invalid bearer token');
  });

  test('a 403 is not a 401: the engine says that to a browser presenting no bearer at all', async () => {
    const fetchImpl = vi.fn(async () => respond({ detail: 'Invalid local session token' }, { status: 403 }));
    const onUnauthorized = vi.fn();
    const api = createApi({ token: () => '', fetchImpl, onUnauthorized });

    await expect(api.registry()).rejects.toBeInstanceOf(EngineError);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});

describe('the other three failures are told apart', () => {
  test('nothing answering is OfflineError, not a parse failure', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(createApi({ token: () => 't', fetchImpl }).registry()).rejects.toBeInstanceOf(OfflineError);
  });

  test('an answer this build cannot read is ShapeError, naming the path', async () => {
    const fetchImpl = vi.fn(async () => respond({ rows: 'not a list' }));
    const api = createApi({ token: () => 't', fetchImpl });
    const error = await api.registry().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ShapeError);
    expect((error as ShapeError).path).toBe('/api/registry');
  });

  test('an abort propagates as an abort and is not mistaken for the engine being down', async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(async () => {
      throw new DOMException('aborted', 'AbortError');
    });
    controller.abort();
    const error = await createApi({ token: () => 't', fetchImpl }).registry(controller.signal).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(DOMException);
    expect(error).not.toBeInstanceOf(OfflineError);
  });
});

describe('the scene document is parsed against the contract, and never silently downgraded', () => {
  const envelope = {
    project_id: 1,
    slug: 'ls-wohnen-01',
    kind: 'dialogue',
    stage: 'draft',
    revision: 1,
    scene_sha256: 'abc',
    renders: [],
    history: [],
  };

  const gutesDokument = {
    slug: 'ls-wohnen-01',
    kind: 'dialogue',
    schema_version: 1,
    authoring: 'manual',
    generation_prompt: null,
    brief: null,
    acoustics: { lead_in_ms: 0, room: null },
    variants: [],
    title: { en: 'A flat viewing', ru: 'Осмотр квартиры', uk: null },
    cast: [{ role: 'Maklerin', character: null, voice: { engine: 'qwen_tts', voice: 'Vivian', seed: 100, style: null } }],
    script: [
      {
        id: 'line-1',
        role: 'Maklerin',
        display_text: 'Hier ist die Wohnung.',
        synthesis_text: null,
        pace: 1,
        pause_after_ms: 600,
        pronunciation_overrides: [],
        seed_override: null,
      },
    ],
    timeline: [{ type: 'speech', utterance_id: 'line-1', at_ms: null, placement: null }],
  };

  test('a conforming document parses strictly and is marked valid', async () => {
    const fetchImpl = vi.fn(async () => respond({ ...envelope, scene: gutesDokument }));
    const detail = await createApi({ token: () => 't', fetchImpl }).scene('ls-wohnen-01');
    expect(detail.document.valid).toBe(true);
    expect(detail.document.scene.cast[0]?.role).toBe('Maklerin');
  });

  test('a document that has drifted still renders, and says so', async () => {
    // The failure mode this branch exists to prevent is a blank page: the reviewer needs to see the
    // script even when the engine has moved ahead of the committed contract — and needs to be told,
    // because a silent lenient read is how drift goes unnoticed for a release.
    const fetchImpl = vi.fn(async () =>
      respond({ ...envelope, scene: { ...gutesDokument, tempo_hinweis: 'schnell' } }),
    );
    const detail = await createApi({ token: () => 't', fetchImpl }).scene('ls-wohnen-01');
    expect(detail.document.valid).toBe(false);
    expect(detail.document.problem).toBeTruthy();
    expect(detail.document.scene.script[0]?.display_text).toBe('Hier ist die Wohnung.');
  });
});

describe('binary endpoints are fetched, not linked', () => {
  test('objectUrl sends the bearer header and returns a blob URL', async () => {
    const fetchImpl = vi.fn(async () => new Response(new Blob(['wav']), { status: 200 }));
    const api = createApi({ token: () => 'geheim', fetchImpl });

    const url = await api.objectUrl('/api/characters/lena/demos/0');

    const [path, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(path).toBe('/api/characters/lena/demos/0');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer geheim');
    expect(url.startsWith('blob:')).toBe(true);
  });
});
