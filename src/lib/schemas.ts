import { z } from 'zod';

/** CEFR levels covered by the atlas. */
export const LEVELS = ['A1', 'A2', 'B1', 'B2'] as const;
export const levelSchema = z.enum(LEVELS);
export type Level = z.infer<typeof levelSchema>;

export const TOPIC_KINDS = ['grammar', 'vocab-field', 'communication', 'phonetics'] as const;
export const topicKindSchema = z.enum(TOPIC_KINDS);
export type TopicKind = z.infer<typeof topicKindSchema>;

/** Text that exists in both explanation languages. */
export const bilingualSchema = z.object({
  en: z.string().min(1),
  ru: z.string().min(1),
});
export type Bilingual = z.infer<typeof bilingualSchema>;

const slug = z.string().regex(/^[a-z0-9-]+$/, 'must be a kebab-case slug');

// ---------------------------------------------------------------------------
// Topics (content/topics/<level>/<id>.mdx)
// ---------------------------------------------------------------------------

export const topicSchema = z.object({
  id: slug,
  title_de: z.string().min(1),
  title_en: z.string().min(1),
  title_ru: z.string().min(1),
  level: levelSchema,
  kind: topicKindSchema,
  prerequisites: z.array(slug).default([]),
  /** ids of vocab files whose entries feed this topic's flashcard deck */
  vocab: z.array(slug).default([]),
  /** ids (paths) of exercise sets embedded on this topic's page */
  exercises: z.array(z.string()).default([]),
  /** ids (paths) of reading texts rendered in the Lesetext section */
  reading: z.array(z.string()).default([]),
  /** id (path) of a 3-item pretest exercise set rendered above the article */
  pretest: z.string().optional(),
  tags: z.array(slug).default([]),
  status: z.enum(['draft', 'reviewed']).default('draft'),
});
export type Topic = z.infer<typeof topicSchema>;

// ---------------------------------------------------------------------------
// Vocabulary (content/vocab/<id>.yaml)
// ---------------------------------------------------------------------------

export const POS = [
  'noun',
  'verb',
  'adj',
  'adv',
  'prep',
  'conj',
  'pron',
  'num',
  'particle',
  'interj',
  'phrase',
] as const;
export const posSchema = z.enum(POS);

/** The German IPA inventory, in house style — see CLAUDE.md → Lautschrift.
    ʁ not r, ASCII g not ɡ, no tie bars; ɑ and the nasal exist only for French
    loans (ʁɛstoˈʁɑ̃ː). The three combining marks (U+0303 nasal, U+032F
    non-syllabic, U+0329 syllabic) are standalone members of the set and written
    as escapes so they don't render glued onto the preceding letter. */
export const IPA_CHARS =
  /^[aɐɑbçdeəɛfghiɪjklmnŋoøœɔpʁsʃtuʊvxyʏzʒʔˈˌː\u0303\u032F\u0329 ]+$/u;

/** Combining marks may only sit on a base that can carry them. */
const IPA_MARK_BASE: Array<[string, RegExp, string]> = [
  ['̯', /[iɪuʊyʏɐeoaɔ]/, 'non-syllabic mark must follow a vowel (aɪ̯, aʊ̯, ɔʏ̯, uːɐ̯)'],
  ['̩', /[nlmŋ]/, 'syllabic mark must follow n, l, m or ŋ'],
  ['̃', /[aɑɔɛœ]/, 'nasal mark must follow a vowel'],
];

/**
 * Every hard rule of the Lautschrift house style, as human-readable problems.
 * Lives here rather than in scripts/validate.ts so `bun run build` — which checks
 * content against these schemas — enforces it too, and so the look-alike traps get
 * named: ɡ/g and ʁ/r are near-indistinguishable on screen, and a generic "bad
 * character" message costs the author minutes every time.
 */
export function ipaProblems(de: string, ipa: string | undefined): string[] {
  if (!ipa) return [];
  const at = `ipa for "${de}"`;
  const problems: string[] = [];

  if (/[[\]/()]/.test(ipa)) problems.push(`${at} must be bare — the UI adds the brackets`);
  if (ipa !== ipa.trim() || /\s{2,}/.test(ipa)) problems.push(`${at} has stray whitespace`);
  if (ipa !== ipa.normalize('NFC')) problems.push(`${at} is not NFC-normalized`);
  if (ipa === de) problems.push(`${at} is identical to the headword (generator echoed the word?)`);

  if (/ɡ/.test(ipa)) problems.push(`${at} uses ɡ (U+0261) — house style is ASCII g`);
  if (/[rʀ]/.test(ipa)) problems.push(`${at} uses r/ʀ — German /r/ is ʁ (ɐ̯ when vocalized)`);
  if (/͡/.test(ipa)) problems.push(`${at} uses a tie bar — write ts / pf / tʃ untied`);

  if (!IPA_CHARS.test(ipa)) {
    const bad = [...new Set([...ipa])]
      .filter((c) => !IPA_CHARS.test(c))
      .map((c) => `"${c}" (U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')})`);
    problems.push(`${at} has characters outside the German set: ${bad.join(', ')}`);
  }

  const primary = (ipa.match(/ˈ/g) ?? []).length;
  if (primary === 0) problems.push(`${at} has no primary stress mark ˈ`);
  if (primary > 1 && !/\s/.test(de))
    problems.push(`${at} marks ${primary} primary stresses on one word — use ˌ for secondary`);

  for (const [mark, base, hint] of IPA_MARK_BASE) {
    for (let i = 0; i < ipa.length; i++) {
      if (ipa[i] === mark && (i === 0 || !base.test(ipa[i - 1]!))) {
        problems.push(`${at}: ${hint}`);
        break;
      }
    }
  }
  return problems;
}

export const vocabEntrySchema = z
  .object({
    de: z.string().min(1),
    /** Lautschrift: IPA of the headword alone — no article, and bare (the UI adds
        the brackets). Generate with `bun run gen:ipa`, then review. Notation is
        checked in the superRefine below. */
    ipa: z.string().min(1).optional(),
    pos: posSchema,
    /** nouns only */
    gender: z.enum(['m', 'f', 'n']).optional(),
    /** nouns: plural form with article, e.g. "die Äpfel"; "—" if unused */
    plural: z.string().optional(),
    en: z.string().min(1),
    ru: z.string().min(1),
    example_de: z.string().min(1),
    example_en: z.string().min(1),
    example_ru: z.string().min(1),
    /** verbs */
    partizip2: z.string().optional(),
    aux: z.enum(['haben', 'sein', 'haben/sein']).optional(),
    praesens_3sg: z.string().optional(),
    /** e.g. "+ Akk", "+ Dat", "auf + Akk" */
    valence: z.string().optional(),
    note: bilingualSchema.optional(),
  })
  .superRefine((entry, ctx) => {
    if (entry.pos === 'noun' && !entry.gender) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `noun "${entry.de}" must declare gender (m/f/n)`,
      });
    }
    if (entry.pos !== 'noun' && (entry.gender || entry.plural)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `"${entry.de}" is not a noun but has gender/plural`,
      });
    }
    // Sentence-length phrases are exempt: a full-sentence transcription is
    // useless in the table and hostile to author.
    if (entry.pos !== 'phrase' && !entry.ipa) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `"${entry.de}" is missing ipa (Lautschrift) — run \`bun run gen:ipa\``,
      });
    }
    for (const message of ipaProblems(entry.de, entry.ipa)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    }
  });
export type VocabEntry = z.infer<typeof vocabEntrySchema>;

export const vocabFileSchema = z.object({
  id: slug,
  title_de: z.string().min(1),
  title_en: z.string().min(1),
  title_ru: z.string().min(1),
  level: levelSchema,
  entries: z.array(vocabEntrySchema).min(1),
});
export type VocabFile = z.infer<typeof vocabFileSchema>;

// ---------------------------------------------------------------------------
// Exercises (content/exercises/<level>/<set-id>.yaml)
// ---------------------------------------------------------------------------

/** Canonical confusion tag, e.g. "haben-sein" — see the focus-tag table in CLAUDE.md. */
const focusTag = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'must be a kebab-case ASCII focus tag');

const itemBase = {
  id: slug,
  /** task instruction shown above the item, in both explanation languages */
  instruction: bilingualSchema.optional(),
  /** shown when the learner answers incorrectly */
  explain: bilingualSchema.optional(),
  /**
   * The one confusion this item drills (canonical tag from CLAUDE.md).
   * Attempts carry it into the progress log; weakness detection and
   * training prioritization aggregate error rates per tag.
   */
  focus: focusTag.optional(),
};

export const mcItemSchema = z.object({
  ...itemBase,
  type: z.literal('mc'),
  /** German sentence or question; may contain a gap written as ___ */
  prompt: z.string().min(1),
  options: z.array(z.string().min(1)).min(2),
  /** index into options — exactly one correct answer */
  correct: z.number().int().min(0),
  translation: bilingualSchema.optional(),
});

export const clozeItemSchema = z.object({
  ...itemBase,
  type: z.literal('cloze'),
  /** gaps written inline as {{answer}} or {{answer|alternative}} */
  text: z.string().min(1),
  translation: bilingualSchema.optional(),
});

export const matchItemSchema = z.object({
  ...itemBase,
  type: z.literal('match'),
  pairs: z
    .array(z.object({ left: z.string().min(1), right: z.string().min(1) }))
    .min(2),
});

export const orderItemSchema = z.object({
  ...itemBase,
  type: z.literal('order'),
  /** tokens in the correct order; the UI shuffles them */
  words: z.array(z.string().min(1)).min(2),
  /** alternative correct sentences (full text, tokens joined by spaces) */
  accept: z.array(z.string().min(1)).default([]),
  translation: bilingualSchema.optional(),
});

export const tableItemSchema = z.object({
  ...itemBase,
  type: z.literal('table'),
  title: z.string().optional(),
  /** column headers; the row label column is implicit */
  columns: z.array(z.string().min(1)).min(1),
  rows: z
    .array(
      z.object({
        label: z.string().min(1),
        cells: z
          .array(
            z.object({
              answer: z.string().min(1),
              /** given cells are prefilled and not asked */
              given: z.boolean().default(false),
            }),
          )
          .min(1),
      }),
    )
    .min(1),
});

export const translateItemSchema = z.object({
  ...itemBase,
  type: z.literal('translate'),
  /** source sentence, English version (shown when the explanation language is EN) */
  prompt_en: z.string().min(1),
  /** source sentence, Russian version (shown when the explanation language is RU) */
  prompt_ru: z.string().min(1),
  /** canonical German translation — shown as the correct answer on mistakes */
  answer: z.string().min(1),
  /** alternative accepted German translations (e.g. another valid V2 word order) */
  accept: z.array(z.string().min(1)).default([]),
});

export const listenItemSchema = z.object({
  ...itemBase,
  type: z.literal('listen'),
  /**
   * German sentence spoken aloud via browser TTS — also the canonical typed
   * answer. Keep it ≤ ~10 words at the set's level; write numbers as words
   * so what is heard and what must be typed agree. Punctuation is ignored in
   * matching; capitalization is not.
   */
  text: z.string().min(1),
  /** alternative accepted transcriptions (real spelling variants only) */
  accept: z.array(z.string().min(1)).default([]),
  translation: bilingualSchema.optional(),
});

export const exerciseItemSchema = z.discriminatedUnion('type', [
  mcItemSchema,
  clozeItemSchema,
  matchItemSchema,
  orderItemSchema,
  tableItemSchema,
  translateItemSchema,
  listenItemSchema,
]);
export type ExerciseItem = z.infer<typeof exerciseItemSchema>;

export const exerciseSetSchema = z.object({
  /** back-reference to the owning topic id */
  topic: slug,
  title: bilingualSchema.optional(),
  items: z.array(exerciseItemSchema).min(1),
});
export type ExerciseSet = z.infer<typeof exerciseSetSchema>;

// ---------------------------------------------------------------------------
// Reading texts (content/reading/<level>/<id>.yaml)
// ---------------------------------------------------------------------------

export const readingSchema = z.object({
  /** back-reference to the owning topic id */
  topic: slug,
  title_de: z.string().min(1),
  /**
   * Paragraphs of German text. Inline gloss markers:
   * `[[German phrase::en gloss::ru gloss]]` (see src/lib/gloss.ts).
   */
  text: z.array(z.string().min(1)).min(1),
  /** 2–4 comprehension questions shown after the text */
  questions: z.array(mcItemSchema).min(2).max(4),
});
export type Reading = z.infer<typeof readingSchema>;

// ---------------------------------------------------------------------------
// Atlas graph + curriculum spine (content/atlas.yaml)
// ---------------------------------------------------------------------------

/** A learner-facing CEFR can-do statement ("Ich kann …") with independently
    written EN and RU versions (never translations of each other). */
export const outcomeSchema = z.object({
  de: z.string().min(1),
  en: z.string().min(1),
  ru: z.string().min(1),
});
export type Outcome = z.infer<typeof outcomeSchema>;

export const atlasNodeSchema = z.object({
  id: slug,
  level: levelSchema,
  kind: topicKindSchema,
  prerequisites: z.array(slug).default([]),
  /** base topics this one revisits at greater depth (spiral learning). A target
      may also be a prerequisite — both meanings can apply. Must appear earlier
      in the spine. */
  deepens: z.array(slug).default([]),
  /** 2–4 can-do statements the topic teaches, at the topic's CEFR level */
  outcomes: z.array(outcomeSchema).min(2).max(4),
});
export type AtlasNode = z.infer<typeof atlasNodeSchema>;

/** One curriculum unit. The file order of `units:` IS the spine order — new
    units are inserted, never renumbered. */
export const atlasUnitSchema = z.object({
  id: slug,
  level: levelSchema,
  title_de: z.string().min(1),
  title_en: z.string().min(1),
  title_ru: z.string().min(1),
  /** topic ids in teaching order within the unit */
  topics: z.array(slug).min(1),
});
export type AtlasUnit = z.infer<typeof atlasUnitSchema>;

export const atlasSchema = z.object({
  nodes: z.array(atlasNodeSchema).min(1),
  units: z.array(atlasUnitSchema).min(1),
});
export type Atlas = z.infer<typeof atlasSchema>;
