/**
 * Web app manifest + service worker emission.
 *
 * Hand-rolled rather than `@vite-pwa/astro`, for two reasons that are both checkable:
 * its peer range is `astro: ^1 || … || ^5` and this repo is on Astro 7, and the caching policy
 * here is unusual enough (never precache 14.2 MB of reviewed audio; version the document cache
 * but not the media cache) that a Workbox recipe would be configuration rather than a saving.
 * The worker's own reasoning lives in `service-worker.js`; this file only fills its blanks.
 *
 * Emitted at `astro:build:done`, so nothing runs in dev — a service worker that survives a dev
 * restart serves the previous build's HTML and looks exactly like a broken hot reload.
 *
 * The version pins the caches. It is the content hash of the worker template plus everything
 * precached, so a rebuild that changes nothing does not invalidate a learner's document cache,
 * and one that changes an asset or the caching logic does. A timestamp would have invalidated on
 * every deploy, including no-op ones.
 */
import type { AstroIntegration } from 'astro';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, posix, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Assets precached on install: the content-hashed bundle plus the icons and offline page. */
const SHELL_DIRS = ['_astro', 'icons'];
const SHELL_FILES = ['favicon.png', 'manifest.webmanifest', 'offline/index.html'];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/** Build the manifest. `base` is Astro's, always with a trailing slash. */
export function webManifest(base: string) {
  return {
    name: 'Deutsch-Atlas',
    short_name: 'Deutsch-Atlas',
    description: 'Ein interaktives Lehrbuch für Deutsch — A1 bis B1.',
    lang: 'de',
    start_url: base,
    scope: base,
    display: 'standalone',
    orientation: 'any',
    background_color: '#fafaf9',
    theme_color: '#d97706',
    icons: [
      { src: `${base}icons/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `${base}icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: `${base}icons/maskable-512.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    // Long-press / desktop jump list. Deliberately the three the daily loop starts from.
    shortcuts: [
      { name: 'Tagesplan', url: base },
      { name: 'Wiederholen', url: `${base}ueben/wiederholen` },
      { name: 'Themen', url: `${base}topics` },
    ],
  };
}

export function pwa(): AstroIntegration {
  return {
    name: 'deutsch-atlas:pwa',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const outDir = fileURLToPath(dir);
        const base = ensureTrailingSlash(process.env.BASE_PATH ?? '/');

        writeFileSync(
          join(outDir, 'manifest.webmanifest'),
          `${JSON.stringify(webManifest(base), null, 2)}\n`,
        );

        const source = readFileSync(
          fileURLToPath(new URL('./service-worker.js', import.meta.url)),
          'utf8',
        );

        const shell: string[] = [];
        const hash = createHash('sha256');
        // The **template** goes into the hash, not the substituted output — that would be
        // circular, since the output embeds the hash. Including it means a change to the
        // worker's own caching logic retires the caches that logic used to manage; hashing only
        // the assets would have left a new worker reading an old cache's layout.
        hash.update(source);
        for (const rel of [...SHELL_DIRS.flatMap((d) => collect(outDir, d)), ...SHELL_FILES]) {
          const full = join(outDir, rel);
          if (!exists(full)) continue;
          hash.update(readFileSync(full));
          // The offline page is precached under its route, not its file path.
          shell.push(base + rel.replace(/index\.html$/, ''));
        }
        const buildId = hash.digest('hex').slice(0, 12);

        // Each placeholder is written so the template is itself valid, lintable JavaScript —
        // `'__VERSION__'` is a string and `/* __SHELL__ */ []` an empty array — rather than a
        // bare identifier that only parses after substitution.
        const worker = source
          .replace("'__VERSION__'", JSON.stringify(buildId))
          .replace("'__BASE__'", JSON.stringify(base))
          .replace('/* __SHELL__ */ []', JSON.stringify(shell, null, 2));

        if (worker.includes('__VERSION__') || worker.includes('__BASE__') || worker.includes('__SHELL__')) {
          // A silently unsubstituted placeholder ships a worker that caches the literal string
          // "__SHELL__" and serves nothing — a failure that only appears on a real device.
          throw new Error('[pwa] service-worker.js has an unsubstituted placeholder');
        }
        writeFileSync(join(outDir, 'sw.js'), worker);

        logger.info(
          `manifest + service worker (build ${buildId}) — ${shell.length} shell asset(s) precached`,
        );
      },
    },
  };
}

function ensureTrailingSlash(base: string): string {
  return base.endsWith('/') ? base : `${base}/`;
}

function exists(path: string): boolean {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}

/** Repo-relative, POSIX-separated paths under `outDir/sub`, or [] when it does not exist. */
function collect(outDir: string, sub: string): string[] {
  const dir = join(outDir, sub);
  if (!exists(dir)) return [];
  return walk(dir).map((f) => relative(outDir, f).split(/[\\/]/).join(posix.sep));
}
