/**
 * The exam simulator island's behaviour — the half `tests/exam-sim.test.ts` cannot reach.
 *
 * That suite proves the contract: what `parseExamManifest` admits, what `scoreModule`
 * computes, what the history round-trips. None of it can see the four things that would
 * actually break this feature in the learner's hands, and all four are silent when broken:
 *
 *  - **Absence is the normal case.** Official materials never enter the repo (ADR 0009), so
 *    every CI machine and every public build serves no manifest at all. A 404, a network
 *    error and a body that is not a manifest must all land on the same calm card — never a
 *    spinner that never resolves, never a player with nothing behind it. The manifest is
 *    mocked here for exactly that reason: this file must pass on a machine with no
 *    `public/exams/` and must never read one that happens to exist.
 *  - **The clock submits the sheet itself.** A countdown that reaches 0:00 and does nothing
 *    turns a timed run into an untimed one, and nothing else would notice.
 *  - **A run is recorded exactly once.** The clock and the Abgeben button can both arrive;
 *    two rows would inflate the history the repeat warning reads.
 *  - **Prüfungsmodus gives the recording no replay.** The real Tonträger already contains
 *    every repetition; native `controls` would quietly hand back a listening budget the exam
 *    does not give.
 */
import { afterAll, afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import GoetheExamSimulator from '../src/components/pruefung/GoetheExamSimulator';
import { EXAM_HISTORY_KEY, type ExamManifest, type ExamRunRecord } from '../src/lib/exam-sim';

/**
 * A manifest with the shape of the real ones and none of their content: two modules, one
 * with audio, the three option shapes, and a module whose `maxScaled` deliberately differs
 * from its item count so the rescaling line can be checked.
 */
const MANIFEST: ExamManifest = {
  version: 1,
  sets: [
    {
      id: 'demo-set',
      title: 'Demo Satz',
      level: 'a1',
      modules: [
        {
          module: 'hoeren',
          timeLimitMin: 20,
          pages: ['/exams/demo/h1.png'],
          audio: '/exams/demo/h.m4a',
          maxScaled: 4,
          teile: [
            {
              teil: 1,
              plays: 'twice',
              items: [
                { nr: 1, shape: 'abc', key: 'a' },
                { nr: 2, shape: 'abc', key: 'b' },
              ],
            },
            {
              teil: 2,
              plays: 'once',
              items: [
                { nr: 3, shape: 'rf', key: 'r' },
                { nr: 4, shape: 'rf', key: 'f' },
              ],
            },
          ],
        },
        {
          module: 'lesen',
          timeLimitMin: 25,
          pages: ['/exams/demo/l1.png', '/exams/demo/l2.png'],
          maxScaled: 6, // ≠ the 3 items, so the run must show its rescaled score too
          teile: [
            {
              teil: 1,
              items: [
                { nr: 1, shape: 'rf', key: 'r' },
                { nr: 2, shape: 'rf', key: 'f' },
              ],
            },
            { teil: 2, items: [{ nr: 3, shape: 'ab', key: 'a' }] },
          ],
        },
      ],
    },
  ],
};

const originalFetch = globalThis.fetch;
const originalPlay = HTMLMediaElement.prototype.play;
const originalPause = HTMLMediaElement.prototype.pause;

/** The island's only network call. Nothing here ever reaches a real `public/exams/`. */
const serveManifest = (ok: boolean, body: unknown = MANIFEST) => {
  globalThis.fetch = (async () => ({ ok, json: async () => body })) as unknown as typeof fetch;
};

const history = (): ExamRunRecord[] => JSON.parse(localStorage.getItem(EXAM_HISTORY_KEY) ?? '[]');

beforeEach(() => {
  // Only this feature's key: the exam history is deliberately outside the profile store, and
  // other suites in the same process keep their own state in localStorage.
  localStorage.removeItem(EXAM_HISTORY_KEY);
  // happy-dom has no media pipeline; the runner needs play/pause to exist, nothing more.
  HTMLMediaElement.prototype.play = async () => {};
  HTMLMediaElement.prototype.pause = () => {};
});

afterEach(cleanup);

afterAll(() => {
  globalThis.fetch = originalFetch;
  HTMLMediaElement.prototype.play = originalPlay;
  HTMLMediaElement.prototype.pause = originalPause;
  localStorage.removeItem(EXAM_HISTORY_KEY);
});

const openDemoSet = async (module: RegExp, mode: RegExp) => {
  render(<GoetheExamSimulator />);
  fireEvent.click(await screen.findByText('Demo Satz'));
  fireEvent.click(await screen.findByRole('button', { name: module }));
  fireEvent.click(await screen.findByRole('button', { name: mode }));
};

describe('absence', () => {
  test('a build without the materials gets the absence card, not a spinner', async () => {
    serveManifest(false, null);
    render(<GoetheExamSimulator />);
    expect(await screen.findByText(/nicht vorhanden/)).toBeTruthy();
    expect(screen.getByText(/exam:ingest/)).toBeTruthy();
    expect(screen.getByText(/exam-trainer\.md/)).toBeTruthy();
  });

  test('a served body that is not a manifest is absence too, never a half-built picker', async () => {
    serveManifest(true, { version: 2, sets: [] });
    render(<GoetheExamSimulator />);
    expect(await screen.findByText(/nicht vorhanden/)).toBeTruthy();
  });
});

describe('Üben', () => {
  test('answers resolve immediately, and the finished run is recorded once', async () => {
    serveManifest(true);
    await openDemoSet(/Lesen · 25 Min/, /Üben · ohne Zeit/);

    expect(screen.getByText('Antwortbogen')).toBeTruthy();
    expect(screen.getAllByAltText(/Aufgabenblatt Seite/).length).toBe(2);
    expect(screen.getByText('richtig: 0/0')).toBeTruthy();

    const richtig = screen.getAllByRole('button', { name: 'Richtig' });
    fireEvent.click(richtig[0]!); // item 1, key 'r'
    expect(screen.getByText('richtig: 1/1')).toBeTruthy();
    // the key is on screen and the item is settled — a second choice would only edit the score
    expect(screen.getAllByRole('button', { name: 'Richtig' })[0]!.hasAttribute('disabled')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Beenden' }));

    expect(await screen.findByText('Ergebnis')).toBeTruthy();
    expect(screen.getByText('/3')).toBeTruthy();
    expect(screen.getByText('umgerechnet: 2/6')).toBeTruthy(); // maxScaled 6 over 3 items
    expect(screen.getByText(/keine Bestehensgrenze/)).toBeTruthy();
    expect(history().length).toBe(1);
    expect(history()[0]!.mode).toBe('ueben');
    expect(history()[0]!.raw).toBe(1);
    // every item is in the record, so the result table can show an unanswered one as such
    expect(history()[0]!.answers).toEqual({ 1: 'r', 2: null, 3: null });
  });
});

describe('Prüfungsmodus', () => {
  test('the recording plays from one button and has no native controls', async () => {
    serveManifest(true);
    const { container } = render(<GoetheExamSimulator />);
    fireEvent.click(await screen.findByText('Demo Satz'));
    fireEvent.click(await screen.findByRole('button', { name: /Hören · 20 Min/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Prüfungsmodus · 20 Min/ }));

    expect(screen.getByRole('timer').textContent).toMatch(/^(20:00|19:5\d)$/);
    expect(screen.getByText(/Sie hören zweimal/)).toBeTruthy();
    expect(container.querySelector('audio')?.hasAttribute('controls')).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Abspielen' }));
    const pause = await screen.findByRole('button', { name: 'Pause' });
    fireEvent.click(pause);
    expect(screen.getByText(/Pause angehalten/)).toBeTruthy();
    // resuming continues; there is no control anywhere that starts the recording over
    expect(screen.getByRole('button', { name: 'Fortsetzen' })).toBeTruthy();
  });

  test('an incomplete sheet asks once, then submits — and records exactly one run', async () => {
    serveManifest(true);
    await openDemoSet(/Hören · 20 Min/, /Prüfungsmodus · 20 Min/);

    fireEvent.click(screen.getAllByRole('button', { name: 'a' })[0]!); // item 1, key 'a'
    fireEvent.click(screen.getByRole('button', { name: 'Abgeben' }));
    expect(screen.getByText('3 Aufgaben ohne Antwort — trotzdem abgeben?')).toBeTruthy();
    expect(history().length).toBe(0); // the question did not submit anything

    fireEvent.click(screen.getByRole('button', { name: 'Weiter bearbeiten' }));
    fireEvent.click(screen.getByRole('button', { name: 'Abgeben' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ja, abgeben' }));

    expect(await screen.findByText('Ergebnis')).toBeTruthy();
    expect(history().length).toBe(1);
    expect(history()[0]!.mode).toBe('pruefung');
    expect(history()[0]!.raw).toBe(1);
    // rawMax equals maxScaled here, so no second identical number is shown
    expect(screen.queryByText(/umgerechnet/)).toBeNull();

    // and the next run of the same set+module is warned about what it repeats
    fireEvent.click(screen.getByRole('button', { name: 'Noch einmal üben' }));
    expect(await screen.findByText(/Zuletzt bearbeitet am/)).toBeTruthy();
    expect(screen.getByText(/Ergebnis 1\/4/)).toBeTruthy();
    expect(screen.getByText(/nicht nur die Kompetenz/)).toBeTruthy();
  });

  test('at 0:00 the sheet submits itself, once, and the result says why', async () => {
    const short: ExamManifest = JSON.parse(JSON.stringify(MANIFEST));
    short.sets[0]!.modules[1]!.timeLimitMin = 0.004; // ~240 ms
    serveManifest(true, short);
    await openDemoSet(/Lesen/, /Prüfungsmodus/);

    expect(await screen.findByText(/Die Zeit war um/, {}, { timeout: 4000 })).toBeTruthy();
    expect(history().length).toBe(1);
    expect(history()[0]!.raw).toBe(0);
  });
});
