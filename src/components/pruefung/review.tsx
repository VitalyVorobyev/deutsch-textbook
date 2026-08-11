/**
 * Post-run review pieces, shared by the single-module result screen and the full written run:
 * the Prüferblätter viewer, the learner's own free-part text, and the criteria-based
 * self-assessment.
 *
 * The self-assessment is the one place a number enters this feature by hand, so its contract
 * is stated where it happens: the score comes from the learner reading the printed criteria
 * (rendered right above the panel), it is stored on the run as `selfScore` — never merged
 * into the automatic `raw` — and, like everything else here (ADR 0009), it is calibration
 * that never touches mastery, tiers or weakness.
 */
import { useState } from 'react';
import type {
  ExamFreeSpec,
  ExamModuleSpec,
  ExamRunRecord,
} from '../../lib/exam-sim';
import { withBase } from '../../lib/url';
import { countWords, formatPoints, PRIMARY_BUTTON } from './shared';

const ANSWER_PAGES_LABEL: Partial<Record<ExamModuleSpec['module'], string>> = {
  hoeren: 'Transkriptionen ansehen',
  schreiben: 'Bewertungskriterien & Beispiele ansehen',
  sprechen: 'Hinweise & Bewertung ansehen',
};

/** The module's Prüferblätter pages, collapsed by default — reading them is a choice. */
export function AnswerPages({ module }: { module: ExamModuleSpec }) {
  if (!module.answerPages || module.answerPages.length === 0) return null;
  return (
    <details className="mt-5">
      <summary className="cursor-pointer text-sm font-medium text-stone-600 hover:text-amber-700 dark:text-stone-300">
        {ANSWER_PAGES_LABEL[module.module] ?? 'Prüferblätter ansehen'}
      </summary>
      <div className="mt-2 space-y-3">
        {module.answerPages.map((page, index) => (
          <img
            key={page}
            src={withBase(page)}
            loading="lazy"
            alt={`Prüferblatt Seite ${index + 1}`}
            className="max-w-full rounded-md border border-stone-200 dark:border-stone-700"
          />
        ))}
      </div>
    </details>
  );
}

/** What the learner wrote in each free Teil, kept beside the criteria it is judged by. */
export function FreeTexts({ module, run }: { module: ExamModuleSpec; run: ExamRunRecord }) {
  const teile = module.teile.filter((teil) => teil.free);
  if (teile.length === 0) return null;
  return (
    <div className="mt-5 space-y-3">
      {teile.map((teil) => {
        const text = run.texts?.[teil.teil];
        return (
          <div key={teil.teil}>
            <h4 className="text-sm font-semibold">
              Teil {teil.teil} · {teil.free?.label}
            </h4>
            {text ? (
              <>
                <p className="mt-1 whitespace-pre-wrap rounded-md border border-stone-200 bg-stone-50 p-3 text-sm dark:border-stone-700 dark:bg-stone-900">
                  {text}
                </p>
                <p className="mt-1 text-xs text-stone-400">Wörter: {countWords(text)}</p>
              </>
            ) : (
              <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">Kein Text geschrieben.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CriterionRow({
  label,
  steps,
  picked,
  onPick,
}: {
  label: string;
  steps: number[];
  picked: number | undefined;
  onPick: (points: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-1">
      <span className="text-sm">{label}</span>
      <div className="flex gap-1.5">
        {steps.map((points) => (
          <button
            key={points}
            type="button"
            aria-pressed={picked === points}
            onClick={() => onPick(points)}
            className={`min-h-11 min-w-11 rounded-md border px-3 text-sm font-medium ${
              picked === points
                ? 'border-amber-600 bg-amber-600 text-white'
                : 'border-stone-300 text-stone-600 hover:border-amber-500 dark:border-stone-600 dark:text-stone-300'
            }`}
          >
            {formatPoints(points)}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The criteria of the Prüferblätter as a self-assessment. With printed criteria each one is a
 * row of its point steps; without them a plain half-point entry stands in. Applying hands the
 * sum to the parent, which stores it on the run — visibly as a self-assessment, nothing more.
 */
export function SelfScorePanel({
  free,
  current,
  onApply,
}: {
  free: ExamFreeSpec;
  /** The already-stored self-assessment, when the learner returns to the screen. */
  current?: number;
  onApply: (score: number, max: number) => void;
}) {
  const criteria = free.criteria ?? [];
  const [picks, setPicks] = useState<Record<number, number | undefined>>({});
  const [plain, setPlain] = useState('');

  const structured = criteria.length > 0;
  const sum = structured
    ? criteria.reduce((total, _, index) => total + (picks[index] ?? 0), 0)
    : Number(plain.replace(',', '.'));
  const complete = structured
    ? criteria.every((_, index) => picks[index] !== undefined)
    : plain.trim() !== '' && Number.isFinite(sum) && sum >= 0 && sum <= free.points;

  return (
    <div className="mt-5 rounded-md border border-stone-200 p-4 dark:border-stone-700">
      <h4 className="text-sm font-bold uppercase tracking-wide text-stone-500 dark:text-stone-400">
        Selbstbewertung · {free.label}
      </h4>
      <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
        Nach den Kriterien der Prüferblätter (oben einsehbar). Eine Selbstbewertung bleibt eine
        Selbstbewertung — sie wird getrennt vom automatischen Ergebnis gespeichert.
      </p>
      {structured ? (
        <div className="mt-3 divide-y divide-stone-100 dark:divide-stone-700/60">
          {criteria.map((criterion, index) => (
            <CriterionRow
              key={criterion.label}
              label={criterion.label}
              steps={criterion.points}
              picked={picks[index]}
              onPick={(points) => setPicks((state) => ({ ...state, [index]: points }))}
            />
          ))}
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2">
          <label className="text-sm" htmlFor="exam-self-score">
            Punkte (0–{free.points})
          </label>
          <input
            id="exam-self-score"
            type="number"
            min={0}
            max={free.points}
            step={0.5}
            value={plain}
            onChange={(event) => setPlain(event.target.value)}
            className="min-h-11 w-24 rounded-md border border-stone-300 bg-white px-3 text-sm dark:border-stone-600 dark:bg-stone-900"
          />
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!complete}
          onClick={() => onApply(sum, free.points)}
          className={PRIMARY_BUTTON}
        >
          {structured ? `Übernehmen · ${formatPoints(sum)}/${formatPoints(free.points)}` : 'Übernehmen'}
        </button>
        {current !== undefined && (
          <span className="text-sm text-stone-500 dark:text-stone-400">
            gespeichert: {formatPoints(current)}/{formatPoints(free.points)}
          </span>
        )}
      </div>
    </div>
  );
}
