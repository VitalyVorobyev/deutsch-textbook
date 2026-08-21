import { describe, expect, test } from 'vitest';

import { artifactQaDeepLink } from './App';

describe('Listening Studio information architecture', () => {
  test('keeps the two corpus kinds explicit', () => {
    const kinds = ['dialogue', 'reading'] as const;
    expect(kinds).toEqual(['dialogue', 'reading']);
  });

  test('chart points deep-link to the exact QA fragment', () => {
    expect(artifactQaDeepLink({ project: 12, kind: 'dialogue', focus: 'line-4' })).toBe(
      '#/project/dialogue/12?tab=QA&focus=line-4',
    );
    expect(artifactQaDeepLink({ project: 68, kind: 'reading', focus: 2 })).toBe(
      '#/project/reading/68?tab=QA&focus=2',
    );
    expect(artifactQaDeepLink({ kind: 'reading' })).toBeNull();
  });
});
