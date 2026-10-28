/**
 * Leben in Deutschland — the trainer's pure logic. ADR 0009.
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
 * is facts — seen, each question's status (`lidQuestionStatus`), due, mock scores — never a pass
 * probability.
 *
 * Pure: no `node:fs` and no store access, because React islands import it. (`./store` appears
 * below for its types only.)
 */
import { LID_EXAM, type LidBank, type LidOptionKey, type LidQuestion } from '@da/schema/lid';
import { localDateString } from './local-date';
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
  const card = applyGradeAt(
    state.cards[answer.q],
    answer.correct ? Rating.Good : Rating.Again,
    answer.ts,
  );
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
  /** Given, each group (due, then new) is dealt in random order; omitted, the order below. */
  rng?: () => number;
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
export function planLidPractice({
  questionIds,
  state,
  now,
  newPerDay,
  limit,
  rng,
}: LidPracticeInput): string[] {
  const due: string[] = [];
  const fresh: string[] = [];
  for (const id of new Set(questionIds)) {
    const card = state.cards[id];
    if (!card) fresh.push(id);
    else if (Date.parse(card.due) <= now.getTime()) due.push(id);
  }
  due.sort((a, b) => Date.parse(state.cards[a]!.due) - Date.parse(state.cards[b]!.due));
  const allowance = Math.max(0, newPerDay - practiceIntroducedToday(state, now));
  // The allowance picks today's new questions in teaching order; only their order is shuffled.
  const queue = [...within(due, rng), ...within(fresh.slice(0, allowance), rng)];
  return limit === undefined ? queue : queue.slice(0, Math.max(0, limit));
}

export interface LidScopedPracticeInput {
  /** the questions in scope — a lesson's — in TEACHING order */
  questionIds: readonly string[];
  state: LidState;
  /**
   * The moment of the read, as `planLidPractice` takes it. The order does not depend on it — a
   * drill deals every question, due or not, and sorting the answered ones by due date already
   * puts the most overdue first — but the call reads one clock like every other planner here.
   */
  now: Date;
  /** Given, each of the three groups is dealt in random order; omitted, the order below. */
  rng?: () => number;
}

/**
 * A deliberate "drill this topic now" (`/pruefung/leben/ueben?lektion=<id>`): EVERY question in scope,
 * with no daily allowance — the learner chose this set, so holding questions back would only
 * hide part of it. Ordered by what most needs the attention:
 *
 *  1. last answer wrong, most recent first (`lidMistakes`);
 *  2. never answered, in the given teaching order;
 *  3. the rest by due date, soonest first — not-yet-due questions included. Ties keep the given
 *     order, as `planLidPractice`'s do.
 *
 * A question first met here still gets its card through `applyLidAnswer`, so this queue spends
 * the day's new-question allowance like any practice — what it skips is only the cap.
 */
export function planLidScopedPractice({
  questionIds,
  state,
  rng,
}: LidScopedPracticeInput): string[] {
  const ids = [...new Set(questionIds)];
  const wrong = lidMistakes(state, ids);
  const wrongSet = new Set(wrong);
  const answered = new Set(state.answers.map((answer) => answer.q));
  const fresh: string[] = [];
  const rest: string[] = [];
  for (const id of ids) {
    if (wrongSet.has(id)) continue;
    if (!answered.has(id) && !state.cards[id]) fresh.push(id);
    else rest.push(id);
  }
  // A question answered but without a state (it cannot arise through `applyLidAnswer`) sorts last.
  const due = (id: string) => {
    const card = state.cards[id];
    return card ? Date.parse(card.due) : Number.POSITIVE_INFINITY;
  };
  rest.sort((a, b) => {
    const [x, y] = [due(a), due(b)];
    return x === y ? 0 : x < y ? -1 : 1;
  });
  return [...within(wrong, rng), ...within(fresh, rng), ...within(rest, rng)];
}

/**
 * New questions today's PRACTICE has already dealt. A question first met in a mock exam is not
 * one of them: the mock schedules it (a miss comes back for review), but it must not spend the
 * day's allowance — otherwise one mock on a fresh profile introduces 33 questions and practice
 * offers nothing new until tomorrow, which is a month-long plan losing a day per mock.
 */
function practiceIntroducedToday(state: LidState, now: Date): number {
  const metInExam = new Set<string>();
  for (const [q, answers] of answersByQuestion(state.answers))
    if (answers[0]!.mode === 'exam') metInExam.add(q);
  const practiced = Object.fromEntries(
    Object.entries(state.cards).filter(([q]) => !metInExam.has(q)),
  );
  return introducedToday(practiced, now);
}

/**
 * Where a question stands, read one local DAY at a time: a day is right only when every answer the
 * question got that day was right.
 *
 * Practice re-asks a missed question later in the same sitting until it is answered right
 * (`recordMiss`), so a question's latest answer is right almost by construction, and "wrong last
 * time" read off it was close to zero however many questions had been missed. The retry is
 * answered with the feedback still fresh — it shows the learner saw the answer, not that they know
 * it — so a right retry cannot rescue its day, while a wrong answer always counts:
 *
 *  - `unseen` — never answered;
 *  - `missed` — wrong on the latest day it came up;
 *  - `shaky` — right on the latest day, but not on two days running;
 *  - `secure` — right on the last two days it came up.
 *
 * A mistake therefore closes only on a later day, when the question is answered right again.
 */
export type LidStatus = 'unseen' | 'missed' | 'shaky' | 'secure';

/** A question's answers, oldest first, reduced to one verdict per local day, oldest first. */
function dayVerdicts(answers: readonly LidAnswer[]): Array<{ day: string; correct: boolean }> {
  const out: Array<{ day: string; correct: boolean }> = [];
  for (const answer of answers) {
    const day = localDateString(new Date(answer.ts));
    const last = out.at(-1);
    if (last?.day === day) last.correct &&= answer.correct;
    else out.push({ day, correct: answer.correct });
  }
  return out;
}

/** One question's status from its answers, oldest first (as `answersByQuestion` gives them). */
export function lidQuestionStatus(answers: readonly LidAnswer[] | undefined): LidStatus {
  if (!answers?.length) return 'unseen';
  const days = dayVerdicts(answers);
  if (!days.at(-1)!.correct) return 'missed';
  return days.at(-2)?.correct ? 'secure' : 'shaky';
}

/** Every question's status within `questionIds`. */
export function lidStatuses(
  state: LidState,
  questionIds: readonly string[],
): Map<string, LidStatus> {
  const answered = answersByQuestion(state.answers);
  return new Map(questionIds.map((id) => [id, lidQuestionStatus(answered.get(id))]));
}

/**
 * The questions to review as mistakes, most recently answered first — optionally within a set:
 * status `missed`, less those missed today whose latest answer is already right again. Those stay
 * `missed` until a later day, but asking them again today would only re-ask what the learner has
 * just put right.
 */
export function lidMistakes(
  state: LidState,
  questionIds?: readonly string[],
  now: Date = new Date(),
): string[] {
  const within = questionIds ? new Set(questionIds) : undefined;
  const today = localDateString(now);
  const latest: LidAnswer[] = [];
  for (const [q, answers] of answersByQuestion(state.answers)) {
    if (within && !within.has(q)) continue;
    if (lidQuestionStatus(answers) !== 'missed') continue;
    const last = answers.at(-1)!;
    if (last.correct && localDateString(new Date(last.ts)) === today) continue;
    latest.push(last);
  }
  return latest.sort((a, b) => b.ts - a.ts).map((a) => a.q);
}

/** A practice queue in random order — the order says nothing about the answers. */
export function shuffleQueue<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  return seededShuffle(items, rng);
}

/** One group of a queue: shuffled when a generator is given, as it stands when not. */
function within<T>(items: T[], rng: (() => number) | undefined): T[] {
  return rng ? seededShuffle(items, rng) : items;
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
export function drawMockExam(
  bank: Pick<LidBank, 'questions'>,
  state: string,
  rng: () => number,
): string[] {
  const generalCount = LID_EXAM.questions - LID_EXAM.stateQuestions;
  const general = [
    ...new Set(bank.questions.filter((q) => q.scope === 'general').map((q) => q.id)),
  ];
  const local = [
    ...new Set(
      bank.questions.filter((q) => q.scope === 'state' && q.stateCode === state).map((q) => q.id),
    ),
  ];
  if (general.length < generalCount)
    throw new Error(
      `A mock exam needs ${generalCount} general questions; the bank has ${general.length}.`,
    );
  if (local.length < LID_EXAM.stateQuestions)
    throw new Error(
      `A mock exam needs ${LID_EXAM.stateQuestions} questions for ${state}; the bank has ${local.length}.`,
    );
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
export function lidExamAnswers(
  run: LidExamRun,
  solutions: Readonly<Record<string, LidOptionKey>>,
): LidAnswer[] {
  return run.items.map((q) => {
    const chosen = run.answers[q] ?? null;
    return {
      q,
      chosen,
      correct: chosen !== null && chosen === solutions[q],
      ts: run.submittedAt,
      mode: 'exam',
      bank: run.bank,
    };
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
  /** status `secure`: right at the first try on the last two days it came up */
  secure: number;
  /** status `shaky`: right at the latest first try, not yet two days running */
  shaky: number;
  /** status `missed`: wrong at the latest first try */
  missed: number;
  /** with a question state due now */
  due: number;
  /** still to review as mistakes today (`lidMistakes`) */
  mistakes: number;
  /** the last ten mocks, oldest first */
  exams: Array<{ submittedAt: number; correct: number }>;
}

/** Readiness as plain facts over `questionIds` — no probability, no composite score (ADR 0009). */
export function lidReadiness(
  state: LidState,
  questionIds: readonly string[],
  now: Date,
): LidReadiness {
  const ids = new Set(questionIds);
  const answered = answersByQuestion(state.answers);
  const count = { unseen: 0, missed: 0, shaky: 0, secure: 0 };
  let due = 0;
  for (const id of ids) {
    count[lidQuestionStatus(answered.get(id))]++;
    const card = state.cards[id];
    if (card && Date.parse(card.due) <= now.getTime()) due++;
  }
  return {
    total: ids.size,
    seen: ids.size - count.unseen,
    secure: count.secure,
    shaky: count.shaky,
    missed: count.missed,
    due,
    mistakes: lidMistakes(state, questionIds, now).length,
    exams: [...state.exams]
      .sort(bySubmitted)
      .slice(-10)
      .map(({ submittedAt, correct }) => ({ submittedAt, correct })),
  };
}
