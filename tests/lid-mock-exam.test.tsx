/**
 * The Leben-in-Deutschland mock exam island (ADR 0009). tests/lid.test.ts proves the draw and
 * the scoring as functions; this file proves the island wires them up the way the learner meets
 * them, and each of these is silent when broken:
 *
 *  - a started mock holds 33 questions — 30 general, 3 of the state;
 *  - the result is read against BOTH pass marks, which belong to different tests, so 17 correct
 *    passes both and 15 passes only the Orientierungskurs test;
 *  - an unanswered question counts as wrong, and is saved as an exam answer with `chosen: null`
 *    so it is scheduled for review like a missed one;
 *  - the run survives a reload, and one found after its deadline is submitted as `timedOut`.
 *
 * Only `logLidExamDurably` is stubbed, and it delegates back to the real journal in afterAll —
 * `mock.module` is process-global in bun (see tests/probe-step.test.tsx). Every test unmounts
 * the island, which clears its 500 ms clock.
 */
import { afterAll, afterEach, beforeAll, describe, expect, mock, test } from 'bun:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentType } from 'react';
import type { LidQuestion } from '@da/schema/lid';
import type { LidEntry } from '../src/components/lid/shared';
import { drawMockExam, mulberry32, type LidAnswer, type LidExamRun } from '../src/lib/lid';
import * as journal from '../src/lib/write-journal';

const realLogLidExamDurably = journal.logLidExamDurably;
const logLidExamDurably = mock(() => Promise.resolve());
mock.module('../src/lib/write-journal', () => ({ ...journal, logLidExamDurably }));

afterAll(() => {
  logLidExamDurably.mockImplementation(realLogLidExamDurably as never);
});

/** 32 general and 4 Bayern questions — more than a draw takes, so the draw has to choose.
    Every key is `a`, and `a` reads "richtig …", so a test can answer correctly by text. */
function entry(id: string, n: number, stateCode: string | null): LidEntry {
  const question: LidQuestion = {
    id,
    officialNumber: n,
    scope: stateCode ? 'state' : 'general',
    stateCode,
    bamfInternalId: id,
    sourcePage: 1,
    question: `Frage zu ${id}?`,
    answers: { a: `richtig ${id}`, b: `falsch b ${id}`, c: `falsch c ${id}`, d: `falsch d ${id}` },
    solution: 'a',
    images: [],
  };
  return { question, topic: 't', topicTitle: 'Thema', module: 'm' };
}
const ENTRIES: LidEntry[] = [
  ...Array.from({ length: 32 }, (_, i) =>
    entry(`general-${String(i + 1).padStart(3, '0')}`, i + 1, null),
  ),
  ...Array.from({ length: 4 }, (_, i) =>
    entry(`BY-${String(i + 1).padStart(2, '0')}`, i + 1, 'BY'),
  ),
];

type Props = { entries: LidEntry[]; bankVersion: string; state: string; pdfUrl: string };
let LidMockExam: ComponentType<Props>;

beforeAll(async () => {
  ({ default: LidMockExam } = await import('../src/components/lid/LidMockExam'));
});

afterEach(() => {
  cleanup();
  logLidExamDurably.mockClear();
  localStorage.clear();
});

const mount = () =>
  render(
    <LidMockExam
      entries={ENTRIES}
      bankVersion="test-bank"
      state="BY"
      pdfUrl="https://example.invalid/k.pdf"
    />,
  );

/** Answer the question on screen correctly, then go on. */
function answerRightAndNext() {
  fireEvent.click(screen.getByText(/^richtig /));
  fireEvent.click(screen.getByRole('button', { name: 'Weiter →' }));
}

function submitConfirmingUnanswered() {
  fireEvent.click(screen.getByRole('button', { name: 'Abgeben' }));
  fireEvent.click(screen.getByRole('button', { name: 'Ja, abgeben' }));
}

function savedRun(): { run: LidExamRun; answers: LidAnswer[] } {
  expect(logLidExamDurably).toHaveBeenCalledTimes(1);
  const [run, answers] = logLidExamDurably.mock.calls[0] as unknown as [LidExamRun, LidAnswer[]];
  return { run, answers };
}

/** The result line for one pass mark — its test's name and its verdict. */
const verdictFor = (name: string) =>
  screen.getByText(name, { selector: 'span.font-semibold' }).parentElement!.textContent;

describe('LidMockExam', () => {
  test('a started mock draws 33 questions, 3 of them from the state', () => {
    mount();
    expect(screen.getByText(/Simulation — kein offizieller Fragebogen/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Simulation starten' }));
    expect(screen.getByText('Frage 1 / 33')).toBeTruthy();
    expect(
      screen.getAllByRole('button', { name: /^Frage \d+, (beantwortet|offen)$/ }),
    ).toHaveLength(33);
    // No translation and no read-aloud anywhere in the exam.
    expect(screen.queryByRole('button', { name: /Übersetzung/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Anhören/ })).toBeNull();

    submitConfirmingUnanswered();
    const { run } = savedRun();
    expect(run.items).toHaveLength(33);
    expect(new Set(run.items).size).toBe(33);
    expect(run.items.filter((id) => id.startsWith('BY-'))).toHaveLength(3);
  });

  test('17 correct passes both tests; the 16 unanswered count as wrong and are saved as such', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Simulation starten' }));
    for (let k = 0; k < 17; k++) answerRightAndNext();
    expect(screen.getByText('beantwortet: 17/33')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Abgeben' }));
    expect(screen.getByText('16 Fragen ohne Antwort — trotzdem abgeben?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ja, abgeben' }));

    expect(screen.getByText('17 von 33 richtig')).toBeTruthy();
    expect(verdictFor('Einbürgerungstest')).toContain('bestanden');
    expect(verdictFor('Einbürgerungstest')).not.toContain('nicht bestanden');
    expect(verdictFor('Test „Leben in Deutschland“')).not.toContain('nicht bestanden');
    expect(screen.getByText('Falsch oder ohne Antwort (16)')).toBeTruthy();

    const { run, answers } = savedRun();
    expect(run.correct).toBe(17);
    expect(run.timedOut).toBe(false);
    expect(run.bank).toBe('test-bank');
    expect(answers).toHaveLength(33);
    expect(answers.every((a) => a.mode === 'exam' && a.ts === run.submittedAt)).toBe(true);
    const unanswered = answers.filter((a) => a.chosen === null);
    expect(unanswered).toHaveLength(16);
    expect(unanswered.every((a) => !a.correct)).toBe(true);
    expect(answers.filter((a) => a.correct)).toHaveLength(17);
  });

  test('15 correct passes the Orientierungskurs test and not the Einbürgerungstest', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Simulation starten' }));
    for (let k = 0; k < 15; k++) answerRightAndNext();
    submitConfirmingUnanswered();
    expect(screen.getByText('15 von 33 richtig')).toBeTruthy();
    expect(verdictFor('Einbürgerungstest')).toContain('nicht bestanden');
    expect(verdictFor('Test „Leben in Deutschland“')).not.toContain('nicht bestanden');
    expect(savedRun().run.correct).toBe(15);
  });

  test('a reload resumes the run where it stood', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Simulation starten' }));
    answerRightAndNext();
    answerRightAndNext();
    cleanup(); // the reload

    mount();
    expect(screen.getByText('Frage 3 / 33')).toBeTruthy();
    expect(screen.getByText('beantwortet: 2/33')).toBeTruthy();
    expect(logLidExamDurably).not.toHaveBeenCalled();
  });

  test('a run found after its deadline is submitted as it stands, timed out', () => {
    const items = drawMockExam({ questions: ENTRIES.map((e) => e.question) }, 'BY', mulberry32(7));
    const startedAt = Date.now() - 61 * 60_000;
    localStorage.setItem(
      'da:lid-mock:local',
      JSON.stringify({
        seed: 7,
        items,
        answers: { [items[0]!]: 'a', [items[1]!]: 'b' },
        startedAt,
        current: 1,
      }),
    );
    mount();
    expect(screen.getByText('1 von 33 richtig')).toBeTruthy();
    expect(screen.getByText(/Zeit abgelaufen/)).toBeTruthy();
    const { run } = savedRun();
    expect(run.timedOut).toBe(true);
    expect(run.submittedAt).toBe(startedAt + 60 * 60_000);
    expect(run.id).toBe(`mock-${startedAt}-7`);
    expect(localStorage.getItem('da:lid-mock:local')).toBeNull();
  });
});
