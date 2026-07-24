import { describe, expect, test } from 'bun:test';
import {
  sanitizeThemenResume,
  THEMEN_RESUME_DEFAULTS,
  type ThemenResume,
} from '../src/components/atlas/themen-resume';

const ctx = {
  levels: new Set(['A1', 'A2']),
  topicIds: new Set(['dativ', 'erste-schritte']),
  groupIds: new Set(['nomen-kasus']),
};

describe('sanitizeThemenResume — never trust a stored shape', () => {
  test('a full valid entry survives unchanged', () => {
    const saved: ThemenResume = {
      query: 'dativ',
      atlas: {
        level: 'A2',
        strand: 'grammar',
        selectedId: 'dativ',
        expandedGroup: 'nomen-kasus',
        drawer: 'open',
      },
      overview: { level: 'A1', status: 'practiced', expandedId: 'erste-schritte' },
      scrollY: 1234,
    };
    expect(sanitizeThemenResume(saved, ctx)).toEqual(saved);
  });

  test('garbage shapes return pure defaults', () => {
    for (const garbage of [null, undefined, 'hi', 42, [], { atlas: 'yes' }]) {
      expect(sanitizeThemenResume(garbage, ctx)).toEqual(THEMEN_RESUME_DEFAULTS);
    }
  });

  test('ids that no longer exist are dropped, unknown enum values default', () => {
    const s = sanitizeThemenResume(
      {
        query: 'x',
        atlas: {
          level: 'B9',
          strand: 'cooking',
          selectedId: 'retired-topic',
          expandedGroup: 'retired-group',
          drawer: 'sideways',
        },
        overview: { level: 7, status: 'legendary', expandedId: 'retired-topic' },
        scrollY: 10,
      },
      ctx,
    );
    expect(s.atlas).toEqual({
      level: 'all', strand: 'all', selectedId: undefined, expandedGroup: undefined, drawer: 'closed',
    });
    expect(s.overview).toEqual({ level: 'all', status: 'all', expandedId: undefined });
    expect(s.query).toBe('x');
    expect(s.scrollY).toBe(10);
  });

  test('a level is valid exactly when a topic carries it — B1 works the day it ships', () => {
    const withB1 = { ...ctx, levels: new Set(['A1', 'A2', 'B1']) };
    const saved = { atlas: { level: 'B1' } };
    expect(sanitizeThemenResume(saved, ctx).atlas.level).toBe('all');
    expect(sanitizeThemenResume(saved, withB1).atlas.level).toBe('B1');
  });

  test('scrollY rejects everything that is not a positive finite number', () => {
    for (const bad of [-5, Number.NaN, Number.POSITIVE_INFINITY, '300', null]) {
      expect(sanitizeThemenResume({ scrollY: bad }, ctx).scrollY).toBe(0);
    }
    expect(sanitizeThemenResume({ scrollY: 777 }, ctx).scrollY).toBe(777);
  });

  test('query must be a string and is capped', () => {
    expect(sanitizeThemenResume({ query: 9 }, ctx).query).toBe('');
    expect(sanitizeThemenResume({ query: 'a'.repeat(500) }, ctx).query).toHaveLength(200);
  });
});
