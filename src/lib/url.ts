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

/**
 * The canonical URL of a topic page. Topic pages build at
 * /topics/<level>/<id> (the collection entry id), while frontmatter ids are
 * level-less — a link built from the bare id 404s. Every derived chip goes
 * through here so the two can never disagree again.
 */
export function topicPath(topic: { id: string; level: string }): string {
  return `/topics/${topic.level.toLowerCase()}/${topic.id}`;
}
