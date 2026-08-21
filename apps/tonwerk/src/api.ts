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
  acousticsSchema,
  approvalResultSchema,
  charactersSchema,
  declineResultSchema,
  narrationProfilesSchema,
  qaResultSchema,
  registrySchema,
  renderResultSchema,
  reviseResultSchema,
  sceneDetailSchema,
  sceneRowSchema,
  sceneSchema,
  soundRowSchema,
  voiceDemoSchema,
  voiceSchema,
  voicesSchema,
  revocationSchema,
  type Acoustics,
  type ApprovalResult,
  type Characters,
  type DeclineResult,
  type NarrationProfiles,
  type QaResult,
  type Registry,
  type RenderResult,
  type ReviseResult,
  type SceneDetail,
  type SceneRow,
  type SoundRow,
  type Revocation,
  type Voice,
  type VoiceDemo,
  type Voices,
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

/** What a generation asks for: `SoundSpec`'s own fields, plus which engine is to make them. */
export interface SoundGenerationRequest {
  prompt: string;
  negative_prompt?: string | null;
  seed: number;
  duration_seconds: number;
  engine: string;
}

/** The signature, as the engine's `ApprovalRequest` takes it. */
export interface ApprovalSubmission {
  editor: string;
  /**
   * The sha256 of the master the reviewer actually listened to, read off the render row rather
   * than derived here. The engine refuses a mismatch, which is the whole point of the field: if a
   * re-render landed mid-review, the signature would otherwise vouch for bytes nobody heard.
   */
  master_sha256: string;
  checklist: string[];
  variant: string;
}

export interface Api {
  registry(signal?: AbortSignal): Promise<Registry>;
  scenes(signal?: AbortSignal): Promise<SceneRow[]>;
  scene(slug: string, signal?: AbortSignal): Promise<SceneDetail & { document: SceneDocument }>;
  characters(signal?: AbortSignal): Promise<Characters>;
  acoustics(signal?: AbortSignal): Promise<Acoustics>;
  sounds(signal?: AbortSignal): Promise<SoundRow[]>;
  narrationProfiles(signal?: AbortSignal): Promise<NarrationProfiles>;
  objectUrl(path: string, signal?: AbortSignal): Promise<string>;

  /**
   * Save a scene as a **new revision**, which returns the project to `draft`.
   *
   * `exercise` is passed through and not optional in practice: the engine's `PUT` takes the scene
   * and the exercise as siblings and stores what it was given, so a body that omitted an existing
   * exercise would delete it. The editor never constructs one — it carries the envelope's own
   * value back unchanged.
   */
  reviseScene(slug: string, scene: Scene, exercise: unknown): Promise<ReviseResult>;
  renderScene(slug: string, variant: string, soundEngine?: string): Promise<RenderResult>;
  runQa(slug: string, variant: string): Promise<QaResult>;
  generateSound(request: SoundGenerationRequest): Promise<SoundRow>;

  /** The human signature. A 409 here means the master changed — re-listen, do not retry. */
  approveScene(slug: string, submission: ApprovalSubmission): Promise<ApprovalResult>;
  /** A refusal, with its reason. The scene returns to `draft`; the QA report and render stay. */
  declineScene(slug: string, reason: string, editor?: string): Promise<DeclineResult>;
  /** Convert one Lesetext into a narration scene project. 409 when it already has one. */
  sceneFromReading(readingId: string, profile?: string): Promise<SceneRow>;

  /** Stored voice references, plus the consent rules a new one is held to. */
  voices(signal?: AbortSignal): Promise<Voices>;
  /** Register one consented voice. A 400 here names the consent rule that was not met. */
  createVoice(submission: VoiceSubmission): Promise<Voice>;
  /** Synthesize the three audition phrases through one stored voice. */
  renderVoiceDemo(voiceId: string): Promise<VoiceDemo>;
  /** Withdraw consent: future synthesis refused, recording and demos deleted. */
  revokeVoice(voiceId: string): Promise<Revocation>;
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

/** A request that changes something. Reads pass nothing; there is no third kind. */
interface Write {
  method: 'PUT' | 'POST';
  body: unknown;
  /**
   * A multipart body, sent as it is.
   *
   * The one endpoint that is not JSON: a reference recording is bytes, and base64 in a JSON field
   * would be a third of the file again in memory on both sides for no gain. `Content-Type` is
   * **deliberately not set** when this is true — the browser writes it, including the boundary
   * token, and a hand-written `multipart/form-data` header without one produces a body the server
   * cannot parse.
   */
  formData?: boolean;
}

/** What the Klon-Assistent sends: the recording, the consent document, and how to read them. */
export interface VoiceSubmission {
  voice_id: string;
  /** The consent as JSON text. Built by the wizard, shown to the editor before it is sent. */
  consent: string;
  reference: File;
  ref_text?: string;
  x_vector_only: boolean;
  engine: string;
}

export function createApi(options: ApiOptions = {}): Api {
  const token = options.token ?? getToken;
  const fetcher: Fetcher = options.fetchImpl ?? ((input, init) => globalThis.fetch(input, init));
  let reportedUnauthorized = false;

  async function send(path: string, signal?: AbortSignal, write?: Write): Promise<Response> {
    let response: Response;
    try {
      response = await fetcher(path, {
        signal,
        method: write?.method ?? 'GET',
        headers: {
          Authorization: `Bearer ${token()}`,
          Accept: 'application/json',
          ...(write && !write.formData ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(write
          ? { body: write.formData ? (write.body as FormData) : JSON.stringify(write.body) }
          : {}),
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

  async function read<T>(
    path: string,
    schema: z.ZodType<T>,
    signal?: AbortSignal,
    write?: Write,
  ): Promise<T> {
    const response = await send(path, signal, write);
    const body: unknown = await response.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new ShapeError(path, parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '));
    return parsed.data;
  }

  return {
    registry: (signal) => read('/api/registry', registrySchema, signal),
    scenes: (signal) => read('/api/scenes', z.array(sceneRowSchema), signal),
    acoustics: (signal) => read('/api/acoustics', acousticsSchema, signal),
    sounds: (signal) => read('/api/sounds', z.array(soundRowSchema), signal),

    reviseScene: (slug, scene, exercise) =>
      read(`/api/scenes/${encodeURIComponent(slug)}`, reviseResultSchema, undefined, {
        method: 'PUT',
        body: { scene, exercise: exercise ?? null },
      }),

    renderScene: (slug, variant, soundEngine) =>
      read(`/api/scenes/${encodeURIComponent(slug)}/render`, renderResultSchema, undefined, {
        method: 'POST',
        body: { variant, ...(soundEngine ? { sound_engine: soundEngine } : {}) },
      }),

    runQa: (slug, variant) =>
      read(`/api/scenes/${encodeURIComponent(slug)}/qa`, qaResultSchema, undefined, {
        method: 'POST',
        body: { variant },
      }),

    generateSound: (request) =>
      read('/api/sounds/generate', soundRowSchema, undefined, { method: 'POST', body: request }),

    narrationProfiles: (signal) => read('/api/narration-profiles', narrationProfilesSchema, signal),

    approveScene: (slug, submission) =>
      read(`/api/scenes/${encodeURIComponent(slug)}/approve`, approvalResultSchema, undefined, {
        method: 'POST',
        body: submission,
      }),

    declineScene: (slug, reason, editor) =>
      read(`/api/scenes/${encodeURIComponent(slug)}/decline`, declineResultSchema, undefined, {
        method: 'POST',
        // `editor` is optional on the engine's side and omitted rather than sent empty: a decline
        // by nobody is a real state, and `""` would record an editor whose name is nothing.
        body: { reason, ...(editor ? { editor } : {}) },
      }),

    sceneFromReading: (readingId, profile) =>
      read('/api/scenes/from-reading', sceneRowSchema, undefined, {
        method: 'POST',
        // No profile means the engine's own default for this Lesetext. Sending a value the picker
        // guessed would put a copy of that rule in the frontend, which is the one place it must
        // not be — a hardcoded id keeps being offered after the catalog renames it.
        body: { reading_id: readingId, ...(profile ? { profile } : {}) },
      }),

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

    voices: (signal) => read('/api/voices', voicesSchema, signal),

    createVoice: (submission) => {
      const form = new FormData();
      form.set('voice_id', submission.voice_id);
      form.set('consent', submission.consent);
      form.set('reference', submission.reference, submission.reference.name);
      form.set('x_vector_only', String(submission.x_vector_only));
      form.set('engine', submission.engine);
      // Omitted rather than sent empty: an empty transcript is not "no transcript" to a form
      // parser, and the engine's own fallback (transcribe it locally) is what an absent field asks
      // for. A blank string would ask for a voice conditioned on nothing.
      if (submission.ref_text?.trim()) form.set('ref_text', submission.ref_text.trim());
      return read('/api/voices', voiceSchema, undefined, {
        method: 'POST',
        body: form,
        formData: true,
      });
    },

    renderVoiceDemo: (voiceId) =>
      read(`/api/voices/${encodeURIComponent(voiceId)}/demo`, voiceDemoSchema, undefined, {
        method: 'POST',
        body: {},
      }),

    revokeVoice: (voiceId) =>
      read(`/api/voices/${encodeURIComponent(voiceId)}/revoke`, revocationSchema, undefined, {
        method: 'POST',
        body: {},
      }),

    async objectUrl(path, signal) {
      const response = await send(path, signal);
      return URL.createObjectURL(await response.blob());
    },
  };
}

/**
 * The engine's own words for a refusal, in the two shapes FastAPI answers with.
 *
 * A hand-written `HTTPException` carries a string. A request that failed **schema** validation
 * carries a list of `{loc, msg}` — which is the shape the scene editor hits most, because that is
 * what a scene document with a bad field produces. Falling back to `422 Unprocessable Entity`
 * there would tell the author that something is wrong and never which field, so the list is
 * flattened into `script.0.pace: Input should be less than or equal to 1.3` — the path the engine
 * itself names, unchanged.
 */
async function detail(response: Response, fallback: string): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (!body || typeof body !== 'object' || !('detail' in body)) return fallback;
    const { detail: reason } = body as { detail: unknown };
    if (typeof reason === 'string') return reason;
    if (Array.isArray(reason)) {
      const zeilen = reason.flatMap((eintrag) => {
        if (!eintrag || typeof eintrag !== 'object') return [];
        const { loc, msg } = eintrag as { loc?: unknown; msg?: unknown };
        if (typeof msg !== 'string') return [];
        // `loc` starts with "body" on every request FastAPI validated; the reader knows.
        const pfad = Array.isArray(loc)
          ? loc.filter((teil) => teil !== 'body').join('.')
          : '';
        return [pfad ? `${pfad}: ${msg}` : msg];
      });
      if (zeilen.length) return zeilen.join(' · ');
    }
  } catch {
    /* not JSON; the fallback is the honest answer */
  }
  return fallback;
}
