import { describe, expect, test } from 'bun:test';
import { pullRequestGateProblems, type PullRequestGateInput } from '../scripts/pr-review-gate';

const passing: PullRequestGateInput = {
  isDraft: false,
  headRefOid: 'abcdef1234567890',
  statusCheckRollup: [{ name: 'CI', status: 'COMPLETED', conclusion: 'SUCCESS' }],
  reviewDecision: null,
  reviews: [
    {
      author: { login: 'chatgpt-codex-connector' },
      body: '### Codex Review\n\n**Reviewed commit:** `abcdef123456`',
      state: 'COMMENTED',
    },
  ],
  opinionatedReviews: [],
  threads: [{ isResolved: true, isOutdated: false, path: 'file.ts', line: 1 }],
};

describe('pull-request review gate', () => {
  test('passes only a green non-draft PR reviewed at current HEAD', () => {
    expect(pullRequestGateProblems(passing)).toEqual([]);
  });

  test('rejects unresolved threads, stale review, draft state and pending CI', () => {
    const problems = pullRequestGateProblems({
      ...passing,
      isDraft: true,
      headRefOid: 'ffff001122334455',
      statusCheckRollup: [{ name: 'CI', status: 'IN_PROGRESS' }],
      threads: [{ isResolved: false, isOutdated: false, path: 'content/topic.mdx', line: 42 }],
    });
    expect(problems).toContain('pull request is a draft');
    expect(problems).toContain('unresolved review thread at content/topic.mdx:42');
    expect(problems).toContain('CI check "CI" is not successful');
    expect(problems).toContain('Codex review has not completed against HEAD ffff00112233');
  });

  test('ignores outdated unresolved threads', () => {
    expect(
      pullRequestGateProblems({
        ...passing,
        threads: [{ isResolved: false, isOutdated: true, path: 'old.ts', line: 3 }],
      }),
    ).toEqual([]);
  });

  test('rejects an outstanding summary-only change request', () => {
    expect(
      pullRequestGateProblems({
        ...passing,
        reviews: [
          ...passing.reviews,
          {
            author: { login: 'reviewer' },
            body: 'A later non-opinionated note.',
            state: 'COMMENTED',
          },
        ],
        opinionatedReviews: [
          {
            author: { login: 'reviewer' },
            state: 'CHANGES_REQUESTED',
          },
        ],
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

  test('rejects lookalike reviewers and abbreviated hashes below the review contract', () => {
    expect(
      pullRequestGateProblems({
        ...passing,
        reviews: [
          {
            author: { login: 'friendly-codex-reviewer' },
            body: '**Reviewed commit:** `abcdef123456`',
          },
        ],
      }),
    ).toContain('Codex review has not completed against HEAD abcdef123456');

    expect(
      pullRequestGateProblems({
        ...passing,
        reviews: [
          {
            author: { login: 'chatgpt-codex-connector' },
            body: '**Reviewed commit:** `a`',
          },
        ],
      }),
    ).toContain('Codex review has not completed against HEAD abcdef123456');
  });

  test('accepts the exact GitHub App bot-login form', () => {
    expect(
      pullRequestGateProblems({
        ...passing,
        reviews: [
          {
            author: { login: 'chatgpt-codex-connector[bot]' },
            body: '**Reviewed commit:** `abcdef123456`',
          },
        ],
      }),
    ).toEqual([]);
  });
});
