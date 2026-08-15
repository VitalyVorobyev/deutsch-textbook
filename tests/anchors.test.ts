/**
 * The anchor dimensions, held to the two things that must never silently drift.
 *
 * `bun scripts/structures.ts` and `bun scripts/handlungen.ts` are dev reports — nobody runs them in
 * CI, and a citation that stopped resolving would print one line in a report nobody read. These are
 * the assertions that make the reports' invariants part of the gate.
 */
import { describe, expect, test } from 'bun:test';
import { structureCoverage } from '@da/content/structures';
import { handlungCoverage } from '@da/content/handlungen';
import { themaCoverage } from '@da/content/themen';
import { loadAnchorSources } from '@da/content/anchors';
import { LEVELS } from '@da/schema';

describe('inventory anchors', () => {
  /**
   * A `claims:` ref naming a source or key that does not exist is always a defect, in either
   * direction: a renamed entry key orphans every citation of it, and a typo'd ref means a row
   * believes it is anchored when nothing anchors it. The report prints these; nothing failed on
   * them until this existed.
   */
  test('every claim resolves to a real source entry, in both dimensions', () => {
    for (const level of LEVELS) {
      expect(structureCoverage(level).dangling).toEqual([]);
      expect(handlungCoverage(level).dangling).toEqual([]);
      expect(themaCoverage(level).dangling).toEqual([]);
    }
  });

  /**
   * Ratchets on measured reality, the `grammar-depth.test.ts` pattern: today's figures pinned so
   * they may only improve. Raising one is a commit that added a citation or shipped a topic.
   *
   * B1 was `anchored: false` until the DTZ Prüfungshandbuch landed on 2026-08-14 — its own
   * Prüfungsziele is a book, and the free A1/A2 inventories stop below it.
   */
  test('structure coverage does not fall', () => {
    expect(structureCoverage('A1').percent).toBeGreaterThanOrEqual(100);
    expect(structureCoverage('A2').percent).toBeGreaterThanOrEqual(100);
    expect(structureCoverage('B1').anchored).toBe(true);
    expect(structureCoverage('B1').percent).toBeGreaterThanOrEqual(100);
  });

  /**
   * The original DTZ tail closed only after all eight teaching slices had exact article,
   * scaffold, transfer and delayed-probe evidence. This ratchet prevents an edited source list or
   * removed claim from quietly reopening either cumulative denominator.
   */
  test('the cumulative DTZ inventory has no unclaimed tail', () => {
    expect(structureCoverage('A2').unclaimed).toEqual([]);
    expect(structureCoverage('B1').unclaimed).toEqual([]);
  });

  /**
   * 63%, and nine of the fifteen holes are the whole of §8.3 Redeorganisation — this course teaches
   * a learner to build sentences and never to manage a conversation (backlog P26-10). The floor is
   * deliberately today's number and not a target: closing that block is authoring work, and a
   * threshold invented here would either be met by accident or ignored.
   */
  test('Sprachhandlung coverage does not fall', () => {
    expect(handlungCoverage('A2').percent).toBeGreaterThanOrEqual(68);
    expect(handlungCoverage('B1').percent).toBeGreaterThanOrEqual(68);
    // A1 has no handlung source: the DTZ starts at A2. `anchored: false` must stay distinguishable
    // from 0% — "nothing unclaimed" and "nothing measurable" print the same zero.
    expect(handlungCoverage('A1').anchored).toBe(false);
  });

  /**
   * 84%, and the eleven holes are the point: no topic is about Unfall, Polizei, Versicherungen,
   * Kinderbetreuung or Klima/Wetter. Today's number, not a target — and deliberately a floor rather
   * than an equality, because the honest way to raise it is to author a topic, while the dishonest
   * way is to add a claim to a topic that does not teach the theme. The floor rewards neither.
   */
  test('Thema coverage does not fall', () => {
    expect(themaCoverage('A2').percent).toBeGreaterThanOrEqual(100);
    expect(themaCoverage('B1').percent).toBeGreaterThanOrEqual(100);
    // The DTZ starts at A2, exactly as for Sprachhandlungen.
    expect(themaCoverage('A1').anchored).toBe(false);
  });

  /**
   * `audience` was documentation until it wasn't: A2 read 138/138 = 100% for a day against *Fit in
   * Deutsch 2*, the exam for teenagers, and nothing in the report said so. This course is for an
   * adult, so at least one current adult source must cover every level the course claims to teach.
   */
  test('every anchored level has a current source for adults', () => {
    for (const dimension of ['struktur', 'handlung'] as const) {
      for (const source of loadAnchorSources(dimension)) {
        expect(source.source.levels.length).toBeGreaterThan(0);
        // Every source says who sits it and what it governs — never assumed from the level.
        expect(typeof source.source.audience === 'string' || source.source.status === 'retired').toBe(true);
      }
    }
    // *Anchored* levels only, and the distinction is the point: B2 has no source at all, because
    // Goethe delegates its inventory to a book. Asserting over every level would turn one
    // unbought document into a failing test, which is the blind-spot-as-finding mistake
    // `anchored: false` exists to prevent.
    const anchored = LEVELS.map((level) => structureCoverage(level)).filter((c) => c.anchored);
    expect(anchored.length).toBeGreaterThan(0);
    for (const coverage of anchored) {
      const adult = coverage.sources.filter(
        (s) => s.status !== 'retired' && /erwachsene/i.test(s.audience ?? ''),
      );
      expect([coverage.level, adult.length > 0]).toEqual([coverage.level, true]);
    }
  });
});
