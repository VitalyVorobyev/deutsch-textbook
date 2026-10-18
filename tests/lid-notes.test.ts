/**
 * Leben-in-Deutschland notes (`content/lid/notes/<topic>.yaml`, ADR 0009): the Ukrainian half is
 * all-or-none per file, as it is for every other content file. `lidNotesUkProblems` is the rule
 * `lidProblems` applies; it runs here on invented notes, never on the real ones — the corpus-wide
 * "every file carries its uk" ratchet is `tests/i18n-content.test.ts`.
 */
import { describe, expect, test } from 'bun:test';
import { lidNotesUkProblems, type PlacedLidNote } from '@da/content/lid';

const en = (s: string) => `${s} (en)`;
const ru = (s: string) => `${s} — ру`;
const uk = (s: string) => `${s} — укр`;

function note(id: string, topic: string, withUk: boolean): PlacedLidNote {
  const half = (s: string) => ({ en: en(s), ru: ru(s), ...(withUk && { uk: uk(s) }) });
  return {
    id,
    topic,
    status: 'reviewed',
    rationale_de: 'Begründung.',
    question: half('frage'),
    options: { a: half('a'), b: half('b'), c: half('c'), d: half('d') },
    terms: [{ de: 'das Wort', ...half('wort') }],
  };
}

describe('lidNotesUkProblems', () => {
  test('a file with no uk at all passes, and so does a file with uk throughout', () => {
    expect(
      lidNotesUkProblems([
        note('general-001', 'grundrechte', false),
        note('general-002', 'grundrechte', false),
      ]),
    ).toEqual([]);
    expect(
      lidNotesUkProblems([
        note('general-001', 'grundrechte', true),
        note('general-002', 'grundrechte', true),
      ]),
    ).toEqual([]);
  });

  test('one uk in a file obliges every ru in it — another note, an option, a term', () => {
    const missingNote = lidNotesUkProblems([
      note('general-001', 'grundrechte', true),
      note('general-002', 'grundrechte', false),
    ]);
    expect(missingNote.length).toBe(6); // question, four options, one term of general-002
    expect(
      missingNote.every((p) => p.startsWith('content/lid/notes/grundrechte.yaml: general-002: ')),
    ).toBe(true);

    const partial = note('general-003', 'europa', true);
    delete partial.options!.c.uk;
    delete partial.terms![0]!.uk;
    const problems = lidNotesUkProblems([partial]);
    expect(problems).toHaveLength(2);
    expect(problems.join('\n')).toContain('options.c.ru has no uk sibling');
    expect(problems.join('\n')).toContain('terms[0].ru has no uk sibling');
  });

  test('the scope is the file: uk in one topic obliges nothing in another', () => {
    expect(
      lidNotesUkProblems([
        note('general-001', 'grundrechte', true),
        note('general-002', 'europa', false),
      ]),
    ).toEqual([]);
  });
});
