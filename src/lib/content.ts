/** Server-side helpers over the content collections (usable in .astro files only). */
import { getCollection } from 'astro:content';
import { buildDeck, type CardDef } from './srs';
import { withBase } from './url';
import type { TopicNode } from './mastery';

export const KIND_LABEL: Record<string, string> = {
  grammar: 'Grammatik',
  'vocab-field': 'Wortschatz',
  communication: 'Kommunikation',
  phonetics: 'Aussprache',
};

export async function getTopicNodes(): Promise<TopicNode[]> {
  const topics = await getCollection('topics');
  return topics.map((t) => ({
    id: t.data.id,
    path: withBase(`/topics/${t.id}`),
    level: t.data.level,
    kind: t.data.kind,
    title_de: t.data.title_de,
    title_en: t.data.title_en,
    title_ru: t.data.title_ru,
    prerequisites: t.data.prerequisites,
    exerciseSets: t.data.exercises,
    vocabIds: t.data.vocab,
    readingIds: t.data.reading,
    pretestId: t.data.pretest,
  }));
}

export async function getAllCards(): Promise<CardDef[]> {
  const vocab = await getCollection('vocab');
  return vocab.flatMap((v) => buildDeck(v.data.id, v.data.entries));
}
