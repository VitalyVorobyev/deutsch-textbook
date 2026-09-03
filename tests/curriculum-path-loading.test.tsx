/**
 * CurriculumPath's `ctx` starts null and stays null until getAttempts/getCardStates/
 * getTopicsState/getLearningGoal all resolve — every render before that used an empty
 * `completions` map, which is indistinguishable from "confirmed untouched": every topic
 * rendered its "Neu" badge with no loading gate. This test stalls all four reads and
 * pins that the page shows an explicit loading state instead — and, so the fixture
 * cannot silently pass by omission, states every field the assertions below depend on:
 * one topic, one unit, one badge slot that must NOT read "Neu" while data is still in
 * flight.
 *
 * **The loading gate was only half an answer, and this file used to pin the other half as
 * correct.** There was no deadline and no rejection handler here — the only daily-loop
 * surface without either — so a stalled read left the Russian "Загружаем ваш прогресс…"
 * on screen forever, while 824 cards and 3919 attempts sat in the store on disk. The three
 * cases below the first one are ADR 0018: a failed read reaches an error state with a way
 * back, the retry re-issues the reads, and a read that comes back *empty* for a profile
 * that has persisted progress before is treated as a failure rather than as a beginner.
 *
 * Scope: the four store reads are mocked; `withReadRetry` is NOT — `mock.module` is
 * process-wide in bun and replacing a store primitive here would hand it to every test file
 * that runs after this one. The component therefore goes through the real wrapper, and the
 * failure cases drive it the way a broken store does: a read that *rejects* is not retried
 * (only silence is), so the error state arrives in milliseconds without waiting on the 10 s
 * deadline. The wrapper's own timers, deadline and stall-log side effects are pinned against
 * the real implementation in store-read-retry.test.ts.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { act, cleanup, render, screen } from '@testing-library/react';
import type { ComponentType } from 'react';
import type { CourseTopic, CourseUnit } from '../src/components/atlas/course';
import type { AtlasGroup } from '@da/schema';
import * as store from '../src/lib/store';

const neverResolves = <T,>() => new Promise<T>(() => {});
const getAttempts = mock(() => neverResolves<store.Attempt[]>());
const getCardStates = mock(() => neverResolves<store.CardStates>());
const getTopicsState = mock(() => neverResolves<store.TopicsState>());
const getLearningGoal = mock(() => neverResolves<store.LearningGoal | undefined>());

/** Every read fails the way a dead object store does — `withReadRetry` passes a rejection
    straight through, so this is the whole "the store answered, and the answer was no" path. */
function allReadsReject() {
  const fail = () => Promise.reject(new Error('NotFoundError'));
  getAttempts.mockImplementation(fail as never);
  getCardStates.mockImplementation(fail as never);
  getTopicsState.mockImplementation(fail as never);
  getLearningGoal.mockImplementation(fail as never);
}

function allReadsResolveEmpty() {
  getAttempts.mockImplementation(() => Promise.resolve([]));
  getCardStates.mockImplementation(() => Promise.resolve({}));
  getTopicsState.mockImplementation(() => Promise.resolve({}));
  getLearningGoal.mockImplementation(() => Promise.resolve(undefined));
}

mock.module('../src/lib/store', () => ({
  ...store,
  getAttempts,
  getCardStates,
  getTopicsState,
  getLearningGoal,
}));

let CurriculumPath: ComponentType<{ units: CourseUnit[]; groups: AtlasGroup[]; spine: string[] }>;

beforeAll(async () => {
  ({ default: CurriculumPath } = await import('../src/components/atlas/CurriculumPath'));
});

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('da:profiles', JSON.stringify([{ id: 'test', label: 'Test' }]));
  localStorage.setItem('da:profile', 'test');
  getAttempts.mockImplementation(() => neverResolves<store.Attempt[]>());
  getCardStates.mockImplementation(() => neverResolves<store.CardStates>());
  getTopicsState.mockImplementation(() => neverResolves<store.TopicsState>());
  getLearningGoal.mockImplementation(() => neverResolves<store.LearningGoal | undefined>());
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  getAttempts.mockClear();
  getCardStates.mockClear();
  getTopicsState.mockClear();
  getLearningGoal.mockClear();
});

const topic = {
  id: 't1',
  exerciseSets: [],
  vocabIds: [],
  readingIds: [],
  path: '/topics/a1/t1',
  level: 'A1',
  kind: 'topic',
  title_de: 'Testthema',
  title_en: 'Test topic',
  title_ru: 'Тестовая тема',
  prerequisites: [],
  strand: 'grammar',
  group: 'g1',
  outcomes: [],
  deepens: [],
  related: [],
} as unknown as CourseTopic;

const unit = {
  id: 'u1',
  level: 'A1',
  title_de: 'Einheit 1',
  title_en: 'Unit 1',
  title_ru: 'Раздел 1',
  topics: [topic],
} as CourseUnit;

const renderPath = () => render(<CurriculumPath units={[unit]} groups={[]} spine={['t1']} />);

describe('CurriculumPath with never-resolving reads', () => {
  test('renders the loading state and zero "Neu" badges', async () => {
    renderPath();

    expect(await screen.findByText(/Loading your progress/)).toBeTruthy();
    // The bug: every topic's TierBadge defaulted to 'untouched' ("Neu") before ctx
    // resolved. With the loading gate, nothing claiming completion status renders at all.
    expect(screen.queryByText('Neu')).toBeNull();
    expect(screen.queryByText(topic.title_de)).toBeNull();

    // The reads were attempted — this is a loading state, not a broken one.
    expect(getAttempts).toHaveBeenCalled();
    expect(getCardStates).toHaveBeenCalled();
    expect(getTopicsState).toHaveBeenCalled();
    expect(getLearningGoal).toHaveBeenCalled();
  });
});

describe('CurriculumPath when the read fails', () => {
  test('a failed read reaches the error state instead of loading forever', async () => {
    allReadsReject();
    renderPath();

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Fortschritt konnte nicht geladen werden');
    // The permanent-loading defect: this text must be gone, not sitting underneath.
    expect(screen.queryByText(/Загружаем ваш прогресс|Loading your progress/)).toBeNull();
    expect(screen.queryByText('Neu')).toBeNull();
  });

  test('the retry button re-issues the reads, and a store that has recovered renders', async () => {
    allReadsReject();
    renderPath();

    const retry = await screen.findByRole('button', { name: 'Erneut versuchen' });
    const before = getAttempts.mock.calls.length;
    allReadsResolveEmpty();
    act(() => retry.click());

    // The view tablist only renders past the `ctx === null` gate, so its presence IS
    // "the retry worked" — and the reads were genuinely issued again.
    expect(await screen.findByRole('tablist')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(getAttempts.mock.calls.length).toBeGreaterThan(before);
  });

  test('an empty read for a profile that has stored progress before is a failure, not a beginner', async () => {
    // The markers `markSeenData` writes: this profile has persisted cards and attempts.
    // Reading back nothing at all is therefore a stalled store — and on this page that
    // would mean every topic wearing "Neu" and the Lernpfad pointing back at unit 1.
    localStorage.setItem('da:seen-data:cards:test', '1');
    localStorage.setItem('da:seen-data:attempts:test', '1');
    allReadsResolveEmpty();

    renderPath();

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Fortschritt konnte nicht geladen werden');
    expect(screen.queryByText('Neu')).toBeNull();
  });

  test('an empty read for a genuinely new profile still renders the course', async () => {
    // The other side of the same gate, so it cannot be satisfied by erroring on every
    // empty read: with no markers set, empty means what it says. The view tablist only
    // renders past the `ctx === null` gate, so its presence IS "the page loaded"
    // (the atlas panel itself stays empty here — this fixture ships no groups).
    allReadsResolveEmpty();

    renderPath();

    expect(await screen.findByRole('tablist')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/Загружаем ваш прогресс|Loading your progress/)).toBeNull();
  });
});
