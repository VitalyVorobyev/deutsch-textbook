import { describe, expect, test } from 'bun:test';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { modulAnker, praxisSet, teile, uebungssaetze } from '../src/lib/exam-practice';

/**
 * The level page arranges the course's exam-format sets by Übungssatz, Modul and Teil, all read
 * off ids. Each fixture states the ids its assertion reads.
 */

const set = (id: string, items: string[] = []) => ({
  id,
  data: { items: items.map((i) => ({ id: i })) },
});

describe('Übungssatz and Modul from a set id', () => {
  test('a numbered set, an unnumbered one, and a set that is not exam practice', () => {
    expect(praxisSet('a2/pruefung-a2-2-hoeren')).toEqual({ nummer: 2, modul: 'hoeren' });
    expect(praxisSet('a1/pruefung-a1-lesen')).toEqual({ nummer: null, modul: 'lesen' });
    expect(praxisSet('a2/perfekt-ueben')).toBeNull();
  });

  test('sets are grouped by number, and each group is in the exam order of modules', () => {
    const saetze = uebungssaetze([
      set('a2/pruefung-a2-2-schreiben'),
      set('a2/pruefung-a2-1-hoeren'),
      set('a2/pruefung-a2-2-lesen'),
      set('a2/pruefung-a2-1-schreiben'),
      set('a2/pruefung-a2-1-lesen'),
      set('a2/kein-pruefungsset'),
    ]);
    expect(saetze.map((s) => [s.nummer, s.module.map((m) => m.modul)])).toEqual([
      [1, ['lesen', 'hoeren', 'schreiben']],
      [2, ['lesen', 'schreiben']],
    ]);
  });

  test('every exam-practice set in the corpus is placed, none dropped by the pattern', () => {
    const root = join(import.meta.dir, '..', 'content', 'exercises');
    const ids = readdirSync(root).flatMap((level) =>
      readdirSync(join(root, level))
        .filter((file) => file.startsWith('pruefung-') && file.endsWith('.yaml'))
        .map((file) => `${level}/${file.replace(/\.yaml$/, '')}`),
    );
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(praxisSet(id)).not.toBeNull();
  });
});

describe('Teile from item ids', () => {
  test('contiguous runs of teilN- items, bis exclusive', () => {
    expect(teile([{ id: 'teil1-a' }, { id: 'teil1-b' }, { id: 'teil2-a' }])).toEqual([
      { teil: 1, von: 0, bis: 2 },
      { teil: 2, von: 2, bis: 3 },
    ]);
  });

  test('a set whose items carry no Teil has none, even if one item does', () => {
    expect(teile([{ id: 'lesen-1' }, { id: 'lesen-2' }])).toBeNull();
    expect(teile([{ id: 'teil1-a' }, { id: 'lesen-2' }])).toBeNull();
    expect(teile([])).toBeNull();
  });

  test('the fragment names the set without its level directory', () => {
    expect(modulAnker('a2/pruefung-a2-3-lesen')).toBe('uebung-pruefung-a2-3-lesen');
  });
});
