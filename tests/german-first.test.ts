/**
 * The German-first article (ADR 0005): what `germanFirstTopicProblems` holds a converted B1 topic
 * to, through `bun run validate`.
 *
 * Every case is the inline fixture below with one edit, never a real article — a test reading
 * `content/topics/b1/` would protect whatever those happen to say. `edit` throws when its target
 * is missing, so a fixture change cannot quietly turn a broken case into a copy of the valid one.
 */
import { describe, expect, test } from 'bun:test';
import { germanFirstTopicProblems, germanProse, isGermanFirst } from '@da/content/german-first';

const FIXTURE = `## Kurz gesagt

Das ist die Zusammenfassung auf Deutsch.

<Translation open>
<En>
This is the summary in German.
</En>
</Translation>

<Erklaerung>
<En>
The summary, written for an English reader.
</En>
<Ru>
Резюме для русского читателя.
</Ru>
</Erklaerung>

## Erklärung

### Die Regel

Die Regel steht hier.

| Kasus | Form |
| --- | --- |
| Nominativ | der Kollege |

<Translation>
<En>
The rule is here.
</En>
</Translation>

<Erklaerung>
<En>
The rule, explained in English.
</En>
<Ru>
Правило по-русски.
</Ru>
</Erklaerung>

## Beispiele

> **Das ist der neue Kollege.**

## Häufige Fehler

❌ *Ich spreche mit dem Kollege.* → ✅ *Ich spreche mit dem Kollegen.*
`;

function edit(source: string, from: string, to: string): string {
  if (!source.includes(from)) throw new Error(`fixture edit target missing: ${from}`);
  return source.replace(from, to);
}

describe('germanFirstTopicProblems', () => {
  test('the fixture is valid, and is recognised as German-first', () => {
    expect(isGermanFirst(FIXTURE)).toBe(true);
    expect(germanFirstTopicProblems(FIXTURE)).toEqual([]);
  });

  test('an article without the fold is not German-first', () => {
    expect(isGermanFirst('## Kurz gesagt\n\n<Bilingual><En>x</En></Bilingual>\n')).toBe(false);
  });

  test('a section with German prose and no Translation fails', () => {
    const broken = edit(
      FIXTURE,
      '<Translation>\n<En>\nThe rule is here.\n</En>\n</Translation>\n',
      '',
    );
    expect(germanFirstTopicProblems(broken)).toEqual([
      '"### Die Regel" closes with exactly one <Translation> and one <Erklaerung>, found 0 and 1',
    ]);
  });

  test('a section with German prose and no Erklaerung fails', () => {
    const broken = edit(
      FIXTURE,
      '<Erklaerung>\n<En>\nThe rule, explained in English.\n</En>\n<Ru>\nПравило по-русски.\n</Ru>\n</Erklaerung>\n',
      '',
    );
    expect(germanFirstTopicProblems(broken)).toEqual([
      '"### Die Regel" closes with exactly one <Translation> and one <Erklaerung>, found 1 and 0',
    ]);
  });

  test('the folds come last, Translation before Erklaerung', () => {
    const swapped = edit(
      FIXTURE,
      '<Translation>\n<En>\nThe rule is here.\n</En>\n</Translation>\n\n<Erklaerung>\n<En>\nThe rule, explained in English.\n</En>\n<Ru>\nПравило по-русски.\n</Ru>\n</Erklaerung>\n',
      '<Erklaerung>\n<En>\nThe rule, explained in English.\n</En>\n<Ru>\nПравило по-русски.\n</Ru>\n</Erklaerung>\n\n<Translation>\n<En>\nThe rule is here.\n</En>\n</Translation>\n',
    );
    expect(germanFirstTopicProblems(swapped)).toEqual([
      '"### Die Regel": the section ends <Translation> then <Erklaerung>, after the German they serve',
    ]);
  });

  test('only Kurz gesagt opens its Translation, and it must', () => {
    const second = edit(
      FIXTURE,
      '<Translation>\n<En>\nThe rule is here.',
      '<Translation open>\n<En>\nThe rule is here.',
    );
    expect(germanFirstTopicProblems(second)).toEqual([
      '"### Die Regel": only "## Kurz gesagt" opens its <Translation>',
    ]);
    const closed = edit(FIXTURE, '<Translation open>', '<Translation>');
    expect(germanFirstTopicProblems(closed)).toEqual([
      '"## Kurz gesagt": the summary\'s translation is <Translation open> — it is read in both languages at once',
    ]);
  });

  test('a stray Bilingual or De half fails', () => {
    const bilingual = edit(
      FIXTURE,
      'Die Regel steht hier.',
      'Die Regel steht hier.\n\n<Bilingual>\n<En>\nold\n</En>\n</Bilingual>',
    );
    expect(germanFirstTopicProblems(bilingual)[0]).toStartWith('1 <Bilingual> block(s)');
    const de = edit(FIXTURE, 'Die Regel steht hier.', '<De>\nDie Regel steht hier.\n</De>');
    expect(germanFirstTopicProblems(de)).toEqual([
      'a <De> half — in a German-first article the German is the body itself',
    ]);
  });

  test('an optional Translation half is all-or-none per file', () => {
    const ru = edit(
      FIXTURE,
      'This is the summary in German.\n</En>',
      'This is the summary in German.\n</En>\n<Ru>\nЭто резюме.\n</Ru>',
    );
    expect(germanFirstTopicProblems(ru)).toEqual([
      '"### Die Regel": its <Translation> has no <Ru> half — the optional halves are all-or-none per file',
    ]);
  });

  test('an untranslated stub fails', () => {
    const stub = edit(FIXTURE, 'The rule is here.', 'TODO');
    expect(germanFirstTopicProblems(stub)).toEqual([
      '"### Die Regel": its <Translation> is still a TODO stub — translate the German above it',
    ]);
  });

  test('the Erklaerung keeps its Russian half', () => {
    const noRu = edit(FIXTURE, '<Ru>\nПравило по-русски.\n</Ru>\n', '');
    expect(germanFirstTopicProblems(noRu)).toEqual([
      '"### Die Regel": its <Erklaerung> has no <Ru> half',
    ]);
  });

  test('a section with only tables or examples takes no fold', () => {
    const folded = edit(
      FIXTURE,
      '> **Das ist der neue Kollege.**\n',
      '> **Das ist der neue Kollege.**\n\n<Translation>\n<En>\nx\n</En>\n</Translation>\n',
    );
    expect(germanFirstTopicProblems(folded)).toEqual([
      '"## Beispiele" has a fold but no German prose to go with it',
    ]);
  });

  test('Cyrillic in the German body fails', () => {
    const leak = edit(FIXTURE, 'Die Regel steht hier.', 'Die Regel steht hier (падеж).');
    expect(germanFirstTopicProblems(leak)).toEqual([
      'Cyrillic outside a <Ru>/<Uk> half: "Die Regel steht hier (падеж)."',
    ]);
  });

  test('the paragraph cap covers the German body', () => {
    const wall = edit(
      FIXTURE,
      'Die Regel steht hier.',
      Array.from({ length: 130 }, () => 'Wort').join(' '),
    );
    const problems = germanFirstTopicProblems(wall);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toStartWith('German body, paragraph 2: 130 words (max 120)');
  });
});

describe('germanProse', () => {
  test('keeps prose, drops tables, examples, error lines and folds', () => {
    const section = edit(FIXTURE, '## Kurz gesagt', '');
    const prose = germanProse(
      section.slice(
        section.indexOf('### Die Regel') + '### Die Regel'.length,
        section.indexOf('## Beispiele'),
      ),
    );
    expect(prose).toBe('Die Regel steht hier.');
    expect(germanProse('\n> **Beispiel.**\n\n❌ *falsch* → ✅ *richtig*\n')).toBe('');
  });
});
