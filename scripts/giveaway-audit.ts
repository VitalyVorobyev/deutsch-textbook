/**
 * Items whose answer is printed on the screen that asks for it.
 *
 * Every gate can pass on such an item: a cloze whose gaps spell a name already written beside
 * them (`Lena: {{L}} – {{E}} – {{N}} – {{A}}`), a gap whose hint is its answer, an mc whose
 * correct option is quoted in its stem. A translate item naming its graded word in the
 * instruction is not on the list: the item rules require exactly that for a connector or a
 * lexical verb, and the item still grades where the word goes. The learner scores
 * a copy as a retrieval. This lists the candidates; it decides nothing, because a repeated word
 * is often legitimate (a model sentence before the gap, a contrast pair), so every hit is read.
 *
 *   bun scripts/giveaway-audit.ts [--level a1|a2|b1]
 *
 * Read-only. Exits 0 whatever it finds.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import YAML from 'yaml';

type Texts = Record<string, string | undefined> | string | undefined;
interface Item {
  id: string;
  type: string;
  text?: string;
  prompt?: Texts;
  prompt_en?: string;
  prompt_ru?: string;
  prompt_uk?: string;
  instruction?: Texts;
  translation?: Texts;
  key_tokens?: string[];
  options?: string[];
  correct?: number;
}

const root = join(import.meta.dir, '..');
const base = join(root, 'content', 'exercises');
const levelArg = process.argv.indexOf('--level');
const level = levelArg > 0 ? process.argv[levelArg + 1] : undefined;

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (name.endsWith('.yaml')) yield path;
  }
}

const flatten = (value: Texts): string[] =>
  value === undefined
    ? []
    : typeof value === 'string'
      ? [value]
      : Object.values(value).filter((v): v is string => !!v);

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Whole-word, case-insensitive: "Arbeit" is in "zur Arbeit", not in "Arbeitszeit". */
const containsWord = (haystack: string, needle: string) =>
  new RegExp(`(?<!\\p{L})${escape(needle)}(?!\\p{L})`, 'iu').test(haystack);

interface Hit {
  file: string;
  id: string;
  rule: string;
  detail: string;
}
const hits: Hit[] = [];

for (const file of walk(base)) {
  const rel = relative(base, file).replace(/\.yaml$/, '');
  if (level && !rel.startsWith(`${level}/`)) continue;
  const doc = YAML.parse(readFileSync(file, 'utf8')) as { items?: Item[] };
  for (const item of doc.items ?? []) {
    const shown = [...flatten(item.instruction), ...flatten(item.translation)];
    if (item.type === 'cloze' && item.text) {
      const answers = [...item.text.matchAll(/\{\{([^}]+)\}\}/g)].map((m) =>
        m[1]!.split('|')[0]!.trim(),
      );
      const visible = [item.text.replace(/\{\{[^}]+\}\}/g, ' '), ...shown].join(' \n ');
      // The gaps together spell or form a word that is printed (the L-E-N-A case).
      if (answers.length > 1) {
        const joined = answers.join('');
        if (joined.length >= 3 && containsWord(visible, joined))
          hits.push({
            file: rel,
            id: item.id,
            rule: 'cloze-joined',
            detail: `gaps join to “${joined}”, which is printed`,
          });
      }
      // One gap whose exact answer is printed on the item and is the only candidate printed: a
      // hint "(arbeiten)" over a gap whose answer is arbeiten. A choice cloze printing both
      // options (weil oder denn) is a choice, not a giveaway, and is skipped; short function
      // words (der, am, zu) repeat legitimately and are not read.
      const choice =
        /\b(oder|or)\b|\s(или|або)\s|\s\/\s/iu.test(shown.join(' ')) ||
        /\(([^)]*)\/|\boder\b/u.test(item.text);
      if (!choice)
        for (const answer of new Set(answers)) {
          if (answer.length < 4) continue;
          if (containsWord(visible, answer))
            hits.push({
              file: rel,
              id: item.id,
              rule: 'cloze-printed',
              detail: `gap answer “${answer}” is printed on the item`,
            });
        }
    }
    if (item.type === 'mc' && item.options && item.correct !== undefined) {
      const stem = [...flatten(item.prompt), ...shown].join(' \n ');
      const right = item.options[item.correct];
      const others = item.options.filter((_, i) => i !== item.correct);
      if (
        right &&
        right.length >= 3 &&
        containsWord(stem, right) &&
        !others.some((o) => containsWord(stem, o))
      )
        hits.push({
          file: rel,
          id: item.id,
          rule: 'mc-answer-in-stem',
          detail: `correct option “${right}” is quoted in the stem, no distractor is`,
        });
    }
  }
}

const byRule = new Map<string, Hit[]>();
for (const hit of hits) byRule.set(hit.rule, [...(byRule.get(hit.rule) ?? []), hit]);
console.log(`# Giveaway audit${level ? ` — ${level.toUpperCase()}` : ''}\n`);
console.log(
  `${hits.length} candidate(s). Every one is read before anything changes: a repeat is often deliberate.\n`,
);
for (const [rule, list] of byRule) {
  console.log(`## ${rule} (${list.length})\n`);
  for (const hit of list) console.log(`- \`${hit.file}:${hit.id}\` — ${hit.detail}`);
  console.log('');
}
