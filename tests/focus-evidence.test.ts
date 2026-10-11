/**
 * The `focus_evidence` checks `bun run validate` runs (`focusEvidenceProblems`,
 * packages/content/src/focus-evidence.ts), held against fixtures rather than the live corpus — a
 * corpus that happens to pass proves nothing about a rule.
 *
 * The rule this file exists for: a delayed probe reads a `translate` miss that no pinned token
 * explains as the competence *retained* (`classifyProbe`), and `key_tokens` cannot attribute a
 * token the learner ADDED. So a probe item whose tag names an added word (`insertionErrors`,
 * packages/content/src/focus-tags.ts) must carry a `failed` predicate that catches that word —
 * built from its own accepted renderings, so a predicate that merely exists does not pass.
 */
import { describe, expect, test } from 'bun:test';
import { listenItemSchema, translateItemSchema } from '@da/schema';
import { focusEvidenceProblems, insertedRendering } from '@da/content/focus-evidence';

const modalProbe = (focus_evidence?: { retained: string[]; failed: string[] }) =>
  translateItemSchema.parse({
    id: 'variant-a',
    type: 'translate',
    focus: 'modal-satzklammer',
    prompt_en: 'On Monday I have to go to the doctor.',
    prompt_ru: 'В понедельник мне нужно пойти к врачу.',
    answer: 'Am Montag muss ich zum Arzt gehen.',
    accept: ['Ich muss am Montag zum Arzt gehen.'],
    key_tokens: ['muss', 'gehen'],
    ...(focus_evidence ? { focus_evidence } : {}),
  });

describe('a translate probe whose tag names an added word', () => {
  test('without failed predicates is an error — the inserted zu would read as retained', () => {
    const problems = focusEvidenceProblems(modalProbe(), 'probe');
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('"Am Montag muss ich zum Arzt zu gehen"');
  });

  test('passes when a failed predicate catches the insertion in every accepted rendering', () => {
    const caught = modalProbe({ failed: ['\\bzu gehen\\b'], retained: ['\\bmuss\\b.*\\bgehen$'] });
    expect(focusEvidenceProblems(caught, 'probe')).toEqual([]);
  });

  test('fails when the predicates exist but none of them catches the insertion', () => {
    const blind = modalProbe({ failed: ['^(?!.*\\bmuss\\b)'], retained: ['\\bmuss\\b.*\\bgehen$'] });
    const problems = focusEvidenceProblems(blind, 'probe');
    // one per accepted rendering — the answer and the subject-first accept
    expect(problems).toHaveLength(2);
    expect(problems.every((p) => p.startsWith('no focus_evidence.failed predicate catches'))).toBe(true);
  });

  test('applies only to probes: a practice item gets the honest gap, not a false pass', () => {
    expect(focusEvidenceProblems(modalProbe(), 'practice')).toEqual([]);
  });

  test('a variant with no insertion site needs nothing', () => {
    // zeitangaben-system adds a preposition in front of a bare-accusative time phrase; a seit
    // variant has none, so its pins keep attributing as before.
    const seit = translateItemSchema.parse({
      id: 'variant-a',
      type: 'translate',
      focus: 'zeitangaben-system',
      prompt_en: 'I have known Mia for two years.',
      prompt_ru: 'Я знаю Мию уже два года.',
      answer: 'Ich kenne Mia seit zwei Jahren.',
      key_tokens: ['seit'],
    });
    expect(focusEvidenceProblems(seit, 'probe')).toEqual([]);
    expect(insertedRendering('Ab Oktober fahre ich jeden Tag mit dem Zug.', ['Ab', 'jeden'], 'zeitangaben-system'))
      .toBe('Ab Oktober fahre ich am jeden Tag mit dem Zug');
  });

  test('a tag that names no added word is untouched', () => {
    const item = translateItemSchema.parse({
      id: 'variant-a',
      type: 'translate',
      focus: 'akkusativ-artikel',
      prompt_en: 'I am buying a table.',
      prompt_ru: 'Я покупаю стол.',
      answer: 'Ich kaufe einen Tisch.',
      key_tokens: ['einen'],
    });
    expect(focusEvidenceProblems(item, 'probe')).toEqual([]);
  });
});

describe('every focus_evidence item', () => {
  test('a failed predicate may not fire on a rendering the item accepts', () => {
    const item = modalProbe({ failed: ['\\bzu gehen\\b', '\\bzum\\b'], retained: [] });
    const problems = focusEvidenceProblems(item, 'probe');
    expect(problems).toHaveLength(2);
    expect(problems[0]).toContain('"\\bzum\\b" fires on the accepted rendering "Am Montag muss ich zum Arzt gehen."');
  });

  test('is evaluated in the case mode it declares', () => {
    const dictation = (case_sensitive?: boolean) =>
      listenItemSchema.parse({
        id: 'hoeren-diktat-neues',
        type: 'listen',
        focus: 'adjektiv-nomen',
        text: 'Als Verkäufer habe ich immer etwas Neues gelernt.',
        focus_evidence: {
          failed: ['\\betwas neu'],
          retained: ['\\betwas Neues\\b'],
          ...(case_sensitive === undefined ? {} : { case_sensitive }),
        },
      });
    // Folded, `etwas neu` is a prefix of the correct `etwas Neues`.
    expect(focusEvidenceProblems(dictation(), 'practice')).toHaveLength(1);
    expect(focusEvidenceProblems(dictation(false), 'practice')).toHaveLength(1);
    expect(focusEvidenceProblems(dictation(true), 'practice')).toEqual([]);
  });

  test('an invalid regex is reported, and needs a focus tag to attribute to', () => {
    const item = translateItemSchema.parse({
      id: 'x',
      type: 'translate',
      prompt_en: 'Hello.',
      prompt_ru: 'Привет.',
      answer: 'Hallo.',
      focus_evidence: { failed: ['(unclosed'], retained: [] },
    });
    const problems = focusEvidenceProblems(item, 'practice');
    expect(problems).toContain('focus_evidence requires a focus tag');
    expect(problems.some((p) => p.startsWith('invalid focus_evidence regex "(unclosed"'))).toBe(true);
  });
});
