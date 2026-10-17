/**
 * The focus-tag taxonomy lives in two places and must never diverge:
 *
 *   - `docs/authoring/focus-tags.md` — the table an author consults while tagging an item;
 *   - `focusIntroducedBy` (packages/content/src/focus-tags.ts) — the allowlist `bun run validate`
 *     enforces, which also names the topic that introduces each tag.
 *
 * Keeping them in step has been a rule in prose. That works at 62 tags maintained a handful
 * at a time; B1 adds roughly forty in one level, against a grammar inventory that already
 * proposes them (`data/grammar-inventory.yaml`, 31 points at 0/31 covered). A pair of
 * hand-kept lists is at its most fragile exactly then, and the failure is silent in the
 * worse direction: a tag in the doc but not the allowlist is rejected loudly the first time
 * it is used, but a tag in the allowlist and not the doc is invisible — authors never learn
 * the confusion exists, and it goes untagged or gets a near-miss tag instead. A false tag is
 * worse than no tag, because it sends training and drill authoring after a confusion the
 * learner does not have.
 */
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { focusIntroducedBy, insertionErrors } from '@da/content/focus-tags';

const ROOT = join(import.meta.dirname, '..');

const INSERTIONS_HEADING = /^## Errors that add a word$/m;

/** The doc, split at the insertion-error section: the taxonomy table comes before it. */
function docParts(): { taxonomy: string; insertions: string } {
  const doc = readFileSync(join(ROOT, 'docs', 'authoring', 'focus-tags.md'), 'utf8');
  const [taxonomy, insertions = ''] = doc.split(INSERTIONS_HEADING);
  return { taxonomy: taxonomy!, insertions };
}

/** Tags from the Markdown table: rows shaped `| \`tag\` | what it names |`. */
function documentedTags(): string[] {
  return [...docParts().taxonomy.matchAll(/^\|\s*`([a-z0-9-]+)`\s*\|/gm)].map((m) => m[1]!);
}

/** Rows shaped `| \`tag\` | \`word\` … | site |` from "Errors that add a word". */
function documentedInsertions(): Record<string, string> {
  return Object.fromEntries(
    [...docParts().insertions.matchAll(/^\|\s*`([a-z0-9-]+)`\s*\|\s*`([^`]+)`/gm)].map((m) => [
      m[1]!,
      m[2]!,
    ]),
  );
}

describe('the focus-tag table and the validator allowlist are one list', () => {
  test('the doc table parses — the regex still matches the table it reads', () => {
    // A guard on the guard: if the table's formatting changes, every assertion below would
    // pass vacuously over an empty list rather than failing.
    expect(documentedTags().length).toBeGreaterThan(50);
  });

  test('every documented tag is registered, and every registered tag is documented', () => {
    const documented = new Set(documentedTags());
    const registered = new Set(Object.keys(focusIntroducedBy));
    expect([...documented].filter((tag) => !registered.has(tag))).toEqual([]);
    expect([...registered].filter((tag) => !documented.has(tag))).toEqual([]);
  });

  test('the table lists each tag exactly once', () => {
    const tags = documentedTags();
    const seen = new Set<string>();
    const duplicated = tags.filter((tag) => !seen.add(tag));
    expect(duplicated).toEqual([]);
  });

  test('the insertion-error table and `insertionErrors` are one list, word for word', () => {
    // A tag the validator treats as adding a word but the doc does not list is a rule an author
    // meets only as a failure; one the doc lists and the registry lacks is a probe left reading
    // the insertion as retention. The guard on the guard: the section must parse to something.
    const documented = documentedInsertions();
    expect(Object.keys(documented).length).toBeGreaterThan(0);
    const registered = Object.fromEntries(
      Object.entries(insertionErrors).map(([tag, error]) => [tag, error.word]),
    );
    expect(documented).toEqual(registered);
    for (const tag of Object.keys(insertionErrors)) expect(focusIntroducedBy).toHaveProperty(tag);
  });

  test('every tag names a topic that introduces it', () => {
    for (const [tag, topic] of Object.entries(focusIntroducedBy)) {
      expect(topic, `focus "${tag}" has no introducing topic`).toMatch(/^[a-z0-9-]+$/);
    }
  });
});
