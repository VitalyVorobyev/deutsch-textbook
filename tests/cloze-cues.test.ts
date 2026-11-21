/**
 * A cloze gap of three or more words must be cued (packages/content/src/cloze-cues.ts, enforced
 * by `bun run validate`). Every fixture states the text, instruction and translation the verdict
 * depends on; none reads the corpus.
 */
import { describe, expect, test } from 'bun:test';
import { clozeCueProblems, phraseGaps } from '@da/content/cloze-cues';

describe('phrase gaps must be cued', () => {
  test('an uncued three-word gap fails, naming the gap and the repair', () => {
    const problems = clozeCueProblems({ text: 'Die Reparatur hat {{über drei Tage}} gedauert.' });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('{{über drei Tage}}');
    expect(problems[0]).toContain('3-word');
    expect(problems[0]).toContain('name the base words in brackets after the sentence');
  });

  test('a bracket naming the base words after the sentence cues it', () => {
    const item = { text: 'Die Reparatur hat {{über drei Tage}} gedauert. (über + drei Tage)' };
    expect(clozeCueProblems(item)).toEqual([]);
    expect(phraseGaps(item)[0]!.cues).toEqual(['bracket']);
  });

  test('a bracket in base form cues the inflected phrase', () => {
    expect(
      clozeCueProblems({
        text: 'Der Onlinekurs ist {{meiner Meinung nach}} zu schnell. (nach + meine Meinung)',
      }),
    ).toEqual([]);
    expect(
      clozeCueProblems({ text: 'Wir gehen {{um den Park herum}}. (um … herum + der Park)' }),
    ).toEqual([]);
  });

  test('a bracket that names a different gap does not cue this one', () => {
    const problems = clozeCueProblems({
      text: 'Der Zug {{fährt}} {{zwischen dem ersten und dem dritten Mai}} nicht. (fahren)',
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('zwischen dem ersten und dem dritten Mai');
  });

  test('a two-word gap needs no cue', () => {
    expect(clozeCueProblems({ text: 'Ich warte {{auf dich}}.' })).toEqual([]);
    expect(phraseGaps({ text: 'Ich warte {{auf dich}}.' })).toEqual([]);
  });

  test('only the first alternative is counted', () => {
    expect(clozeCueProblems({ text: 'Das ist das Auto {{Lenas|von Lena selbst}}.' })).toEqual([]);
  });

  test('an instruction that names the content words cues it', () => {
    const item = {
      text: 'Ich habe {{wegen des Regens}} gewartet.',
      instruction: { en: 'Use: wegen des Regens.', ru: 'Используйте: wegen des Regens.' },
    };
    expect(clozeCueProblems(item)).toEqual([]);
    expect(phraseGaps(item)[0]!.cues).toEqual(['instruction']);
  });

  test('an instruction that names nothing in the gap does not cue it', () => {
    expect(
      clozeCueProblems({
        text: 'Mein Sohn geht heute {{nicht in die Schule}}.',
        instruction: { en: 'Complete the sentence.', ru: 'Дополните предложение.' },
      }),
    ).toHaveLength(1);
  });

  test('a translation of the sentence cues it', () => {
    const item = {
      text: 'Mein Sohn geht heute {{nicht in die Schule}}.',
      translation: {
        en: 'My son is not going to school today.',
        ru: 'Мой сын сегодня не идёт в школу.',
      },
    };
    expect(clozeCueProblems(item)).toEqual([]);
    expect(phraseGaps(item)[0]!.cues).toEqual(['translation']);
  });
});
