/**
 * Where the topic manifests are and how to find them.
 *
 * Two callers want the same 49 files under different contracts, which is why the walk is here and
 * the parsing is not: `getCurriculum()` parses strictly because a malformed manifest must stop a
 * build, while `contentGraph()` degrades a bad file to a `note` because it is the model an editor
 * reads *while* authoring — a file being edited is broken most of the time.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from './repo-root';

/** `content/topics/<level>/<id>.topic.yaml` — the manifest beside `<id>.mdx`. */
export const MANIFEST_SUFFIX = '.topic.yaml';

/** Absolute paths to every topic manifest, sorted, so two callers see the same order. */
export function manifestFiles(root = repoRoot()): string[] {
  const base = join(root, 'content', 'topics');
  if (!existsSync(base)) return [];
  return readdirSync(base, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .flatMap((dir) =>
      readdirSync(join(base, dir.name))
        .filter((name) => name.endsWith(MANIFEST_SUFFIX))
        .map((name) => join(base, dir.name, name)),
    )
    .sort();
}

/** The topic id a manifest path declares — the filename is the id, as it is for the article. */
export const idFromManifestPath = (file: string): string =>
  file.split(/[\\/]/).at(-1)!.slice(0, -MANIFEST_SUFFIX.length);
