/**
 * Leben in Deutschland (Einbürgerungstest) — the official question bank and the course's own
 * notes on it. ADR 0021.
 *
 * Two layers, kept in two places on purpose:
 *
 * - **The bank** (`data/lid/bank.yaml`, images under `public/lid/`) is the official catalogue,
 *   Anlage 1 of the EinbTestV, imported verbatim by `scripts/lid-import.ts` and never
 *   hand-edited. It is an official work (§5 UrhG) and sits outside `content/`, whose licence it
 *   does not share.
 * - **The notes** (`content/lid/`) are this course's: the topic each question belongs to, a
 *   short rationale in simple German, and unofficial EN/RU translations. A re-import never
 *   touches them, so an upstream change cannot overwrite editorial work.
 *
 * Pure Zod — imported by React islands, so no `node:fs` here.
 */
import { z } from 'zod';

export const LID_OPTION_KEYS = ['a', 'b', 'c', 'd'] as const;
export const lidOptionKeySchema = z.enum(LID_OPTION_KEYS);
export type LidOptionKey = z.infer<typeof lidOptionKeySchema>;

const sha256 = z.string().regex(/^[0-9a-f]{64}$/, 'expected a lowercase hex SHA-256');

export const lidImageSchema = z
  .object({
    /** Root-absolute, ready for `withBase`: `/lid/<file>.png` or `.jpeg`, as the catalogue ships it. */
    path: z.string().regex(/^\/lid\/[A-Za-z0-9-]+\.(png|jpe?g)$/),
    sha256,
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    /**
     * Set when the catalogue credits the picture to a third-party photographer (`© Deutscher
     * Bundestag/…`, `© Bundesregierung/…`). §5 UrhG frees the official text, not a press photo
     * placed in it, so the file is NOT shipped: the value is the credit, and the page links the
     * question's page in BAMF's own PDF instead. ADR 0021.
     */
    withheld: z.string().min(1).optional(),
  })
  .strict();
export type LidImage = z.infer<typeof lidImageSchema>;

const option = z.string().min(1);

export const lidQuestionSchema = z
  .object({
    /** `general-001`…`general-300`, or `<state>-01`…`<state>-10`. The progress key — never renumber. */
    id: z.string().regex(/^(general-\d{3}|[A-Z]{2}-\d{2})$/),
    /** The catalogue's own number: 1–300 for general questions, 1–10 within a state. */
    officialNumber: z.number().int().positive(),
    scope: z.enum(['general', 'state']),
    stateCode: z.string().regex(/^[A-Z]{2}$/).nullable(),
    /** BAMF's internal id, recorded so a re-import can tell a renumbered question from a new one. */
    bamfInternalId: z.string().min(1),
    sourcePage: z.number().int().positive(),
    question: z.string().min(1),
    /** Verbatim and in source order — the mock exam shows them exactly so. */
    answers: z.object({ a: option, b: option, c: option, d: option }).strict(),
    solution: lidOptionKeySchema,
    images: z.array(lidImageSchema),
  })
  .strict()
  .superRefine((q, ctx) => {
    const general = q.scope === 'general';
    if (general !== (q.stateCode === null))
      ctx.addIssue({ code: 'custom', message: 'a general question has no stateCode; a state question has one' });
    const expected = general
      ? `general-${String(q.officialNumber).padStart(3, '0')}`
      : `${q.stateCode}-${String(q.officialNumber).padStart(2, '0')}`;
    if (q.id !== expected) ctx.addIssue({ code: 'custom', message: `id ${q.id} should be ${expected}` });
  });
export type LidQuestion = z.infer<typeof lidQuestionSchema>;

export const lidBankSchema = z
  .object({
    version: z.literal(1),
    source: z
      .object({
        title: z.string().min(1),
        publisher: z.string().min(1),
        /** As printed on the catalogue, e.g. `Stand: 07.05.2025`. */
        edition: z.string().min(1),
        legalBasis: z.string().min(1),
        pdfUrl: z.url(),
        pdfSha256: sha256,
        attribution: z.string().min(1),
      })
      .strict(),
    /** The machine-readable extraction the bank was imported from — an import format only. */
    dataset: z
      .object({
        url: z.url(),
        version: z.string().min(1),
        questionsSha256: sha256,
        retrievedAt: z.string().min(1),
      })
      .strict(),
    /** Which states' ten questions the bank carries. Today: `[BY]`. */
    states: z.array(z.string().regex(/^[A-Z]{2}$/)).min(1),
    questions: z.array(lidQuestionSchema),
  })
  .strict();
export type LidBank = z.infer<typeof lidBankSchema>;

export const lidTopicsSchema = z
  .object({
    modules: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-z0-9-]+$/),
            title_de: z.string().min(1),
            topics: z
              .array(
                z.object({ id: z.string().regex(/^[a-z0-9-]+$/), title_de: z.string().min(1) }).strict(),
              )
              .min(1),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();
export type LidTopics = z.infer<typeof lidTopicsSchema>;

/**
 * One unofficial rendering of an official German text. `uk` is optional in the shape only: like
 * every Ukrainian half it is all-or-none per file (`lidProblems` → `ukParityProblems`), and
 * `tests/i18n-content.test.ts` holds every notes file to carrying it.
 */
const enRuUk = z.object({ en: z.string().min(1), ru: z.string().min(1), uk: z.string().min(1).optional() }).strict();

export const lidNoteSchema = z
  .object({
    id: z.string().regex(/^(general-\d{3}|[A-Z]{2}-\d{2})$/),
    /** Why the correct answer is correct, in simple (B1) German. Never contradicts the key. */
    rationale_de: z.string().min(1).optional(),
    /** An UNOFFICIAL translation, shown on demand in practice only — never in the mock exam. */
    question: enRuUk.optional(),
    options: z.object({ a: enRuUk, b: enRuUk, c: enRuUk, d: enRuUk }).strict().optional(),
    /** Key terms of the question, glossed — candidates for a later recognition deck. */
    terms: z
      .array(
        z
          .object({ de: z.string().min(1), en: z.string().min(1), ru: z.string().min(1), uk: z.string().min(1).optional() })
          .strict(),
      )
      .optional(),
    /** Where the rationale's fact comes from, e.g. `GG Art. 5`. */
    source: z.string().min(1).optional(),
    status: z.enum(['draft', 'reviewed']).default('draft'),
  })
  .strict()
  .superRefine((n, ctx) => {
    if (!!n.question !== !!n.options)
      ctx.addIssue({ code: 'custom', message: 'a translation covers the question and all four options, or neither' });
    if (n.status === 'reviewed' && !n.rationale_de)
      ctx.addIssue({ code: 'custom', message: 'a reviewed note has a rationale' });
  });
export type LidNote = z.infer<typeof lidNoteSchema>;

/** `content/lid/notes/<topic-id>.yaml` — the file name IS the topic assignment. */
export const lidNotesFileSchema = z.object({ notes: z.array(lidNoteSchema).min(1) }).strict();
export type LidNotesFile = z.infer<typeof lidNotesFileSchema>;

/** A lesson id is its file name: kebab-case ASCII, like a topic id. */
export const LID_LESSON_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * One glossary row of a lesson. `uk` is optional in the shape and, like every Ukrainian half,
 * all-or-none per file (the validator's uk parity bridges the frontmatter and the `<Uk>` half of
 * `## Kurz gesagt`); the page renders a Ukrainian column only when the lesson carries one.
 */
export const lidLessonTermSchema = z
  .object({ de: z.string().min(1), en: z.string().min(1), ru: z.string().min(1), uk: z.string().min(1).optional() })
  .strict();
export type LidLessonTerm = z.infer<typeof lidLessonTermSchema>;

/**
 * The frontmatter of `content/lid/lessons/<lesson-id>.mdx` — a compact reading lesson in simple
 * German that teaches the system behind a group of exam questions. Reading material, not a spine
 * topic: it owns no exercises, probes or denominators, and its practice is the official
 * questions of its `topics` (ADR 0021). The body opens with `## Kurz gesagt` and one bilingual
 * orientation; the rest is German. `bun run validate` holds the cross-file rules (`lidProblems`):
 * every topic exists, a topic belongs to at most one lesson, `order` is unique.
 */
export const lidLessonSchema = z
  .object({
    title_de: z.string().min(1),
    /** Position in the lesson list. Unique across lessons. */
    order: z.number().int().positive(),
    /** Topic ids from `content/lid/topics.yaml`. The lesson's questions are theirs. */
    topics: z.array(z.string().regex(/^[a-z0-9-]+$/)).min(1),
    summary_de: z.string().min(1),
    /** A draft ships, marked „Entwurf“ — the trainer's notes follow the same rule. */
    status: z.enum(['draft', 'reviewed']).default('draft'),
    sources: z.array(z.object({ title: z.string().min(1), url: z.url().startsWith('https://') }).strict()).min(1),
    terms: z.array(lidLessonTermSchema).min(1),
  })
  .strict()
  .superRefine((lesson, ctx) => {
    const seen = new Set<string>();
    for (const topic of lesson.topics) {
      if (seen.has(topic)) ctx.addIssue({ code: 'custom', path: ['topics'], message: `topic "${topic}" is listed twice` });
      seen.add(topic);
    }
    const terms = new Set<string>();
    for (const term of lesson.terms) {
      if (terms.has(term.de)) ctx.addIssue({ code: 'custom', path: ['terms'], message: `term "${term.de}" is listed twice` });
      terms.add(term.de);
    }
  });
export type LidLesson = z.infer<typeof lidLessonSchema>;

/** The test as the EinbTestV §1 defines it: 33 questions, 3 of them from the learner's state. */
export const LID_EXAM = {
  questions: 33,
  stateQuestions: 3,
  minutes: 60,
  /** Einbürgerungstest (EinbTestV §1 Abs. 3). */
  passEinbuergerung: 17,
  /** Test „Leben in Deutschland“ at the end of the Orientierungskurs. */
  passOrientierungskurs: 15,
} as const;
