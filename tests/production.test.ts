import { describe, expect, test } from 'bun:test';
import { gradeTranslation, isOneEdit, verdictIsCorrect } from '../src/lib/production';

describe('one-edit near-miss detection', () => {
  test('accepts the slips a learner actually makes', () => {
    // Every pair below is a real (typed, expected) pair from progress/vitaly/2026-07-12.json.
    expect(isOneEdit('Kanst', 'Kannst')).toBe(true); // dropped a doubled consonant
    expect(isOneEdit('heite', 'heute')).toBe(true); // adjacent-key substitution
    expect(isOneEdit('Artzt', 'Arzt')).toBe(true); // inserted a letter
    expect(isOneEdit('schimmen', 'schwimmen')).toBe(true); // dropped a letter
    expect(isOneEdit('bischen', 'bisschen')).toBe(true);
    expect(isOneEdit('do', 'du')).toBe(true);
    expect(isOneEdit('Morgen', 'morgen')).toBe(true); // case is one substitution
    expect(isOneEdit('Bahnhoff', 'Bahnhof')).toBe(true);
  });

  test('rejects divergences too large to be unmistakable slips', () => {
    expect(isOneEdit('we', 'wir')).toBe(false); // substitution + insertion
    expect(isOneEdit('Ingineer', 'Ingenieur')).toBe(false); // the word was not known
    expect(isOneEdit('hilfe', 'helfen')).toBe(false);
    expect(isOneEdit('', 'Arzt')).toBe(false);
  });

  test('treats an adjacent transposition as one edit', () => {
    expect(isOneEdit('Duetsch', 'Deutsch')).toBe(true);
    expect(isOneEdit('Dsutech', 'Deutsch')).toBe(false);
  });
});

describe('grading a typed German sentence', () => {
  const habenSein = {
    answer: 'Gestern sind wir zu Hause geblieben.',
    focus: 'haben-sein',
    keyTokens: ['sind', 'geblieben'],
  };

  test('an exact answer is correct', () => {
    expect(gradeTranslation('Gestern sind wir zu Hause geblieben.', habenSein).kind).toBe('correct');
  });

  test('trailing punctuation stays optional', () => {
    expect(gradeTranslation('Gestern sind wir zu Hause geblieben', habenSein).kind).toBe('correct');
  });

  test('an accepted variant is correct', () => {
    const spec = { answer: 'Gestern haben wir eine Pizza gegessen.', accept: ['Wir haben gestern eine Pizza gegessen.'] };
    expect(gradeTranslation('Wir haben gestern eine Pizza gegessen.', spec).kind).toBe('correct');
  });
});

describe('rule 1 — a slipped token is a spelling note, not a grammar error', () => {
  test('a placement item forgives a misspelled infinitive — the bracket still holds', () => {
    // Real attempt: logged as a modal-satzklammer error, though the bracket is perfect.
    // modal-satzklammer grades *placement*, and placement is enforced by comparing
    // tokens positionally — so the infinitive's spelling is not a graded token.
    const verdict = gradeTranslation('Ich kann gut schimmen', {
      answer: 'Ich kann gut schwimmen.',
      focus: 'modal-satzklammer',
    });
    expect(verdict).toEqual({
      kind: 'spelling',
      correction: { given: 'schimmen', expected: 'schwimmen' },
    });
  });

  test('a reordered sentence can never pass as a one-token slip', () => {
    const verdict = gradeTranslation('Ich kann schwimmen gut', {
      answer: 'Ich kann gut schwimmen.',
      focus: 'modal-satzklammer',
    });
    expect(verdict.kind).toBe('wrong');
  });

  test('forgives a slip in the scaffolding around the graded tokens', () => {
    // Real attempt: logged as a verben-mit-dativ error, though `mir` is correct.
    const verdict = gradeTranslation('Kanst du mir bitte helfen?', {
      answer: 'Kannst du mir bitte helfen?',
      focus: 'verben-mit-dativ',
      keyTokens: ['mir', 'helfen'],
    });
    expect(verdict).toEqual({
      kind: 'spelling',
      correction: { given: 'Kanst', expected: 'Kannst' },
    });
    expect(verdictIsCorrect(verdict)).toBe(true);
  });

  test('a miscapitalized adverb is a slip, not an accusative error', () => {
    // Real attempt: logged as an akkusativ-pronomen error, though `dich` is correct.
    const verdict = gradeTranslation('Ich rufe dich Morgen an', {
      answer: 'Ich rufe dich morgen an.',
      focus: 'akkusativ-pronomen',
      keyTokens: ['dich'],
    });
    expect(verdict.kind).toBe('spelling');
    expect(verdictIsCorrect(verdict)).toBe(true);
  });

  test('never forgives a near-miss on a token the item grades', () => {
    // `geflügen` for `geflogen` is one edit, but a Perfekt item grades the participle:
    // the sentence is not right German, and forgiving it would hide a real gap.
    const verdict = gradeTranslation('Sie ist nach Spanien geflügen', {
      answer: 'Sie ist nach Spanien geflogen.',
      focus: 'haben-sein',
      keyTokens: ['ist', 'geflogen'],
    });
    expect(verdict).toEqual({ kind: 'wrong', focus: 'haben-sein' });
  });

  test('a non-word is a slip even where a real function word would be a choice', () => {
    // Real attempt, logged as a verben-mit-dativ error though `mir` is correct. `do`
    // is not German, so the learner cannot have *chosen* it — unlike `den` for `dem`,
    // which is a grammatical decision and stays gradeable.
    const verdict = gradeTranslation('Kannst do mir helfen?', {
      answer: 'Kannst du mir helfen?',
      focus: 'verben-mit-dativ',
      keyTokens: ['mir'],
    });
    expect(verdict.kind).toBe('spelling');
  });

  test('but a real function word swapped for another stays a graded choice', () => {
    const verdict = gradeTranslation('Kannst Sie mir helfen?', {
      answer: 'Kannst du mir helfen?',
      focus: 'du-sie',
    });
    expect(verdict).toEqual({ kind: 'wrong', focus: 'du-sie' });
  });

  test('two slipped tokens are a real error, not a slip', () => {
    const verdict = gradeTranslation('Ich hilfe mainem Bruder', {
      answer: 'Ich helfe meinem Bruder.',
      focus: 'verben-mit-dativ',
      keyTokens: ['meinem'],
    });
    expect(verdict.kind).toBe('wrong');
  });
});

describe('rule 2 — a real error is only blamed on the tag it is about', () => {
  test('does not blame haben-sein for a determiner slip elsewhere in the sentence', () => {
    // Real attempt: `haben` and `gegessen` are both right — the Perfekt is correct.
    // Only the determiner differs. Logging this as haben-sein evidence is what
    // inflated that tag in the snapshot.
    const verdict = gradeTranslation('Gestern haben wir die Pizza gegessen', {
      answer: 'Gestern haben wir eine Pizza gegessen.',
      focus: 'haben-sein',
      keyTokens: ['haben', 'gegessen'],
    });
    expect(verdict).toEqual({ kind: 'wrong' });
    expect((verdict as { focus?: string }).focus).toBeUndefined();
  });

  test('does blame haben-sein when the auxiliary itself was wrong', () => {
    const verdict = gradeTranslation('Gestern haben wir zu Hause geblieben', {
      answer: 'Gestern sind wir zu Hause geblieben.',
      focus: 'haben-sein',
      keyTokens: ['sind'],
    });
    expect(verdict).toEqual({ kind: 'wrong', focus: 'haben-sein' });
  });

  test('does not blame trennbar-modal when the bracket was right', () => {
    // Real attempt: `möchte … absagen` is textbook-correct; only the determiner slipped.
    const verdict = gradeTranslation('Ich möchte einen Termin absagen', {
      answer: 'Ich möchte den Termin absagen.',
      focus: 'trennbar-modal',
      keyTokens: ['möchte', 'absagen'],
    });
    expect(verdict).toEqual({ kind: 'wrong' });
  });

  test('an undeclared item keeps the old attribution rather than silently losing it', () => {
    const verdict = gradeTranslation('Ich helfe den Mann', {
      answer: 'Ich helfe dem Mann.',
      focus: 'dativ-artikel',
    });
    expect(verdict).toEqual({ kind: 'wrong', focus: 'dativ-artikel' });
  });

  test('closed-class words are protected even when the item declares nothing', () => {
    // den/dem is one edit apart. Forgiving it as a typo would erase exactly the
    // error the dative topic exists to teach, on every un-audited item.
    for (const [typed, answer, focus] of [
      ['Ich helfe den Mann', 'Ich helfe dem Mann.', 'dativ-artikel'],
      ['Ich sehe ihm', 'Ich sehe ihn.', 'akkusativ-pronomen'],
      ['Ich habe einem Hund', 'Ich habe einen Hund.', 'akkusativ-artikel'],
    ] as const) {
      expect(gradeTranslation(typed, { answer, focus })).toEqual({ kind: 'wrong', focus });
    }
  });

  test('an untagged item stays untagged', () => {
    const verdict = gradeTranslation('Main Vater ist Ingineer', {
      answer: 'Mein Vater ist Ingenieur.',
    });
    expect(verdict).toEqual({ kind: 'wrong' });
  });
});
