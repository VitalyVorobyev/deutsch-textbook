/**
 * A dictation whose text spells a number has to say so.
 *
 * `listen` items are scored on spelling — `normalizeDictation` strips punctuation but keeps
 * case and digits — so `04879` for `null vier acht sieben neun` and `um 6 Uhr` for `um sechs
 * Uhr` are misses. The validator has always forbidden the AUTHOR from writing digits in a
 * `listen` text ("write numbers as words so audio and answer agree"); nothing told the LEARNER,
 * and thirteen shipped items carried that trap until the learner walked into the phone-number
 * one and reported, fairly, that it was not obvious.
 *
 * The rule itself lives in `scripts/validate.ts` (search `NUMBER_WORDS`), which is a script and
 * cannot be imported, so this file pins the corpus against the same arithmetic. The second test
 * is the one that keeps it honest: it asserts the rule is load-bearing (some dictation really
 * does spell a number) and that the cardinal list does not fire on `ein`/`eine`, which are
 * articles far more often than numbers — a regex that matched them would demand the clause on
 * every dictation and the rule would be noise.
 */
import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';

const NUMBER_WORDS =
  /\b(null|eins|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|elf|zwölf|dreizehn|vierzehn|fünfzehn|sechzehn|siebzehn|achtzehn|neunzehn|zwanzig|dreißig|vierzig|fünfzig|sechzig|siebzig|achtzig|neunzig|hundert|tausend)\b/i;
const NUMBER_CLAUSE = { en: /numbers?\b[^.]*\bwords\b/i, ru: /словами/i, uk: /словами/i } as const;

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : path.endsWith('.yaml') ? [path] : [];
  });

interface ListenItem {
  id: string;
  type: string;
  text?: string;
  instruction?: { en?: string; ru?: string; uk?: string };
}

const dictations: Array<{ ref: string; item: ListenItem }> = [];
for (const file of walk('content/exercises')) {
  const set = YAML.parse(readFileSync(file, 'utf8')) as { items?: ListenItem[] };
  for (const item of set?.items ?? [])
    if (item.type === 'listen') dictations.push({ ref: `${file}:${item.id}`, item });
}

const numeric = dictations.filter(({ item }) => NUMBER_WORDS.test(item.text ?? ''));

describe('dictations that spell a number', () => {
  test('say so in every instruction language', () => {
    const silent = numeric.flatMap(({ ref, item }) =>
      (['en', 'ru', 'uk'] as const)
        .filter((lang) => !NUMBER_CLAUSE[lang].test(item.instruction?.[lang] ?? ''))
        .map((lang) => `${ref} (${lang})`),
    );
    expect(silent).toEqual([]);
  });

  test('the rule is load-bearing, and the cardinal list ignores the article ein', () => {
    // Some dictation really does spell a number, or the test above is a tautology.
    expect(numeric.length).toBeGreaterThanOrEqual(10);
    // …and not every dictation does, or the clause would just be boilerplate.
    expect(numeric.length).toBeLessThan(dictations.length);
    for (const text of ['Ich habe einen Apfel und ein Brot.', 'Er isst ein Brötchen.', 'Er kauft am Samstag ein.'])
      expect(NUMBER_WORDS.test(text)).toBe(false);
    expect(NUMBER_WORDS.test('Meine Telefonnummer ist null vier acht sieben neun.')).toBe(true);
  });
});
