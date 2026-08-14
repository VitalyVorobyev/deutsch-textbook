/**
 * The dev-server bridge between the corpus and the browser.
 *
 * The editorial app runs on a Vite dev server, so it has a Node process available and does not need
 * — and must not have — a build step that bakes the corpus into a bundle. A baked corpus is exactly
 * what the previous console was: a 2.4 MB generated file that was stale the moment anyone edited a
 * topic. Here the graph is rebuilt when a file under `content/` or `data/` changes, and the browser
 * refetches.
 *
 * This is the same mechanism the learner app already uses to write snapshots into the repo during
 * `astro dev` (`src/integrations/progress-writer.ts`): a Vite plugin registering middleware in
 * `configureServer`. It runs in dev only. `vite build` produces a static bundle with no endpoints,
 * which is why the app is served rather than built.
 *
 * `apply: 'serve'` is what makes `PUT /__write` unreachable from anything but a running dev server
 * — not a flag, not an environment check, but the plugin never being present in a build. The write
 * itself is `@da/content/write`, which is where every rule about what may be changed lives; this
 * only adds the two protections that belong to a transport: a method check and a body cap.
 */
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';
import { contentGraph, invalidateContentGraph } from '@da/content/graph';
import { graphChunk, graphPayload, type ChunkName } from '@da/content/payload';
import { repoRoot } from '@da/content/repo-root';
import { applyPatch, writableFields, type WritePatch } from '@da/content/write';
import { readSource, saveSource, type SaveFileInput } from '@da/content/editor';

const CHUNKS: ChunkName[] = ['items', 'vocab', 'texts'];

/** A patch is three short strings; the cap acts before anything is parsed. */
const MAX_PATCH_BYTES = 4 * 1024;
const MAX_SOURCE_BYTES = 2 * 1024 * 1024;

/**
 * The corpus-level gate, run on the tree the write just produced. A per-file schema check cannot
 * see, for instance, that marking a B1 topic `reviewed` makes the provenance check demand records
 * it may not have — so an editorial click could leave `bun run validate` red with nothing on
 * screen saying so. About six seconds; the write is undone if it reports anything.
 */
function validateCorpus(root: string): string | undefined {
  const run = spawnSync('bun', ['scripts/validate.ts'], { cwd: root, encoding: 'utf8', timeout: 120_000 });
  if (run.status === 0) return undefined;
  const output = `${run.stdout ?? ''}${run.stderr ?? ''}`;
  const first = output.split('\n').find((line) => line.trim().startsWith('content/') || line.trim().startsWith('data/'));
  return (first ?? output.split('\n').filter(Boolean).at(-1) ?? 'validate failed').trim();
}

function json(res: { setHeader: (k: string, v: string) => void; end: (body: string) => void }, body: unknown): void {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  // No caching: the whole point is that an edit on disk is visible on the next request.
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function readBody(req: NodeJS.ReadableStream, max: number): Promise<string> {
  return new Promise((resolveBody, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > max) reject(new Error(`body larger than ${max} bytes`));
      else chunks.push(chunk);
    });
    req.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function validateWorkspace(root: string): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolveRun) => {
    const child = spawn('bun', ['scripts/validate.ts'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => { output += chunk.toString('utf8'); });
    child.stderr.on('data', (chunk: Buffer) => { output += chunk.toString('utf8'); });
    child.on('error', (error) => resolveRun({ ok: false, output: error.message }));
    child.on('close', (code) => resolveRun({ ok: code === 0, output }));
  });
}

export function corpus(): Plugin {
  const root = repoRoot();
  return {
    name: 'redaktion:corpus',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      // Watch the knowledge base, which lives outside this app's Vite root.
      server.watcher.add([`${root}/content`, `${root}/data`]);
      const invalidate = (file: string) => {
        if (file.startsWith(`${root}/content`) || file.startsWith(`${root}/data`)) {
          invalidateContentGraph(root);
          server.ws.send({ type: 'custom', event: 'redaktion:corpus-changed', data: { file } });
        }
      };
      server.watcher.on('change', invalidate);
      server.watcher.on('add', invalidate);
      server.watcher.on('unlink', invalidate);

      server.middlewares.use((req, res, next) => {
        const parsedUrl = new URL(req.url ?? '/', 'http://redaktion.local');
        const url = parsedUrl.pathname;
        if (url === '/__workspace')
          return json(res, { root, writable: true, transport: 'vite', platform: process.platform });
        if (url === '/__asset') {
          const path = parsedUrl.searchParams.get('path') ?? '';
          try {
            const checkout = realpathSync(root);
            const target = realpathSync(resolve(checkout, path));
            if (!target.startsWith(resolve(checkout, 'content', 'listening') + sep) || !target.endsWith('.mp3') || !statSync(target).isFile())
              throw new Error('only committed listening MP3 files are served');
            res.setHeader('Content-Type', 'audio/mpeg');
            res.setHeader('Cache-Control', 'no-store');
            return res.end(readFileSync(target));
          } catch (error) {
            res.statusCode = 404;
            return json(res, { error: error instanceof Error ? error.message : String(error) });
          }
        }
        if (url === '/__graph') {
          const started = Date.now();
          const payload = graphPayload(contentGraph(root));
          server.config.logger.info(
            `  ➜  Korpus: ${payload.topics.length} Themen · ${payload.elements.length} Elemente · ` +
              `${payload.problems.length} Befunde (${Date.now() - started} ms)`,
          );
          return json(res, payload);
        }
        const chunk = /^\/__chunk\/([a-z]+)$/.exec(url)?.[1];
        if (chunk) {
          if (!CHUNKS.includes(chunk as ChunkName)) {
            res.statusCode = 404;
            return json(res, { error: `unknown chunk "${chunk}"`, known: CHUNKS });
          }
          return json(res, graphChunk(contentGraph(root), chunk as ChunkName));
        }
        // What the editor is allowed to change. The UI reads this rather than carrying its own
        // copy of the enum, so a field can only ever appear in the interface after it exists in
        // the controller's allowlist — never the other way round.
        if (url === '/__writable') return json(res, { fields: writableFields() });
        if (url === '/__file') {
          if (req.method === 'GET') {
            const path = parsedUrl.searchParams.get('path') ?? '';
            void readSource(root, path)
              .then((snapshot) => json(res, snapshot))
              .catch((error: unknown) => {
                res.statusCode = 422;
                json(res, { error: error instanceof Error ? error.message : String(error) });
              });
            return;
          }
          if (req.method !== 'PUT') {
            res.statusCode = 405;
            return json(res, { error: 'GET or PUT only' });
          }
          void readBody(req, MAX_SOURCE_BYTES + 64 * 1024)
            .then((raw) => JSON.parse(raw) as SaveFileInput)
            .then((input) => saveSource(root, input))
            .then((result) => {
              if (!result.ok) res.statusCode = result.conflict ? 409 : 422;
              if (result.ok && result.changed) invalidateContentGraph(root);
              json(res, result);
            })
            .catch((error: unknown) => {
              res.statusCode = error instanceof SyntaxError ? 400 : 413;
              json(res, { error: error instanceof Error ? error.message : String(error) });
            });
          return;
        }
        if (url === '/__validate') {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            return json(res, { error: 'POST only' });
          }
          const startedAt = new Date().toISOString();
          void validateWorkspace(root).then((result) => json(res, { ...result, startedAt, finishedAt: new Date().toISOString() }));
          return;
        }
        if (url === '/__review') {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            return json(res, { error: 'POST only' });
          }
          void readBody(req, MAX_PATCH_BYTES)
            .then((raw) => JSON.parse(raw) as { topicId?: string; expectedRevision?: string })
            .then(({ topicId, expectedRevision }) => {
              const topic = topicId ? contentGraph(root).topics.get(topicId) : undefined;
              if (!topic || !expectedRevision) return { ok: false, error: 'topicId and expectedRevision are required' } as const;
              return applyPatch({ file: topic.file, field: 'status', value: 'reviewed' }, root, {
                expectedRevision,
                verify: validateCorpus,
              });
            })
            .then((result) => {
              if (!result.ok) res.statusCode = 422;
              if (result.ok && result.changed) invalidateContentGraph(root);
              json(res, result);
            })
            .catch((error: unknown) => {
              res.statusCode = error instanceof SyntaxError ? 400 : 413;
              json(res, { error: error instanceof Error ? error.message : String(error) });
            });
          return;
        }
        if (url === '/__write') {
          if (req.method !== 'PUT') {
            res.statusCode = 405;
            return json(res, { error: 'PUT only' });
          }
          let size = 0;
          const chunks: Buffer[] = [];
          req.on('data', (c: Buffer) => {
            size += c.length;
            // A patch is three short strings. Anything larger is not one, and a body cap is the
            // one protection that has to act before the payload is parsed.
            if (size > MAX_PATCH_BYTES) {
              res.statusCode = 413;
              json(res, { error: `patch larger than ${MAX_PATCH_BYTES} bytes` });
              req.destroy();
              return;
            }
            chunks.push(c);
          });
          req.on('end', () => {
            if (res.writableEnded) return;
            let patch: WritePatch;
            try {
              patch = JSON.parse(Buffer.concat(chunks).toString('utf8')) as WritePatch;
            } catch {
              res.statusCode = 400;
              return json(res, { error: 'body is not JSON' });
            }
            const result = applyPatch(patch, root, { verify: validateCorpus });
            if (!result.ok) {
              res.statusCode = 422;
              server.config.logger.warn(`  ✗  Schreibversuch abgelehnt: ${result.error}`);
              return json(res, result);
            }
            // The watcher fires on the write and invalidates the graph, so the browser refetches
            // what is on disk rather than trusting what it just sent.
            if (result.changed)
              server.config.logger.info(
                `  ✎  ${result.file}: ${result.field} ${result.before ?? '—'} → ${result.after ?? '—'}`,
              );
            return json(res, result);
          });
          return;
        }
        return next();
      });
    },
  };
}
