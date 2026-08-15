/** Server-side helpers over the content collections (usable in .astro files only). */
import { getCollection } from 'astro:content';
import {
  buildDeck,
  mergeLexicalContexts,
  wordFieldContexts,
  wortnetzContexts,
  type CardDef,
} from './srs';
import { topicPath, withBase } from './url';
import type { CheckpointItemRef } from './checkpoint';
import type { ExerciseSet } from '@da/schema';
import type { TopicNode } from './mastery';
import { getCurriculum } from '@da/content/curriculum';

/**
 * The learner-facing view of every topic, from the manifests.
 *
 * `primaryPractice` used to be re-derived here as "the first `role: practice` set in `exercises:`",
 * which made reordering a topic's page a silent change to what advances the Lernpfad. The manifest
 * declares it; this only has to look up the item ids.
 */
export async function getTopicNodes(): Promise<TopicNode[]> {
  const exercises = await getCollection('exercises');
  const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise.data]));
  return getCurriculum().nodes.map((t) => {
    const primary = t.elements.primary_practice;
    const primarySet = primary ? exerciseById.get(primary) : undefined;
    return {
      id: t.id,
      path: withBase(topicPath(t)),
      level: t.level,
      kind: t.kind,
      title_de: t.title_de,
      title_en: t.title_en,
      title_ru: t.title_ru,
      title_uk: t.title_uk,
      prerequisites: t.prerequisites,
      exerciseSets: t.elements.exercises,
      vocabIds: t.elements.vocab,
      readingIds: t.elements.reading,
      pretestId: t.elements.pretest,
      primaryPractice:
        primary && primarySet
          ? { setId: primary, itemIds: primarySet.items.map((item) => item.id) }
          : undefined,
    };
  });
}

export async function getAllCards(): Promise<CardDef[]> {
  const [vocab, fields, networks] = await Promise.all([
    getCollection('vocab'),
    getCollection('wortfelder'),
    getCollection('wortnetze'),
  ]);
  const contexts = mergeLexicalContexts(
    wordFieldContexts(fields.map((field) => field.data)),
    wortnetzContexts(networks.map((network) => network.data)),
  );
  return vocab.flatMap((v) => buildDeck(v.data.id, v.data.entries, contexts));
}

/** deck id → CEFR level, for level-gating decks no topic owns (see src/lib/decks.ts). */
export async function getDeckLevels(): Promise<Record<string, string>> {
  const vocab = await getCollection('vocab');
  return Object.fromEntries(vocab.map((v) => [v.data.id, v.data.level]));
}

/**
 * A whole-level assessment set that owns its own route — a checkpoint or a placement
 * test. Both are discovered the same way and every page that surfaces one needs this.
 */
export interface LevelSetDescriptor {
  /** exercise path-id, e.g. `a1/checkpoint-a1` — attempts are keyed by it */
  setId: string;
  /** CEFR level the set covers, derived from the set's directory */
  level: string;
  /** the route param — the lowercased level */
  slug: string;
  path: string;
  title: string;
  items: CheckpointItemRef[];
  /** the set's own bilingual title (rendered by ExerciseSet) */
  set: ExerciseSet;
}

/** A cumulative level checkpoint. */
export type CheckpointDescriptor = LevelSetDescriptor;
/** A level entry test: pass a topic here and it never enters the recommended path. */
export type PlacementDescriptor = LevelSetDescriptor;

/**
 * Every set of one whole-level `role`, in level order.
 *
 * These roles are **data, not wiring**: the level comes from the set's directory
 * (`content/exercises/a2/…` → A2), and every surface that shows one iterates the list.
 * Shipping the B1 checkpoint or the B1 placement test is therefore one new YAML file
 * and no code. `bun run validate` enforces one set per level per role (they would
 * share a route) and that the directory matches the level of the topic it anchors to.
 */
async function levelSets(
  role: 'checkpoint' | 'placement',
  route: string,
  title: (level: string) => string,
): Promise<LevelSetDescriptor[]> {
  const exercises = await getCollection('exercises');
  return exercises
    .filter((entry) => entry.data.role === role)
    .map((entry) => {
      const slug = entry.id.split('/')[0]!;
      const level = slug.toUpperCase();
      return {
        setId: entry.id,
        level,
        slug,
        path: withBase(`/${route}/${slug}`),
        title: title(level),
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

/** Every `role: checkpoint` set — the /checkpoint/[level] route, Heute, Lernpfad, Fortschritt. */
export function getCheckpoints(): Promise<CheckpointDescriptor[]> {
  return levelSets('checkpoint', 'checkpoint', (level) => `Checkpoint ${level}`);
}

/** Every `role: placement` set — the /einstufung/[level] route and the FirstSteps entry link. */
export function getPlacements(): Promise<PlacementDescriptor[]> {
  return levelSets('placement', 'einstufung', (level) => `Einstufungstest ${level}`);
}
