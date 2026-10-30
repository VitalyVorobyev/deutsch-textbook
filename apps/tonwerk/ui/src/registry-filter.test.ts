import { describe, expect, test } from 'vitest';
import {
  ANY,
  NO_FILTER,
  STUDIO,
  laengeImFenster,
  levelsOf,
  matches,
  overCount,
  sammlungOf,
  sammlungen,
  selectRows,
  snippet,
  statusCounts,
  type RegistryFilter,
} from './registry-filter';
import type { RegistryRow } from './contracts';
import { bibliothekFixture, registryFixture } from './test/fixtures';

const rows = registryFixture.rows as unknown as RegistryRow[];

/**
 * The registry's filter is the one piece of logic in this app whose failure is invisible: a dropped
 * row looks exactly like a plan that never contained it, and the point of a registry is to show
 * what you would not have known to look for.
 */

describe('slicing', () => {
  test('no filter keeps every row', () => {
    expect(selectRows(rows, { ebene: ANY, status: ANY, art: ANY })).toHaveLength(3);
  });

  test('the level filter is case-insensitive, because the two row families disagree', () => {
    // Listening rows carry the level as it is written in the plan (`A1`); reading sources carry
    // whatever `load_reading_sources` read. A case-sensitive compare would silently empty the table
    // for one of the two families and look like a filter that works.
    const upper = selectRows(rows, { ebene: 'A1', status: ANY, art: ANY });
    const lower = selectRows(rows, { ebene: 'a1', status: ANY, art: ANY });
    expect(upper.map((row) => row.id)).toEqual(lower.map((row) => row.id));
    expect(upper).toHaveLength(2);
  });

  test('the kind filter separates Hörszenen from Lesetexten', () => {
    expect(
      selectRows(rows, { ebene: ANY, status: ANY, art: 'reading' }).map((row) => row.id),
    ).toEqual(['a1/erste-schritte']);
  });

  test('filters compose, and an empty result is a legitimate answer', () => {
    expect(selectRows(rows, { ebene: 'B1', status: 'stale', art: 'listening' })).toEqual([]);
  });

  test('matches() agrees with selectRows() row by row', () => {
    const filter = { ebene: 'A2', status: 'stale', art: 'listening' };
    expect(rows.filter((row) => matches(row, filter)).map((row) => row.id)).toEqual(
      selectRows(rows, filter).map((row) => row.id),
    );
  });
});

describe('ordering', () => {
  test('the most alarming row is first, and `published` is last', () => {
    // The registry is opened to find what is wrong. Sorting by id would make the reader do the
    // scanning the sort should have done.
    expect(
      selectRows(rows, { ebene: ANY, status: ANY, art: ANY }).map((row) => row.status),
    ).toEqual(['stale', 'planned', 'published']);
  });

  test('a status this build does not know sorts to the top rather than the bottom', () => {
    const seltsam: RegistryRow = { ...rows[0]!, id: 'ls-neu', status: 'quarantined' };
    expect(selectRows([...rows, seltsam], { ebene: ANY, status: ANY, art: ANY })[0]?.id).toBe(
      'ls-neu',
    );
  });
});

describe('the Pegel’s numbers', () => {
  test('every pipeline status keeps its place on the scale, even at zero', () => {
    // A meter whose marks move is not a meter: the reader learns where `approved` sits and expects
    // it to stay there when the count is 0.
    expect(statusCounts(rows).map((entry) => entry.status)).toEqual([
      'planned',
      'drafted',
      'qa_failed',
      'awaiting_approval',
      'approved',
      'published',
    ]);
    expect(statusCounts(rows).map((entry) => entry.count)).toEqual([1, 0, 0, 0, 0, 1]);
  });

  test('`stale` is counted off the scale', () => {
    expect(statusCounts(rows).some((entry) => entry.status === 'stale')).toBe(false);
    expect(overCount(rows)).toBe(1);
  });

  test('an unrecognised status is appended rather than dropped', () => {
    const seltsam: RegistryRow = { ...rows[0]!, id: 'ls-neu', status: 'quarantined' };
    const counts = statusCounts([...rows, seltsam]);
    expect(counts.at(-1)).toEqual({ status: 'quarantined', count: 1 });
  });
});

describe('the level list', () => {
  test('levels come from the data, in curriculum order', () => {
    expect(levelsOf(rows)).toEqual(['A1', 'A2']);
  });

  test('a level the curriculum order does not know is kept, at the end', () => {
    const row: RegistryRow = { ...rows[0]!, level: 'A0' };
    expect(levelsOf([...rows, row])).toEqual(['A1', 'A2', 'A0']);
  });
});

describe('the library', () => {
  const library = bibliothekFixture.rows as unknown as RegistryRow[];
  const ids = (filter: Partial<RegistryFilter>) =>
    selectRows(library, { ...NO_FILTER, ...filter }).map((row) => row.id);

  test('a row belongs to its exam set, its unit, its topic, or the studio', () => {
    const owner = Object.fromEntries(library.map((row) => [row.id, sammlungOf(row)]));
    expect(owner['ls-pruefung-a2-1-hoeren-04']).toBe('pruefung-a2-1-hoeren');
    expect(owner['ls-wohnen-01']).toBe('A1.4');
    expect(owner['a1/erste-schritte']).toBe('erste-schritte');
    expect(owner['ls-wohnen-01-v2']).toBe(STUDIO);
    // Exam sets first, the studio last.
    const order = sammlungen(library);
    expect(order[0]).toBe('pruefung-a2-1-hoeren');
    expect(order.at(-1)).toBe(STUDIO);
    expect(ids({ sammlung: 'pruefung-a2-1-hoeren' })).toEqual(['ls-pruefung-a2-1-hoeren-04']);
  });

  test('an archived studio scene is hidden unless asked for; a planned row never is', () => {
    expect(ids({})).not.toContain('ls-probe-alt');
    expect(ids({ archiv: true })).toContain('ls-probe-alt');
    const archivedPlan = { ...library[0]!, project: { ...library[0]!.project!, archived: true } };
    expect(selectRows([archivedPlan], NO_FILTER)).toHaveLength(1);
  });

  test('every search word must occur, in any case, in what the row says or is called', () => {
    expect(ids({ suche: 'GLEIS würzburg' })).toEqual(['ls-pruefung-a2-1-hoeren-04']);
    expect(ids({ suche: 'gleis paris' })).toEqual([]);
    expect(ids({ suche: 'teil1-zug' })).toEqual(['ls-pruefung-a2-1-hoeren-04']);
    expect(ids({ suche: '  ' })).toHaveLength(ids({}).length);
  });

  test('a snippet is the text around the hit, trimmed at both ends', () => {
    const row = library.find((r) => r.id === 'ls-pruefung-a2-1-hoeren-04')!;
    expect(snippet(row, 'würzburg', 10)).toBe('…ress nach Würzburg hat heute…');
    expect(snippet(row, 'teil1-zug')).toBeNull();
  });

  test('a published length is judged against the window the plan asked for', () => {
    const row = (duration: number | null) =>
      ({ ...library[0]!, window: [20, 30], duration_seconds: duration }) as RegistryRow;
    expect(laengeImFenster(row(19))).toBe('kurz');
    expect(laengeImFenster(row(20))).toBe('passt');
    expect(laengeImFenster(row(31))).toBe('lang');
    expect(laengeImFenster(row(null))).toBeNull();
  });
});
