import { useEffect, useRef, type ReactNode } from 'react';
import type { Bilingual } from '../../lib/schemas';
import { pick, type ExplainLang } from '../../lib/prefs';
import SpeakerButton from '../SpeakerButton';

export interface ItemResult {
  /** fully correct */
  correct: boolean;
  /** learner's answer, serialized for the attempt log */
  given: string;
  /** partial credit for multi-part items (cloze/match/table); totalParts ≥ 1 when present */
  correctParts?: number;
  totalParts?: number;
  /** open production is useful practice but not automatically verified */
  evidence?: 'verified' | 'practice';
}

export interface ItemProps<T> {
  item: T;
  lang: ExplainLang;
  /** called exactly once, when the learner submits */
  onResult: (result: ItemResult) => void;
  /** after submission the item is locked and shows its state */
  locked: boolean;
  /**
   * Advance to the next item. Rendered by ActionRow in the very slot the Prüfen
   * button occupied, so checking an answer never moves the button under the
   * learner's finger.
   */
  onNext: () => void;
  /** label for the advance button — "Weiter →" or the runner's end-of-set wording */
  nextLabel: string;
}

export function Instruction({ text, lang }: { text?: Bilingual; lang: ExplainLang }) {
  if (!text) return null;
  return <p className="mb-3 text-sm text-stone-500 dark:text-stone-400">{pick(lang, text)}</p>;
}

export function Translation({ text, lang }: { text?: Bilingual; lang: ExplainLang }) {
  if (!text) return null;
  return <p className="mt-2 text-sm italic text-stone-400 dark:text-stone-500">{pick(lang, text)}</p>;
}

/** Prüfen and Weiter share these metrics, so swapping one for the other moves nothing. */
const ACTION_BUTTON = 'min-h-11 rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-40 sm:min-h-0 sm:py-1.5';

/**
 * Because Weiter takes over the very pixels Prüfen occupied, a double-click or
 * double-tap on Prüfen would land its second click on Weiter and skip past the
 * feedback the learner never got to read. Swallow clicks that arrive within this
 * window of the swap — a real "next" click always comes later than a stray one.
 */
const SWAP_GUARD_MS = 500;

function VerdictChip({ correct }: { correct: boolean }) {
  return (
    <span
      lang="de"
      className={`text-sm font-semibold ${
        correct ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
      }`}
    >
      {correct ? 'Richtig! ✓' : 'Leider falsch ✗'}
    </span>
  );
}

/**
 * The item's one and only action slot: Prüfen turns into Weiter *in place*, so the
 * button keeps its exact position when an answer is checked and the learner never
 * has to chase it down the page. The verdict sits after the button (never before,
 * or it would push the button sideways) and Feedback renders below the row.
 *
 * Items that submit on click instead of on Prüfen (mc, match) pass no `onCheck`:
 * the slot then holds a disabled Weiter from the start, reserving the same height.
 */
export function ActionRow({
  checked,
  correct,
  onCheck,
  checkDisabled,
  onNext,
  nextLabel,
}: {
  checked: boolean;
  correct: boolean;
  onCheck?: () => void;
  checkDisabled?: boolean;
  onNext: () => void;
  nextLabel: string;
}) {
  // Only the Prüfen→Weiter swap needs the guard; items that submit on click (mc,
  // match) never had a button in this slot to double-click in the first place.
  const swappedAt = useRef(0);
  useEffect(() => {
    if (checked && onCheck) swappedAt.current = Date.now();
  }, [checked, onCheck]);

  function handleNext() {
    if (onCheck && Date.now() - swappedAt.current < SWAP_GUARD_MS) return;
    onNext();
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      {onCheck && !checked ? (
        <button
          type="button"
          onClick={onCheck}
          disabled={checkDisabled}
          className={`${ACTION_BUTTON} bg-amber-600 text-white hover:bg-amber-700`}
        >
          Prüfen
        </button>
      ) : (
        <button
          type="button"
          onClick={handleNext}
          disabled={!checked}
          className={`${ACTION_BUTTON} bg-stone-800 text-white hover:bg-stone-700 dark:bg-stone-200 dark:text-stone-900 dark:hover:bg-stone-300`}
        >
          {nextLabel}
        </button>
      )}
      {checked && <VerdictChip correct={correct} />}
    </div>
  );
}

/**
 * The teaching half of a checked answer: correct solution + explanation, rendered
 * *below* the ActionRow so it can grow to any height without displacing the button.
 * The Richtig/Falsch verdict itself lives in the row (VerdictChip), which is why a
 * correct answer with nothing left to say renders nothing at all.
 */
export function Feedback({
  correct,
  correctAnswer,
  explain,
  lang,
  speakText,
}: {
  correct: boolean;
  correctAnswer?: ReactNode;
  explain?: Bilingual;
  lang: ExplainLang;
  /** German text to offer for playback next to the correct answer */
  speakText?: string;
}) {
  const showAnswer = !correct && !!correctAnswer;
  if (!showAnswer && !explain) return null;

  return (
    <div
      className={`mt-4 rounded-md border px-4 py-3 text-sm ${
        correct
          ? 'border-green-300 bg-green-50 text-green-900 dark:border-green-700 dark:bg-green-950 dark:text-green-200'
          : 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200'
      }`}
    >
      {showAnswer && (
        <p>
          {lang === 'ru' ? 'Правильный ответ: ' : 'Correct answer: '}
          <span lang="de" className="font-medium">{correctAnswer}</span>
          {speakText && <SpeakerButton text={speakText} className="ml-1" />}
        </p>
      )}
      {!correct && explain && <p className={showAnswer ? 'mt-2' : undefined}>{pick(lang, explain)}</p>}
      {correct && explain && (
        <details>
          <summary className="cursor-pointer text-xs font-medium opacity-70 hover:opacity-100">
            Warum?
          </summary>
          <p className="mt-1">{pick(lang, explain)}</p>
        </details>
      )}
    </div>
  );
}
