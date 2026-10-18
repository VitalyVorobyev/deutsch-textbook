/**
 * Leben in Deutschland (Einbürgerungstest) — the official question bank and the course's own
 * notes on it. ADR 0009.
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
     * question's page in BAMF's own PDF instead. ADR 0009.
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
    stateCode: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .nullable(),
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
      ctx.addIssue({
        code: 'custom',
        message: 'a general question has no stateCode; a state question has one',
      });
    const expected = general
      ? `general-${String(q.officialNumber).padStart(3, '0')}`
      : `${q.stateCode}-${String(q.officialNumber).padStart(2, '0')}`;
    if (q.id !== expected)
      ctx.addIssue({ code: 'custom', message: `id ${q.id} should be ${expected}` });
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
                z
                  .object({ id: z.string().regex(/^[a-z0-9-]+$/), title_de: z.string().min(1) })
                  .strict(),
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
const enRuUk = z
  .object({ en: z.string().min(1), ru: z.string().min(1), uk: z.string().min(1).optional() })
  .strict();

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
          .object({
            de: z.string().min(1),
            en: z.string().min(1),
            ru: z.string().min(1),
            uk: z.string().min(1).optional(),
          })
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
      ctx.addIssue({
        code: 'custom',
        message: 'a translation covers the question and all four options, or neither',
      });
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
  .object({
    de: z.string().min(1),
    en: z.string().min(1),
    ru: z.string().min(1),
    uk: z.string().min(1).optional(),
  })
  .strict();
export type LidLessonTerm = z.infer<typeof lidLessonTermSchema>;

/** Where a lesson figure added by the course lives; the bank's own pictures stay at `/lid/<file>`. */
export const LID_FIGURE_DIR = '/lid/lessons/';
/** Per-file ceiling for a figure: every one ships in the desktop bundle. */
export const LID_FIGURE_MAX_BYTES = 300_000;
/** The bank's path shape (`lidImageSchema`): an `official` figure points at one of its pictures. */
const LID_BANK_IMAGE_PATH = /^\/lid\/[A-Za-z0-9-]+\.(png|jpe?g)$/;
const LID_FIGURE_CREDIT = ['attribution', 'license', 'license_url', 'source_url'] as const;

/**
 * One picture a lesson shows with `<Figure id="…" />` (or two or three in a row with
 * `<Figure ids="… …" />`), placed outside any `<Translation>` so every Lernsprache sees it. The
 * German caption is always shown; the learner's language sits beneath it, and every lesson
 * carries UK, so `uk` is required.
 *
 * Provenance follows the discovery images' contract, with one more class: `official` is a picture
 * of the BAMF catalogue already shipped under `/lid/` (§5 UrhG — never a `withheld` one, which
 * `lidProblems` checks against the bank), credited as the catalogue, so it carries no credit
 * fields. `real`/`adapted` are someone else's work and must name author, licence, licence URL
 * and source page. Everything else lives under `/lid/lessons/`.
 */
export const lidFigureSchema = z
  .object({
    /** Kebab-case, unique across ALL lessons — `<Figure>` resolves it without knowing the lesson. */
    id: z.string().regex(LID_LESSON_ID),
    /**
     * Root-absolute public path, ready for `withBase`. An `.svg` is a drawing the course made or
     * adapted; `lidFigureProblems` holds it to carrying no script and no external reference, since
     * the picture also opens on its own in a new tab.
     */
    src: z.string().regex(/^\/lid\/[A-Za-z0-9/-]+\.(png|jpe?g|webp|svg)$/),
    /** The file's pixel size (an SVG's root `width`/`height`, else its `viewBox`) — checked against the file by `bun run validate`. */
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    alt_de: z.string().min(1),
    caption: z
      .object({
        de: z.string().min(1),
        en: z.string().min(1),
        ru: z.string().min(1),
        uk: z.string().min(1),
      })
      .strict(),
    sourceClass: z.enum(['official', 'real', 'adapted', 'simulated']),
    attribution: z.string().min(1).optional(),
    license: z.string().min(1).optional(),
    license_url: z.url().startsWith('https://').optional(),
    /** The source's own page, e.g. the Wikimedia Commons file page. */
    source_url: z.url().startsWith('https://').optional(),
  })
  .strict()
  .superRefine((figure, ctx) => {
    if (figure.sourceClass === 'official') {
      if (!LID_BANK_IMAGE_PATH.test(figure.src))
        ctx.addIssue({
          code: 'custom',
          path: ['src'],
          message: 'an official figure is a bank picture at /lid/<file>.png|jpeg',
        });
      const credit = LID_FIGURE_CREDIT.filter((key) => figure[key] !== undefined);
      if (credit.length)
        ctx.addIssue({
          code: 'custom',
          message: `an official figure is credited as the catalogue — drop ${credit.join(', ')}`,
        });
      return;
    }
    if (!figure.src.startsWith(LID_FIGURE_DIR))
      ctx.addIssue({
        code: 'custom',
        path: ['src'],
        message: `a course figure lives under ${LID_FIGURE_DIR}`,
      });
    if (figure.sourceClass === 'real' || figure.sourceClass === 'adapted') {
      const missing = LID_FIGURE_CREDIT.filter((key) => !figure[key]);
      if (missing.length)
        ctx.addIssue({
          code: 'custom',
          message: `real/adapted figures require attribution, license, license_url and source_url — missing ${missing.join(', ')}`,
        });
    }
  });
export type LidFigure = z.infer<typeof lidFigureSchema>;

/**
 * The frontmatter of `content/lid/lessons/<lesson-id>.mdx` — a compact reading lesson in simple
 * German that teaches the system behind a group of exam questions. Reading material, not a spine
 * topic: it owns no exercises, probes or denominators, and its practice is the official
 * questions of its `topics` (ADR 0009). The body opens with `## Kurz gesagt` and one bilingual
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
    sources: z
      .array(z.object({ title: z.string().min(1), url: z.url().startsWith('https://') }).strict())
      .min(1),
    terms: z.array(lidLessonTermSchema).min(1),
    /** Pictures the body shows with `<Figure>`; every one is used (`lidProblems`). */
    figures: z.array(lidFigureSchema).default([]),
  })
  .strict()
  .superRefine((lesson, ctx) => {
    const figures = new Set<string>();
    for (const figure of lesson.figures) {
      if (figures.has(figure.id))
        ctx.addIssue({
          code: 'custom',
          path: ['figures'],
          message: `figure "${figure.id}" is listed twice`,
        });
      figures.add(figure.id);
    }
    const seen = new Set<string>();
    for (const topic of lesson.topics) {
      if (seen.has(topic))
        ctx.addIssue({
          code: 'custom',
          path: ['topics'],
          message: `topic "${topic}" is listed twice`,
        });
      seen.add(topic);
    }
    const terms = new Set<string>();
    for (const term of lesson.terms) {
      if (terms.has(term.de))
        ctx.addIssue({
          code: 'custom',
          path: ['terms'],
          message: `term "${term.de}" is listed twice`,
        });
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
