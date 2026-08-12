/**
 * `remediationSetFor` (src/lib/training.ts) is R4 of PR-8
 * (docs/adrs/0010-probe-failure-remediation.md): which of a failed probe family's
 * topic's own sets the session-end card should point at. Pure and stateless — every
 * case here is a fixture, not the corpus.
 */
import { describe, expect, test } from 'bun:test';
import { remediationSetFor, type TrainingSet } from '../src/lib/training';
import type { ExerciseItem, ExerciseRole } from '../src/lib/schemas';

const FOCUS = 'dativ-praepositionen';

const mcItem = (id: string, focus?: string): ExerciseItem =>
  ({ id, type: 'mc', outcomes: [], preview: false, prompt: '?', options: ['a', 'b'], correct: 0, focus }) as ExerciseItem;

const translateItem = (id: string, focus?: string): ExerciseItem =>
  ({
    id,
    type: 'translate',
    outcomes: [],
    preview: false,
    prompt_en: '?',
    prompt_ru: '?',
    answer: 'x',
    accept: [],
    key_tokens: [],
    focus,
  }) as ExerciseItem;

function set(over: { setId: string; role: ExerciseRole; items: ExerciseItem[]; topicId?: string }): TrainingSet {
  return {
    setId: over.setId,
    topicId: over.topicId ?? 't1',
    title_de: 't1',
    level: 'A2',
    role: over.role,
    items: over.items,
  };
}

describe('remediationSetFor (R4)', () => {
  test('prefers role: drill over role: practice when both carry the focus', () => {
    const practice = set({ setId: 'practice', role: 'practice', items: [mcItem('p1', FOCUS)] });
    const drill = set({ setId: 'drill', role: 'drill', items: [mcItem('d1', FOCUS)] });
    expect(remediationSetFor(FOCUS, 't1', [practice, drill])?.setId).toBe('drill');
    // order in the input must not matter for this preference
    expect(remediationSetFor(FOCUS, 't1', [drill, practice])?.setId).toBe('drill');
  });

  test('among sets of the same role, tie-breaks by translate-item count carrying the tag', () => {
    const fewTranslate = set({
      setId: 'few',
      role: 'drill',
      items: [translateItem('a', FOCUS), mcItem('b', FOCUS)],
    });
    const manyTranslate = set({
      setId: 'many',
      role: 'drill',
      items: [translateItem('c', FOCUS), translateItem('d', FOCUS)],
    });
    expect(remediationSetFor(FOCUS, 't1', [fewTranslate, manyTranslate])?.setId).toBe('many');
    expect(remediationSetFor(FOCUS, 't1', [manyTranslate, fewTranslate])?.setId).toBe('many');
  });

  test('a translate item carrying a DIFFERENT focus does not count toward the tie-break', () => {
    const setA = set({ setId: 'a', role: 'drill', items: [mcItem('a1', FOCUS), translateItem('a2', 'other-focus')] });
    const setB = set({ setId: 'b', role: 'drill', items: [mcItem('b1', FOCUS), translateItem('b2', FOCUS)] });
    expect(remediationSetFor(FOCUS, 't1', [setA, setB])?.setId).toBe('b');
  });

  test('ties on role and translate count go to the earliest set in the given order', () => {
    const first = set({ setId: 'first', role: 'practice', items: [mcItem('f1', FOCUS)] });
    const second = set({ setId: 'second', role: 'practice', items: [mcItem('s1', FOCUS)] });
    expect(remediationSetFor(FOCUS, 't1', [first, second])?.setId).toBe('first');
    expect(remediationSetFor(FOCUS, 't1', [second, first])?.setId).toBe('second');
  });

  test('excludes pretest, probe, checkpoint and placement sets even when items carry the focus', () => {
    const pretest = set({ setId: 'pre', role: 'pretest', items: [mcItem('p', FOCUS)] });
    const probe = set({ setId: 'probe', role: 'probe', items: [mcItem('pr', FOCUS)] });
    const checkpoint = set({ setId: 'cp', role: 'checkpoint', items: [mcItem('c', FOCUS)] });
    const placement = set({ setId: 'pl', role: 'placement', items: [mcItem('pl1', FOCUS)] });
    expect(remediationSetFor(FOCUS, 't1', [pretest, probe, checkpoint, placement])).toBeUndefined();
  });

  test('ignores sets belonging to a different topic', () => {
    const other = set({ setId: 'other', topicId: 't2', role: 'drill', items: [mcItem('o1', FOCUS)] });
    expect(remediationSetFor(FOCUS, 't1', [other])).toBeUndefined();
  });

  test('returns undefined when nothing carries the focus', () => {
    const s = set({ setId: 's', role: 'drill', items: [mcItem('x', 'unrelated')] });
    expect(remediationSetFor(FOCUS, 't1', [s])).toBeUndefined();
  });
});
