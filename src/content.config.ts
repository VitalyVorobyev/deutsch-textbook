import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import {
  topicSchema,
  vocabFileSchema,
  exerciseSetSchema,
  readingSchema,
  visualDocumentSchema,
  wordFieldSchema,
  wortnetzSchema,
  discoverySchema,
  referenceDataSchema,
} from './lib/schemas';

const topics = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './content/topics' }),
  schema: topicSchema,
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
};
