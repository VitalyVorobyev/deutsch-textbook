/**
 * Shared pieces of the Goethe exam simulator island: labels, the option shapes an answer
 * sheet draws, the clock format, and the Tailwind strings its three screens share.
 *
 * The island's chrome is German only — the app pins chrome German for immersion, and the
 * Astro shell around it (`src/pages/pruefung/goethe-a1.astro`) already carries the EN/RU/UK
 * explanation of what the feature is and what its results mean.
 *
 * Everything here reads the manifest and writes nothing. The only write in the whole island
 * is `recordExamRun` (ADR 0009: exam results are calibration, never mastery), which is why
 * nothing under this directory imports the profile store, the SRS, mastery or probes.
 */
import type {
  ExamAnswer,
  ExamModuleId,
  ExamModuleSpec,
  ExamOptionShape,
  ExamSetSpec,
} from '../../lib/exam-sim';
import { moduleItems } from '../../lib/exam-sim';

export type ExamMode = 'pruefung' | 'ueben';

export const MODULE_LABEL: Record<ExamModuleId, string> = {
  hoeren: 'Hören',
  lesen: 'Lesen',
  schreiben: 'Schreiben',
  sprechen: 'Sprechen',
};

export const MODE_LABEL: Record<ExamMode, string> = {
  pruefung: 'Prüfungsmodus',
  ueben: 'Üben',
};

/** Short form for history rows, where the column is two words wide. */
export const MODE_SHORT: Record<ExamMode, string> = { pruefung: 'Prüfung', ueben: 'Üben' };

interface ExamOption {
  value: ExamAnswer;
  /** What the Antwortbogen prints beside the box. */
  label: string;
}

/** The answer sheet's buttons, per shape — the same three shapes `parseExamManifest` admits. */
export const OPTIONS: Record<ExamOptionShape, readonly ExamOption[]> = {
  abc: [
    { value: 'a', label: 'a' },
    { value: 'b', label: 'b' },
    { value: 'c', label: 'c' },
  ],
  ab: [
    { value: 'a', label: 'a' },
    { value: 'b', label: 'b' },
  ],
  rf: [
    { value: 'r', label: 'Richtig' },
    { value: 'f', label: 'Falsch' },
  ],
};

/** An answer as the sheet prints it; an unanswered item is an em dash, never a blank. */
export function answerLabel(shape: ExamOptionShape, answer: ExamAnswer | null | undefined): string {
  if (!answer) return '—';
  return OPTIONS[shape].find((option) => option.value === answer)?.label ?? answer;
}

/** mm:ss, never negative — the countdown stops at 0:00 and the run submits itself. */
export function formatClock(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

/** A stored ISO timestamp as a German date; a corrupt one degrades to a dash, never to NaN. */
export function formatDay(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('de-DE');
}

/**
 * Modules a session can actually be run against. `parseExamManifest` admits a module with an
 * empty `teile` list (nothing about the shape is wrong), but a sheet with no items would
 * divide by zero in `scoreModule` — so such a module is simply not offered.
 */
export const runnableModules = (set: ExamSetSpec): ExamModuleSpec[] =>
  set.modules.filter((module) => moduleItems(module).length > 0);

export const CARD = 'rounded-lg border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-800';

export const PRIMARY_BUTTON =
  'min-h-11 rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-40';

export const QUIET_BUTTON =
  'min-h-11 rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-600 hover:border-amber-500 dark:border-stone-600 dark:text-stone-300';

export function LevelBadge({ level }: { level: string }) {
  return (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-900 dark:text-amber-200">
      {level.toUpperCase()}
    </span>
  );
}
