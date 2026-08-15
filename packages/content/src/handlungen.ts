/**
 * Sprachhandlung coverage — the `handlung` dimension of `anchors.ts`.
 *
 * Every topic declares 2–5 learner-facing `outcomes` in `content/atlas.yaml`; 179 of them exist,
 * each a can-do statement in up to four languages, each required to be measured by a practice or
 * drill item. What no outcome had until 2026-08-14 is an **outside**. `bun run validate` checks
 * that an outcome is *exercised*; nothing checked that the set of can-dos this course teaches is
 * the set an adult learner is actually expected to perform, and a self-authored list of
 * communicative goals drifts exactly the way the self-authored grammar list drifted — silently, and
 * toward whatever was convenient to write.
 *
 * The DTZ Prüfungshandbuch §8.2/§8.3 is that outside: Goethe's and telc's enumeration of the
 * language functions and discourse strategies an adult migrant must produce.
 *
 * WHY THIS IS NOT MORE ROWS IN `grammar-inventory.yaml`. A course can teach every structure on the
 * published list and still never ask the learner to refuse an offer, ask for a word to be spelled,
 * or say that they did not understand. Grammar coverage cannot see that gap by construction, which
 * is the entire argument for a second denominator.
 *
 * An outcome's level is its topic's level, so `beyond` means "a can-do this course teaches at this
 * level that no published function covers" — legitimate and expected, since the DTZ inventory is
 * scoped to an exam and this course is a course.
 */
import { anchorCoverage, type AnchorCoverage, type Claimant } from './anchors';
import { contentGraph } from './graph';
import { repoRoot } from './repo-root';
import type { Level, Outcome } from '@da/schema';

export interface OutcomeClaimant extends Claimant {
  topic: string;
  outcome: Outcome;
}

/** Every atlas outcome, as a claimant carrying its topic's level. */
export function outcomeClaimants(root = repoRoot()): OutcomeClaimant[] {
  const graph = contentGraph(root);
  const claimants: OutcomeClaimant[] = [];
  for (const [id, { outcome, topic }] of graph.outcomes) {
    const level = graph.topics.get(topic)?.data.level;
    if (!level) continue;
    claimants.push({
      id,
      level,
      claims: (outcome as Outcome & { claims?: string[] }).claims,
      label: outcome.de,
      topic,
      outcome,
    });
  }
  return claimants;
}

export function handlungCoverage(level: Level, root = repoRoot()): AnchorCoverage {
  return anchorCoverage('handlung', level, outcomeClaimants(root), root);
}
