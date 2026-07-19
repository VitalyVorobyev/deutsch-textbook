import { z } from 'zod';

/** CEFR levels covered by the atlas. */
export const LEVELS = ['A1', 'A2', 'B1', 'B2'] as const;
export const levelSchema = z.enum(LEVELS);
export type Level = z.infer<typeof levelSchema>;

export const TOPIC_KINDS = ['grammar', 'vocab-field', 'communication', 'phonetics'] as const;
export const CURRICULUM_STRANDS = ['foundations', 'grammar', 'communication', 'vocabulary'] as const;
export type CurriculumStrand = (typeof CURRICULUM_STRANDS)[number];
export const topicKindSchema = z.enum(TOPIC_KINDS);
export type TopicKind = z.infer<typeof topicKindSchema>;

/** Text that exists in both core explanation languages. `uk` (translation
    waves) and `de` (German-medium halves, B1 onward) are optional and fall
    back to `en` at render time (`pick` in src/lib/prefs.ts). Parity is
    enforced per file by the validator, not per record here. */
export const bilingualSchema = z.object({
  en: z.string().min(1),
  ru: z.string().min(1),
  uk: z.string().min(1).optional(),
  de: z.string().min(1).optional(),
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
  title_uk: z.string().min(1).optional(),
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

  // The contract keeps the glottal stop before a word-internal stressed vowel
  // (bəˈʔantvɔʁtn̩) and drops it word-initially — but the two look identical in a
  // transcription, so the wrong one slipped through twice before this check existed.
  if (/^ʔ/.test(ipa))
    problems.push(`${at} starts with ʔ — a word-initial glottal stop is not transcribed`);
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
    /** optional Ukrainian gloss (translation waves); no `de` gloss exists —
        a German gloss of a German headword is nonsense */
    uk: z.string().min(1).optional(),
    example_de: z.string().min(1),
    example_en: z.string().min(1),
    example_ru: z.string().min(1),
    example_uk: z.string().min(1).optional(),
    /** verbs */
    partizip2: z.string().optional(),
    aux: z.enum(['haben', 'sein', 'haben/sein']).optional(),
    praesens_3sg: z.string().optional(),
    /** e.g. "+ Akk", "+ Dat", "auf + Akk" */
    valence: z.string().optional(),
    /**
     * Further typed answers the EN/RU→DE production card must accept.
     *
     * `de` is three things at once: the Wortliste key (matched against the manifest
     * character for character), the answer shown on the back, and the answer the
     * learner must type. For most words those coincide. For three classes they do
     * not, and without this field the card marks correct German wrong:
     *  - a reflexive verb — the headword is `ärgern`, but the form a learner should
     *    produce is `sich ärgern`;
     *  - an adjectival noun — `die Deutsche` is one correct form of several, and
     *    `der Deutsche` / `ein Deutscher` are just as right;
     *  - anywhere the article is genuinely optional.
     * A country that takes no article is NOT solved here: it is `pos: phrase`, so no
     * article is demanded of it in the first place.
     */
    accept: z.array(z.string().min(1)).default([]),
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
  title_uk: z.string().min(1).optional(),
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
  /** Task contract version persisted with attempts. */
  revision: z.number().int().min(1).default(1),
  /** stable curriculum outcomes this item provides evidence for */
  outcomes: z.array(slug).default([]),
  /** intentional preview of a structure taught later in the spine */
  preview: z.boolean().default(false),
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
    .array(
      z.object({
        left: z.string().min(1),
        /** A German↔German pair keeps a plain string. A meaning-side right is a
            per-language record — never a mixed "en / ru" string, which no
            language mode can render and the parity/letter-set checks cannot
            see. The record's `en` doubles as the pair's stable identity in
            Match.tsx, so edit it as carefully as an answer. */
        right: z.union([
          z.string().min(1),
          z
            .object({ en: z.string().min(1), ru: z.string().min(1), uk: z.string().min(1).optional() })
            .strict(),
        ]),
      }),
    )
    .min(2)
    // Identity must be unique on both columns — and for the right column,
    // unique as *rendered under every language mode*, not merely as identity:
    // matching keys on the record's `en`, so two rights whose ru (or uk)
    // labels coincide would show the learner two indistinguishable buttons of
    // which one is "wrong". The uk label falls back to en exactly as pick()
    // renders it. (de mode renders en, so the en pass covers it.)
    .superRefine((pairs, ctx) => {
      const lefts = new Set<string>();
      for (const p of pairs) {
        if (lefts.has(p.left))
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `duplicate left "${p.left}" — pair identity must be unique` });
        lefts.add(p.left);
      }
      for (const mode of ['en', 'ru', 'uk'] as const) {
        const seen = new Set<string>();
        for (const p of pairs) {
          const label =
            typeof p.right === 'string'
              ? p.right
              : mode === 'ru'
                ? p.right.ru
                : mode === 'uk'
                  ? (p.right.uk ?? p.right.en)
                  : p.right.en;
          if (seen.has(label))
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `duplicate right label "${label}" under ${mode} mode — rights must render distinct in every language`,
            });
          seen.add(label);
        }
      }
    }),
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
  /** source sentence, Ukrainian version (optional; uk mode falls back to the EN
      prompt). There is deliberately no prompt_de: a German→German translation
      prompt is nonsense, so de mode also falls back to the EN prompt. */
  prompt_uk: z.string().min(1).optional(),
  /** preferred German teaching model; feedback may use a closer accepted rendering */
  answer: z.string().min(1),
  /** equally correct, target-preserving German renderings (e.g. another valid V2 order) */
  accept: z.array(z.string().min(1)).default([]),
  /**
   * The tokens of `answer` whose exact form this item grades — typically the verb
   * form or participle the `focus` tag is about. A near-miss on one of these is a
   * real error (`geflügen` is a wrong participle, not a typo) and is what the focus
   * tag is attributed to; a slip anywhere else is forgiven as spelling.
   *
   * Word order needs no declaration (tokens are compared positionally), and articles
   * and pronouns are protected automatically, so an item usually needs this only when
   * it grades a verb form. See `src/lib/production.ts`.
   */
  key_tokens: z.array(z.string().min(1)).default([]),
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

/** Open productive writing. It creates practice evidence, never an automatic
    correctness score. The model stays hidden until the learner submits. */
export const writeItemSchema = z.object({
  ...itemBase,
  type: z.literal('write'),
  prompt: bilingualSchema,
  goal: bilingualSchema,
  requirements: z.array(bilingualSchema).min(1),
  model_answer: z.string().min(1),
  model_translation: bilingualSchema.optional(),
  min_words: z.number().int().min(1).default(8),
});

/** Open spoken production or interaction. Audio never leaves the browser and
    the completion is practice evidence, not automatically verified accuracy. */
export const speakItemSchema = z.object({
  ...itemBase,
  type: z.literal('speak'),
  mode: z.enum(['spoken-production', 'spoken-interaction']),
  prompt: bilingualSchema,
  goal: bilingualSchema,
  checklist: z.array(bilingualSchema).min(1),
  model_answer: z.string().min(1),
  model_translation: bilingualSchema.optional(),
});

const audioTurnSchema = z.object({
  speaker: z.string().min(1),
  text: z.string().min(1),
});

export const audioSourceSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('tts'),
    turns: z.array(audioTurnSchema).min(1),
    rate: z.number().min(0.5).max(1.2).default(0.9),
  }),
  z.object({
    kind: z.literal('asset'),
    src: z.string().min(1),
    transcript: z.array(audioTurnSchema).min(1),
  }),
]);

/** Listening comprehension rather than dictation. When no audio is available
    the UI exposes the transcript and explicitly relabels the task as reading. */
export const audioComprehensionItemSchema = z.object({
  ...itemBase,
  type: z.literal('audio-comprehension'),
  source: audioSourceSchema,
  question: z.string().min(1),
  options: z.array(z.string().min(1)).min(2),
  correct: z.number().int().min(0),
  translation: bilingualSchema.optional(),
  max_replays: z.number().int().min(1).max(10).default(3),
});

export const exerciseItemSchema = z.discriminatedUnion('type', [
  mcItemSchema,
  clozeItemSchema,
  matchItemSchema,
  orderItemSchema,
  tableItemSchema,
  translateItemSchema,
  listenItemSchema,
  writeItemSchema,
  speakItemSchema,
  audioComprehensionItemSchema,
]);
export type ExerciseItem = z.infer<typeof exerciseItemSchema>;

export const EXERCISE_ROLES = ['pretest', 'practice', 'drill', 'checkpoint', 'probe'] as const;
export const exerciseRoleSchema = z.enum(EXERCISE_ROLES);
export type ExerciseRole = z.infer<typeof exerciseRoleSchema>;

export const exerciseSetSchema = z.object({
  /** back-reference to the owning topic id */
  topic: slug,
  /** explicit learning role; controls training eligibility and evidence use */
  role: exerciseRoleSchema.default('practice'),
  title: bilingualSchema.optional(),
  /** Reusable document kept visible while every item in this set is answered. */
  stimulus: z.string().optional(),
  items: z.array(exerciseItemSchema).min(1),
});
export type ExerciseSet = z.infer<typeof exerciseSetSchema>;

// ---------------------------------------------------------------------------
// Reading texts (content/reading/<level>/<id>.yaml)
// ---------------------------------------------------------------------------

export const READING_KINDS = ['intensive', 'extensive'] as const;

export const readingSchema = z.object({
  /** back-reference to the owning topic id */
  topic: slug,
  title_de: z.string().min(1),
  /**
   * What the text is *for*, which decides how it is read — not merely how long it is.
   *
   * `intensive` (the default, and every reading before this field existed): ~90–130 words,
   * densely glossed, followed by comprehension questions. The learner works through it.
   *
   * `extensive`: 250–400 words at late A1, very high known-word coverage and sparse glosses,
   * read for meaning at volume. It is deliberately NOT quizzed line by line — being asked to
   * account for every sentence is what turns reading back into a test, and the whole point of
   * this track is the reading itself. A couple of gist questions are allowed; none is fine.
   */
  kind: z.enum(READING_KINDS).default('intensive'),
  /**
   * Paragraphs of German text. Inline gloss markers:
   * `[[German phrase::en gloss::ru gloss]]` (see src/lib/gloss.ts).
   */
  text: z.array(z.string().min(1)).min(1),
  /** comprehension questions shown after the text — 2–4 for intensive, 0–2 for extensive */
  questions: z.array(mcItemSchema).max(4).default([]),
});
export type Reading = z.infer<typeof readingSchema>;

// ---------------------------------------------------------------------------
// Visual documents (content/documents/<level>/<id>.yaml)
// ---------------------------------------------------------------------------

export const visualDocumentSchema = z
  .object({
    topic: slug,
    level: levelSchema,
    title_de: z.string().min(1),
    genre: z.enum(['notice', 'timetable', 'form', 'listing', 'letter', 'receipt', 'map', 'chat']),
    sourceClass: z.enum(['real', 'adapted', 'simulated']),
    asset: z.string().min(1),
    description: bilingualSchema,
    transcript: z.array(z.string().min(1)).min(1),
    attribution: z.string().min(1).optional(),
    license: z.string().min(1).optional(),
  })
  .superRefine((document, ctx) => {
    if (document.sourceClass !== 'simulated' && (!document.attribution || !document.license)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'real/adapted documents require attribution and license',
      });
    }
  });
export type VisualDocument = z.infer<typeof visualDocumentSchema>;

// ---------------------------------------------------------------------------
// Vocabulary fields (content/wortfelder/<id>.yaml)
// ---------------------------------------------------------------------------

const vocabRefSchema = z.object({ deck: slug, de: z.string().min(1) });
const lexicalRelationSchema = z.object({
  type: z.enum(['collocation', 'contrast', 'family', 'formation', 'register']),
  de: z.string().min(1),
  explanation: bilingualSchema,
  example_de: z.string().min(1).optional(),
  example: bilingualSchema.optional(),
});
const wordFieldMemberSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('card'),
    ref: vocabRefSchema,
    role: z.enum(['active', 'chunk']),
    relations: z.array(lexicalRelationSchema).max(4).default([]),
  }),
  z.object({
    kind: z.literal('receptive'),
    de: z.string().min(1),
    en: z.string().min(1),
    ru: z.string().min(1),
    uk: z.string().min(1).optional(),
    note: bilingualSchema.optional(),
  }),
]);
export const wordFieldSchema = z.object({
  id: slug,
  topic: slug,
  level: levelSchema,
  title_de: z.string().min(1),
  title_en: z.string().min(1),
  title_ru: z.string().min(1),
  title_uk: z.string().min(1).optional(),
  members: z.array(wordFieldMemberSchema).min(1),
});
export type WordField = z.infer<typeof wordFieldSchema>;

// ---------------------------------------------------------------------------
// Cross-topic lexical networks (content/wortnetze/<id>.yaml)
// ---------------------------------------------------------------------------

const wortnetzMemberBaseSchema = z.object({
  id: slug,
  status: z.enum(['productive', 'receptive']),
  usage: bilingualSchema,
  collocations: z.array(z.string().min(1)).max(5).default([]),
  example: z.object({
    de: z.string().min(1),
    en: z.string().min(1),
    ru: z.string().min(1),
    uk: z.string().min(1),
  }),
});

const wortnetzMemberSchema = z.discriminatedUnion('kind', [
  wortnetzMemberBaseSchema.extend({
    kind: z.literal('card'),
    ref: vocabRefSchema,
  }),
  wortnetzMemberBaseSchema.extend({
    kind: z.literal('receptive'),
    de: z.string().min(1),
    gloss: bilingualSchema.extend({ uk: z.string().min(1) }),
  }),
]);

const wortnetzRelationSchema = z
  .object({
    from: slug,
    to: slug,
    type: z.enum(['family', 'formation', 'meaning-contrast', 'register', 'collocation']),
    basis: z.enum(['current-meaning', 'historical', 'mnemonic']),
    explanation: bilingualSchema.extend({ uk: z.string().min(1) }),
    source_note: z.string().min(1).optional(),
  })
  .superRefine((relation, ctx) => {
    if (relation.basis === 'historical' && !relation.source_note) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['source_note'],
        message: 'historical relations require an authoring source note',
      });
    }
  });

export const wortnetzSchema = z
  .object({
    id: slug,
    kind: z.enum(['family', 'meaning-contrast']),
    level: levelSchema,
    title_de: z.string().min(1),
    title: bilingualSchema.extend({ uk: z.string().min(1) }),
    introduction: bilingualSchema.extend({ uk: z.string().min(1) }),
    members: z.array(wortnetzMemberSchema).min(2),
    relations: z.array(wortnetzRelationSchema).min(1),
  })
  .superRefine((network, ctx) => {
    const ids = new Set<string>();
    for (const [index, member] of network.members.entries()) {
      if (ids.has(member.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['members', index, 'id'],
          message: `duplicate member id "${member.id}"`,
        });
      }
      ids.add(member.id);
    }
    const relations = new Set<string>();
    for (const [index, relation] of network.relations.entries()) {
      if (!ids.has(relation.from)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['relations', index, 'from'],
          message: `unknown member "${relation.from}"`,
        });
      }
      if (!ids.has(relation.to)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['relations', index, 'to'],
          message: `unknown member "${relation.to}"`,
        });
      }
      const key = `${relation.from}::${relation.to}::${relation.type}`;
      if (relations.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['relations', index],
          message: `duplicate canonical relation "${key}"`,
        });
      }
      relations.add(key);
    }
  });
export type Wortnetz = z.infer<typeof wortnetzSchema>;

// ---------------------------------------------------------------------------
// Optional discovery/editorial pieces (content/discovery/<level>/<id>.mdx)
// ---------------------------------------------------------------------------

/** Same provenance contract as visualDocumentSchema: a real or adapted asset
    is someone else's work, so shipping it without attribution and license is
    not an option the schema offers. Simulated assets are the course's own. */
const discoveryImageSchema = z
  .object({
    src: z.string().min(1),
    alt: z.string().min(1),
    sourceClass: z.enum(['real', 'adapted', 'simulated']),
    attribution: z.string().min(1).optional(),
    license: z.string().min(1).optional(),
  })
  .superRefine((image, ctx) => {
    if (image.sourceClass !== 'simulated' && (!image.attribution || !image.license)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'real/adapted images require attribution and license',
      });
    }
  });

/** Curated external material. Links are rendered visibly online-only and are
    never load-bearing: a dead link may disappoint, but nothing breaks. */
const discoveryLinkSchema = z.object({
  url: z.string().url().startsWith('https://'),
  label: z.string().min(1),
  note: bilingualSchema.optional(),
});

// Strict on purpose: the retired bare `image` field must fail loudly in old
// frontmatter, not be silently stripped and leave a piece without its picture.
export const discoverySchema = z
  .object({
    id: slug,
    level: levelSchema,
    title_de: z.string().min(1),
    title_en: z.string().min(1),
    title_ru: z.string().min(1),
    title_uk: z.string().min(1).optional(),
    summary: bilingualSchema,
    images: z.array(discoveryImageSchema).default([]),
    links: z.array(discoveryLinkSchema).default([]),
    status: z.enum(['draft', 'reviewed']).default('draft'),
  })
  .strict();
export type Discovery = z.infer<typeof discoverySchema>;

export const caseReferenceSchema = z.object({
  id: z.literal('cases'),
  articles: z.array(z.object({
    case: z.enum(['Nominativ', 'Akkusativ', 'Dativ']),
    masculine: z.string(), feminine: z.string(), neuter: z.string(), plural: z.string(),
  })).min(3),
  pronouns: z.array(z.object({ nominative: z.string(), accusative: z.string(), dative: z.string() })).min(1),
  prepositions: z.object({
    accusative: z.array(z.object({ form: z.string(), example: z.string().optional() })),
    dative: z.array(z.object({ form: z.string(), example: z.string().optional() })),
    two_way: z.array(z.object({ form: z.string(), example: z.string().optional() })),
  }),
});
export type CaseReference = z.infer<typeof caseReferenceSchema>;

/** A German example sentence with its translations. `de` is content (the
    sentence itself), never a German explanation half — which is why
    content/reference-data is exempt from deParityProblems. `uk` exists for
    parity satisfiability: zod strips unknown keys, so without this slot a
    reference file gaining `meaning.uk` could never satisfy the validator's
    uk-parity rule (its examples' uk would be stripped before the check). */
const referenceExampleSchema = z.object({
  de: z.string().min(1),
  en: z.string().min(1),
  ru: z.string().min(1),
  uk: z.string().min(1).optional(),
});

export const pronominalAdverbReferenceSchema = z.object({
  id: z.literal('pronominal-adverbs'),
  entries: z.array(z.object({
    preposition: z.string().min(1),
    status: z.enum(['productive', 'receptive']),
    construction: z.string().min(1),
    question: z.string().min(1),
    thing: z.string().min(1),
    person: z.string().min(1),
    example: referenceExampleSchema,
  })).min(1),
  temporal: z.array(z.object({
    form: z.enum(['vorher', 'zuvor', 'danach']),
    status: z.enum(['productive', 'receptive']),
    meaning: bilingualSchema,
    example: referenceExampleSchema,
  })).length(3),
});
export type PronominalAdverbReference = z.infer<typeof pronominalAdverbReferenceSchema>;

export const zahlenDatumZeitReferenceSchema = z.object({
  id: z.literal('zahlen-datum-zeit'),
  /** cardinal numbers: numeral → spelled-out word (German only, no gloss) */
  cardinals: z.array(z.object({ value: z.string().min(1), word: z.string().min(1) })).min(1),
  /** ordinal numbers: "1." → "erste" */
  ordinals: z.array(z.object({ value: z.string().min(1), word: z.string().min(1) })).min(1),
  /** clock times: 24-hour value, its formal reading, and the everyday one */
  clock: z.array(z.object({
    time: z.string().min(1),
    formal: z.string().min(1),
    colloquial: z.string().min(1).optional(),
  })).min(1),
  weekdays: z.array(z.string().min(1)).length(7),
  months: z.array(z.string().min(1)).length(12),
  /** the formation rules — bilingual, with an optional German example */
  notes: z.array(z.object({
    heading: bilingualSchema,
    body: bilingualSchema,
    example: referenceExampleSchema.optional(),
  })).min(1),
});
export type ZahlenDatumZeitReference = z.infer<typeof zahlenDatumZeitReferenceSchema>;

const connectorSyntaxSchema = z.enum([
  'coordinating',
  'subordinating',
  'adverbial',
  'prepositional',
  'paired',
]);

export const sentenceConnectorsReferenceSchema = z.object({
  id: z.literal('sentence-connectors'),
  relations: z.array(z.object({
    id: slug,
    title: bilingualSchema,
    cue: bilingualSchema,
    description: bilingualSchema,
    entries: z.array(z.object({
      form: z.string().min(1),
      level: levelSchema,
      syntax: connectorSyntaxSchema,
      register: z.enum(['neutral', 'spoken', 'written', 'formal']).default('neutral'),
      meaning: bilingualSchema,
      note: bilingualSchema.optional(),
      example: referenceExampleSchema,
    })).min(1),
  })).min(1),
  comparisons: z.array(z.object({
    id: slug,
    title: bilingualSchema,
    explanation: bilingualSchema,
    examples: z.array(referenceExampleSchema).min(2),
  })).min(1),
});
export type SentenceConnectorsReference = z.infer<typeof sentenceConnectorsReferenceSchema>;

export const referenceDataSchema = z.discriminatedUnion('id', [
  caseReferenceSchema,
  pronominalAdverbReferenceSchema,
  zahlenDatumZeitReferenceSchema,
  sentenceConnectorsReferenceSchema,
]);
export type ReferenceData = z.infer<typeof referenceDataSchema>;

// ---------------------------------------------------------------------------
// Atlas graph + curriculum spine (content/atlas.yaml)
// ---------------------------------------------------------------------------

/** A learner-facing CEFR can-do statement ("Ich kann …") with independently
    written EN and RU versions (never translations of each other). */
export const outcomeSchema = z.object({
  id: slug,
  mode: z.enum(['listening', 'reading', 'writing', 'spoken-production', 'spoken-interaction']),
  domain: z.enum(['personal', 'public', 'educational', 'professional']).optional(),
  /** the German can-do itself — under ExplainLang 'de' it doubles as the explanation */
  de: z.string().min(1),
  en: z.string().min(1),
  ru: z.string().min(1),
  uk: z.string().min(1).optional(),
});
export type Outcome = z.infer<typeof outcomeSchema>;

export const atlasGroupSchema = z.object({
  id: slug,
  strand: z.enum(CURRICULUM_STRANDS),
  parent: slug.optional(),
  title_de: z.string().min(1),
  title_en: z.string().min(1),
  title_ru: z.string().min(1),
  // zod strips unknown keys, so without this slot a title_ru-bearing group
  // could never satisfy the validator's per-file uk-parity rule.
  title_uk: z.string().min(1).optional(),
});
export type AtlasGroup = z.infer<typeof atlasGroupSchema>;

export const atlasNodeSchema = z.object({
  id: slug,
  level: levelSchema,
  kind: topicKindSchema,
  strand: z.enum(CURRICULUM_STRANDS),
  group: slug,
  prerequisites: z.array(slug).default([]),
  /** base topics this one revisits at greater depth (spiral learning). A target
      may also be a prerequisite — both meanings can apply. Must appear earlier
      in the spine. */
  deepens: z.array(slug).default([]),
  /** Useful comparison/association; symmetric, non-blocking, and unordered. */
  related: z.array(slug).default([]),
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
  // parity satisfiability, same as atlasGroupSchema
  title_uk: z.string().min(1).optional(),
  /** topic ids in teaching order within the unit */
  topics: z.array(slug).min(1),
});
export type AtlasUnit = z.infer<typeof atlasUnitSchema>;

export const atlasSchema = z.object({
  groups: z.array(atlasGroupSchema).min(1),
  nodes: z.array(atlasNodeSchema).min(1),
  units: z.array(atlasUnitSchema).min(1),
});
export type Atlas = z.infer<typeof atlasSchema>;

// ---------------------------------------------------------------------------
// Grading decisions (data/grading-decisions.yaml)
// ---------------------------------------------------------------------------

export const GRADING_DECISION_RULINGS = ['accept', 'constrain', 'confirm'] as const;

/**
 * One committed linguistic ruling on a rejected `translate` rendering.
 *
 * The audit's grading-review queue is derived from the attempt log and has no
 * memory, so without a committed home for rulings the same rendering returns for
 * review on every run and the queue can never drain. This file is that memory —
 * loaded by both `scripts/validate.ts` (which enforces the machine-checkable
 * claims) and `scripts/progress-audit.ts` (which applies the exclusion semantics;
 * see `src/lib/grading-decisions.ts`).
 */
export const gradingDecisionSchema = z.object({
  /** `<set-id>:<item-id>` of the translate item the rendering answered */
  item: z
    .string()
    .regex(/^[a-z0-9/-]+:[a-z0-9-]+$/, 'must be <set-id>:<item-id> (kebab-case path ids)'),
  /** the rendering as logged; matched via `normalizeTranslation`, so spacing and
      trailing sentence punctuation never distinguish two renderings */
  given: z.string().min(1),
  /**
   * accept    — correct, target-preserving German. Must pass today's grader
   *             (validator-enforced): either the scorer's slip-forgiveness covers
   *             it or the item's `accept` list gains it in the same change.
   * constrain — good German that bypasses the target; paired with a bilingual
   *             `instruction` constraint on the item.
   * confirm   — the rejection was linguistically right; the attempts re-enter the
   *             focus signals with attribution recomputed under today's grader.
   */
  decision: z.enum(GRADING_DECISION_RULINGS),
  /** the linguistic reason, stated so a future reviewer can re-check it */
  note: z.string().min(1),
  /** date of the ruling, YYYY-MM-DD */
  decidedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a YYYY-MM-DD date'),
});
export type GradingDecision = z.infer<typeof gradingDecisionSchema>;

export const gradingDecisionsSchema = z.array(gradingDecisionSchema);
