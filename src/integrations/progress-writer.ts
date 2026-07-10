/**
 * Dev-only progress writer.
 *
 * Registers a Vite middleware that accepts `POST /__progress/<profile>` and
 * writes the posted snapshot to `progress/<profile>/<date>.json`. Together
 * with the client's auto-sync (`src/lib/autosync.ts`) this keeps repo
 * snapshots current while `bun run dev` is running, with zero effect on
 * `astro build` output — in a built/preview site the endpoint 404s and the
 * client falls back to a plain file download on manual export.
 *
 * The middleware is injected via a Vite plugin's `configureServer` (not the
 * `astro:server:setup` hook): middleware added there directly runs BEFORE
 * Vite's internal stack and Astro's route handler, which would otherwise
 * answer 404 first and never call next().
 */
import type { AstroIntegration } from 'astro';
import type { Connect } from 'vite';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const PREFIX = '/__progress/';
const MAX_BYTES = 5 * 1024 * 1024;

function localDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

const handler: Connect.NextHandleFunction = (req, res, next) => {
  const progressDir = path.resolve(process.cwd(), 'progress');
  const url = req.url ?? '';
  if (req.method !== 'POST' || !url.startsWith(PREFIX)) return next();

  const id = decodeURIComponent(url.slice(PREFIX.length).replace(/[?#].*$/, ''));
  // Slug whitelist makes `..`, `/`, `\`, and null bytes impossible.
  if (!/^[a-z0-9-]+$/.test(id)) {
    res.statusCode = 400;
    return res.end('invalid profile');
  }
  const dir = path.resolve(progressDir, id);
  // Defense in depth: the resolved dir must stay inside progress/.
  if (dir !== path.join(progressDir, id) || !dir.startsWith(progressDir + path.sep)) {
    res.statusCode = 400;
    return res.end('bad path');
  }

  const chunks: Buffer[] = [];
  let size = 0;
  let aborted = false;

  req.on('data', (c: Buffer) => {
    if (aborted) return;
    size += c.length;
    if (size > MAX_BYTES) {
      aborted = true;
      res.statusCode = 413;
      res.end('too large');
      req.destroy();
      return;
    }
    chunks.push(c);
  });

  req.on('end', () => {
    if (aborted) return;
    void (async () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        const snap = JSON.parse(raw) as { attempts?: unknown };
        if (typeof snap !== 'object' || snap === null || !Array.isArray(snap.attempts)) {
          res.statusCode = 422;
          return res.end('not a snapshot');
        }
        // The server decides the filename — never trust the client for the path.
        const file = `${localDate(new Date())}.json`;
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(path.join(dir, file), raw, 'utf8');
        res.statusCode = 200;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ ok: true, path: `progress/${id}/${file}` }));
      } catch {
        res.statusCode = 500;
        res.end('write failed');
      }
    })();
  });
};

export function progressWriter(): AstroIntegration {
  return {
    name: 'progress-writer',
    hooks: {
      'astro:config:setup': ({ command, updateConfig }) => {
        if (command !== 'dev') return;
        updateConfig({
          vite: {
            plugins: [
              {
                name: 'progress-writer-middleware',
                configureServer(server) {
                  server.middlewares.use(handler);
                },
              },
            ],
          },
        });
      },
    },
  };
}
