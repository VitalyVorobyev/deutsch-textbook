/**
 * Leben in Deutschland — the trainer's pure logic. ADR 0021.
 *
 * Practising the official bank is learning, so every answer is graded by FSRS and synced — but
 * into its OWN store key (`lid`), never `cards` or `attempts`. Question states in `cards` would
 * count as vocabulary on Fortschritt, spend the course's shared 15-a-day new-card budget and
 * show a fake deck in `progress:audit`; answers in `attempts` would inflate verified accuracy.
 * So this module carries its own state shape, its own idempotent writers (the mutate halves the
 * store runs inside a transaction), its own merge and its own queue.
 *
 * The mock exam is calibration, never mastery: its score is reported against BOTH published
 * thresholds, which are different pass marks for different tests and are never merged. Readiness
 * is facts — seen, correct on the last two answers, due, mock scores — never a pass probability.
 *
 * Pure: no `node:fs` and no store access, because React islands import it. (`./store` appears
 * below for its types only.)
 */
import { LID_EXAM, type LidBank, type LidOptionKey, type LidQuestion } from '@da/schema/lid';
import { mergeCards } from './snapshot-merge';
import { applyGradeAt, introducedToday, Rating } from './srs';
import type { StoredCard } from './store';

/** One answer to one question, in practice or in a mock exam. */
export interface LidAnswer {
  /** question id — `general-001`…`general-300` or `<state>-01`…`<state>-10` */
  q: string;
  /** the option chosen, by its SOURCE key (never a shuffled position); null = left unanswered */
  chosen: LidOptionKey | null;
  correct: boolean;
  ts: number;
  mode: 'practice' | 'exam';
  /** the bank's `dataset.version` the answer was graded against */
  bank: string;
}

/** One submitted mock exam. A simulation: never an official Fragebogen (EinbTestV §1 Abs. 2). */
export interface LidExamRun {
  id: string;
  /** the state whose three questions were drawn, e.g. `BY` */
  state: string;
  /** the bank's `dataset.version` */
  bank: string;
  startedAt: number;
  submittedAt: number;
  /** the 33 question ids, in the order they were shown */
  items: string[];
  /** chosen source key per item; null or absent = unanswered */
  answers: Record<string, LidOptionKey | null>;
  correct: number;
  timedOut: boolean;
}

export interface LidState {
  /** FSRS state per question id — the same `StoredCard` shape as the course's cards */
  cards: Record<string, StoredCard>;
  /** every answer, sorted by `ts` */
  answers: LidAnswer[];
  /** every submitted mock, sorted by `submittedAt` */
  exams: LidExamRun[];
}

/** Nothing here mutates a state it is handed, so one shared empty state is safe to start from. */
export const EMPTY_LID_STATE: LidState = { cards: {}, answers: [], exams: [] };

/** Identity of one answer — the dedupe key for merges, journal replays and timed retries. */
export const lidAnswerKey = (answer: Pick<LidAnswer, 'q' | 'ts'>) => `${answer.q}|${answer.ts}`;

const byTs = (a: LidAnswer, b: LidAnswer) => a.ts - b.ts;
const bySubmitted = (a: LidExamRun, b: LidExamRun) => a.submittedAt - b.submittedAt;

/**
 * Append one answer and grade its question. **Idempotent**: an answer already in the log —
 * a journal replay or a retried transaction of a write that landed — returns `state` itself.
 *
 * The grade goes through `applyGradeAt`, whose `last_review >= ts` guard also keeps an OLDER
 * answer (arriving late from another device) from regrading a newer card: it is logged, and the
 * card stays as it is.
 */
export function applyLidAnswer(state: LidState, answer: LidAnswer): LidState {
  const key = lidAnswerKey(answer);
  if (state.answers.some((a) => lidAnswerKey(a) === key)) return state;
  const card = applyGradeAt(state.cards[answer.q], answer.correct ? Rating.Good : Rating.Again, answer.ts);
  const last = state.answers.at(-1);
  const answers = [...state.answers, answer];
  if (last && last.ts > answer.ts) answers.sort(byTs);
  return { ...state, cards: { ...state.cards, [answer.q]: card }, answers };
}

/** Record one submitted mock. Idempotent by `run.id`. Grading its items is `applyLidAnswer`'s
    job — the journal writes one exam-mode answer per item beside the run. */
export function applyLidExam(state: LidState, run: LidExamRun): LidState {
  if (state.exams.some((e) => e.id === run.id)) return state;
  return { ...state, exams: [...state.exams, run].sort(bySubmitted) };
}

function unionBy<T>(a: readonly T[], b: readonly T[], key: (item: T) => string): T[] {
  const seen = new Set(a.map(key));
  const out = [...a];
  for (const item of b) {
    const k = key(item);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(item);
    }
  }
  return out;
}

/**
 * Non-destructive merge of two devices' LiD progress — the same rules the rest of the snapshot
 * merges by: answers union by `q|ts`, exams by id, and question states by `mergeCards`, which
 * keeps the more advanced card.
 */
export function mergeLid(a: LidState, b: LidState): LidState {
  return {
    cards: mergeCards(a.cards, b.cards),
    answers: unionBy(a.answers, b.answers, lidAnswerKey).sort(byTs),
    exams: unionBy(a.exams, b.exams, (e) => e.id).sort(bySubmitted),
  };
}

/** Each question's answers, oldest first. */
function answersByQuestion(answers: readonly LidAnswer[]): Map<string, LidAnswer[]> {
  const out = new Map<string, LidAnswer[]>();
  for (const answer of [...answers].sort(byTs)) {
    const own = out.get(answer.q);
    if (own) own.push(answer);
    else out.set(answer.q, [answer]);
  }
  return out;
}

export interface LidPracticeInput {
  /** every question to plan over, in TEACHING order (topic order, then official number) */
  questionIds: readonly string[];
  state: LidState;
  now: Date;
  /** new questions per local day — counted against LiD's own cards, never the course's budget */
  newPerDay: number;
  limit?: number;
}

/**
 * The practice queue: due questions first, most overdue first, then never-answered questions in
 * teaching order up to what is left of today's new-question allowance.
 *
 * The allowance is per DAY, not per queue, for the reason `planReview` gives: the queue is
 * rebuilt on every mount, so a per-queue cap alone deals a reloading learner a fresh batch each
 * time. Due ties keep teaching order rather than breaking at random — a LiD question has no
 * sibling card whose answer it could hand over, so determinism costs nothing here.
 */
export function planLidPractice({ questionIds, state, now, newPerDay, limit }: LidPracticeInput): string[] {
  const due: string[] = [];
  const fresh: string[] = [];
  for (const id of new Set(questionIds)) {
    const card = state.cards[id];
    if (!card) fresh.push(id);
    else if (Date.parse(card.due) <= now.getTime()) due.push(id);
  }
  due.sort((a, b) => Date.parse(state.cards[a]!.due) - Date.parse(state.cards[b]!.due));
  const allowance = Math.max(0, newPerDay - introducedToday(state.cards, now));
  const queue = [...due, ...fresh.slice(0, allowance)];
  return limit === undefined ? queue : queue.slice(0, Math.max(0, limit));
}

/** Questions whose MOST RECENT answer was wrong, most recent first — optionally within a set. */
export function lidMistakes(state: LidState, questionIds?: readonly string[]): string[] {
  const within = questionIds ? new Set(questionIds) : undefined;
  const latest: LidAnswer[] = [];
  for (const [q, answers] of answersByQuestion(state.answers)) {
    if (within && !within.has(q)) continue;
    const last = answers.at(-1)!;
    if (!last.correct) latest.push(last);
  }
  return latest.sort((a, b) => b.ts - a.ts).map((a) => a.q);
}

/** A small seeded PRNG (mulberry32): uniform in [0, 1), the same sequence for the same seed. */
export function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates driven by the given generator, so a seed reproduces the order. */
function seededShuffle<T>(items: readonly T[], rng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

/**
 * Draw one mock exam: 30 distinct general questions and 3 distinct questions of `state`, the
 * state's three at random positions among the 33. Deterministic for a given generator, and it
 * throws rather than drawing a short exam from a pool too small to fill one.
 *
 * The real Fragebögen are not published (EinbTestV §1 Abs. 2), so a draw is a simulation and must
 * never be presented as an official sheet.
 */
export function drawMockExam(bank: Pick<LidBank, 'questions'>, state: string, rng: () => number): string[] {
  const generalCount = LID_EXAM.questions - LID_EXAM.stateQuestions;
  const general = [...new Set(bank.questions.filter((q) => q.scope === 'general').map((q) => q.id))];
  const local = [
    ...new Set(bank.questions.filter((q) => q.scope === 'state' && q.stateCode === state).map((q) => q.id)),
  ];
  if (general.length < generalCount)
    throw new Error(`A mock exam needs ${generalCount} general questions; the bank has ${general.length}.`);
  if (local.length < LID_EXAM.stateQuestions)
    throw new Error(`A mock exam needs ${LID_EXAM.stateQuestions} questions for ${state}; the bank has ${local.length}.`);
  const drawn = [
    ...seededShuffle(general, rng).slice(0, generalCount),
    ...seededShuffle(local, rng).slice(0, LID_EXAM.stateQuestions),
  ];
  return seededShuffle(drawn, rng);
}

export interface LidMockScore {
  correct: number;
  /** ≥ 17 of 33: the Einbürgerungstest (EinbTestV §1 Abs. 3) */
  passEinbuergerung: boolean;
  /** ≥ 15 of 33: the test at the end of the Orientierungskurs — a DIFFERENT pass mark */
  passOrientierungskurs: boolean;
}

/** Score a mock. An unanswered item counts 0; an item with no answer key is a programming
    error and throws, rather than silently scoring as wrong. */
export function scoreMock(
  items: readonly string[],
  answers: Readonly<Record<string, LidOptionKey | null>>,
  solutions: Readonly<Record<string, LidOptionKey>>,
): LidMockScore {
  let correct = 0;
  for (const id of items) {
    const solution = solutions[id];
    if (!solution) throw new Error(`No answer key for mock item ${id}.`);
    if (answers[id] === solution) correct++;
  }
  return {
    correct,
    passEinbuergerung: correct >= LID_EXAM.passEinbuergerung,
    passOrientierungskurs: correct >= LID_EXAM.passOrientierungskurs,
  };
}

/** The exam-mode answer per mock item, journaled beside the run so a missed mock question is
    scheduled for review like a missed practice one. Each carries the run's `submittedAt`. */
export function lidExamAnswers(run: LidExamRun, solutions: Readonly<Record<string, LidOptionKey>>): LidAnswer[] {
  return run.items.map((q) => {
    const chosen = run.answers[q] ?? null;
    return { q, chosen, correct: chosen !== null && chosen === solutions[q], ts: run.submittedAt, mode: 'exam', bank: run.bank };
  });
}

const IMAGE_OPTION = /^Bild \d$/;

/**
 * May practice present this question's options in another order? Not when the options are
 * `Bild 1`…`Bild 4`: those name numbered pictures in the question's image, and shuffling the
 * labels would detach them from the pictures they point at. The mock exam never shuffles.
 */
export function shouldShuffleOptions(question: Pick<LidQuestion, 'answers'>): boolean {
  return !Object.values(question.answers).some((text) => IMAGE_OPTION.test(text));
}

export interface LidReadiness {
  /** questions in scope */
  total: number;
  /** answered at least once */
  seen: number;
  /** whose two most recent answers are both correct */
  lastTwoCorrect: number;
  /** with a question state due now */
  due: number;
  /** whose most recent answer was wrong */
  mistakes: number;
  /** the last ten mocks, oldest first */
  exams: Array<{ submittedAt: number; correct: number }>;
}

/** Readiness as plain facts over `questionIds` — no probability, no composite score (ADR 0021). */
export function lidReadiness(state: LidState, questionIds: readonly string[], now: Date): LidReadiness {
  const ids = new Set(questionIds);
  const answered = answersByQuestion(state.answers);
  let seen = 0;
  let lastTwoCorrect = 0;
  let due = 0;
  for (const id of ids) {
    const answers = answered.get(id);
    if (answers) {
      seen++;
      const [before, last] = answers.slice(-2);
      if (before?.correct && last?.correct) lastTwoCorrect++;
    }
    const card = state.cards[id];
    if (card && Date.parse(card.due) <= now.getTime()) due++;
  }
  return {
    total: ids.size,
    seen,
    lastTwoCorrect,
    due,
    mistakes: lidMistakes(state, questionIds).length,
    exams: [...state.exams]
      .sort(bySubmitted)
      .slice(-10)
      .map(({ submittedAt, correct }) => ({ submittedAt, correct })),
  };
}
