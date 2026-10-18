import { describe, expect, test } from 'vitest';
import { befehlFuer, gewaehlt, naechste } from './warteschlange';

/**
 * The queue's movement rules. Two of them are about what must *not* happen.
 */

const reihe = ['a', 'b', 'c'];

describe('moving', () => {
  test('j and the down arrow step forward; k and up step back', () => {
    expect(naechste(reihe, 'a', 1)).toBe('b');
    expect(naechste(reihe, 'b', -1)).toBe('a');
  });

  test('it stops at both ends rather than wrapping', () => {
    // A `j` at the last row that lands on the first is a reviewer who has silently started the
    // queue again — the one mistake a surface built for 85 rows in a row must not make.
    expect(naechste(reihe, 'c', 1)).toBe('c');
    expect(naechste(reihe, 'a', -1)).toBe('a');
  });

  test('with nothing selected, the first key press still lands somewhere', () => {
    expect(naechste(reihe, undefined, 1)).toBe('a');
    expect(naechste(reihe, undefined, -1)).toBe('c');
  });

  test('an empty queue answers nothing rather than throwing', () => {
    expect(naechste([], undefined, 1)).toBeUndefined();
    expect(naechste([], 'a', -1)).toBeUndefined();
  });

  test('a selection the rows no longer contain falls back to the first row', () => {
    // Which is what happens when a filter is narrowed with a position held: not an error, and a
    // stale id would leave every key press a no-op with nothing on screen to explain it.
    expect(gewaehlt(reihe, 'weg')).toBe('a');
    expect(gewaehlt(reihe, 'b')).toBe('b');
    expect(gewaehlt([], 'b')).toBeUndefined();
  });
});

describe('which keys the queue takes', () => {
  test('j/k, the arrows and Enter', () => {
    expect(befehlFuer({ key: 'j' })).toBe('weiter');
    expect(befehlFuer({ key: 'ArrowDown' })).toBe('weiter');
    expect(befehlFuer({ key: 'k' })).toBe('zurueck');
    expect(befehlFuer({ key: 'ArrowUp' })).toBe('zurueck');
    expect(befehlFuer({ key: 'Enter' })).toBe('oeffnen');
    expect(befehlFuer({ key: 'x' })).toBeNull();
  });

  test('a key a control already owns is that control’s', () => {
    // The profile picker is a `<select>` on every unconverted row, and a queue that stole its
    // arrows would make the picker unusable from the keyboard it is meant to be driven from.
    expect(befehlFuer({ key: 'ArrowDown', target: { tagName: 'SELECT' } })).toBeNull();
    expect(befehlFuer({ key: 'Enter', target: { tagName: 'BUTTON' } })).toBeNull();
    expect(befehlFuer({ key: 'j', target: { tagName: 'TEXTAREA' } })).toBeNull();
    expect(befehlFuer({ key: 'j', target: { tagName: 'TD' } })).toBe('weiter');
  });

  test('any modifier hands the key back to the browser', () => {
    // ⌘↓ is "end of page". A queue that stole it would be a queue you cannot scroll out of.
    expect(befehlFuer({ key: 'ArrowDown', metaKey: true })).toBeNull();
    expect(befehlFuer({ key: 'j', ctrlKey: true })).toBeNull();
    expect(befehlFuer({ key: 'Enter', altKey: true })).toBeNull();
  });
});
