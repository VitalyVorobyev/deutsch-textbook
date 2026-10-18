/**
 * Properties of the source files themselves, not of the code in them.
 *
 * This exists because the defect it catches survives every other gate. A NUL byte in a
 * `.ts` file is valid TypeScript, so tests, `astro check`, the linter and the production build
 * all pass — but `file` reports the source as `data` instead of text, and grep, ripgrep and
 * every editor search then **skip the file silently**, returning "no matches" rather than
 * an error. Two files in this repo sat that way; working out why a search over
 * `progress-audit.ts` kept coming back empty cost half a dozen dead-end greps.
 *
 * Both were using NUL as a composite-map-key separator, which is a good idea — no rendering
 * can contain one, so no pair of parts can collide. Emitting it as a literal byte rather than
 * as an escape sequence is the part that costs, and it buys nothing: the escape produces the
 * identical string at runtime and leaves the file searchable.
 */
import { expect, test } from 'bun:test';
import { execSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';

const SOURCE = /\.(ts|tsx|astro|md|mdx|yaml|json|css|js)$/;

test('no tracked source file contains a NUL byte', () => {
  const files = execSync('git ls-files -co --exclude-standard', { encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter((f) => SOURCE.test(f));

  // Sanity check on the listing itself — a silently empty file list would make this test
  // pass by measuring nothing, which is the same failure mode it exists to catch.
  expect(files.length).toBeGreaterThan(100);

  const offenders = files.filter((f) => {
    try {
      return readFileSync(f).includes(0);
    } catch {
      return false; // deleted between listing and reading
    }
  });

  expect(offenders).toEqual([]);
});

// History keeps every byte ever committed, so a file that should not have been tracked costs every
// clone for good, even after it is deleted. The learner snapshots reached 17.7 MB raw before they
// were untracked and purged from history. Compressed media is the only content allowed to be large,
// and uncompressed audio never is: published audio is MP3.
const MEDIA = /\.(mp3|ogg|m4a|png|jpe?g|webp|gif|ico|icns|woff2?)$/;
const UNCOMPRESSED_AUDIO = /\.(wav|flac|aiff?)$/;
const MEDIA_LIMIT = 3 * 1024 * 1024;
const TEXT_LIMIT = 256 * 1024;

test('no tracked file is larger than its kind allows', () => {
  const files = execSync('git ls-files -co --exclude-standard', { encoding: 'utf8' })
    .trim()
    .split('\n');
  expect(files.length).toBeGreaterThan(100);

  const offenders = files.flatMap((f) => {
    if (UNCOMPRESSED_AUDIO.test(f)) return [`${f}: uncompressed audio`];
    let size: number;
    try {
      size = statSync(f).size;
    } catch {
      return []; // deleted between listing and reading
    }
    const limit = MEDIA.test(f) ? MEDIA_LIMIT : TEXT_LIMIT;
    return size > limit ? [`${f}: ${size} bytes, limit ${limit}`] : [];
  });

  expect(offenders).toEqual([]);
});

// A history rewrite changes every later commit's hash, and a cited hash then names nothing, with no
// error until someone runs the command. CI checks out one commit, so there the test has nothing to
// resolve against and stands down; it runs in every full clone.
test('every commit the repository cites exists', () => {
  if (execSync('git rev-parse --is-shallow-repository', { encoding: 'utf8' }).trim() === 'true') {
    return;
  }
  const cited = [
    ...readFileSync('.git-blame-ignore-revs', 'utf8').matchAll(/^([0-9a-f]{40})$/gm),
    ...execSync('git ls-files "*.md"', { encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter((f) => f !== 'CHANGELOG.md')
      .flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/git show ([0-9a-f]{7,40}):/g)]),
  ].map((match) => match[1]!);
  expect(cited.length).toBeGreaterThan(0);

  const missing = cited.filter((hash) => {
    try {
      execSync(`git cat-file -e ${hash}^{commit}`, { stdio: 'ignore' });
      return false;
    } catch {
      return true;
    }
  });

  expect(missing).toEqual([]);
});

// Code and content say what is true and why, never when it happened or which work item it was.
// A backlog ID in a comment points at an entry that is deleted when the work is done, so it
// dangles by design. A PR number, a release version or a phase name is the same thing — history,
// which `git log` and `git blame` already keep. Markdown is exempt (docs may cite the queue), and so are the records
// whose content is history by nature: the changelog, the blame-ignore list and the provenance and
// ruling ledgers.
const MILESTONE =
  /\b(?:P\d{1,2}-\d+[a-z]?|C\d{1,2}-\d+|F-\d+|(?:CON|APP|INS|WS|TON|RED|STO)-\d+|Phase \d+|PR ?#?\d+|v0\.\d+\.\d+)\b|\(#\d+\)|#\d+'s\b/;
const MILESTONE_EXEMPT =
  /\.mdx?$|^CHANGELOG\.md$|^\.git-blame-ignore-revs$|^data\/(?:grading-decisions|authorship-provenance|asset-provenance)\.yaml$|^data\/prompts\/|^sources\//;

test('no code or content names a development milestone', () => {
  const files = execSync('git ls-files -co --exclude-standard', { encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter((f) => !MILESTONE_EXEMPT.test(f) && !MEDIA.test(f) && !UNCOMPRESSED_AUDIO.test(f));
  expect(files.length).toBeGreaterThan(100);

  const offenders = files.flatMap((f) => {
    let source: string;
    try {
      source = readFileSync(f, 'utf8');
    } catch {
      return []; // deleted between listing and reading
    }
    return source.split('\n').flatMap((line, i) => {
      const match = MILESTONE.exec(line);
      return match ? [`${f}:${i + 1}: ${match[0]}`] : [];
    });
  });

  expect(offenders).toEqual([]);
});
