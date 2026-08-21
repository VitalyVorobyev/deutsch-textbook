/**
 * The one way Tonwerk talks to the engine.
 *
 * Every read in the app goes through `createApi`. That is not tidiness — it is where three rules
 * live that would otherwise be repeated at each call site and got wrong at one of them:
 *
 * 1. **The token is attached here and nowhere else.** No view constructs a URL or a header.
 * 2. **A 401 is a session ending, not a request failing.** It is turned into `UnauthorizedError`
 *    and reported once through `onUnauthorized`, so the shell can return to the token screen with
 *    the engine's own reason instead of every view inventing an error message.
 * 3. **Audio and portraits are fetched, not linked.** An `<audio src>` or an `<img src>` cannot
 *    carry an `Authorization` header, and the engine's other way in — a session cookie or
 *    `?token=` — is the legacy browser path its own middleware says nothing new may be built on.
 *    So binary endpoints are fetched with the bearer header and handed to the element as a blob
 *    URL. `objectUrl` is the only correct way to point an element at engine bytes.
 *
 * Requests are same-origin: Vite proxies `/api` to 127.0.0.1:8765 (see `vite.config.ts`), so
 * nothing here knows a host or a port, and no CORS configuration is needed on the Python side.
 */
import { z } from 'zod';
import { getToken } from './auth';
import {
  charactersSchema,
  registrySchema,
  sceneDetailSchema,
  sceneRowSchema,
  sceneSchema,
  type Characters,
  type Registry,
  type SceneDetail,
  type SceneRow,
} from './contracts';
import type { Scene } from '@da/schema/audio-scene';

/** The token was refused. The engine answers this to a wrong bearer, never to a missing one. */
export class UnauthorizedError extends Error {
  constructor(message = 'Der Token wurde abgelehnt.') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/** The engine answered, and said no. Carries its own words, which are usually the useful part. */
export class EngineError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'EngineError';
  }
}

/** Nothing answered at all. Almost always: `atlas-listening serve` is not running. */
export class OfflineError extends Error {
  constructor() {
    super('Keine Verbindung zur Engine. Läuft `atlas-listening serve`?');
    this.name = 'OfflineError';
  }
}

/** The response body could be read but not understood. A contract change, not a network fault. */
export class ShapeError extends Error {
  constructor(
    readonly path: string,
    readonly detail: string,
  ) {
    super(`Die Antwort von ${path} passt nicht zum erwarteten Aufbau.`);
    this.name = 'ShapeError';
  }
}

export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export interface ApiOptions {
  /** Defaults to the module-level token store; passed explicitly in tests. */
  token?: () => string;
  /** Defaults to `globalThis.fetch`. */
  fetchImpl?: Fetcher;
  /** Called once per rejected token, with the engine's own reason when it gave one. */
  onUnauthorized?: (reason: string) => void;
}

export interface Api {
  registry(signal?: AbortSignal): Promise<Registry>;
  scenes(signal?: AbortSignal): Promise<SceneRow[]>;
  scene(slug: string, signal?: AbortSignal): Promise<SceneDetail & { document: SceneDocument }>;
  characters(signal?: AbortSignal): Promise<Characters>;
  objectUrl(path: string, signal?: AbortSignal): Promise<string>;
}

/**
 * A scene detail's `scene` field, read twice over.
 *
 * `valid` is the strict Scene v1 parse. When it fails, the app does **not** blank the page: it
 * keeps a lenient read so the reviewer still sees the cast and the script, and carries `problem`
 * so the page can say plainly that the stored document and the committed contract disagree. A
 * silent lenient fallback would be the worst of both — the drift would never be noticed.
 */
export interface SceneDocument {
  valid: boolean;
  scene: Scene;
  problem?: string;
}

/** The lenient read: enough structure for the views, nothing closed. */
const looseSceneSchema = z.looseObject({
  slug: z.string().default(''),
  kind: z.string().default('custom'),
  title: z.looseObject({ en: z.string().default(''), ru: z.string().default('') }).default({ en: '', ru: '' }),
  cast: z.array(z.looseObject({ role: z.string().default('') })).default([]),
  script: z.array(z.looseObject({ id: z.string().default(''), role: z.string().default(''), display_text: z.string().default('') })).default([]),
  timeline: z.array(z.looseObject({ type: z.string().default('speech') })).default([]),
  variants: z.array(z.looseObject({ id: z.string().default('') })).default([]),
});

export function createApi(options: ApiOptions = {}): Api {
  const token = options.token ?? getToken;
  const fetcher: Fetcher = options.fetchImpl ?? ((input, init) => globalThis.fetch(input, init));
  let reportedUnauthorized = false;

  async function send(path: string, signal?: AbortSignal): Promise<Response> {
    let response: Response;
    try {
      response = await fetcher(path, {
        signal,
        headers: { Authorization: `Bearer ${token()}`, Accept: 'application/json' },
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      throw new OfflineError();
    }
    if (response.status === 401) {
      const reason = await detail(response, 'Der Token wurde abgelehnt.');
      if (!reportedUnauthorized) {
        reportedUnauthorized = true;
        options.onUnauthorized?.(reason);
      }
      throw new UnauthorizedError(reason);
    }
    if (!response.ok) throw new EngineError(response.status, await detail(response, `${response.status} ${response.statusText}`));
    reportedUnauthorized = false;
    return response;
  }

  async function read<T>(path: string, schema: z.ZodType<T>, signal?: AbortSignal): Promise<T> {
    const response = await send(path, signal);
    const body: unknown = await response.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new ShapeError(path, parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '));
    return parsed.data;
  }

  return {
    registry: (signal) => read('/api/registry', registrySchema, signal),
    scenes: (signal) => read('/api/scenes', z.array(sceneRowSchema), signal),

    async scene(slug, signal) {
      const detailResponse = await read(`/api/scenes/${encodeURIComponent(slug)}`, sceneDetailSchema, signal);
      const strict = sceneSchema.safeParse(detailResponse.scene);
      if (strict.success) return { ...detailResponse, document: { valid: true, scene: strict.data } };
      const lenient = looseSceneSchema.safeParse(detailResponse.scene);
      if (!lenient.success) throw new ShapeError(`/api/scenes/${slug}`, 'Das Szenendokument ist unlesbar.');
      return {
        ...detailResponse,
        document: {
          valid: false,
          scene: lenient.data as unknown as Scene,
          problem: strict.error.issues
            .slice(0, 4)
            .map((issue) => `${issue.path.join('.') || 'scene'}: ${issue.message}`)
            .join(' · '),
        },
      };
    },

    characters: (signal) => read('/api/characters', charactersSchema, signal),

    async objectUrl(path, signal) {
      const response = await send(path, signal);
      return URL.createObjectURL(await response.blob());
    },
  };
}

async function detail(response: Response, fallback: string): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === 'object' && 'detail' in body && typeof body.detail === 'string') return body.detail;
  } catch {
    /* not JSON; the fallback is the honest answer */
  }
  return fallback;
}
