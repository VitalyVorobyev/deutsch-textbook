/**
 * Shared pieces of the Leben-in-Deutschland islands (ADR 0009): the build-time data shapes the
 * pages hand them, the per-profile "new questions per day" setting, the in-progress mock's
 * storage key, and the furniture all three islands draw with.
 *
 * Client-safe on purpose: types only from `@da/schema/lid`, no `node:fs`. The pages assemble
 * the data with `getLidCatalogue()` (src/lib/content.ts), which is the only reader of the bank.
 */
import type { LidBank, LidOptionKey, LidQuestion } from '@da/schema/lid';
import { getActiveProfileId } from '../../lib/profile';
import { t, type StringKey, type UiLang } from '../../lib/strings';

/** The course's note on one question, as the islands see it — never the official text. */
export interface LidNoteView {
  rationale_de?: string;
  source?: string;
  /** an UNOFFICIAL translation; practice only, never the mock exam */
  question?: { en: string; ru: string; uk?: string };
  options?: Record<LidOptionKey, { en: string; ru: string; uk?: string }>;
  terms?: { de: string; en: string; ru: string; uk?: string }[];
  status: 'draft' | 'reviewed';
}

/** One official question with the topic the course files it under. */
export interface LidEntry {
  question: LidQuestion;
  topic: string;
  topicTitle: string;
  module: string;
  note?: LidNoteView;
  /** The lesson that teaches this question's topic, if one does — practice feedback links it. */
  lesson?: { id: string; title: string };
}

/**
 * One lesson (`content/lid/lessons/<id>.mdx`) as the list, the lesson page and the practice island
 * see it. Its questions are every in-scope question of its topics, in teaching order.
 */
export interface LidLessonView {
  id: string;
  title: string;
  order: number;
  summary: string;
  status: 'draft' | 'reviewed';
  topics: string[];
  ids: string[];
}

/** What `/pruefung/leben/ueben?lektion=<id>` needs of each lesson: its title and its questions. */
export type LidLessonScopes = Record<string, { title: string; ids: string[] }>;

/** The lessons as the practice island's scope map. */
export const lessonScopes = (lessons: readonly LidLessonView[]): LidLessonScopes =>
  Object.fromEntries(
    lessons.map((lesson) => [lesson.id, { title: lesson.title, ids: lesson.ids }]),
  );

export interface LidModuleView {
  id: string;
  title: string;
  topics: { id: string; title: string; ids: string[] }[];
}

/** Everything a LiD page needs, built once at build time. */
export interface LidCatalogue {
  source: LidBank['source'];
  /** `dataset.version` — what every answer records it was graded against */
  bankVersion: string;
  /** the learner's state, `bank.states[0]` — Bayern today */
  state: string;
  modules: LidModuleView[];
  /** the general questions plus the state's, in TEACHING order: module → topic → official number */
  entries: LidEntry[];
  /** the lessons, in their `order` */
  lessons: LidLessonView[];
}

export const LID_OPTION_ORDER: readonly LidOptionKey[] = ['a', 'b', 'c', 'd'];

/** The state names the bank can carry. A second state is data (ADR 0009); its name joins here. */
const STATE_NAMES: Record<string, string> = { BY: 'Bayern' };
export const stateName = (code: string): string => STATE_NAMES[code] ?? code;

/** A chrome string with its `{name}` placeholders filled. */
export function lidText(
  key: StringKey,
  uiLang: UiLang,
  vars: Record<string, string | number> = {},
): string {
  return t(key, uiLang).replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
}

/** "Frage 21" or "Bayern 3" — the catalogue's own numbering, never a position in a queue. */
export function questionLabel(question: LidQuestion, uiLang: UiLang): string {
  return question.stateCode
    ? `${stateName(question.stateCode)} ${question.officialNumber}`
    : lidText('lid.questionNumber', uiLang, { n: question.officialNumber });
}

/** Fragment ids on the catalogue page, so a question or topic can be linked to. */
export const questionAnchor = (id: string): string => `frage-${id}`;
export const topicAnchor = (id: string): string => `thema-${id}`;

// ---------------------------------------------------------------------------
// "Neue Fragen pro Tag" — per profile, in localStorage, best-effort.

export const NEW_PER_DAY_CHOICES = [15, 30, 50] as const;
export const DEFAULT_NEW_PER_DAY = 30;

export const newPerDayKey = (profileId = getActiveProfileId()): string =>
  `da:lid-new-per-day:${profileId}`;

/** The stored allowance, or the default when storage is blocked, empty or holds anything else. */
export function readNewPerDay(): number {
  try {
    const value = Number(localStorage.getItem(newPerDayKey()));
    return (NEW_PER_DAY_CHOICES as readonly number[]).includes(value) ? value : DEFAULT_NEW_PER_DAY;
  } catch {
    return DEFAULT_NEW_PER_DAY;
  }
}

export function writeNewPerDay(value: number): void {
  try {
    localStorage.setItem(newPerDayKey(), String(value));
  } catch {
    // storage blocked — the choice holds for this page only
  }
}

/** Where an unfinished mock exam waits for a reload (ExamRunner's wall-clock rule applies). */
export const mockKey = (profileId = getActiveProfileId()): string => `da:lid-mock:${profileId}`;

/**
 * Bring an element's top back into view when it sits above the viewport or under the sticky site
 * header — after Weiter, a jump in the grid, or a submit at the foot of a long page. A card that
 * is already in view is left alone; `scroll-mt-32` on the target clears the header.
 */
export function revealTop(element: HTMLElement | null): void {
  if (!element) return;
  const header = document.querySelector('body > header')?.getBoundingClientRect().bottom ?? 0;
  if (element.getBoundingClientRect().top < header) element.scrollIntoView({ block: 'start' });
}

// ---------------------------------------------------------------------------
// Furniture — the same Tailwind strings the Goethe simulator uses, so the two exam surfaces
// look like one product.

export const CARD =
  'rounded-lg border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-800';

export const PRIMARY_BUTTON =
  'inline-flex min-h-11 items-center justify-center rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-40';

export const QUIET_BUTTON =
  'inline-flex min-h-11 items-center justify-center rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-600 hover:border-amber-500 disabled:opacity-40 dark:border-stone-600 dark:text-stone-300';
