/** Server-side helpers over the content collections (usable in .astro files only). */
import { getCollection } from 'astro:content';
import { buildDeck, wordFieldContexts, type CardDef } from './srs';
import { withBase } from './url';
import type { CheckpointItemRef } from './checkpoint';
import type { ExerciseSet } from './schemas';
import type { TopicNode } from './mastery';

export async function getTopicNodes(): Promise<TopicNode[]> {
  const [topics, exercises] = await Promise.all([getCollection('topics'), getCollection('exercises')]);
  const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise.data]));
  return topics.map((t) => ({
    id: t.data.id,
    path: withBase(`/topics/${t.id}`),
    level: t.data.level,
    kind: t.data.kind,
    title_de: t.data.title_de,
    title_en: t.data.title_en,
    title_ru: t.data.title_ru,
    title_uk: t.data.title_uk,
    prerequisites: t.data.prerequisites,
    exerciseSets: t.data.exercises,
    vocabIds: t.data.vocab,
    readingIds: t.data.reading,
    pretestId: t.data.pretest,
    primaryPractice: t.data.exercises.flatMap((setId) => {
      const set = exerciseById.get(setId);
      return set?.role === 'practice'
        ? [{ setId, itemIds: set.items.map((item) => item.id) }]
        : [];
    })[0],
  }));
}

export async function getAllCards(): Promise<CardDef[]> {
  const [vocab, fields] = await Promise.all([getCollection('vocab'), getCollection('wortfelder')]);
  const contexts = wordFieldContexts(fields.map((field) => field.data));
  return vocab.flatMap((v) => buildDeck(v.data.id, v.data.entries, contexts));
}

/** deck id → CEFR level, for level-gating decks no topic owns (see src/lib/decks.ts). */
export async function getDeckLevels(): Promise<Record<string, string>> {
  const vocab = await getCollection('vocab');
  return Object.fromEntries(vocab.map((v) => [v.data.id, v.data.level]));
}

/** A cumulative level checkpoint, as every page that surfaces one needs it. */
export interface CheckpointDescriptor {
  /** exercise path-id, e.g. `a1/checkpoint-a1` — attempts are keyed by it */
  setId: string;
  /** CEFR level the checkpoint covers, derived from the set's directory */
  level: string;
  /** the /checkpoint/<slug> route param — the lowercased level */
  slug: string;
  path: string;
  title: string;
  items: CheckpointItemRef[];
  /** the set's own bilingual title (rendered by ExerciseSet) */
  set: ExerciseSet;
}

/**
 * Every `role: checkpoint` set in the content, in level order.
 *
 * Checkpoints are **data, not wiring**: the level comes from the set's directory
 * (`content/exercises/a2/…` → A2), and the /checkpoint/[level] route, the Heute
 * card, the Lernpfad and Fortschritt all iterate this list. Shipping the A2
 * checkpoint is therefore one new YAML file and no code. `bun run validate`
 * enforces one checkpoint per level (they share a route) and that the directory
 * matches the level of the topic the set anchors to.
 */
export async function getCheckpoints(): Promise<CheckpointDescriptor[]> {
  const exercises = await getCollection('exercises');
  return exercises
    .filter((entry) => entry.data.role === 'checkpoint')
    .map((entry) => {
      const slug = entry.id.split('/')[0]!;
      const level = slug.toUpperCase();
      return {
        setId: entry.id,
        level,
        slug,
        path: withBase(`/checkpoint/${slug}`),
        title: `Checkpoint ${level}`,
        items: entry.data.items.map((item) => ({
          id: item.id,
          type: item.type,
          outcomes: item.outcomes,
        })),
        set: entry.data,
      };
    })
    .sort((a, b) => a.level.localeCompare(b.level));
}
