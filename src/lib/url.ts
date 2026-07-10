/**
 * Prefix a root-absolute path with the configured Astro base, so internal
 * links survive a subpath deployment (GitHub Pages serves the site under
 * /<repo>/). At the default base "/" this is a no-op.
 */
export function withBase(path: string): string {
  const base = import.meta.env.BASE_URL;
  if (!base || base === '/') return path;
  return base.replace(/\/$/, '') + path;
}
