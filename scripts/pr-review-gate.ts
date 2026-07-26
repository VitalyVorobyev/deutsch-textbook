/**
 * Read-only merge gate for the current pull request.
 *
 * It intentionally uses thread-aware GraphQL data: `gh pr view` flattens review
 * comments and cannot tell whether an inline thread was resolved.
 */
import { execFileSync } from 'node:child_process';

export interface PullRequestGateInput {
  isDraft: boolean;
  headRefOid: string;
  statusCheckRollup: Array<{
    name?: string;
    context?: string;
    status?: string;
    conclusion?: string;
    state?: string;
  }>;
  reviewDecision?: string | null;
  reviews: Array<{
    author?: { login?: string };
    body?: string;
    state?: string;
    submittedAt?: string;
  }>;
  comments: Array<{ author?: { login?: string }; body?: string }>;
  opinionatedReviews: Array<{ author?: { login?: string }; state?: string }>;
  threads: Array<{ isResolved: boolean; isOutdated: boolean; path: string; line?: number | null }>;
}

const CODEX_REVIEW_LOGINS = new Set([
  'chatgpt-codex-connector',
  'chatgpt-codex-connector[bot]',
]);

const successfulCheck = (check: PullRequestGateInput['statusCheckRollup'][number]): boolean => {
  if (check.state) return ['SUCCESS', 'NEUTRAL', 'SKIPPED'].includes(check.state);
  return (
    check.status === 'COMPLETED' &&
    !!check.conclusion &&
    ['SUCCESS', 'NEUTRAL', 'SKIPPED'].includes(check.conclusion)
  );
};

export function pullRequestGateProblems(input: PullRequestGateInput): string[] {
  const problems: string[] = [];
  if (input.isDraft) problems.push('pull request is a draft');

  const unresolved = input.threads.filter((thread) => !thread.isResolved && !thread.isOutdated);
  for (const thread of unresolved)
    problems.push(`unresolved review thread at ${thread.path}:${thread.line ?? '?'}`);

  const requestedChanges = input.opinionatedReviews.filter(
    (review) => review.state === 'CHANGES_REQUESTED',
  );
  for (const review of requestedChanges) {
    problems.push(`changes requested by ${review.author?.login ?? 'unknown reviewer'}`);
  }
  if (input.reviewDecision === 'CHANGES_REQUESTED' && requestedChanges.length === 0) {
    // Keep the aggregate decision as a fallback if GitHub cannot expose the
    // reviewer (for example because permissions or pagination change).
    problems.push('pull request has outstanding requested changes');
  }

  if (input.statusCheckRollup.length === 0) {
    problems.push('no CI checks are reported');
  } else {
    for (const check of input.statusCheckRollup) {
      if (!successfulCheck(check))
        problems.push(`CI check "${check.name ?? check.context ?? 'unnamed'}" is not successful`);
    }
  }

  // Codex submits a GitHub review when it has inline findings, but records a
  // clean result as an issue comment. Both are trusted only by exact bot login
  // and an explicit sufficiently long current-HEAD hash.
  const codexReviewedHead = [...input.reviews, ...input.comments].some((report) => {
    if (!report.author?.login || !CODEX_REVIEW_LOGINS.has(report.author.login)) return false;
    const reviewedCommit = report.body?.match(/Reviewed commit:\*{0,2}\s*`([a-f0-9]{10,40})`/i)?.[1];
    return !!reviewedCommit && input.headRefOid.startsWith(reviewedCommit);
  });
  if (!codexReviewedHead) problems.push(`Codex review has not completed against HEAD ${input.headRefOid.slice(0, 12)}`);

  return problems;
}

function ghJson<T>(args: string[]): T {
  return JSON.parse(execFileSync('gh', args, { encoding: 'utf8' })) as T;
}

function fetchThreads(owner: string, repo: string, number: number): PullRequestGateInput['threads'] {
  const query = `
    query($owner: String!, $repo: String!, $number: Int!, $after: String) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $number) {
          reviewThreads(first: 100, after: $after) {
            pageInfo { hasNextPage endCursor }
            nodes { isResolved isOutdated path line }
          }
        }
      }
    }`;
  const threads: PullRequestGateInput['threads'] = [];
  let after: string | null = null;
  do {
    const args = [
      'api',
      'graphql',
      '-f',
      `query=${query}`,
      '-f',
      `owner=${owner}`,
      '-f',
      `repo=${repo}`,
      '-F',
      `number=${number}`,
    ];
    if (after) args.push('-f', `after=${after}`);
    const response = ghJson<{
      data: {
        repository: {
          pullRequest: {
            reviewThreads: {
              pageInfo: { hasNextPage: boolean; endCursor: string | null };
              nodes: PullRequestGateInput['threads'];
            };
          };
        };
      };
    }>(args);
    const page = response.data.repository.pullRequest.reviewThreads;
    threads.push(...page.nodes);
    after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (after);
  return threads;
}

function fetchReviewStatus(
  owner: string,
  repo: string,
  number: number,
): Pick<PullRequestGateInput, 'reviewDecision' | 'opinionatedReviews'> {
  const query = `
    query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $number) {
          reviewDecision
          latestOpinionatedReviews(first: 100) {
            nodes { state author { login } }
          }
        }
      }
    }`;
  const response = ghJson<{
    data: {
      repository: {
        pullRequest: {
          reviewDecision: string | null;
          latestOpinionatedReviews: { nodes: PullRequestGateInput['opinionatedReviews'] };
        };
      };
    };
  }>([
    'api',
    'graphql',
    '-f',
    `query=${query}`,
    '-f',
    `owner=${owner}`,
    '-f',
    `repo=${repo}`,
    '-F',
    `number=${number}`,
  ]);
  const review = response.data.repository.pullRequest;
  return {
    reviewDecision: review.reviewDecision,
    opinionatedReviews: review.latestOpinionatedReviews.nodes,
  };
}

export function runPullRequestGate(): void {
  const repository = ghJson<{ nameWithOwner: string }>([
    'repo',
    'view',
    '--json',
    'nameWithOwner',
  ]).nameWithOwner;
  const [owner, repo] = repository.split('/');
  if (!owner || !repo) throw new Error(`cannot parse repository "${repository}"`);

  const pr = ghJson<{
    number: number;
    url: string;
    isDraft: boolean;
    headRefOid: string;
    statusCheckRollup: PullRequestGateInput['statusCheckRollup'];
    latestReviews: PullRequestGateInput['reviews'];
    comments: PullRequestGateInput['comments'];
  }>([
    'pr',
    'view',
    '--json',
    'number,url,isDraft,headRefOid,statusCheckRollup,latestReviews,comments',
  ]);
  const input: PullRequestGateInput = {
    isDraft: pr.isDraft,
    headRefOid: pr.headRefOid,
    statusCheckRollup: pr.statusCheckRollup,
    reviews: pr.latestReviews,
    comments: pr.comments,
    ...fetchReviewStatus(owner, repo, pr.number),
    threads: fetchThreads(owner, repo, pr.number),
  };
  const problems = pullRequestGateProblems(input);
  if (problems.length) {
    console.error(`PR review gate failed for ${pr.url}:`);
    for (const problem of problems) console.error(`- ${problem}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PR review gate passed for ${pr.url} at ${pr.headRefOid.slice(0, 12)}.`);
}

if (import.meta.main) runPullRequestGate();
