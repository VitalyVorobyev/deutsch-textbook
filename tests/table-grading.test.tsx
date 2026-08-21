/**
 * Continuation stubs in table items — `src/lib/table.ts`.
 *
 * Fixtures are inline and state every field the assertion reads. Pointing these at
 * `a2/verbindungen-folgen.yaml` would make the corpus load-bearing for the mechanism: editing the
 * item later would turn the test red for a reason that has nothing to do with the rule.
 */
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { acceptedCellAnswers, continuationWord } from '../src/lib/table';
import { answerMatches } from '@da/grading/cloze';
import { TableFill } from '../src/components/exercises/TableFill';
import { tableItemSchema } from '@da/schema';

afterEach(cleanup);

/** The three rows of `a2/verbindungen-folgen:table-drei-wortarten`, restated. */
const weil = [
  { answer: 'Ich komme nicht, weil …', given: true },
  { answer: 'ich heute arbeite' },
];
const deshalb = [
  { answer: 'Ich arbeite heute. Deshalb …', given: true },
  { answer: 'komme ich nicht' },
];

describe('continuationWord', () => {
  test('returns the stub’s trailing word, verbatim', () => {
    expect(continuationWord(weil, 1)).toBe('weil');
  });

  test('preserves case — a sentence-initial adverb is capital', () => {
    expect(continuationWord(deshalb, 1)).toBe('Deshalb');
  });

  test('a medial ellipsis is a slot marker, not a continuation', () => {
    // The shape `a2/relativsaetze.yaml` uses: the sentence closes after the gap, so nothing
    // is handed over and the learner has no connector to wonder about.
    const relativ = [
      { answer: 'Ich habe einen Freund, … in Wien arbeitet.', given: true },
      { answer: 'der' },
    ];
    expect(continuationWord(relativ, 1)).toBeUndefined();
  });

  test('the first column has no predecessor', () => {
    expect(continuationWord(weil, 0)).toBeUndefined();
  });

  test('a graded predecessor is not a stub', () => {
    const both = [{ answer: 'Ich komme nicht, weil …' }, { answer: 'ich heute arbeite' }];
    expect(continuationWord(both, 1)).toBeUndefined();
  });
});

describe('acceptedCellAnswers', () => {
  const graded = (cells: Array<{ answer: string; given?: boolean }>, typed: string) =>
    answerMatches(typed, acceptedCellAnswers(cells, 1));

  test('accepts the continuation the answer key states', () => {
    expect(graded(weil, 'ich heute arbeite')).toBe(true);
    expect(graded(deshalb, 'komme ich nicht')).toBe(true);
  });

  test('accepts the same answer with the connector restated', () => {
    // The rendering the learner submitted on 2026-07-24 and was scored 0/3 for.
    expect(graded(weil, 'weil ich heute arbeite')).toBe(true);
    expect(graded(deshalb, 'Deshalb komme ich nicht')).toBe(true);
  });

  test('still grades the word order the row exists to drill', () => {
    // Verb-final after weil, inversion after Deshalb — wrong either way, connector or not.
    expect(graded(weil, 'weil ich arbeite heute')).toBe(false);
    expect(graded(deshalb, 'Deshalb ich komme nicht')).toBe(false);
  });

  test('does not accept a lower-case sentence-initial adverb', () => {
    expect(graded(deshalb, 'deshalb komme ich nicht')).toBe(false);
  });

  test('does not accept retyping the whole sentence', () => {
    // Only the one word the stub handed over is tolerated; the instruction asks for the
    // second half, and how much of the first half to omit was never ambiguous.
    expect(graded(weil, 'Ich komme nicht, weil ich heute arbeite')).toBe(false);
  });

  test('a cell with no stub accepts its answer and that answer capitalized', () => {
    const plain = [{ answer: 'Positiv: gut', given: true }, { answer: 'am besten' }];
    expect(acceptedCellAnswers(plain, 1)).toEqual(['am besten', 'Am besten']);
  });
});

/**
 * A cell is a box for a fragment, so its first letter is not part of the graded surface — in the
 * direction the learner can get it wrong for free. `a2/man-und-besitz:table-wem-gehoert`,
 * restated: two rows whose key starts with a name, two whose key starts with an article.
 */
describe('acceptedCellAnswers tolerates a capitalized fragment', () => {
  const graded = (cells: Array<{ answer: string; given?: boolean }>, typed: string) =>
    answerMatches(typed, acceptedCellAnswers(cells, 1));
  const vonDativ = [
    { answer: 'Das Auto gehört meinem Bruder.', given: true },
    { answer: 'das Auto von meinem Bruder' },
  ];
  const name = [
    { answer: 'Das Fahrrad gehört Anna.', given: true },
    { answer: 'Annas Fahrrad' },
  ];

  test('accepts the key as authored', () => {
    expect(graded(vonDativ, 'das Auto von meinem Bruder')).toBe(true);
  });

  test('accepts the same answer with a capital first letter', () => {
    // The rendering scored wrong on 2026-08-02, on the D alone.
    expect(graded(vonDativ, 'Das Auto von meinem Bruder')).toBe(true);
  });

  test('still grades the construction the row exists to drill', () => {
    expect(graded(vonDativ, 'Das Auto von mein Bruder')).toBe(false);
    expect(graded(name, 'Das Annas Fahrrad')).toBe(false);
  });

  test('does not tolerate the other direction — noun capitalization stays graded', () => {
    expect(graded(vonDativ, 'das auto von meinem Bruder')).toBe(false);
    expect(graded(name, 'annas Fahrrad')).toBe(false);
  });
});

/**
 * End to end through the component, because that is where the miss was scored: the attempt log
 * gets `correct` and `correctParts` from `TableFill`, not from `acceptedCellAnswers`.
 */
describe('TableFill grades a submitted continuation', () => {
  const item = tableItemSchema.parse({
    id: 'table-drei-wortarten',
    type: 'table',
    columns: ['Verbindung', 'Ich arbeite heute. / Ich komme nicht.'],
    rows: [
      { label: 'weil (Nebensatz)', cells: [
        { answer: 'Ich komme nicht, weil …', given: true }, { answer: 'ich heute arbeite' }] },
      { label: 'denn (Hauptsatz)', cells: [
        { answer: 'Ich komme nicht, denn …', given: true }, { answer: 'ich arbeite heute' }] },
      { label: 'deshalb (Adverb)', cells: [
        { answer: 'Ich arbeite heute. Deshalb …', given: true }, { answer: 'komme ich nicht' }] },
    ],
  });

  const submit = (typed: string[]) => {
    const onResult = mock(() => {});
    render(
      <TableFill item={item} lang="en" onResult={onResult} locked={false}
        onNext={mock(() => {})} nextLabel="Weiter →" />,
    );
    const inputs = screen.getAllByRole('textbox');
    expect(inputs).toHaveLength(3);
    typed.forEach((value, n) => fireEvent.change(inputs[n]!, { target: { value } }));
    fireEvent.click(screen.getByRole('button', { name: /prüfen|check/i }));
    return onResult.mock.calls[0]![0] as {
      correct: boolean; correctParts: number; totalParts: number; given: string;
    };
  };

  test('the rendering scored 0/3 on 2026-07-24 is 3/3', () => {
    const result = submit(['weil ich heute arbeite', 'denn ich arbeite heute', 'Deshalb komme ich nicht']);
    expect(result.correct).toBe(true);
    expect(result.correctParts).toBe(3);
    expect(result.totalParts).toBe(3);
    // The learner's own text still reaches the log verbatim — the grader widened, not the record.
    expect(result.given).toBe('weil ich heute arbeite / denn ich arbeite heute / Deshalb komme ich nicht');
  });

  test('and so is the continuation the answer key states', () => {
    const result = submit(['ich heute arbeite', 'ich arbeite heute', 'komme ich nicht']);
    expect(result.correct).toBe(true);
    expect(result.correctParts).toBe(3);
  });

  test('a wrong word order is still wrong, connector or not', () => {
    const result = submit(['weil ich arbeite heute', 'denn ich arbeite heute', 'Deshalb ich komme nicht']);
    expect(result.correct).toBe(false);
    expect(result.correctParts).toBe(1);
  });
});
