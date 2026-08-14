/**
 * Theme coverage — the `thema` dimension of `anchors.ts`, and the third question a course answers.
 *
 * `structures.ts` measures the grammar this course teaches against a published inventory.
 * `handlungen.ts` measures what it lets the learner *do*. Neither can see **what it is about**: a
 * course can teach every structure the standard lists, cover every communicative function it
 * enumerates, and never once mention Versicherungen, Polizei or Kinderbetreuung — three of the
 * seventy sub-topics the DTZ names for an adult building a life in Germany.
 *
 * WHY IT LANDED LAST. A theme is claimed by a **topic**, and until 2026-08-14 a topic had nowhere
 * to declare anything: its identity was split across a directory, an MDX frontmatter and an atlas
 * node, none of them authoritative. ADR 0012's manifests gave it a home, and this is the first
 * thing that home was used for.
 *
 * WHAT `beyond` MEANS HERE. A topic citing no theme is usually a grammar topic, and that is not a
 * defect — "Der Akkusativ" is about the accusative, not about a slice of life. Read `beyond` as
 * *the course teaches more than the exam is about* and `unclaimed` as *the exam is about more than
 * the course teaches*; only the second is a gap.
 */
import { anchorCoverage, type AnchorCoverage, type Claimant } from './anchors';
import { contentGraph } from './graph';
import { repoRoot } from './repo-root';
import type { Level, TopicManifest } from '@da/schema';

export interface TopicClaimant extends Claimant {
  manifest: TopicManifest;
}

/** Every topic manifest, as a claimant. */
export function topicClaimants(root = repoRoot()): TopicClaimant[] {
  return [...contentGraph(root).topics.values()].map(({ id, data }) => ({
    id,
    level: data.level,
    claims: data.claims,
    label: data.title_de,
    manifest: data,
  }));
}

export function themaCoverage(level: Level, root = repoRoot()): AnchorCoverage {
  return anchorCoverage('thema', level, topicClaimants(root), root);
}
