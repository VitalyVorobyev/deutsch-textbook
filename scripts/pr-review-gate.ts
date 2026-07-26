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
  reviews: Array<{ author?: { login?: string }; body?: string }>;
  threads: Array<{ isResolved: boolean; isOutdated: boolean; path: string; line?: number | null }>;
}

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

  if (input.statusCheckRollup.length === 0) {
    problems.push('no CI checks are reported');
  } else {
    for (const check of input.statusCheckRollup) {
      if (!successfulCheck(check))
        problems.push(`CI check "${check.name ?? check.context ?? 'unnamed'}" is not successful`);
    }
  }

  const codexReviewedHead = input.reviews.some((review) => {
    if (!review.author?.login?.includes('codex')) return false;
    const reviewedCommit = review.body?.match(/Reviewed commit:\*{0,2}\s*`([a-f0-9]+)`/i)?.[1];
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
    reviews: PullRequestGateInput['reviews'];
  }>([
    'pr',
    'view',
    '--json',
    'number,url,isDraft,headRefOid,statusCheckRollup,reviews',
  ]);
  const input: PullRequestGateInput = {
    isDraft: pr.isDraft,
    headRefOid: pr.headRefOid,
    statusCheckRollup: pr.statusCheckRollup,
    reviews: pr.reviews,
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
