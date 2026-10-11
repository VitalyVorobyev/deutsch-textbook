/**
 * The course content the session pages run on, as two static JSON files instead of inline props.
 *
 * `/session`, `/ueben/wiederholen`, `/ueben/training` and `/ueben/proben` each used to inline
 * every flashcard (5,745 cards, 8.3 MB) or every exercise set (438 sets, 5.7 MB) into one island's
 * props: 7–18 MB of HTML per page, re-downloaded on every visit because HTML is network-first in
 * the service worker. The same bytes now ship once, as `data/cards-<hash>.json` and
 * `data/sets-<hash>.json`, which every page shares and the service worker keeps until the content
 * changes (docs/adrs/0022-session-content-as-shared-data-files.md).
 *
 * The name carries a hash of the body, so a file is immutable: a changed corpus is a new URL, and
 * an unchanged one keeps its URL — and its cached copy — across deploys.
 *
 * Server-side only (it reads the content collections).
 */
import { createHash } from 'node:crypto';
import { getAllCards, getTrainingSets } from './content';
import { withBase } from './url';

export type CorpusKind = 'cards' | 'sets';

export interface CorpusFile {
  kind: CorpusKind;
  /** file name without extension, e.g. `cards-3f2a9c1e04b7` */
  name: string;
  body: string;
}

/** The file name for a payload: its kind plus the first 12 hex digits of the body's SHA-256. */
export function corpusFileName(kind: CorpusKind, body: string): string {
  return `${kind}-${createHash('sha256').update(body).digest('hex').slice(0, 12)}`;
}

async function build(): Promise<CorpusFile[]> {
  const [cards, sets] = await Promise.all([getAllCards(), getTrainingSets()]);
  return (
    [
      ['cards', JSON.stringify(cards)],
      ['sets', JSON.stringify(sets)],
    ] as const
  ).map(([kind, body]) => ({ kind, name: corpusFileName(kind, body), body }));
}

let memo: Promise<CorpusFile[]> | undefined;

/**
 * Both files. Memoised for the build, where every page asks; rebuilt per call in dev, where an
 * edited exercise must show up without restarting the server.
 */
export function corpusFiles(): Promise<CorpusFile[]> {
  if (import.meta.env.DEV) return build();
  return (memo ??= build());
}

/** The base-aware URL of one payload, for an island prop and a `<link rel="preload">`. */
export async function corpusUrl(kind: CorpusKind): Promise<string> {
  const file = (await corpusFiles()).find((f) => f.kind === kind)!;
  return withBase(`/data/${file.name}.json`);
}
