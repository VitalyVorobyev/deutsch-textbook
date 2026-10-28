/**
 * `<Siehe to="…">` — an inline link from an article to the place it builds on.
 *
 * Articles say "Auf A2 stand der Komparativ nach *ist*" and the learner wants to look. The
 * target is a topic (`a2/einkaufen-reklamation`, optionally `#heading-slug`) or a Referenz page
 * (`referenz/zeitformen`). A link nobody follows still renders, so a wrong target is silent:
 * this module is what the validator uses to fail it.
 */

export interface SieheLink {
  to: string;
  /** `a1` · `a2` · `b1` for a topic, `referenz` for a Referenz page */
  section: string;
  id: string;
  anchor?: string;
}

/** Every `<Siehe to="…">` in an article body, in order. */
export function sieheLinks(body: string): SieheLink[] {
  return [...body.matchAll(/<Siehe\s+to="([^"]*)"\s*>/g)].map((match) => {
    const to = match[1]!;
    const [path = '', anchor] = to.split('#');
    const [section = '', id = ''] = path.split('/');
    return { to, section, id, ...(anchor !== undefined ? { anchor } : {}) };
  });
}

/**
 * The id Astro gives a Markdown heading (github-slugger's rule): the visible text, lowercased,
 * with everything but letters, digits, spaces and hyphens dropped and each space a hyphen.
 * Emphasis markers are not visible text. `tests/siehe.test.ts` holds it to the built pages.
 */
export function headingSlug(text: string): string {
  return text
    .replace(/[*_`]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s/g, '-');
}

/** The slugs of an article's `##` and `###` headings. */
export function headingSlugs(body: string): Set<string> {
  return new Set([...body.matchAll(/^#{2,3}\s+(.+)$/gm)].map((match) => headingSlug(match[1]!)));
}

export interface SieheTargets {
  /** the article body of a topic, by `<level>/<id>`, lowercase level */
  topicBody: (key: string) => string | undefined;
  /** whether `src/pages/referenz/<id>.astro` exists */
  referenzPage: (id: string) => boolean;
}

export function sieheProblems(body: string, targets: SieheTargets): string[] {
  const problems: string[] = [];
  for (const link of sieheLinks(body)) {
    if (link.section === 'referenz') {
      if (!targets.referenzPage(link.id))
        problems.push(`<Siehe to="${link.to}">: there is no Referenz page "${link.id}"`);
      continue;
    }
    const target = targets.topicBody(`${link.section}/${link.id}`);
    if (target === undefined) {
      problems.push(`<Siehe to="${link.to}">: there is no topic "${link.section}/${link.id}"`);
      continue;
    }
    if (link.anchor !== undefined && !headingSlugs(target).has(link.anchor))
      problems.push(
        `<Siehe to="${link.to}">: "${link.section}/${link.id}" has no heading with the id "${link.anchor}"`,
      );
  }
  return problems;
}
