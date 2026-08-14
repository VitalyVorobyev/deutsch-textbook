/**
 * The item-mix bar counts written formats, and `audio-comprehension` is on neither side of it.
 *
 * The rule lives in `scripts/validate.ts` (search `practiceItems`), which is a script and cannot
 * be imported, so these tests pin the *corpus* against the same arithmetic rather than calling
 * the validator. That is enough to catch the drift they exist for: the bar was written when no
 * listening item was attached to a topic, and it counted `audio-comprehension` in the
 * denominator while `selection` counted only `mc + match + order`. Every recorded item therefore
 * bought a topic more room for written recognition — publishing the 41-recording corpus would
 * have loosened the selection cap on 38 of 41 topics and the mc cap on 27, with no gate saying so.
 *
 * The second test is the one that matters. It asserts the exclusion is *load-bearing* — that
 * there really are topics whose two denominators differ — so this file cannot quietly become a
 * tautology on a corpus where no practice set owns audio.
 */
import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';

const LEVELS = ['a1', 'a2', 'b1'] as const;
const MAX_SELECTION_PERCENT = 45;
const SELECTION = new Set(['mc', 'match', 'order']);

interface Item {
  type: string;
}

const sets = new Map<string, { role?: string; items?: Item[] }>();
for (const level of LEVELS) {
  const dir = join('content/exercises', level);
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.yaml')) continue;
    sets.set(`${level}/${name.replace(/\.yaml$/, '')}`, YAML.parse(readFileSync(join(dir, name), 'utf8')));
  }
}

/** Every item in every `role: practice` set a topic lists, in the validator's order. */
function practiceItems(level: string, topic: string): Item[] {
  const manifest = YAML.parse(
    readFileSync(join('content/topics', level, `${topic}.topic.yaml`), 'utf8'),
  ) as { elements?: { exercises?: string[] } };
  return (manifest.elements?.exercises ?? [])
    .filter((ref) => sets.get(ref)?.role === 'practice')
    .flatMap((ref) => sets.get(ref)!.items ?? []);
}

const topics = LEVELS.flatMap((level) =>
  readdirSync(join('content/topics', level))
    .filter((name) => name.endsWith('.topic.yaml'))
    .map((name) => {
      const id = name.replace(/\.topic\.yaml$/, '');
      const all = practiceItems(level, id);
      return {
        id: `${level}/${id}`,
        all,
        written: all.filter((item) => item.type !== 'audio-comprehension'),
      };
    })
    .filter((t) => t.all.length > 0),
);

describe('the item-mix bar counts written formats only', () => {
  test('every topic clears both caps against its written items', () => {
    const over: string[] = [];
    for (const { id, written } of topics) {
      if (written.length === 0) continue;
      const mc = written.filter((item) => item.type === 'mc').length;
      const selection = written.filter((item) => SELECTION.has(item.type)).length;
      if (mc * 3 > written.length) over.push(`${id}: ${mc}/${written.length} mc`);
      if (selection * 100 > written.length * MAX_SELECTION_PERCENT)
        over.push(`${id}: ${selection}/${written.length} selection`);
    }
    expect(over).toEqual([]);
  });

  test('excluding audio-comprehension actually changes the denominator somewhere', () => {
    // If this ever reads zero, the test above proves nothing and the validator's exclusion has
    // no corpus behind it — either listening items left the practice sets, or the filter did.
    const loosened = topics.filter(
      ({ all, written }) =>
        Math.floor((written.length * MAX_SELECTION_PERCENT) / 100) <
        Math.floor((all.length * MAX_SELECTION_PERCENT) / 100),
    );
    expect(loosened.length).toBeGreaterThan(0);
  });
});
