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
 *    every repetition; native `controls` — or the Üben-only Sprungmarken row — would quietly
 *    hand back a listening budget the exam does not give.
 */
import { afterAll, afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
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
          // Invented seconds — no official recording's timings ever enter the repo (ADR 0009).
          cues: [
            { label: 'Teil 1', at: 30 },
            { label: 'Nr. 1', at: 90 },
          ],
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
        {
          module: 'schreiben',
          timeLimitMin: 20,
          pages: ['/exams/demo/s1.png'],
          answerPages: ['/exams/demo/s-kriterien.png'],
          maxScaled: 12, // 2 auto blanks + the 10-point free part
          teile: [
            {
              teil: 1,
              items: [
                { nr: 1, shape: 'text', answer: 'Lyon', accept: ['Lyon, Frankreich'] },
                { nr: 2, shape: 'text', answer: '9 - 12 Uhr' },
              ],
            },
            {
              teil: 2,
              items: [],
              free: {
                label: 'Kurze Mitteilung, ca. 30 Wörter',
                points: 10,
                criteria: [
                  { label: 'Inhaltspunkt 1', points: [3, 1.5, 0] },
                  { label: 'Inhaltspunkt 2', points: [3, 1.5, 0] },
                  { label: 'Inhaltspunkt 3', points: [3, 1.5, 0] },
                  { label: 'Kommunikative Gestaltung', points: [1, 0.5, 0] },
                ],
              },
            },
          ],
        },
        {
          module: 'sprechen',
          timeLimitMin: 15,
          pages: ['/exams/demo/sp1.png'],
          answerPages: ['/exams/demo/sp-hinweise.png'],
          maxScaled: 15,
          teile: [],
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

  test('the recording carries its Sprungmarken, and a cue seeks and plays from there', async () => {
    serveManifest(true);
    const { container } = render(<GoetheExamSimulator />);
    fireEvent.click(await screen.findByText('Demo Satz'));
    fireEvent.click(await screen.findByRole('button', { name: /Hören · 20 Min/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Üben · ohne Zeit/ }));

    expect(screen.getByRole('button', { name: 'Teil 1' })).toBeTruthy();
    // `act`: the seek is synchronous, but the play() that follows settles the play state.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Nr. 1' }));
    });
    expect(container.querySelector('audio')?.currentTime).toBe(90);
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
    // Same manifest, same cues — and no jump list here: that is the listening budget the exam
    // withholds, so a Sprungmarke in Prüfungsmodus would be the replay control by another name.
    expect(screen.queryByRole('button', { name: 'Teil 1' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Sprungmarken' })).toBeNull();

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

describe('Schreiben', () => {
  test('typed blanks settle on request, the free text is kept, and the self-assessment stays separate', async () => {
    serveManifest(true);
    await openDemoSet(/Schreiben · 20 Min/, /Üben · ohne Zeit/);

    // Blank 1: an accept variant, case-insensitive. Settled on Prüfen, not on typing.
    fireEvent.change(screen.getByLabelText('Antwort zu Aufgabe 1'), {
      target: { value: 'lyon, frankreich' },
    });
    expect(screen.getByText('richtig: 0/0')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Prüfen' })[0]!);
    expect(screen.getByText('richtig: 1/1')).toBeTruthy();

    // Blank 2: hyphen spacing and a trailing period normalize away.
    fireEvent.change(screen.getByLabelText('Antwort zu Aufgabe 2'), {
      target: { value: '9-12 Uhr.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Prüfen' }));
    expect(screen.getByText('richtig: 2/2')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Text zu Teil 2'), {
      target: { value: 'Lieber Thomas, ich komme gern zur Party.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Beenden' }));

    expect(await screen.findByText('Ergebnis')).toBeTruthy();
    // The automatic score is the blanks alone — the free part never inflates it.
    expect(history()[0]!).toMatchObject({ raw: 2, rawMax: 2 });
    expect(history()[0]!.texts).toEqual({ 2: 'Lieber Thomas, ich komme gern zur Party.' });
    expect(screen.getByText(/dazu kommen 10 Punkte des freien Teils/)).toBeTruthy();

    // Self-assessment: 3 + 1,5 + 0 + 1 = 5,5 — applied, it lands on the record as selfScore.
    fireEvent.click(screen.getAllByRole('button', { name: '3' })[0]!);
    fireEvent.click(screen.getAllByRole('button', { name: '1,5' })[1]!);
    fireEvent.click(screen.getAllByRole('button', { name: '0' })[2]!);
    fireEvent.click(screen.getByRole('button', { name: '1' }));
    fireEvent.click(screen.getByRole('button', { name: /Übernehmen · 5,5\/10/ }));

    expect(await screen.findByText(/mit Selbstbewertung zusammen 7,5\/12/)).toBeTruthy();
    expect(history()[0]!).toMatchObject({ raw: 2, selfScore: 5.5, selfScoreMax: 10 });
  });
});

describe('Sprechen', () => {
  test('a practice module opens as task cards and never writes history', async () => {
    serveManifest(true);
    render(<GoetheExamSimulator />);
    fireEvent.click(await screen.findByText('Demo Satz'));
    fireEvent.click(await screen.findByRole('button', { name: /Sprechen · 15 Min/ }));

    // No Prüfungsmodus for a Gruppenprüfung — the setup offers the cards, nothing else.
    expect(screen.queryByRole('button', { name: /Prüfungsmodus/ })).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: /Aufgabenkarten ansehen/ }));
    expect(await screen.findByText(/laut sprechen, buchstabieren/)).toBeTruthy();
    expect(screen.getByText(/Hinweise & Bewertung ansehen/)).toBeTruthy();
    expect(history().length).toBe(0);
  });
});

describe('Ganze schriftliche Prüfung', () => {
  test('runs the three modules in order, shows nothing between them, and records each once', async () => {
    serveManifest(true);
    render(<GoetheExamSimulator />);
    fireEvent.click(await screen.findByText('Demo Satz'));
    fireEvent.click(await screen.findByRole('button', { name: /Komplett starten · ca\. 65 Min/ }));

    for (const [step, label] of [
      [1, 'Hören'],
      [2, 'Lesen'],
      [3, 'Schreiben'],
    ] as const) {
      expect(await screen.findByText(`Modul ${step} von 3: ${label}`)).toBeTruthy();
      // No result of an earlier module leaks onto the interstitial.
      expect(screen.queryByText('Ergebnis')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: `${label} starten` }));
      fireEvent.click(await screen.findByRole('button', { name: 'Abgeben' }));
      fireEvent.click(screen.getByRole('button', { name: 'Ja, abgeben' }));
    }

    expect(await screen.findByText('Ganze schriftliche Prüfung — Ergebnis')).toBeTruthy();
    expect(screen.getByText(/noch nicht selbst bewertet/)).toBeTruthy();
    expect(history().length).toBe(3);
    expect(history().map((run) => run.module)).toEqual(['hoeren', 'lesen', 'schreiben']);
    expect(history().every((run) => run.mode === 'pruefung')).toBe(true);
  });
});
