/**
 * The Element — one classification for everything a topic is made of.
 *
 * WHY THIS EXISTS. Ask "what is this topic made of?" today and you get four different answers
 * depending on which field you look at: an exercise set says `role`, a reading says `kind`, a
 * listening artifact says `purpose`, and an article says nothing at all. Some links are declared
 * from both sides (topic ↔ set), some only from the far side (a document names its topic; the
 * topic does not name the document), and some exist only as a filename convention nothing checks
 * (`probe-<topic>.yaml`) or as a rule in prose (`primaryPractice` is "the first practice set in the
 * array"). So there is no list of a topic's parts anywhere — only twelve ways to find some of them.
 *
 * An Element is that list. Every artifact a learner can meet becomes one row with the same shape,
 * whatever file it came from, and the two properties that were never recorded anywhere become
 * fields:
 *
 * **`stage`** — where the artifact sits on the lesson cycle `CLAUDE.md` requires of every topic:
 * pretest → model → scaffold → fade → transfer → delayed-check. The cycle has been an authoring
 * convention with no representation in the data, which means nothing could report a topic whose arc
 * stops at "scaffold" — drilled, never transferred, never re-checked. It is **derived** from role
 * and type by default, so the 336 existing sets cost nothing, and **declarable** as an exception
 * where the derivation is wrong (a `practice` set that is really a fresh-context transfer task).
 *
 * **`touches`** — which of the four kinds of learning touch the artifact actually delivers: input,
 * retrieval, interaction, production. A topic can pass every existing gate while feeding only two
 * of them.
 *
 * Neither field is a score. Both exist so that a profile can be *shown* against the level median,
 * the discipline `grammar-depth.ts` and `comprehensibility.ts` already use — never against an
 * invented threshold.
 */
import { PRODUCTION_TYPES, SELECTION_TYPES, type LessonStage } from '@da/schema';
import type { ExerciseItem, ExerciseSet, LearningActivity, Level, Reading } from '@da/schema';

/**
 * What kind of thing this is. German, like the rest of the editorial surface, and deliberately
 * finer than the `role`/`kind` fields it is derived from: a reading splits by `kind` because an
 * intensive and an extensive text are different artifacts for different purposes, and the article
 * is an element although no field anywhere calls it one.
 */
export const ELEMENT_KINDS = [
  'artikel',
  'pretest',
  'praxis',
  'drill',
  'probe',
  'checkpoint',
  'einstufung',
  'pruefungspraxis',
  'lesetext-intensiv',
  'lesetext-extensiv',
  'hoertext',
  'wortschatz',
  'dokument',
  'wortfeld',
  'wortnetz',
  'entdecken',
  'referenz',
] as const;
export type ElementKind = (typeof ELEMENT_KINDS)[number];

/** The lesson cycle, in order. `keine` is for material outside the arc — reference, Entdecken. */
export { LESSON_STAGES, type LessonStage } from '@da/schema';

/** The four kinds of learning touch. A healthy topic feeds all four; nothing measures that today. */
export const TOUCHES = ['input', 'abruf', 'interaktion', 'produktion'] as const;
export type Touch = (typeof TOUCHES)[number];

/** Delivery medium is derived from content and deliberately separate from pedagogical purpose. */
export const LEARNING_MEDIA = ['mixed', 'listening', 'document'] as const;
export type LearningMedium = (typeof LEARNING_MEDIA)[number];

export interface ElementDepth {
  /** Items, or 1 for a single-artifact element (an article, a reading, a recording). */
  items: number;
  /** Of those, items that require the learner to produce German rather than choose it. */
  production: number;
  /** Independently scored parts — a cloze gap, a table cell, a match pair. */
  parts: number;
}

export interface Element {
  /** Stable and addressable: `<source-id>#<kind>`, e.g. `a2/perfekt-haben-sein#praxis`. */
  id: string;
  kind: ElementKind;
  /** The topic this belongs to. Every element belongs to exactly one. */
  topic: string;
  level: Level;
  stage: LessonStage;
  /** Learner-facing purpose of a topic-owned practice/drill file (ADR 0014). */
  activity?: LearningActivity;
  /** Derived delivery medium; only teaching sets carry it. */
  medium?: LearningMedium;
  touches: Touch[];
  /** Response modes this element can actually record, from item types and declared targets. */
  modes: string[];
  /** Focus tags carried by its items. */
  focus: string[];
  /** Outcome ids its items or questions claim. */
  outcomes: string[];
  depth: ElementDepth;
  /** Repo-relative path, so every row in the editor is one click from its file. */
  file: string;
  /** Human label for the editorial surface. */
  title?: string;
  /** True when the derivation was overridden by a declared `stage:` in the source file. */
  stageDeclared?: boolean;
}

/** `role` → the kind of element a set is. */
const KIND_BY_ROLE: Record<string, ElementKind> = {
  pretest: 'pretest',
  practice: 'praxis',
  drill: 'drill',
  probe: 'probe',
  checkpoint: 'checkpoint',
  placement: 'einstufung',
  'exam-practice': 'pruefungspraxis',
};

/**
 * Where each kind sits on the arc by default.
 *
 * `praxis` is `geruest` and `drill` is `ausblenden` because that is what the two roles are *for*:
 * a topic's own practice blocks on one confusion with the instruction visible, and a drill
 * interleaves it against its neighbours. Where an author wrote a practice set that is really a
 * transfer task, the set says so and `stageDeclared` records that it did.
 */
const STAGE_BY_KIND: Record<ElementKind, LessonStage> = {
  artikel: 'modell',
  pretest: 'pretest',
  praxis: 'geruest',
  drill: 'ausblenden',
  probe: 'nachpruefung',
  checkpoint: 'nachpruefung',
  einstufung: 'keine',
  pruefungspraxis: 'transfer',
  'lesetext-intensiv': 'modell',
  'lesetext-extensiv': 'modell',
  hoertext: 'modell',
  // A deck is retrieval and spacing — it runs on the FSRS clock, not on one topic's arc, so it
  // has no stage. Its touches say what it delivers; `stage` would be a category error.
  wortschatz: 'keine',
  dokument: 'modell',
  wortfeld: 'keine',
  wortnetz: 'keine',
  entdecken: 'keine',
  referenz: 'keine',
};

export function defaultStage(kind: ElementKind): LessonStage {
  return STAGE_BY_KIND[kind] ?? 'keine';
}

export function kindForRole(role: string | undefined): ElementKind {
  return KIND_BY_ROLE[role ?? 'practice'] ?? 'praxis';
}

export function kindForReading(kind: Reading['kind'] | undefined): ElementKind {
  return kind === 'extensive' ? 'lesetext-extensiv' : 'lesetext-intensiv';
}

/**
 * The touches a single item delivers.
 *
 * `speak` with `mode: spoken-interaction` is the only thing in the corpus that approximates
 * interaction — a single-learner app cannot do more, and pretending otherwise would make the
 * profile flatter than the truth. `audio-comprehension` is input *and* retrieval and never
 * production, which is exactly why the item-mix bar excludes it from both sides of its ratio.
 */
export function itemTouches(item: ExerciseItem): Touch[] {
  const touches = new Set<Touch>(['abruf']);
  if (PRODUCTION_TYPES.has(item.type)) touches.add('produktion');
  if (item.type === 'audio-comprehension' || item.type === 'listen') touches.add('input');
  if (item.type === 'speak' && (item as { mode?: string }).mode === 'spoken-interaction') {
    touches.add('interaktion');
  }
  if (item.type === 'speak' || item.type === 'write') touches.add('produktion');
  return [...touches];
}

/** The response mode an item records, unless the author declared a different target. */
export function itemMode(item: ExerciseItem): string {
  const declared = (item as { target_mode?: string }).target_mode;
  if (declared) return declared;
  switch (item.type) {
    case 'listen':
    case 'audio-comprehension':
      return 'listening';
    case 'speak':
      return (item as { mode?: string }).mode ?? 'spoken-production';
    case 'write':
    case 'translate':
    case 'cloze':
    case 'table':
    case 'form':
      return 'writing';
    default:
      return 'reading';
  }
}

export function learningMedium(set: ExerciseSet): LearningMedium {
  if (set.stimulus || set.items.some((item) => item.stimulus)) return 'document';
  if (
    set.items.length > 0 &&
    set.items.every((item) => item.type === 'listen' || item.type === 'audio-comprehension')
  ) {
    return 'listening';
  }
  return 'mixed';
}

/** Independently scored parts, for the depth figure. One per gap, cell, field or pair. */
export function itemParts(item: ExerciseItem): number {
  switch (item.type) {
    case 'cloze':
      return Math.max(1, [...((item as { text?: string }).text ?? '').matchAll(/\{\{/g)].length);
    case 'match':
      return (item as { pairs?: unknown[] }).pairs?.length ?? 1;
    case 'table':
      return (
        (item as { rows?: { cells?: { given?: boolean }[] }[] }).rows ?? []
      ).reduce((sum, row) => sum + (row.cells ?? []).filter((c) => !c.given).length, 0) || 1;
    case 'form':
      return (
        (item as { fields?: { given?: boolean }[] }).fields ?? []
      ).filter((f) => !f.given).length || 1;
    default:
      return 1;
  }
}

/** Roll a set's items up into the element's depth, touches, modes, tags and outcomes. */
export function summariseItems(items: readonly ExerciseItem[]): {
  depth: ElementDepth;
  touches: Touch[];
  modes: string[];
  focus: string[];
  outcomes: string[];
} {
  const touches = new Set<Touch>();
  const modes = new Set<string>();
  const focus = new Set<string>();
  const outcomes = new Set<string>();
  let production = 0;
  let parts = 0;
  for (const item of items) {
    for (const t of itemTouches(item)) touches.add(t);
    modes.add(itemMode(item));
    if (item.focus) focus.add(item.focus);
    for (const o of item.outcomes ?? []) outcomes.add(o);
    if (PRODUCTION_TYPES.has(item.type)) production += 1;
    parts += itemParts(item);
  }
  return {
    depth: { items: items.length, production, parts },
    touches: [...touches],
    modes: [...modes],
    focus: [...focus].sort(),
    outcomes: [...outcomes].sort(),
  };
}

/** Selection-heavy sets are worth spotting; re-exported so callers need one import. */
export { PRODUCTION_TYPES, SELECTION_TYPES };
export type { ExerciseSet };
