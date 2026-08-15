import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { contentGraph } from '@da/content/graph';
import { getCurriculum } from '@da/content/curriculum';
import { goetheCoverage } from '@da/content/coverage';
import { grammarCoverage, loadGrammarInventory, productionLevel } from '@da/content/grammar-coverage';
import { focusIntroducedBy } from '@da/content/focus-tags';

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
 * The B1 unit contract is a *plan*, not content: units B1.8–B1.14 have no files, so nothing on
 * disk can measure it — which is why `/about` prints no contract total at all and the README does.
 *
 * Its denominator is still not a constant to be copied here. A hard-coded 14 in this file would be
 * a second copy of exactly the claim that went stale, free to rot in step with the README while
 * the tripwire stayed green — the contract has already been amended once, from ten. So the total
 * is counted off the unit sections of the frozen contract itself, and the sequence is checked for
 * gaps and duplicates so a malformed heading cannot quietly lower it.
 */
function contractedB1Units(): number {
  const headings = [...read('docs/curriculum/a2-b1.md').matchAll(/^### B1\.(\d+) · /gm)].map((m) =>
    Number(m[1]),
  );
  expect(headings).toEqual(headings.map((_, i) => i + 1));
  return headings.length;
}

describe('published progress claims match the content', () => {
  test('README unit counts match the curriculum spine', () => {
    const readme = read('README.md');
    const { units } = getCurriculum();
    const count = (level: string) => units.filter((u) => u.level === level).length;

    const spine = /(\S+) A1 and (\S+) A2\s+units/.exec(readme);
    expect(spine).not.toBeNull();
    // Re-derive: bun -e 'const {getCurriculum}=await import("./packages/content/src/curriculum.ts");
    //   const c={}; for (const u of getCurriculum().units) c[u.level]=(c[u.level]??0)+1; console.log(c)'
    expect([numeral(spine![1]), numeral(spine![2])]).toEqual([count('A1'), count('A2')]);

    const b1 = /(\S+) of the (\S+) contracted B1 units\s+are live/.exec(readme);
    expect(b1).not.toBeNull();
    expect(numeral(b1![1])).toBe(count('B1'));
    expect(numeral(b1![2])).toBe(contractedB1Units());
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
      const coverage = grammarCoverage(level);
      expect([level, stated, total]).toEqual([level, coverage.taught, coverage.total]);
    }
  });

  /**
   * The headline sentence of the project index is a published figure and had no guard, which is
   * exactly how it went on saying "B1 Wortliste coverage stands at 3343/3416 (98%), and the 73 open
   * rows are cardless" for the nine days after P27-3f closed the tail at 3416/3416. The grammar
   * digest one screen below it *was* guarded and stayed correct the whole time — one claim in a
   * paragraph being checked does not protect its neighbours.
   */
  test('the CLAUDE.md Wortliste headline matches the coverage instrument', () => {
    // "Wortliste 673/673 · 1449/1449 · 3416/3416" — re-derive with `bun scripts/coverage.ts <level>`.
    const line = /Wortliste (\d+)\/(\d+) · (\d+)\/(\d+) · (\d+)\/(\d+)/.exec(read('CLAUDE.md'));
    expect(line).not.toBeNull();
    const [, a1c, a1t, a2c, a2t, b1c, b1t] = line!.map(Number);
    for (const [level, stated, total] of [
      ['A1', a1c, a1t],
      ['A2', a2c, a2t],
      ['B1', b1c, b1t],
    ] as const) {
      const c = goetheCoverage(level);
      expect([level, stated, total]).toEqual([level, c.cards + c.grammar, c.total]);
    }
    // 30s, not the 5s default: `goetheCoverage` re-reads and re-parses all 129 vocab decks twice
    // and the entire taught surface once, per level — ~1.2 s locally and past 3 s on CI, three
    // times over. That is the layering defect P27-4 fixes (the function should read the already
    // built ContentGraph), not a slow test. Drop this argument once it does.
  }, 30_000);

  /**
   * `handlungen.ts` reports "N/192 outcomes cite a published Sprachhandlung", and CLAUDE.md states
   * the denominator in prose. A new topic adds outcomes, so this number moves whenever content
   * ships — which is precisely the kind of figure that rots unwatched.
   */
  test('the CLAUDE.md outcome count matches the corpus', () => {
    const line = /do the (\d+) `outcomes` contain/.exec(read('CLAUDE.md'));
    expect(line).not.toBeNull();
    const outcomes = [...contentGraph().topics.values()].reduce(
      (n, t) => n + (t.data.outcomes?.length ?? 0),
      0,
    );
    expect(Number(line![1])).toBe(outcomes);
  });

  test('the coverage-instruments B1 paragraph matches the instrument and the allowlist', () => {
    const doc = read('docs/authoring/coverage-instruments.md');
    const coverage = grammarCoverage('B1');

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
    // `standard_level` was replaced by `level: {reception, production}` on 2026-08-14, and this
    // filter silently matched nothing afterwards — a test that reads a field the data no longer
    // has does not fail loudly, it just stops testing. Use the accessor the instruments use.
    const tags = new Set(
      loadGrammarInventory()
        .filter((p) => productionLevel(p) === 'B1')
        .flatMap((p) => p.focus ?? []),
    );
    const registered = [...tags].filter((tag) => tag in focusIntroducedBy).length;
    const named = /\((\d+) of the (\d+) tags the B1 points name are registered/.exec(doc);
    expect(named).not.toBeNull();
    expect(named!.slice(1).map(Number)).toEqual([registered, tags.size]);
  });
});
