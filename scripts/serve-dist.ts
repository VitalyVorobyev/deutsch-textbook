/**
 * Serve `dist/` exactly as a static host does.
 *
 * `bun run preview` cannot be used to check a build: Astro's preview server answers from the
 * routes it knows about, so anything an integration writes at `astro:build:done` 404s. Measured
 * on this build — `/manifest.webmanifest`, `/sw.js` and `/audio/manifest.json` (the last one
 * predates this script) all 404 under preview, while `/favicon.png` and `/_headers`, copied from
 * `public/` before the build, are served. Cloudflare Pages serves the directory, so preview
 * disagrees with production about precisely the files that make the app installable.
 *
 * A service worker also needs a secure context, and `localhost` is one — so this is enough to
 * exercise registration, precaching, offline navigation and Range-sliced audio for real.
 *
 * Node's http rather than `Bun.serve` because every other script here is typed by `@types/node`
 * and `bun run check` has no `Bun` global.
 *
 *   bun run preview:dist [--port 4321]
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const root = join(process.cwd(), 'dist');
if (!existsSync(root)) {
  console.error('dist/ does not exist — run `bun run build` first.');
  process.exit(1);
}

const portFlag = process.argv.indexOf('--port');
const port = portFlag > -1 ? Number(process.argv[portFlag + 1]) : 4321;

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2',
};

/** Resolve a URL path to a file inside dist, or null. Directories fall back to index.html. */
function resolve(pathname: string): string | null {
  // normalize() collapses `..`; the prefix check then refuses anything that escaped dist.
  const candidate = normalize(join(root, decodeURIComponent(pathname)));
  if (!candidate.startsWith(root)) return null;
  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  const index = join(candidate, 'index.html');
  return existsSync(index) ? index : null;
}

createServer((req, res) => {
  const pathname = new URL(req.url ?? '/', `http://localhost:${port}`).pathname;
  const file = resolve(pathname);
  if (!file) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }
  const headers: Record<string, string> = {
    'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
  };
  // The one header the app depends on and a naive host would get wrong: a cached sw.js is how a
  // PWA strands an installed learner on an old build (see public/_headers).
  if (file.endsWith('sw.js')) headers['cache-control'] = 'no-cache';
  res.writeHead(200, headers);
  res.end(readFileSync(file));
}).listen(port, () => console.log(`dist/ on http://localhost:${port}`));
