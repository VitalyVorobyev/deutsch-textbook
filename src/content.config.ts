import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { topicSchema, vocabFileSchema, exerciseSetSchema } from './lib/schemas';

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

export const collections = { topics, vocab, exercises };
