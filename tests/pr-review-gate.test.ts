import { describe, expect, test } from 'bun:test';
import { pullRequestGateProblems, type PullRequestGateInput } from '../scripts/pr-review-gate';

const passing: PullRequestGateInput = {
  isDraft: false,
  headRefOid: 'abcdef1234567890',
  statusCheckRollup: [{ name: 'CI', status: 'COMPLETED', conclusion: 'SUCCESS' }],
  reviewDecision: null,
  opinionatedReviews: [],
  threads: [{ isResolved: true, isOutdated: false, path: 'file.ts', line: 1 }],
};

describe('pull-request review gate', () => {
  test('passes a green non-draft PR with resolved threads', () => {
    expect(pullRequestGateProblems(passing)).toEqual([]);
  });

  // The owner retired the required Codex review on 2026-10-10: the gate never waits for a
  // reviewer that has not answered.
  test('passes with no review at all', () => {
    expect(pullRequestGateProblems({ ...passing, threads: [] })).toEqual([]);
  });

  test('rejects unresolved threads, draft state and pending CI', () => {
    const problems = pullRequestGateProblems({
      ...passing,
      isDraft: true,
      statusCheckRollup: [{ name: 'CI', status: 'IN_PROGRESS' }],
      threads: [{ isResolved: false, isOutdated: false, path: 'content/topic.mdx', line: 42 }],
    });
    expect(problems).toContain('pull request is a draft');
    expect(problems).toContain('unresolved review thread at content/topic.mdx:42');
    expect(problems).toContain('CI check "CI" is not successful');
  });

  test('rejects a PR with no CI checks reported', () => {
    expect(pullRequestGateProblems({ ...passing, statusCheckRollup: [] })).toContain(
      'no CI checks are reported',
    );
  });

  test('ignores outdated unresolved threads', () => {
    expect(
      pullRequestGateProblems({
        ...passing,
        threads: [{ isResolved: false, isOutdated: true, path: 'old.ts', line: 3 }],
      }),
    ).toEqual([]);
  });

  test('rejects an outstanding change request', () => {
    expect(
      pullRequestGateProblems({
        ...passing,
        opinionatedReviews: [{ author: { login: 'reviewer' }, state: 'CHANGES_REQUESTED' }],
      }),
    ).toContain('changes requested by reviewer');
  });

  test('rejects the aggregate change decision when reviewer details are unavailable', () => {
    expect(
      pullRequestGateProblems({
        ...passing,
        reviewDecision: 'CHANGES_REQUESTED',
      }),
    ).toContain('pull request has outstanding requested changes');
  });
});
