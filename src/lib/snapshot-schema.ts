import { z } from 'zod';
import type { ProgressSnapshot } from './store';

const criterionSchema = z.enum(['met', 'needs-work']);

const practiceSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('writing'),
    draft: z.string(),
    revision: z.string(),
    before: z.array(criterionSchema),
    after: z.array(criterionSchema),
  }),
  z.object({
    kind: z.literal('speaking'),
    recorded: z.boolean(),
    before: z.array(criterionSchema),
    after: z.array(criterionSchema),
  }),
]);

const attemptSchema = z.object({
  setId: z.string().min(1),
  itemId: z.string().min(1),
  itemType: z.string().min(1),
  itemRevision: z.number().int().min(1).optional(),
  correct: z.boolean(),
  // Deliberately permissive: `sanitizeAttempts()` is the one rule for partial credit, and it
  // strips exactly the malformed shapes history contains (`totalParts: 0`, one field without
  // the other). Enforcing `min(1)` here would reject the whole snapshot at the import boundary
  // before the sanitizer written to normalize it ever runs — losing every unrelated attempt in
  // the file over one bad row.
  correctParts: z.number().optional(),
  totalParts: z.number().optional(),
  given: z.string(),
  focus: z.string().optional(),
  evidence: z.enum(['verified', 'practice']).optional(),
  responseMode: z
    .enum(['selection', 'writing', 'listening', 'spoken-production', 'spoken-interaction'])
    .optional(),
  outcomes: z.array(z.string()).optional(),
  practice: practiceSchema.optional(),
  ts: z.number().finite(),
});

const cardSchema = z.object({
  due: z.string(),
  stability: z.number(),
  difficulty: z.number(),
  elapsed_days: z.number(),
  scheduled_days: z.number(),
  learning_steps: z.number(),
  reps: z.number(),
  lapses: z.number(),
  state: z.number(),
  last_review: z.string().optional(),
  introducedAt: z.string().optional(),
});

const sessionSchema = z.object({
  date: z.string(),
  reviewed: z.number().nullable(),
  trained: z.number(),
  ts: z.number(),
});

const topicSchema = z.object({
  readAt: z.number().optional(),
  manual: z.enum(['learned', 'reopened']).optional(),
  manualAt: z.number().optional(),
});

const goalSchema = z.object({ topicId: z.string().optional(), setAt: z.number() });

const feedbackSchema = z.object({
  artifactId: z.string().min(1),
  difficulty: z.enum(['too-easy', 'comfortable', 'too-hard']).optional(),
  useful: z.boolean().optional(),
  wantsMore: z.boolean().optional(),
  ts: z.number(),
});

const snapshotBody = z.object({
  exportedAt: z.string(),
  profile: z.string().optional(),
  attempts: z.array(attemptSchema),
  cards: z.record(z.string(), cardSchema),
  sessions: z.array(sessionSchema).default([]),
  topics: z.record(z.string(), topicSchema).default({}),
  goal: goalSchema.optional(),
  feedback: z.record(z.string(), feedbackSchema).default({}),
});

const snapshotSchemas = {
  1: snapshotBody.extend({ version: z.literal(1) }),
  2: snapshotBody.extend({ version: z.literal(2) }),
  3: snapshotBody.extend({ version: z.literal(3) }),
  4: snapshotBody.extend({ version: z.literal(4) }),
  5: snapshotBody.extend({ version: z.literal(5) }),
} as const;

type NormalizedSnapshot = z.infer<(typeof snapshotSchemas)[keyof typeof snapshotSchemas]>;

function asV5(snapshot: NormalizedSnapshot): ProgressSnapshot {
  return { ...snapshot, version: 5 } as ProgressSnapshot;
}

/** Explicit compatibility steps. Keep these visible even while a step only adds defaults. */
export const migrateSnapshotV1 = (snapshot: z.infer<typeof snapshotSchemas[1]>) => asV5(snapshot);
export const migrateSnapshotV2 = (snapshot: z.infer<typeof snapshotSchemas[2]>) => asV5(snapshot);
export const migrateSnapshotV3 = (snapshot: z.infer<typeof snapshotSchemas[3]>) => asV5(snapshot);
export const migrateSnapshotV4 = (snapshot: z.infer<typeof snapshotSchemas[4]>) => asV5(snapshot);
export const migrateSnapshotV5 = (snapshot: z.infer<typeof snapshotSchemas[5]>) => asV5(snapshot);

/** Parse and normalize every supported snapshot version at the import boundary. */
export function parseProgressSnapshot(input: unknown): ProgressSnapshot {
  if (!input || typeof input !== 'object' || !('version' in input)) {
    throw new Error('Progress snapshot has no version.');
  }
  switch ((input as { version?: unknown }).version) {
    case 1: return migrateSnapshotV1(snapshotSchemas[1].parse(input));
    case 2: return migrateSnapshotV2(snapshotSchemas[2].parse(input));
    case 3: return migrateSnapshotV3(snapshotSchemas[3].parse(input));
    case 4: return migrateSnapshotV4(snapshotSchemas[4].parse(input));
    case 5: return migrateSnapshotV5(snapshotSchemas[5].parse(input));
    default:
      throw new Error(
        `Unsupported progress snapshot version: ${String((input as { version?: unknown }).version)}`,
      );
  }
}

export function isProgressSnapshot(input: unknown): input is ProgressSnapshot {
  try {
    parseProgressSnapshot(input);
    return true;
  } catch {
    return false;
  }
}
