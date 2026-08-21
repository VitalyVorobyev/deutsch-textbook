/**
 * The Lesetext queue's join and its slicing — pure, and outside the view.
 *
 * The corpus is 85 Lesetexte and the wave that narrates them is one pass through this list, so the
 * two things that must be right are the ones a screenshot cannot check: **which scene belongs to
 * which text**, and **what a row's state actually is**. Both have already been got wrong once in
 * this repository, in the engine's own registry, and the comment there is the reason this file
 * exists rather than a `.map()` inside a component.
 */
import { STUFE_LABEL, stufeStatus, type RegistryRow, type SceneRow } from './contracts';

/**
 * `a1/erste-schritte` → `a1-erste-schritte`, the engine's `scene.convert.reading_slug`.
 *
 * **Not `Path(id).name`.** The published file is named after the last segment, and the scene slug
 * is the whole id with the slash flattened — level included, which is what keeps `a1/akkusativ`
 * and `a2/akkusativ` two scenes rather than one collision. Getting this wrong is silent in the
 * worst way: the lookup simply never matches, and every converted narration keeps reporting as an
 * unconverted one. The engine's `api/registry.reading_rows` carries the same warning.
 */
export function lesetextSlug(readingId: string): string {
  return readingId.replaceAll('/', '-');
}

export interface LesetextZeile {
  /** The reading id, `<level>/<name>`. The queue's key and what `from-reading` is called with. */
  id: string;
  /** The scene slug this Lesetext would have — whether or not a scene exists. */
  slug: string;
  level: string;
  titel: string | null;
  /** `intensive` or `extensive`; a narration profile may refuse one of them. */
  art: string | null;
  woerter: number | null;
  /** The course-level status: the registry's own word, corrected by the studio where it can be. */
  status: string;
  /** The studio-level stage, in German, or null when no scene has been made. */
  stufe: string | null;
  szene: SceneRow | null;
  quelleAbgewichen: boolean;
}

/**
 * Every Lesetext, with its scene beside it.
 *
 * The two axes are kept apart rather than merged into one word, because they answer different
 * questions and a queue needs both: **status** is where the artifact stands in the course (the
 * registry's join across the plan, the published files and the exercises), **stufe** is where the
 * project stands in the studio. Only the first knows `published` and `stale`; only the second can
 * tell a rendered take from a draft, which is the distinction a batch reviewer works by.
 */
export function lesetextZeilen(
  rows: readonly RegistryRow[],
  scenes: readonly SceneRow[],
): LesetextZeile[] {
  const nachSlug = new Map(scenes.map((row) => [row.slug, row]));
  return rows
    .filter((row) => row.kind === 'reading')
    .map((row) => {
      const slug = lesetextSlug(row.id);
      const szene = nachSlug.get(slug) ?? null;
      return {
        id: row.id,
        slug,
        level: row.level.toUpperCase(),
        titel: row.title ?? null,
        art: row.reading_kind ?? null,
        woerter: row.word_count ?? null,
        // `published` and `stale` are the registry's alone: one says the course has this audio,
        // the other that it has audio the studio has moved past. Neither is derivable from a
        // stage. Everything else the scene knows better, because it knows about rendering.
        status:
          row.status === 'published' || row.status === 'stale'
            ? row.status
            : szene
              ? stufeStatus(szene.stage, szene.qa_passed)
              : row.status,
        stufe: szene ? (STUFE_LABEL[szene.stage] ?? szene.stage) : null,
        szene,
        quelleAbgewichen: row.source_drift === true,
      };
    })
    .sort(vergleichen);
}

/**
 * Plan order: level, then id. **Not urgency order**, unlike the Übersicht.
 *
 * The Übersicht is opened to find what is wrong and sorts the worst first. This queue is worked
 * through end to end, and a list that reorders itself as rows are acted on is a list you lose your
 * place in — the row under the cursor moves out from under it the moment a scene is created.
 */
function vergleichen(a: LesetextZeile, b: LesetextZeile): number {
  const level = a.level.localeCompare(b.level, 'de');
  return level !== 0 ? level : a.id.localeCompare(b.id, 'de');
}

export const ALLE = 'alle';

export interface LesetextFilter {
  ebene: string;
  status: string;
}

export function filtern(
  zeilen: readonly LesetextZeile[],
  filter: LesetextFilter,
): LesetextZeile[] {
  return zeilen.filter((zeile) => {
    if (filter.ebene !== ALLE && zeile.level !== filter.ebene.toUpperCase()) return false;
    if (filter.status !== ALLE && zeile.status !== filter.status) return false;
    return true;
  });
}

/** The levels present, in curriculum order. Read off the rows: the corpus gains one before we do. */
export function ebenen(zeilen: readonly LesetextZeile[]): string[] {
  const bekannt = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  return [...new Set(zeilen.map((zeile) => zeile.level))].sort((a, b) => {
    const links = bekannt.indexOf(a);
    const rechts = bekannt.indexOf(b);
    if (links === -1 && rechts === -1) return a.localeCompare(b, 'de');
    if (links === -1) return 1;
    if (rechts === -1) return -1;
    return links - rechts;
  });
}

/**
 * Where `Enter` goes on a row, and why one of the three answers is "nowhere".
 *
 * A Lesetext with no scene has nothing to open. The tempting answer — make `Enter` create it — is
 * refused: the engine publishes no way to delete a scene project, so a mistaken key press in an
 * 85-row queue is 85 irreversible projects, one per stray repeat. `Enter` therefore *points at*
 * the button, and a second, deliberate press is what creates.
 */
export function ziel(zeile: LesetextZeile): { art: 'freigabe' | 'szene'; slug: string } | { art: 'anlegen' } {
  if (!zeile.szene) return { art: 'anlegen' };
  if (zeile.szene.stage === 'automatically_checked') {
    return { art: 'freigabe', slug: zeile.slug };
  }
  return { art: 'szene', slug: zeile.slug };
}
