// Generates `dtsPropsFor` into .design-sync/config.json.
//
// Why this exists: Deutsch-Atlas has no built .d.ts tree for the converter's
// extractor to read, so every component came out as `[key: string]: unknown` —
// an empty contract is worse than none, because the design agent codes against
// it. These bodies are written from the component sources and the Zod schemas
// in src/lib/schemas.ts.
//
// They are deliberately STRUCTURAL rather than referencing the real types: the
// items are `z.infer<typeof clozeItemSchema>`, and a design agent has no way to
// resolve a Zod schema. Inlining the shape is what makes the contract usable.
//
// Re-run after changing a synced component's props:
//   node .design-sync/dts-props.mjs
//
// Sources of truth: src/lib/schemas.ts (item shapes), the component sources
// named in config.json's componentSrcMap.

import { readFileSync, writeFileSync } from 'node:fs';

const BIL = `{ en: string; ru: string; uk?: string; de?: string }`;
const LANG = `'en' | 'ru' | 'uk' | 'de'`;
const TIER = `'untouched' | 'read' | 'practiced' | 'mastered'`;
const STRAND = `'foundations' | 'grammar' | 'communication' | 'vocabulary'`;

/** TopicNode in src/lib/mastery.ts — an atlas node plus its rolled-up content ids. */
const TOPIC_NODE = `{
    id: string;
    /** Route path, e.g. "/topics/a2/perfekt-haben-sein". */
    path: string;
    level: string;
    kind: string;
    title_de: string;
    title_en: string;
    title_ru: string;
    /** Optional Ukrainian title; render sites fall back to en. */
    title_uk?: string;
    prerequisites: string[];
    strand?: ${STRAND};
    group?: string;
    /** Exercise set ids belonging to this topic. */
    exerciseSets: string[];
    /** Vocab file ids whose decks belong to this topic. */
    vocabIds: string[];
    /** Reading ids belonging to this topic. */
    readingIds: string[];
    pretestId?: string;
    /** First authored practice-role set; completing every item advances the lesson. */
    primaryPractice?: { setId: string; itemIds: string[] };
  }`;

/** CourseTopic in src/components/atlas/course.ts — TopicNode plus curriculum edges. */
const COURSE_TOPIC = `{
    id: string;
    path: string;
    level: string;
    kind: string;
    title_de: string;
    title_en: string;
    title_ru: string;
    title_uk?: string;
    prerequisites: string[];
    exerciseSets: string[];
    vocabIds: string[];
    readingIds: string[];
    pretestId?: string;
    primaryPractice?: { setId: string; itemIds: string[] };
    strand: ${STRAND};
    group: string;
    /** 2–4 learner-facing can-do statements, each in every explanation language. */
    outcomes: Array<{
      id: string;
      mode: 'listening' | 'reading' | 'writing' | 'spoken-production' | 'spoken-interaction';
      domain?: 'personal' | 'public' | 'educational' | 'professional';
      de: string;
      en: string;
      ru: string;
      uk?: string;
    }>;
    /** Topic ids this one deepens — the edge must share a drilled focus tag. */
    deepens: string[];
    related: string[];
  }`;

/** TopicContext in src/lib/mastery.ts — the learner state a tier is derived from. */
const TOPIC_CONTEXT = `{
    /** The attempt log; every answered item across every set. */
    attempts: Array<{
      /** Exercise set id, e.g. "a2/perfekt-haben-sein". */
      setId: string;
      itemId: string;
      itemType: string;
      correct: boolean;
      /** What the learner entered or chose. */
      given: string;
      /** Partial credit for multi-part items. */
      correctParts?: number;
      totalParts?: number;
      focus?: string;
      evidence?: 'verified' | 'practice';
      outcomes?: string[];
      /** Epoch ms. */
      ts: number;
    }>;
    /** SRS card states, keyed by "<vocab-file-id>::<de>::<direction>". */
    cards: Record<string, unknown>;
    /** Per-topic progress, keyed by topic id. */
    topics: Record<string, {
      /** Epoch ms the article was first opened. */
      readAt?: number;
      /** Learner's own override. A self-rating is never evidence. */
      manual?: 'learned' | 'reopened';
      manualAt?: number;
      /** A passed level entry test — green and real, but never a tier. */
      placement?: { setId: string; at: number; score: number };
    }>;
  }`;

/** Completion in src/lib/mastery.ts. */
const COMPLETION = `{
    /** The measured tier, before any manual override. */
    auto: ${TIER};
    /** effectiveTier(auto, manual) — what the badge renders. */
    tier: ${TIER};
    manual?: 'learned' | 'reopened';
    /** Rendered as its own outlined marker, never folded into the tier. */
    placement?: { setId: string; at: number; score: number };
  }`;

// Bookkeeping fields every exercise item carries (itemBase in schemas.ts).
// They don't affect rendering, but they are part of the object you must pass.
const base = `
    id: string;
    /** Task contract version persisted with attempts. */
    revision?: number;
    /** Stable curriculum outcomes this item provides evidence for. */
    outcomes?: string[];
    /** Intentional preview of a structure taught later in the spine. */
    preview?: boolean;
    /** Task instruction shown above the item, in both explanation languages. */
    instruction?: ${BIL};
    /** Shown when the learner answers incorrectly — this is where the teaching happens. */
    explain?: ${BIL};
    /** The one confusion this item drills (kebab-case tag from docs/focus-tags.md). */
    focus?: string;`;

const onResult = `
  /** Called exactly once, when the learner submits. */
  onResult: (result: {
    correct: boolean;
    /** The learner's answer, serialized for the attempt log. */
    given: string;
    /** Partial credit for multi-part items (cloze/match/table). */
    correctParts?: number;
    totalParts?: number;
    /** Open production is useful practice but is never automatically verified. */
    evidence?: 'verified' | 'practice';
    responseMode?: 'selection' | 'writing' | 'listening' | 'spoken-production' | 'spoken-interaction';
    /** null disclaims the item's own focus tag when it was failed for an unrelated reason. */
    focus?: string | null;
  }) => void;`;

// The uniform runner contract every exercise item renderer takes (ItemProps<T>).
const runner = `
  /** Explanation language — picks which half of every bilingual field renders. */
  lang: ${LANG};${onResult}
  /** After submission the item is locked and shows its state. */
  locked: boolean;
  /** Advance to the next item. Rendered in the slot the Prüfen button occupied. */
  onNext: () => void;
  /** Label for the advance button — "Weiter →" or the runner's end-of-set wording. */
  nextLabel: string;`;

/** An exercise item renderer: `item` of the given shape, plus the runner contract. */
const item = (typeName, fields) => `
  item: {${base}
    type: '${typeName}';${fields}
  };${runner}`;

const props = {
  Cloze: item(
    'cloze',
    `
    /** German sentence whose gaps are written inline as {{answer}} or {{answer|alternative}}. */
    text: string;
    translation?: ${BIL};`,
  ),

  MultipleChoice: item(
    'mc',
    `
    /** German sentence or question; may contain a gap written as ___ */
    prompt: string;
    /** Rendered in shuffled order. Exactly one is correct. */
    options: string[];
    /** Index into options — exactly one correct answer. */
    correct: number;
    translation?: ${BIL};`,
  ),

  Match: item(
    'match',
    `
    /** Rendered as two shuffled columns the learner pairs up. At least 2 pairs. */
    pairs: Array<{
      /** German side. */
      left: string;
      /** A German↔German pair keeps a plain string; a meaning-side right is a
          per-language record — never a mixed "en / ru" string. */
      right: string | { en: string; ru: string; uk?: string };
    }>;`,
  ),

  Order: item(
    'order',
    `
    /** Tokens in the correct order; the component shuffles them for the learner. */
    words: string[];
    /** Alternative correct sentences (full text, tokens joined by spaces).
        Required even when empty — the schema defaults it to [] and the component
        maps over it while rendering, so omitting it throws. */
    accept: string[];
    translation?: ${BIL};`,
  ),

  TableFill: item(
    'table',
    `
    title?: string;
    /** Column headers; the row-label column is implicit. */
    columns: string[];
    rows: Array<{
      label: string;
      /** One cell per column. \`given\` cells render prefilled and are not asked. */
      cells: Array<{ answer: string; given?: boolean }>;
    }>;`,
  ),

  Translate: item(
    'translate',
    `
    /** Source sentence, English version (shown under explanation language 'en'). */
    prompt_en: string;
    /** Source sentence, Russian version (shown under 'ru'). */
    prompt_ru: string;
    /** Optional Ukrainian source; 'uk' and 'de' modes fall back to prompt_en. */
    prompt_uk?: string;
    /** Preferred German teaching model. */
    answer: string;
    /** Equally correct, target-preserving German renderings. Required even when
        empty — the component reads it while rendering. */
    accept: string[];
    /** Tokens of \`answer\` whose exact form this item grades — typically the verb
        form the focus tag is about. A near-miss on one of these is a real error;
        a slip anywhere else is forgiven as spelling. Required even when empty. */
    key_tokens: string[];`,
  ),

  Listen: item(
    'listen',
    `
    /** German sentence spoken aloud via browser TTS — also the canonical typed
        answer. Kept to ≤ ~10 words with numbers written as words, so what is
        heard and what must be typed agree. */
    text: string;
    /** Alternative accepted transcriptions (real spelling variants only).
        Required even when empty — the schema defaults it to [] and the component
        spreads it while rendering, so omitting it throws. */
    accept: string[];
    translation?: ${BIL};`,
  ),

  DocumentStimulus: `
  /** A reusable visual stimulus — a timetable, a form, a receipt. Renders the
      image with its caption and a collapsible text version. Viewing one is
      never learning evidence. */
  document: {
    id: string;
    title_de: string;
    /** Everyday-document genre, e.g. "Fahrplan", "Formular". */
    genre: string;
    /** Bilingual caption shown under the title. */
    description: ${BIL};
    /** Path to the image, resolved against the site base path. */
    asset: string;
    /** Plain-text version of the document, one entry per line. */
    transcript: string[];
    /** Required for real or adapted assets — someone else's work. */
    attribution?: string;
    license?: string;
  };`,

  Instruction: `
  /** Task instruction shown above an item. Renders nothing when absent. */
  text?: ${BIL};
  lang: ${LANG};`,

  ActionRow: `
  /** Whether the answer has been submitted. Drives the Prüfen→Weiter swap. */
  checked: boolean;
  /** Verdict shown as a chip beside the button once \`checked\`. */
  correct: boolean;
  /** Omit for items that submit on click (mc, match) — they never show Prüfen. */
  onCheck?: () => void;
  checkDisabled?: boolean;
  onNext: () => void;
  /** Label for the advance button — "Weiter →" or the end-of-set wording. */
  nextLabel: string;`,

  Feedback: `
  correct: boolean;
  /** The solution, shown only when the answer was wrong. */
  correctAnswer?: React.ReactNode;
  /** Override the default "Correct answer" label, e.g. for a minimal correction.
      It is concatenated directly onto the answer, so include the separator:
      "Partizip II: ", not "Partizip II". */
  correctAnswerLabel?: string;
  /** Shown whether or not the answer was correct — for things worth saying about
      an answer that still counts, such as the spelling of an otherwise right sentence. */
  note?: React.ReactNode;
  /** The teaching text, in both explanation languages. */
  explain?: ${BIL};
  lang: ${LANG};
  /** German text to offer for playback next to the correct answer. */
  speakText?: string;
  /** Other authored, equally correct renderings; shown only after submission. */
  alternatives?: string[];`,

  TierBadge: `
  /** The measured tier. Never raised by a self-rating or a passed placement. */
  tier: 'untouched' | 'read' | 'practiced' | 'mastered';
  /** Adds a ✎ mark when the tier is manually capped (reopened). */
  manual?: boolean;
  className?: string;`,

  SelfAssessedMark: `
  /** Outlined marker: the learner marked the topic learned. It sits beside the
      measured tier and never changes it — a self-rating is not evidence. */
  className?: string;`,

  PlacedMark: `
  /** Outlined marker: the learner passed this topic on the level entry test.
      Deliberately NOT the filled mastered pill — placement is real, green
      evidence, but it is not the ten spaced correct answers across two days
      that mastery means. */
  className?: string;`,

  EvidenceChips: `
  /** The evidence behind a topic's tier. The "2 Tage" chip is the one that
      explains an all-green row still badged Geübt: mastery must survive a
      night's sleep. */
  evidence: {
    /** The article was opened. */
    read: boolean;
    /** Primary practice was completed. */
    practiced: boolean;
    /** Correct answers spread across two days. */
    spaced: boolean;
    /** Whether this topic owns a vocab deck at all — hides the chip when false. */
    hasVocab: boolean;
    vocab: boolean;
  };
  className?: string;`,

  EvidenceChipRow: `
  /** A precomputed chip list — the Themen overview's per-tier filtered view.
      Renders nothing when empty, so a badge-only mastered row spends no space. */
  chips: ReadonlyArray<{
    /** Key into the chrome strings table, e.g. "evidence.read". */
    label: string;
    /** earned = green ✓, missing = dim filled, open = dashed outline. */
    state: 'earned' | 'missing' | 'open';
  }>;
  className?: string;`,

  Sparkline: `
  /** Series in [0,1]; higher values sit nearer the top.
      A null is a bucket with no data and it BREAKS the line — the stroke stops
      and restarts after the gap, rather than running through it, so the chart
      never draws a trend across a period nothing was measured in. A run of a
      single point therefore draws no line at all; its dot still marks it. */
  values: Array<number | null>;
  width?: number;
  height?: number;
  /** Inherits its color from the parent via currentColor. */
  className?: string;`,

  TopicProgressList: `
  /** One row per topic, sorted by level then German title. Each row renders the
      topic's evidence chips, its tier badge, and the self-rated / placed markers. */
  nodes: Array<${TOPIC_NODE}>;
  /** Learner state the tier and chips are computed from. */
  ctx: ${TOPIC_CONTEXT};`,

  TopicDetail: `
  /** The topic being shown: its outcomes and its place in the atlas. */
  topic: ${COURSE_TOPIC};
  /** Every topic in the course — used to resolve the prerequisite, unlocks,
      deepens and related ids on \`topic\` into linkable rows. */
  topics: Array<${COURSE_TOPIC}>;
  /** Atlas groups, used to build the breadcrumb above the title. */
  groups: Array<{
    id: string;
    strand: ${STRAND};
    parent?: string;
    title_de: string;
    title_en: string;
    title_ru: string;
    title_uk?: string;
  }>;
  /** Measured completion, for the tier badge. Absent renders 'untouched'. */
  completion?: ${COMPLETION};
  lang: ${LANG};
  /** Whether this topic is already the learner's active goal — hides the button. */
  isGoal: boolean;
  onGoal: (id?: string) => Promise<void>;
  /** Drop the card chrome; the host (drawer, expanded row) provides it and owns
      the top padding. */
  embedded?: boolean;`,

  SpeakerButton: `
  /** German text to speak. */
  text: string;
  rate?: number;
  /** Turtle button: slow playback for careful listening. */
  slow?: boolean;
  className?: string;`,
};

const path = '.design-sync/config.json';
const cfg = JSON.parse(readFileSync(path, 'utf8'));
cfg.dtsPropsFor = Object.fromEntries(
  Object.entries(props).map(([name, body]) => [name, body.trim()]),
);
writeFileSync(path, JSON.stringify(cfg, null, 2) + '\n');
console.log(`dtsPropsFor: ${Object.keys(props).length} components → ${path}`);
