import type { ReactNode } from 'react';
import type { Bilingual } from '../../lib/schemas';
import { pick, type ExplainLang } from '../../lib/prefs';

export interface ItemResult {
  correct: boolean;
  /** learner's answer, serialized for the attempt log */
  given: string;
}

export interface ItemProps<T> {
  item: T;
  lang: ExplainLang;
  /** called exactly once, when the learner submits */
  onResult: (result: ItemResult) => void;
  /** after submission the item is locked and shows its state */
  locked: boolean;
}

export function Instruction({ text, lang }: { text?: Bilingual; lang: ExplainLang }) {
  if (!text) return null;
  return <p className="mb-3 text-sm text-stone-500 dark:text-stone-400">{pick(lang, text)}</p>;
}

export function Translation({ text, lang }: { text?: Bilingual; lang: ExplainLang }) {
  if (!text) return null;
  return <p className="mt-2 text-sm italic text-stone-400 dark:text-stone-500">{pick(lang, text)}</p>;
}

export function CheckButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mt-4 min-h-11 rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-40 sm:min-h-0 sm:py-1.5"
    >
      Prüfen
    </button>
  );
}

export function Feedback({
  correct,
  correctAnswer,
  explain,
  lang,
}: {
  correct: boolean;
  correctAnswer?: ReactNode;
  explain?: Bilingual;
  lang: ExplainLang;
}) {
  return (
    <div
      className={`mt-4 rounded-md border px-4 py-3 text-sm ${
        correct
          ? 'border-green-300 bg-green-50 text-green-900 dark:border-green-700 dark:bg-green-950 dark:text-green-200'
          : 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200'
      }`}
    >
      <p className="font-semibold">{correct ? 'Richtig! ✓' : 'Leider falsch ✗'}</p>
      {!correct && correctAnswer && (
        <p className="mt-1">
          {lang === 'ru' ? 'Правильный ответ: ' : 'Correct answer: '}
          <span lang="de" className="font-medium">{correctAnswer}</span>
        </p>
      )}
      {!correct && explain && <p className="mt-2">{pick(lang, explain)}</p>}
    </div>
  );
}
