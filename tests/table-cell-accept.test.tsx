/**
 * A table cell's authored `accept` forms — `acceptedCellAnswers` and `cellAcceptProblems` in
 * `src/lib/table.ts`, and `TableFill`, which grades with the first.
 *
 * Fixtures are inline and state every field the assertions read; none of them points at the
 * corpus, so editing a shipped item cannot turn this file red.
 */
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { answerMatches } from '@da/grading/cloze';
import { tableItemSchema, type ExerciseItem } from '@da/schema';
import { focusEvidenceProblems } from '@da/content/focus-evidence';
import { acceptedCellAnswers, cellAcceptProblems } from '../src/lib/table';
import { TableFill } from '../src/components/exercises/TableFill';

afterEach(cleanup);

describe('acceptedCellAnswers reads a cell’s accept forms', () => {
  const du = [{ answer: 'geh', accept: ['gehe'] }];

  test('the answer and each accept form are graded right', () => {
    expect(answerMatches('geh', acceptedCellAnswers(du, 0))).toBe(true);
    expect(answerMatches('gehe', acceptedCellAnswers(du, 0))).toBe(true);
  });

  test('an accept form gets the case tolerance the answer gets', () => {
    expect(answerMatches('Gehe', acceptedCellAnswers(du, 0))).toBe(true);
  });

  test('a form nobody authored is still wrong', () => {
    expect(answerMatches('gehst', acceptedCellAnswers(du, 0))).toBe(false);
    const nimm = [{ answer: 'Nimm' }];
    expect(answerMatches('Nehme', acceptedCellAnswers(nimm, 0))).toBe(false);
  });

  test('an accept form also takes the continuation stub’s word', () => {
    const cells = [
      { answer: 'Ich komme nicht, weil …', given: true },
      { answer: 'ich heute arbeite', accept: ['ich arbeiten muss'] },
    ];
    expect(answerMatches('weil ich arbeiten muss', acceptedCellAnswers(cells, 1))).toBe(true);
  });
});

describe('cellAcceptProblems — the validator rule', () => {
  test('a distinct form passes', () => {
    expect(cellAcceptProblems([{ answer: 'geh', accept: ['gehe'] }], 0)).toEqual([]);
  });

  test('a form equal to the answer is rejected', () => {
    expect(cellAcceptProblems([{ answer: 'geh', accept: ['geh'] }], 0)).toHaveLength(1);
  });

  test('a form equal to the answer after normalization is rejected', () => {
    // Capitalized, padded and punctuated: the grader already takes every one of these.
    expect(cellAcceptProblems([{ answer: 'geh', accept: ['Geh'] }], 0)).toHaveLength(1);
    expect(cellAcceptProblems([{ answer: 'gehen Sie', accept: ['gehen  Sie!'] }], 0)).toHaveLength(
      1,
    );
  });

  test('a form repeating an earlier form is rejected', () => {
    expect(cellAcceptProblems([{ answer: 'Bleib', accept: ['Bleibe', 'Bleibe'] }], 0)).toHaveLength(
      1,
    );
  });

  test('a given cell may not carry accept forms — it is never asked', () => {
    const cells = [{ answer: 'Trink', accept: ['Trinke'], given: true }, { answer: 'Trinkt' }];
    expect(cellAcceptProblems(cells, 0)).toHaveLength(1);
    expect(cellAcceptProblems(cells, 1)).toEqual([]);
  });
});

describe('a focus_evidence failed predicate is checked against the accept forms too', () => {
  const item = (accept: string[]) =>
    tableItemSchema.parse({
      id: 'imperativ',
      type: 'table',
      focus: 'imperativ-form',
      columns: ['Imperativ'],
      rows: [{ label: 'du', cells: [{ answer: 'geh', accept }] }],
      focus_evidence: { retained: [], failed: ['\\bgehe\\b'] },
    }) as ExerciseItem;

  test('a predicate that fires on an accepted form is a problem', () => {
    expect(focusEvidenceProblems(item(['gehe']), 'practice').join('\n')).toContain('"gehe"');
  });

  test('and is none without that form', () => {
    expect(focusEvidenceProblems(item([]), 'practice')).toEqual([]);
  });
});

describe('TableFill', () => {
  const submit = (item: ReturnType<typeof tableItemSchema.parse>, typed: string[]) => {
    const onResult = mock(() => {});
    render(
      <TableFill
        item={item}
        lang="en"
        onResult={onResult}
        locked={false}
        onNext={mock(() => {})}
        nextLabel="Weiter →"
      />,
    );
    const inputs = screen.getAllByRole('textbox');
    typed.forEach((value, n) => fireEvent.change(inputs[n]!, { target: { value } }));
    fireEvent.click(screen.getByRole('button', { name: /prüfen|check/i }));
    return onResult.mock.calls[0]![0] as {
      correct: boolean;
      correctParts: number;
    };
  };

  test('grades an accept form right', () => {
    const item = tableItemSchema.parse({
      id: 'imperativ',
      type: 'table',
      focus: 'imperativ-form',
      columns: ['Imperativ'],
      rows: [
        { label: 'du', cells: [{ answer: 'geh', accept: ['gehe'] }] },
        { label: 'ihr', cells: [{ answer: 'geht' }] },
      ],
    });
    const result = submit(item, ['gehe', 'geht']);
    expect(result.correct).toBe(true);
    expect(result.correctParts).toBe(2);
  });
});
