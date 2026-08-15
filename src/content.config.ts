import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import {
  topicArticleSchema,
  vocabFileSchema,
  exerciseSetSchema,
  readingSchema,
  visualDocumentSchema,
  wordFieldSchema,
  wortnetzSchema,
  discoverySchema,
  referenceDataSchema,
  listeningArtifactSchema,
  readingAudioArtifactSchema,
} from '@da/schema';

// Prose only: a topic's identity, titles and element lists live in the sibling
// `<id>.topic.yaml`, which `getCurriculum()` reads. The collection exists to render the article.
const topics = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './content/topics' }),
  schema: topicArticleSchema,
});

const vocab = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './content/vocab' }),
  schema: vocabFileSchema,
});

const exercises = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './content/exercises' }),
  schema: exerciseSetSchema,
});

const reading = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './content/reading' }),
  schema: readingSchema,
});

const documents = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './content/documents' }),
  schema: visualDocumentSchema,
});

const wortfelder = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './content/wortfelder' }),
  schema: wordFieldSchema,
});

const wortnetze = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './content/wortnetze' }),
  schema: wortnetzSchema,
});

const discovery = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './content/discovery' }),
  schema: discoverySchema,
});

const referenceData = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './content/reference-data' }),
  schema: referenceDataSchema,
});

const listening = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './content/listening' }),
  schema: listeningArtifactSchema,
});

const readingAudio = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './content/reading-audio' }),
  schema: readingAudioArtifactSchema,
});

export const collections = {
  topics,
  vocab,
  exercises,
  reading,
  documents,
  wortfelder,
  wortnetze,
  discovery,
  referenceData,
  listening,
  readingAudio,
};
