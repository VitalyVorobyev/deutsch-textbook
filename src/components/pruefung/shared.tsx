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
  ExamRunRecord,
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

/** Points as German print shows them: comma decimal, "8,5". */
export const formatPoints = (points: number): string => String(points).replace('.', ',');

/**
 * A run's score as one string. A run holding a self-assessment (Schreiben Teil 2) shows the
 * sum, and always says so — the automatic score and a self-report are never summed silently.
 */
export function formatRunScore(run: ExamRunRecord): string {
  if (run.selfScore === undefined) return `${run.raw}/${run.rawMax}`;
  const total = formatPoints(run.raw + run.selfScore);
  const max = formatPoints(run.rawMax + (run.selfScoreMax ?? 0));
  return `${total}/${max} (mit Selbstbewertung)`;
}

/** A typed answer counts once it holds something beyond whitespace. */
export const hasText = (value: string | undefined): value is string =>
  value !== undefined && value.trim() !== '';

export const countWords = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;

/**
 * `scored` — an answer sheet exists (auto-gradable items, a free part, or both) and a run
 * produces a record. `practice` — nothing gradable at all (Sprechen is a Gruppenprüfung with
 * two examiners); the module opens as task cards to study, and no history is ever written.
 */
export type ModuleKind = 'scored' | 'practice';

export const moduleKind = (module: ExamModuleSpec): ModuleKind =>
  moduleItems(module).length > 0 || module.teile.some((teil) => teil.free) ? 'scored' : 'practice';

/** Modules a learner can open: every scored one, plus practice modules that bring pages. */
export const runnableModules = (set: ExamSetSpec): ExamModuleSpec[] =>
  set.modules.filter((module) => (moduleKind(module) === 'scored' ? true : module.pages.length > 0));

/** The full written exam in booklet order, when this set can offer it end to end. */
export function writtenModules(set: ExamSetSpec): ExamModuleSpec[] {
  const order: ExamModuleId[] = ['hoeren', 'lesen', 'schreiben'];
  const found = order
    .map((id) => set.modules.find((module) => module.module === id))
    .filter((module): module is ExamModuleSpec => module !== undefined && moduleKind(module) === 'scored');
  return found.length === order.length ? found : [];
}

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
