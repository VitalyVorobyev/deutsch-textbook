/**
 * The Leben-in-Deutschland question component and the practice island (ADR 0021) — the half
 * tests/lid.test.ts cannot reach. Four things here are silent when broken:
 *
 *  - **Order.** Practice shuffles so a position cannot be memorised — but never `Bild 1…4`
 *    options, which name pictures; the mock exam shows the catalogue's order, lettered a–d.
 *  - **The EN surface.** The unofficial translation shows English, plus Russian only under `ru`
 *    and Ukrainian only under `uk`. An EN reader is never handed Russian, a UK reader never
 *    Russian either (a note without its uk half shows English alone), and the exam never shows a
 *    translation at all.
 *  - **One answer, one write.** The first choice is final and is logged exactly once.
 *  - **A failed read is an error, never a fresh start** (CLAUDE.md runtime invariant).
 *  - **Lessons stay out of the exam.** Practice feedback links the lesson on the question's
 *    topic; the mock exam never does. `?lektion=<id>` narrows practice to that lesson's questions,
 *    and an unknown id falls back to ordinary practice instead of an empty page.
 *
 * Only `getLidState` and the two LiD loggers are stubbed. `mock.module` is process-global in
 * bun, so both stubs delegate back to the real implementations in afterAll (the pattern of
 * tests/probe-step.test.tsx): a later file must see the real store and the real journal.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentType } from 'react';
import type { LidOptionKey, LidQuestion as LidQuestionData } from '@da/schema/lid';
import type { LidEntry, LidLessonScopes } from '../src/components/lid/shared';
import type { LidQuestionProps } from '../src/components/lid/LidQuestion';
import { EMPTY_LID_STATE, type LidState } from '../src/lib/lid';
import * as store from '../src/lib/store';
import * as journal from '../src/lib/write-journal';

// Captured BEFORE mock.module patches the registry: the namespaces are live-bound, so reading
// these afterwards would return the mocks themselves and the delegation would recurse forever.
const real = {
  getLidState: store.getLidState,
  logLidAnswerDurably: journal.logLidAnswerDurably,
  logLidExamDurably: journal.logLidExamDurably,
};
let lidState: LidState | Error = EMPTY_LID_STATE;
const getLidState = mock(() =>
  lidState instanceof Error ? Promise.reject(lidState) : Promise.resolve(lidState),
);
const logLidAnswerDurably = mock(() => Promise.resolve());
const logLidExamDurably = mock(() => Promise.resolve());
mock.module('../src/lib/store', () => ({ ...store, getLidState }));
mock.module('../src/lib/write-journal', () => ({
  ...journal,
  logLidAnswerDurably,
  logLidExamDurably,
}));

afterAll(() => {
  getLidState.mockImplementation(real.getLidState as never);
  logLidAnswerDurably.mockImplementation(real.logLidAnswerDurably as never);
  logLidExamDurably.mockImplementation(real.logLidExamDurably as never);
});

function question(
  id: string,
  answers: Record<LidOptionKey, string>,
  solution: LidOptionKey,
  images: LidQuestionData['images'] = [],
): LidQuestionData {
  const n = Number(id.split('-')[1]);
  return {
    id,
    officialNumber: n,
    scope: 'general',
    stateCode: null,
    bamfInternalId: String(1000 + n),
    sourcePage: 2,
    question: `Testfrage ${n}?`,
    answers,
    solution,
    images,
  };
}

const TEXT: LidEntry = {
  question: question(
    'general-001',
    {
      a: 'hier Religionsfreiheit gilt.',
      b: 'die Menschen Steuern zahlen.',
      c: 'die Menschen das Wahlrecht haben.',
      d: 'hier Meinungsfreiheit gilt.',
    },
    'd',
  ),
  topic: 'grundrechte',
  topicTitle: 'Grundgesetz und Grundrechte',
  module: 'leben-in-der-demokratie',
  note: {
    status: 'draft',
    rationale_de: 'Das Grundgesetz schützt die Meinungsfreiheit.',
    source: 'GG Art. 5',
    question: {
      en: 'People may openly criticise the government because …',
      ru: 'Люди могут открыто критиковать правительство, потому что …',
    },
    options: {
      a: {
        en: 'freedom of religion applies here.',
        ru: 'здесь действует свобода вероисповедания.',
      },
      b: { en: 'people pay taxes.', ru: 'люди платят налоги.' },
      c: { en: 'people have the right to vote.', ru: 'у людей есть право голоса.' },
      d: { en: 'freedom of opinion applies here.', ru: 'здесь действует свобода мнений.' },
    },
  },
};

const IMAGES: LidEntry = {
  question: question(
    'general-021',
    { a: 'Bild 1', b: 'Bild 2', c: 'Bild 3', d: 'Bild 4' },
    'a',
    [1, 2, 3, 4].map((k) => ({
      path: k === 1 ? '/lid/general-021.png' : `/lid/general-021-${k}.png`,
      sha256: '0'.repeat(64),
      width: 375,
      height: 488,
    })),
  ),
  topic: 'staatssymbole',
  topicTitle: 'Staatssymbole',
  module: 'leben-in-der-demokratie',
};

const PDF = 'https://example.invalid/katalog.pdf';
/** rng() = 0 makes Fisher–Yates rotate a,b,c,d into b,c,d,a — a known, non-identity order. */
const ZERO = () => 0;

let LidQuestion: ComponentType<LidQuestionProps>;
let LidPractice: ComponentType<{
  entries: LidEntry[];
  bankVersion: string;
  pdfUrl: string;
  lessons?: LidLessonScopes;
  rng?: () => number;
}>;

beforeAll(async () => {
  ({ default: LidQuestion } = await import('../src/components/lid/LidQuestion'));
  ({ default: LidPractice } = await import('../src/components/lid/LidPractice'));
});

beforeEach(() => {
  lidState = EMPTY_LID_STATE;
  document.documentElement.dataset.explainLang = 'en';
});

afterEach(() => {
  cleanup();
  getLidState.mockClear();
  logLidAnswerDurably.mockClear();
  logLidExamDurably.mockClear();
  localStorage.clear();
  delete document.documentElement.dataset.explainLang;
});

/** The option buttons' visible texts, top to bottom. */
const optionTexts = () =>
  [...document.querySelectorAll<HTMLButtonElement>('button[data-lid-option]')].map(
    (b) => b.textContent ?? '',
  );
const optionKeys = () =>
  [...document.querySelectorAll<HTMLButtonElement>('button[data-lid-option]')].map(
    (b) => b.dataset.lidOption,
  );

function practice(entry: LidEntry, onAnswer = mock(() => {})) {
  render(
    <LidQuestion
      mode="practice"
      entry={entry}
      pdfUrl={PDF}
      onAnswer={onAnswer}
      onNext={() => {}}
      rng={ZERO}
    />,
  );
  return onAnswer;
}

describe('LidQuestion — option order', () => {
  test('practice shuffles a text question, and shows no letters', () => {
    practice(TEXT);
    expect(optionKeys()).toEqual(['b', 'c', 'd', 'a']);
    // No letter in practice: each button reads exactly as the catalogue prints the option.
    expect(optionTexts()).toEqual(
      ['b', 'c', 'd', 'a'].map((k) => TEXT.question.answers[k as LidOptionKey]),
    );
  });

  test('practice never shuffles Bild 1…4 options — they point at numbered pictures', () => {
    practice(IMAGES);
    expect(optionKeys()).toEqual(['a', 'b', 'c', 'd']);
    expect(optionTexts()).toEqual(['Bild 1', 'Bild 2', 'Bild 3', 'Bild 4']);
    // …and the pictures are labelled to match.
    for (const k of [1, 2, 3, 4])
      expect(screen.getByText(`Bild ${k}`, { selector: 'figcaption' })).toBeTruthy();
  });

  test('the exam keeps source order, lettered a–d', () => {
    render(<LidQuestion mode="exam" entry={TEXT} pdfUrl={PDF} chosen={null} onChoose={() => {}} />);
    expect(optionKeys()).toEqual(['a', 'b', 'c', 'd']);
    optionTexts().forEach((text, i) => {
      const key = 'abcd'[i]!;
      expect(text.startsWith(key)).toBe(true);
      expect(text).toContain(TEXT.question.answers[key as LidOptionKey]);
    });
  });

  test('a withheld photo is never requested — its credit and the catalogue page stand in', () => {
    const withheld: LidEntry = {
      ...TEXT,
      question: {
        ...TEXT.question,
        sourcePage: 21,
        images: [
          {
            path: '/lid/general-055.jpeg',
            sha256: '0'.repeat(64),
            width: 1200,
            height: 857,
            withheld: '© Deutscher Bundestag/Achim Melde',
          },
        ],
      },
    };
    practice(withheld);
    expect(document.querySelector('img')).toBeNull();
    expect(
      screen.getByText(
        /Foto im offiziellen Fragenkatalog \(S\. 21\) — © Deutscher Bundestag\/Achim Melde/,
      ),
    ).toBeTruthy();
    const link = screen.getByRole('link', { name: /BAMF-Katalog/ }) as HTMLAnchorElement;
    expect(link.href).toBe(`${PDF}#page=21`);
    expect(link.target).toBe('_blank');
  });
});

describe('LidQuestion — translation', () => {
  test('absent in the exam, even after a choice', () => {
    render(<LidQuestion mode="exam" entry={TEXT} pdfUrl={PDF} chosen="a" onChoose={() => {}} />);
    expect(screen.queryByRole('button', { name: /Übersetzung/ })).toBeNull();
    expect(screen.queryByText(TEXT.note!.question!.en)).toBeNull();
  });

  test('under explanation language en: English only, never the Russian half', () => {
    practice(TEXT);
    fireEvent.click(screen.getByText(TEXT.question.answers.a));
    fireEvent.click(screen.getByRole('button', { name: /Übersetzung \(inoffiziell\)/ }));
    expect(screen.getByText(TEXT.note!.question!.en)).toBeTruthy();
    expect(screen.getByText(TEXT.note!.options!.d.en)).toBeTruthy();
    expect(screen.queryByText(TEXT.note!.question!.ru)).toBeNull();
    expect(screen.queryByText(TEXT.note!.options!.d.ru)).toBeNull();
  });

  test('under ru: English plus Russian; under uk without a uk half: English alone', () => {
    document.documentElement.dataset.explainLang = 'ru';
    practice(TEXT);
    fireEvent.click(screen.getByText(TEXT.question.answers.a));
    fireEvent.click(screen.getByRole('button', { name: /Übersetzung/ }));
    expect(screen.getByText(TEXT.note!.question!.en)).toBeTruthy();
    expect(screen.getByText(TEXT.note!.question!.ru)).toBeTruthy();
    cleanup();

    document.documentElement.dataset.explainLang = 'uk';
    practice(TEXT);
    fireEvent.click(screen.getByText(TEXT.question.answers.a));
    fireEvent.click(screen.getByRole('button', { name: /Übersetzung/ }));
    expect(screen.getByText(TEXT.note!.question!.en)).toBeTruthy();
    expect(screen.queryByText(TEXT.note!.question!.ru)).toBeNull();
  });

  test('under uk with a uk half: English plus Ukrainian — question, options and terms — never Russian', () => {
    const uk: LidEntry = {
      ...TEXT,
      note: {
        ...TEXT.note!,
        question: {
          ...TEXT.note!.question!,
          uk: 'Люди можуть відкрито критикувати уряд, тому що …',
        },
        options: {
          a: { ...TEXT.note!.options!.a, uk: 'тут діє свобода віросповідання.' },
          b: { ...TEXT.note!.options!.b, uk: 'люди сплачують податки.' },
          c: { ...TEXT.note!.options!.c, uk: 'люди мають право голосу.' },
          d: { ...TEXT.note!.options!.d, uk: 'тут діє свобода думки.' },
        },
        terms: [
          {
            de: 'die Meinungsfreiheit',
            en: 'freedom of opinion',
            ru: 'свобода мнений',
            uk: 'свобода думки',
          },
        ],
      },
    };
    document.documentElement.dataset.explainLang = 'uk';
    practice(uk);
    fireEvent.click(screen.getByText(uk.question.answers.a));
    fireEvent.click(screen.getByRole('button', { name: /Übersetzung/ }));
    expect(screen.getByText(uk.note!.question!.en)).toBeTruthy();
    expect(screen.getByText(uk.note!.question!.uk!).getAttribute('lang')).toBe('uk');
    expect(screen.getByText(uk.note!.options!.b.uk!).getAttribute('lang')).toBe('uk');
    expect(screen.getByText('свобода думки', { selector: 'dd span' }).getAttribute('lang')).toBe(
      'uk',
    );
    expect(screen.queryByText(uk.note!.question!.ru)).toBeNull();
    expect(screen.queryByText(uk.note!.options!.b.ru)).toBeNull();
    expect(screen.queryByText('свобода мнений')).toBeNull();
  });
});

describe('LidPractice', () => {
  test('a choice shows feedback and is logged exactly once', async () => {
    render(
      <LidPractice entries={[TEXT, IMAGES]} bankVersion="test-bank" pdfUrl={PDF} rng={ZERO} />,
    );
    await screen.findByText(TEXT.question.question);
    expect(screen.getByText('0 fällig · 2 neu heute')).toBeTruthy();

    expect(screen.getByText('1 von 2')).toBeTruthy();
    fireEvent.click(screen.getByText(TEXT.question.answers.b)); // wrong: the key is d
    expect(screen.getByText('Leider falsch ✗')).toBeTruthy();
    expect(screen.getByText('1 von 2')).toBeTruthy(); // answering never moves the position
    expect(screen.getByText(TEXT.note!.rationale_de!)).toBeTruthy();
    expect(screen.getByText(/GG Art\. 5/)).toBeTruthy();
    // The key is highlighted for the learner who missed it.
    const key = document.querySelector<HTMLButtonElement>('button[data-lid-option="d"]')!;
    expect(key.className).toContain('border-green-600');

    // The first choice is final: another click and a keystroke change nothing.
    fireEvent.click(screen.getByText(TEXT.question.answers.d));
    fireEvent.keyDown(window, { key: '3' });
    expect(logLidAnswerDurably).toHaveBeenCalledTimes(1);
    const [answer] = logLidAnswerDurably.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(answer).toMatchObject({
      q: 'general-001',
      chosen: 'b',
      correct: false,
      mode: 'practice',
      bank: 'test-bank',
    });
    expect(typeof answer.ts).toBe('number');

    // Enter is Weiter. The missed question returns later in the sitting; the image one is next,
    // and a question with no note says so quietly instead of leaving a gap.
    fireEvent.keyDown(document.body, { key: 'Enter' });
    expect(await screen.findByText(IMAGES.question.question)).toBeTruthy();
    expect(screen.getByText('2 von 3')).toBeTruthy(); // the missed one is still to come
    fireEvent.click(screen.getByText('Bild 1', { selector: 'button span' }));
    expect(screen.getByText('Richtig! ✓')).toBeTruthy();
    expect(screen.getByText('Noch keine Erklärung')).toBeTruthy();
    expect(logLidAnswerDurably).toHaveBeenCalledTimes(2);
  });

  test('keys 1–4 choose the option in that displayed position', async () => {
    render(<LidPractice entries={[TEXT]} bankVersion="test-bank" pdfUrl={PDF} rng={ZERO} />);
    await screen.findByText(TEXT.question.question);
    // The question can be in the DOM before the effect that binds the keyboard has run: the read
    // resolves outside act, so React may defer that passive effect. A slow runner (the Windows
    // release lane) pressed the key into that gap. Flush effects first.
    await act(async () => {});
    fireEvent.keyDown(window, { key: '3' }); // displayed b, c, d, a → d, the key
    expect(screen.getByText('Richtig! ✓')).toBeTruthy();
    expect(logLidAnswerDurably).toHaveBeenCalledTimes(1);
    expect((logLidAnswerDurably.mock.calls[0] as unknown as [{ chosen: string }])[0].chosen).toBe(
      'd',
    );
  });

  test('a failed read renders the load error, never a fresh queue', async () => {
    lidState = new Error('NotFoundError');
    render(<LidPractice entries={[TEXT]} bankVersion="test-bank" pdfUrl={PDF} />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.queryByText(TEXT.question.question)).toBeNull();
  });

  test('an empty read for a profile that has saved LiD answers before is an error too', async () => {
    journal.markSeenData('lid');
    render(<LidPractice entries={[TEXT]} bankVersion="test-bank" pdfUrl={PDF} />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.queryByText(TEXT.question.question)).toBeNull();
  });
});

describe('lessons', () => {
  const LESSON = { id: 'staat-symbole', title: 'Staatssymbole' };
  const happyDom = (globalThis as unknown as { happyDOM: { setURL: (url: string) => void } })
    .happyDOM;
  const at = (search: string) => happyDom.setURL(`http://localhost/leben/ueben${search}`);
  const IN_LESSON: LidEntry = { ...IMAGES, lesson: LESSON };
  const lessonLink = () =>
    screen.queryByRole('link', { name: /Mehr dazu: Lektion „Staatssymbole“/ });

  afterEach(() => happyDom.setURL('about:blank'));

  test("practice feedback links the lesson on the question's topic", () => {
    practice(IN_LESSON);
    expect(lessonLink()).toBeNull(); // feedback only, after the answer
    fireEvent.click(screen.getByText('Bild 2', { selector: 'button span' }));
    expect((lessonLink() as HTMLAnchorElement).getAttribute('href')).toBe(
      '/leben/lernen/staat-symbole',
    );
  });

  test('the exam never links a lesson — not while answering, not in its results', () => {
    render(
      <LidQuestion mode="exam" entry={IN_LESSON} pdfUrl={PDF} chosen="b" onChoose={() => {}} />,
    );
    expect(lessonLink()).toBeNull();
    cleanup();
    render(<LidQuestion mode="exam" entry={IN_LESSON} pdfUrl={PDF} chosen="b" reveal />);
    expect(screen.getByText('Noch keine Erklärung')).toBeTruthy(); // the results view did render
    expect(lessonLink()).toBeNull();
  });

  test("?lektion=<id> deals only that lesson's questions, names it and links back", async () => {
    at('?lektion=staat-symbole');
    const lessons: LidLessonScopes = {
      'staat-symbole': { title: 'Staatssymbole', ids: [IMAGES.question.id] },
    };
    render(
      <LidPractice
        entries={[TEXT, IMAGES]}
        bankVersion="test-bank"
        pdfUrl={PDF}
        lessons={lessons}
        rng={ZERO}
      />,
    );
    await screen.findByText(IMAGES.question.question);
    expect(screen.getByText('Lektion „Staatssymbole“')).toBeTruthy();
    expect(screen.getByText('1 Fragen dieser Lektion')).toBeTruthy();
    expect(screen.getByText('1 von 1')).toBeTruthy();
    expect(screen.getByRole('link', { name: '← Zur Lektion' }).getAttribute('href')).toBe(
      '/leben/lernen/staat-symbole',
    );
    expect(screen.queryByText(TEXT.question.question)).toBeNull();
  });

  test('an unknown lesson falls back to ordinary practice, with a quiet note', async () => {
    at('?lektion=gibt-es-nicht');
    const lessons: LidLessonScopes = {
      'staat-symbole': { title: 'Staatssymbole', ids: [IMAGES.question.id] },
    };
    render(
      <LidPractice
        entries={[TEXT, IMAGES]}
        bankVersion="test-bank"
        pdfUrl={PDF}
        lessons={lessons}
        rng={ZERO}
      />,
    );
    await screen.findByText(TEXT.question.question);
    expect(screen.getByText(/Diese Lektion gibt es nicht/)).toBeTruthy();
    expect(screen.getByText('0 fällig · 2 neu heute')).toBeTruthy();
    expect(screen.queryByText(/Zur Lektion/)).toBeNull();
  });

  test('?lektion=constructor names no lesson — only own keys count', async () => {
    at('?lektion=constructor');
    render(
      <LidPractice entries={[TEXT]} bankVersion="test-bank" pdfUrl={PDF} lessons={{}} rng={ZERO} />,
    );
    await screen.findByText(TEXT.question.question);
    expect(screen.getByText(/Diese Lektion gibt es nicht/)).toBeTruthy();
  });
});

describe('LidPractice — a missed question comes back later, not next', () => {
  /** n fresh copies of TEXT (key d), numbered from 101. */
  const copies = (n: number): LidEntry[] =>
    Array.from({ length: n }, (_, i) => ({
      ...TEXT,
      question: question(`general-${101 + i}`, TEXT.question.answers, 'd'),
    }));

  /** Answers `count` presentations, wrong at the 1-based positions in `wrongAt`; returns the ids asked. */
  async function sitThrough(count: number, wrongAt: number[]): Promise<number[]> {
    await screen.findByText(/^Testfrage \d+\?$/);
    await act(async () => {});
    const asked: number[] = [];
    for (let p = 1; p <= count; p++) {
      asked.push(Number(screen.getByText(/^Testfrage \d+\?$/).textContent!.match(/\d+/)![0]));
      fireEvent.click(
        screen.getByText(wrongAt.includes(p) ? TEXT.question.answers.b : TEXT.question.answers.d),
      );
      fireEvent.keyDown(document.body, { key: 'Enter' });
      await act(async () => {});
    }
    return asked;
  }

  test('a new question returns after 8 others, then after half that', async () => {
    render(<LidPractice entries={copies(14)} bankVersion="test-bank" pdfUrl={PDF} rng={ZERO} />);
    const asked = await sitThrough(16, [1, 10]);
    const missed = asked[0];
    expect(asked.flatMap((id, i) => (id === missed ? [i + 1] : []))).toEqual([1, 10, 15]);
    expect(new Set(asked).size).toBe(14);
  });

  test('a learned question that lapses waits the long gap — here, the end of the sitting', async () => {
    const entries = copies(12);
    const learned = entries[0]!.question.id;
    lidState = {
      ...EMPTY_LID_STATE,
      cards: {
        [learned]: {
          due: '2026-01-01T00:00:00.000Z',
          stability: 10,
          difficulty: 5,
          elapsed_days: 10,
          scheduled_days: 10,
          learning_steps: 0,
          reps: 3,
          lapses: 0,
          state: 2, // State.Review
          last_review: '2025-12-22T00:00:00.000Z',
        },
      },
    };
    render(<LidPractice entries={entries} bankVersion="test-bank" pdfUrl={PDF} rng={ZERO} />);
    const asked = await sitThrough(13, [1]);
    expect(asked[0]).toBe(101); // due before new
    // After 8 others it would be the 10th; a lapse waits 50, which here is the end.
    expect(asked.lastIndexOf(101) + 1).toBe(13);
  });
});
