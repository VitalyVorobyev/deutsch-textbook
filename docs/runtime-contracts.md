# Runtime contracts

Status: active engineering checklist. [design.md](design.md) is the system map; `CLAUDE.md` owns
authoring rules. Historical failures and extended rationale are
[archived](archive/2026-07-runtime-contracts-full.md).

| Contract | Source of truth | Required companion checks |
| --- | --- | --- |
| Content shapes | `src/lib/schemas.ts`, `src/content.config.ts` | validator and schema tests |
| Curriculum order and graph | `content/atlas.yaml`, `src/lib/curriculum.ts` | contracts/deepens tests |
| Review queue and daily new-card budget | `src/lib/decks.ts` | review-plan tests |
| Training eligibility and interleaving | `src/lib/training.ts` | eligibility/broad-retrieval tests |
| Mastery and navigation evidence | `src/lib/mastery.ts`, `src/lib/placement.ts` | mastery/placement tests |
| Delayed probes | `src/lib/probes.ts` | probe tests and progress audit |
| Scoring and focus attribution | `src/lib/scoring.ts`, `src/lib/production.ts` | grading/contract tests |
| Profiles and learner storage | `src/lib/profile.ts`, `src/lib/store.ts` | snapshot/store tests |
| Snapshot compatibility | `src/lib/snapshot-schema.ts`, `src/lib/snapshot-merge.ts` | all-version migration tests |
| Language selection | `src/lib/prefs.ts`, `src/lib/langcheck.ts` | i18n tests and validator |
| Explanation prose shape | `src/lib/prose-shape.ts` (authoring-time only; never imported by runtime) | prose-shape tests, validator, `bun scripts/prose-shape.ts` |
| Positional references to shuffled options | `src/lib/option-references.ts` (authoring-time only; never imported by runtime) | option-reference tests, validator |
| Answer-shaped rendering of an input | `src/components/exercises/Cloze.tsx` (`gapWidthCh`) | cloze gap-width tests |
| Same-day lesson resume | `src/lib/resume.ts` | resume tests |
| Tauri filesystem integration | `src/lib/syncdir.ts` | browser path plus Tauri guard |

## Non-negotiable invariants

- Persisted identities are contracts. Renaming topics, items, outcomes, decks or card headwords
  requires an explicit migration.
- Historical attempts keep their logged result and revision; current answer keys never replay them.
- Unverified writing and speaking remain practice evidence and never raise measured mastery.
- Placement may advance the recommended path but never raises a topic’s measured tier.
- Probe state is derived from the attempt log and served before contaminating practice.
- Fresh-card introductions are budgeted per day, not per rendered queue.
- No database is created before a learner profile exists; the final profile cannot be deleted.
- References, documents, discovery pieces and learning figures create no progress or review debt.
- Persisted UI choices receive migrations when their value domain changes.
- Build-time claims on `/about` are computed from content, never typed by hand.
- No input is sized, capped or captioned from the answer it is waiting for. A cloze gap was
  drawn at `answers[0].length + 2`, so `Es gibt hier ___ Supermarkt.` fitted only *einen* of
  *einen / eine / ein* and the item scored a width judgement as accusative mastery. Every gap
  now rests at one width and grows with what the learner typed. The same applies to
  `maxLength`, `placeholder`, `size` and any cell width derived from an answer string —
  `FormFill` and `TableFill` are CSS-sized and must stay so. Nothing catches this class: the
  validator sees a well-formed item, the grader sees a correct answer, and the learner is the
  only observer positioned to notice.

## Change procedure

1. Identify the source-of-truth row above and read its tests before editing.
2. Change the implementation, migration and tests in the same commit.
3. Preserve old snapshots and persisted ids unless the change explicitly migrates them.
4. Run `bun run validate`, `bun test`, `bun run check`, `bun run lint` and `bun run build`.
