import { useEffect, useState, type ReactNode } from 'react';
import type { z } from 'zod';
import type { writeItemSchema } from '../../lib/schemas';
import { pick } from '../../lib/prefs';
import { getActiveProfileId } from '../../lib/profile';
import { reviewedHintsSchema, type ReviewedHints } from '../../lib/assist';
import { t } from '../../lib/strings';
import { useUiLang } from '../hooks';
import { Instruction, Translation, type ItemProps } from './shared';
import { AssistPanel } from './AssistPanel';

type WriteItem = z.infer<typeof writeItemSchema>;
type Stage = 'draft' | 'compare' | 'done';

/** Explanation-language strings — one hoisted record per file (docs/i18n-design.md). */
const UI = {
  modelHeading: {
    en: 'Model — compare content and form',
    ru: 'Пример — сравните содержание и форму',
  },
  yourText: { en: 'Your text', ru: 'Ваш текст' },
  compareHint: {
    en: 'Compare your text with the task and the model — edit it right here if you like.',
    ru: 'Сравните свой текст с заданием и примером — при желании исправьте его прямо здесь.',
  },
  compareButton: { en: 'Compare with model', ru: 'Сравнить с примером' },
  save: { en: 'Save', ru: 'Сохранить' },
  savedNote: {
    en: 'The text is saved as writing practice, not as an automatically verified score.',
    ru: 'Текст сохранён как практика письма, а не автоматически проверенная оценка.',
  },
  placeholder: { en: 'Write your answer in German…', ru: 'Напишите ответ по-немецки…' },
  draftSaved: { en: 'Draft saved on this device', ru: 'Черновик сохраняется на этом устройстве' },
} as const satisfies Record<string, { en: string; ru: string }>;

/**
 * Deliberately minimal ceremony: the app cannot verify free writing, so it never
 * charges steps for feedback it cannot give. The flow is write → one press →
 * model answer beside the learner's own text, which stays editable — revision is
 * an option, not a stage. The requirements render as guidance text, never as a
 * gated form. The one real feedback channel, the advisory Schreib-Assistent,
 * attaches to the compare screen.
 */

interface SavedWriting {
  stage: Exclude<Stage, 'done'>;
  /** The text as first submitted for comparison ('' while still drafting). */
  draft: string;
  /** The live text — equal to `draft` until the learner edits on the compare screen. */
  text: string;
  /**
   * Advisory assistant hints, kept so a same-day reload does not re-bill a slow
   * generation — but only while `forText` still matches the saved text, so
   * hints never outlive the text they quote. Display-only: submit never reads
   * this field, so it can never reach attempts or the snapshot
   * (docs/assist-design.md).
   */
  assist?: ReviewedHints | null;
}

/** The retired staged flow's localStorage record, still restorable. */
interface LegacySavedWriting {
  stage: 'draft' | 'reflect' | 'revise' | 'reassess';
  draft: string;
  revision: string;
  assist?: ReviewedHints | null;
}

function restoreSaved(raw: string | null): SavedWriting | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    if ('text' in parsed) return parsed as SavedWriting;
    // Legacy staged record: anything past drafting resumes on the compare screen.
    const legacy = parsed as LegacySavedWriting;
    return legacy.stage === 'draft'
      ? { stage: 'draft', draft: '', text: legacy.draft, assist: legacy.assist }
      : { stage: 'compare', draft: legacy.draft, text: legacy.revision || legacy.draft, assist: legacy.assist };
  } catch {
    // Back compatibility: the oldest component stored the draft as a plain string.
    return { stage: 'draft', draft: '', text: raw };
  }
}

function wordCount(value: string): number {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

export function Write({
  item,
  lang,
  onResult,
  locked,
  onNext,
  nextLabel,
  storageKey,
}: ItemProps<WriteItem> & { storageKey: string }) {
  // Profile-scoped, like every other per-learner key: a draft is the learner's own
  // writing, and an unscoped key would hand it to whoever opens the item next on a
  // shared device. Unlike `resume.ts` this does not expire at the end of the day —
  // resume state tracks where you are in a lesson, but a draft is work, and silently
  // deleting someone's unfinished paragraph overnight is worse than keeping it.
  const draftKey = `da:write:${getActiveProfileId()}:${storageKey}`;
  const saved = typeof localStorage === 'undefined' ? null : restoreSaved(localStorage.getItem(draftKey));
  const [stage, setStage] = useState<Stage>(locked ? 'done' : saved?.stage ?? 'draft');
  const [draft, setDraft] = useState(saved?.draft ?? '');
  const [text, setText] = useState(saved?.text ?? '');
  const [assist, setAssist] = useState<ReviewedHints | null>(() => {
    const parsed = reviewedHintsSchema.safeParse(saved?.assist);
    // Hints made for a different text than the one being restored are stale —
    // their quotes may point at words the learner has already fixed.
    return parsed.success && parsed.data.forText === (saved?.text ?? '') ? parsed.data : null;
  });
  const words = wordCount(text);
  // The set id prefixes the storage key (`<level>/<set>::<item>`), and the set's
  // level directory is the topic's level — the ceiling the assistant reviews at.
  const level = /^([ab][12])\//i.exec(storageKey)?.[1]?.toUpperCase() ?? 'A2';

  useEffect(() => {
    if (stage === 'done') return;
    localStorage.setItem(draftKey, JSON.stringify({ stage, draft, text, assist } satisfies SavedWriting));
  }, [assist, draft, draftKey, stage, text]);

  function beginComparison() {
    if (words < item.min_words) return;
    setDraft(text);
    setStage('compare');
  }

  function submit() {
    if (words < item.min_words) return;
    setStage('done');
    localStorage.removeItem(draftKey);
    onResult({
      correct: true,
      given: text.trim(),
      evidence: 'practice',
      responseMode: 'writing',
      practice: {
        kind: 'writing',
        draft: draft.trim(),
        revision: text.trim(),
      },
    });
  }

  return (
    <div>
      <Instruction text={item.instruction} lang={lang} />
      <p className="text-lg font-medium">{pick(lang, item.prompt)}</p>
      <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{pick(lang, item.goal)}</p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-stone-600 dark:text-stone-300">
        {item.requirements.map((r, i) => <li key={i}>{pick(lang, r)}</li>)}
      </ul>

      {stage !== 'draft' && (
        <div className="mt-4 rounded-md border border-sky-200 bg-sky-50 px-4 py-3 dark:border-sky-800 dark:bg-sky-950/40">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
            {pick(lang, UI.modelHeading)}
          </p>
          <p lang="de" className="mt-2">{item.model_answer}</p>
          <Translation text={item.model_translation} lang={lang} />
        </div>
      )}

      <WritingArea
        id={`${item.id}-text`}
        value={text}
        onChange={setText}
        words={words}
        minWords={item.min_words}
        lang={lang}
        label={pick(lang, UI.yourText)}
        disabled={stage === 'done' || locked}
      />

      {stage === 'compare' && (
        <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
          {pick(lang, UI.compareHint)}
        </p>
      )}

      {/* Compare screen only, on demand: hints while drafting would replace the
          learner's own retrieval attempt (docs/assist-design.md). */}
      {stage === 'compare' && (
        <AssistPanel
          item={item}
          text={text}
          lang={lang}
          level={level}
          hints={assist}
          onHints={setAssist}
        />
      )}

      <div className="mt-4">
        {stage === 'draft' && (
          <ActionButton onClick={beginComparison} disabled={words < item.min_words}>
            {pick(lang, UI.compareButton)}
          </ActionButton>
        )}
        {stage === 'compare' && (
          <ActionButton onClick={submit} disabled={words < item.min_words}>
            {pick(lang, UI.save)}
          </ActionButton>
        )}
        {stage === 'done' && (
          <ActionButton onClick={onNext}>{nextLabel}</ActionButton>
        )}
      </div>
      {stage === 'done' && (
        <p className="mt-3 text-xs text-stone-500 dark:text-stone-400">
          {pick(lang, UI.savedNote)}
        </p>
      )}
    </div>
  );
}

function WritingArea({ id, value, onChange, words, minWords, lang, label, disabled }: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  words: number;
  minWords: number;
  lang: 'en' | 'ru';
  label: string;
  disabled: boolean;
}) {
  const uiLang = useUiLang();
  return (
    <div className="mt-4">
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      <textarea
        id={id}
        lang="de"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        rows={5}
        className="mt-2 w-full resize-y rounded-md border-2 border-stone-300 bg-transparent px-3 py-2 text-base outline-none focus:border-amber-500 disabled:opacity-80 dark:border-stone-600"
        placeholder={pick(lang, UI.placeholder)}
      />
      <div className="mt-2 flex items-center justify-between text-xs text-stone-400">
        <span>{words} / {minWords} {t('exercise.words', uiLang)}</span>
        {!disabled && <span>{pick(lang, UI.draftSaved)}</span>}
      </div>
    </div>
  );
}

function ActionButton({ children, onClick, disabled = false }: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="min-h-11 rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-40 sm:min-h-0"
    >
      {children}
    </button>
  );
}
