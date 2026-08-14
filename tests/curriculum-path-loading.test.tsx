/**
 * CurriculumPath's `ctx` starts null and stays null until getAttempts/getCardStates/
 * getTopicsState/getLearningGoal all resolve — every render before that used an empty
 * `completions` map, which is indistinguishable from "confirmed untouched": every topic
 * rendered its "Neu" badge with no loading gate. This test stalls all four reads and
 * pins that the page now shows an explicit loading state instead — and, so the fixture
 * cannot silently pass by omission, states every field the assertions below depend on:
 * one topic, one unit, one badge slot that must NOT read "Neu" while data is still in
 * flight.
 */
import { afterEach, beforeAll, describe, expect, mock, test } from 'bun:test';
import { cleanup, render, screen } from '@testing-library/react';
import type { ComponentType } from 'react';
import type { CourseTopic, CourseUnit } from '../src/components/atlas/course';
import type { AtlasGroup } from '@da/schema';
import * as store from '../src/lib/store';

const neverResolves = <T,>() => new Promise<T>(() => {});
const getAttempts = mock(() => neverResolves<store.Attempt[]>());
const getCardStates = mock(() => neverResolves<store.CardStates>());
const getTopicsState = mock(() => neverResolves<store.TopicsState>());
const getLearningGoal = mock(() => neverResolves<store.LearningGoal | undefined>());
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

afterEach(() => {
  cleanup();
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

describe('CurriculumPath with never-resolving reads', () => {
  test('renders the loading state and zero "Neu" badges', async () => {
    render(<CurriculumPath units={[unit]} groups={[]} spine={['t1']} />);

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
