/**
 * Where `content/` and `data/` are, independent of who is asking.
 *
 * Every fs-reading helper here defaulted its `root` to `process.cwd()`, which is correct only
 * as long as every caller happens to run from the repo root. That held while the repo was one
 * package; it stops holding as soon as a workspace package under `packages/` reads the corpus,
 * because a package's cwd is whatever the tool that loaded it chose. A wrong root does not
 * throw in most of these measurements — a missing corpus reads as an *empty* corpus, so
 * coverage would quietly report zero rather than fail.
 *
 * So the root is found by walking up from *this module*, which moves with the code rather than
 * with the caller, and is marked by the one file that only ever exists at the repo root:
 * `content/atlas.yaml`, the curriculum spine.
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const MARKER = join('content', 'atlas.yaml');

let cached: string | undefined;

/** The repository root. Memoised — this is called from default parameters. */
export function repoRoot(): string {
  if (cached !== undefined) return cached;
  let dir = import.meta.dirname;
  for (;;) {
    if (existsSync(join(dir, MARKER))) return (cached = dir);
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(`repo root not found: no ${MARKER} above ${import.meta.dirname}`);
    }
    dir = parent;
  }
}
