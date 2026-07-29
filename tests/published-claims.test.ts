import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { getCurriculum } from '../src/lib/curriculum';
import { grammarCoverage, loadGrammarInventory } from '../src/lib/grammar-coverage';
import { focusIntroducedBy } from '../src/lib/focus-tags';

/**
 * The tripwire for progress figures written into prose.
 *
 * `/about` computes every figure it prints, and `tests/grammar-coverage.test.ts` ratchets the
 * instrument — but the README bullet, the CLAUDE.md rule digest and the coverage-instruments
 * paragraph are prose, and prose has no gate. On 2026-07-29 all three were wrong at once: the
 * README said seventeen A2 units (22) and three live B1 units (7), CLAUDE.md said B1 19/32 (21),
 * and the instrument doc said B1.1–B1.6 was the shipped range (B1.1–B1.7). Every one of them had
 * been true when written, and nothing anywhere noticed them stop being true.
 *
 * So each claim below is parsed back out of the file and checked against the same function the
 * page uses. No new counting logic lives here on purpose: a second implementation could be wrong
 * in the same direction as the prose and agree with it. Failures name the command that re-derives
 * the number, because the fix is meant to be one paste.
 */

const root = resolve(import.meta.dir, '..');
const read = (file: string) => readFileSync(join(root, file), 'utf8');

/** README writes counts as words, the way its prose reads. Extend when a count outgrows this. */
const NUMERALS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  'twenty-one': 21,
  'twenty-two': 22,
  'twenty-three': 23,
  'twenty-four': 24,
  'twenty-five': 25,
};

function numeral(word: string): number {
  const value = NUMERALS[word.toLowerCase()];
  if (value === undefined) throw new Error(`README: "${word}" is not in the numeral table`);
  return value;
}

/**
 * The published numerator, matching the `## A1 grammar — 22/22` headline the script prints: a
 * point taught above its standard level is *taught*, and the report shows the split on the line
 * below rather than in the fraction. A1 is 17 covered + 5 late; comparing prose against `covered`
 * alone would demand the digest read 17/22 and contradict every other surface.
 */
const taught = (level: 'A1' | 'A2' | 'B1') => {
  const coverage = grammarCoverage(level);
  return { ...coverage, taught: coverage.covered + coverage.late };
};

/**
 * The B1 unit contract is a *plan*, not content: units B1.8–B1.14 have no files, so nothing on
 * disk can measure it. It is stated once here, against its source, and the README denominator is
 * held to it — the same reason `/about` prints no contract total at all.
 */
const B1_CONTRACTED_UNITS = 14; // docs/curriculum-a2-b1.md, frozen 2026-07-24

describe('published progress claims match the content', () => {
  test('README unit counts match the curriculum spine', () => {
    const readme = read('README.md');
    const { units } = getCurriculum();
    const count = (level: string) => units.filter((u) => u.level === level).length;

    const spine = /(\S+) A1 and (\S+) A2\s+units/.exec(readme);
    expect(spine).not.toBeNull();
    // Re-derive: bun -e 'const {getCurriculum}=await import("./src/lib/curriculum.ts");
    //   const c={}; for (const u of getCurriculum().units) c[u.level]=(c[u.level]??0)+1; console.log(c)'
    expect([numeral(spine![1]), numeral(spine![2])]).toEqual([count('A1'), count('A2')]);

    const b1 = /(\S+) of the (\S+) contracted B1 units\s+are live/.exec(readme);
    expect(b1).not.toBeNull();
    expect(numeral(b1![1])).toBe(count('B1'));
    expect(numeral(b1![2])).toBe(B1_CONTRACTED_UNITS);
  });

  test('the CLAUDE.md grammar digest matches the grammar-coverage instrument', () => {
    // "A1 22/22, A2 30/30, B1 21/32." — re-derive with `bun scripts/grammar-coverage.ts <level>`.
    const line = /A1 (\d+)\/(\d+), A2 (\d+)\/(\d+), B1 (\d+)\/(\d+)\./.exec(read('CLAUDE.md'));
    expect(line).not.toBeNull();
    const [, a1c, a1t, a2c, a2t, b1c, b1t] = line!.map(Number);
    for (const [level, stated, total] of [
      ['A1', a1c, a1t],
      ['A2', a2c, a2t],
      ['B1', b1c, b1t],
    ] as const) {
      const coverage = taught(level);
      expect([level, stated, total]).toEqual([level, coverage.taught, coverage.total]);
    }
  });

  test('the coverage-instruments B1 paragraph matches the instrument and the allowlist', () => {
    const doc = read('docs/coverage-instruments.md');
    const coverage = taught('B1');

    // "B1 has a real 32-point manifest, at 21/32 (66%) …"
    const figure = /B1 has a real (\d+)-point manifest, at (\d+)\/(\d+) \((\d+)%\)/.exec(doc);
    expect(figure).not.toBeNull();
    expect(figure!.slice(1).map(Number)).toEqual([
      coverage.total,
      coverage.taught,
      coverage.total,
      coverage.percent,
    ]);

    // "… with units B1.1–B1.7 shipped" — the shipped range, not the contract.
    const shipped = getCurriculum().units.filter((u) => u.level === 'B1').length;
    expect(doc).toContain(`with units B1.1–B1.${shipped} shipped`);

    // "(22 of the 35 tags the B1 points name are registered so far …)"
    const tags = new Set(
      loadGrammarInventory()
        .filter((p) => p.standard_level === 'B1')
        .flatMap((p) => p.focus ?? []),
    );
    const registered = [...tags].filter((tag) => tag in focusIntroducedBy).length;
    const named = /\((\d+) of the (\d+) tags the B1 points name are registered/.exec(doc);
    expect(named).not.toBeNull();
    expect(named!.slice(1).map(Number)).toEqual([registered, tags.size]);
  });
});
