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
 */
import type { Plugin, ViteDevServer } from 'vite';
import { contentGraph, invalidateContentGraph } from '@da/content/graph';
import { graphChunk, graphPayload, type ChunkName } from '@da/content/payload';
import { repoRoot } from '@da/content/repo-root';

const CHUNKS: ChunkName[] = ['items', 'vocab', 'texts'];

function json(res: { setHeader: (k: string, v: string) => void; end: (body: string) => void }, body: unknown): void {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  // No caching: the whole point is that an edit on disk is visible on the next request.
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
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
        const url = (req.url ?? '').split('?')[0] ?? '';
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
        return next();
      });
    },
  };
}
