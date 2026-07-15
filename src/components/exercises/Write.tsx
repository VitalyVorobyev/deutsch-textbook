import { useEffect, useState, type ReactNode } from 'react';
import type { z } from 'zod';
import type { writeItemSchema } from '../../lib/schemas';
import { pick } from '../../lib/prefs';
import { getActiveProfileId } from '../../lib/profile';
import type { CriterionAssessment } from '../../lib/store';
import { reviewedHintsSchema, type ReviewedHints } from '../../lib/assist';
import { CriterionReview, Instruction, Translation, type ItemProps } from './shared';
import { AssistPanel } from './AssistPanel';

type WriteItem = z.infer<typeof writeItemSchema>;
type Stage = 'draft' | 'reflect' | 'revise' | 'reassess' | 'done';

interface SavedWriting {
  stage: Exclude<Stage, 'done'>;
  draft: string;
  revision: string;
  before: Array<CriterionAssessment | undefined>;
  after: Array<CriterionAssessment | undefined>;
  /**
   * Advisory assistant hints, kept so a same-day reload does not re-bill a slow
   * generation — but only while `forText` still matches the saved revision, so
   * hints never outlive the text they quote. Display-only: submitRevision never
   * reads this field, so it can never reach attempts or the snapshot
   * (docs/assist-design.md).
   */
  assist?: ReviewedHints | null;
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
  const saved = (() => {
    if (typeof localStorage === 'undefined') return null;
    try {
      return JSON.parse(localStorage.getItem(draftKey) ?? 'null') as SavedWriting | null;
    } catch {
      // Back compatibility: the old component stored the draft as a plain string.
      const legacy = localStorage.getItem(draftKey);
      return legacy ? { stage: 'draft' as const, draft: legacy, revision: '', before: [], after: [] } : null;
    }
  })();
  const [stage, setStage] = useState<Stage>(locked ? 'done' : saved?.stage ?? 'draft');
  const [draft, setDraft] = useState(saved?.draft ?? '');
  const [revision, setRevision] = useState(saved?.revision ?? '');
  const [before, setBefore] = useState<Array<CriterionAssessment | undefined>>(
    item.requirements.map((_, i) => saved?.before?.[i]),
  );
  const [after, setAfter] = useState<Array<CriterionAssessment | undefined>>(
    item.requirements.map((_, i) => saved?.after?.[i]),
  );
  const [assist, setAssist] = useState<ReviewedHints | null>(() => {
    const parsed = reviewedHintsSchema.safeParse(saved?.assist);
    // Hints made for a different text than the one being restored are stale —
    // their quotes may point at words the learner has already fixed.
    return parsed.success && parsed.data.forText === (saved?.revision ?? '') ? parsed.data : null;
  });
  const draftWords = wordCount(draft);
  const revisionWords = wordCount(revision);
  // The set id prefixes the storage key (`<level>/<set>::<item>`), and the set's
  // level directory is the topic's level — the ceiling the assistant reviews at.
  const level = /^([ab][12])\//i.exec(storageKey)?.[1]?.toUpperCase() ?? 'A2';

  useEffect(() => {
    if (stage === 'done') return;
    localStorage.setItem(draftKey, JSON.stringify({ stage, draft, revision, before, after, assist }));
  }, [after, assist, before, draft, draftKey, revision, stage]);

  function beginReflection() {
    if (draftWords < item.min_words) return;
    setRevision(draft);
    setStage('reflect');
  }

  function beginRevision() {
    if (!before.every(Boolean)) return;
    setStage('revise');
  }

  function beginReassessment() {
    if (revisionWords < item.min_words) return;
    setStage('reassess');
  }

  // An honest after-rating is a rating *of a particular text*. Going back to edit therefore
  // throws the rating away rather than trapping the learner with a typo they just spotted —
  // and `Speak` already works this way (its recording panel disappears once the checklist is up).
  function resumeRevision() {
    setAfter(item.requirements.map(() => undefined));
    setStage('revise');
  }

  function submitRevision() {
    if (!after.every(Boolean) || revisionWords < item.min_words) return;
    setStage('done');
    localStorage.removeItem(draftKey);
    onResult({
      correct: true,
      given: revision.trim(),
      evidence: 'practice',
      responseMode: 'writing',
      practice: {
        kind: 'writing',
        draft: draft.trim(),
        revision: revision.trim(),
        before: before as CriterionAssessment[],
        after: after as CriterionAssessment[],
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

      {stage === 'draft' && (
        <WritingArea
          id={`${item.id}-draft`}
          value={draft}
          onChange={setDraft}
          words={draftWords}
          minWords={item.min_words}
          lang={lang}
          label={lang === 'ru' ? 'Первый вариант' : 'First draft'}
          disabled={locked}
        />
      )}

      {(stage === 'reflect' || stage === 'revise' || stage === 'reassess' || stage === 'done') && (
        <div className="mt-4 rounded-md border border-sky-200 bg-sky-50 px-4 py-3 dark:border-sky-800 dark:bg-sky-950/40">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
            {lang === 'ru' ? 'Пример — сравните содержание и форму' : 'Model — compare content and form'}
          </p>
          <p lang="de" className="mt-2">{item.model_answer}</p>
          <Translation text={item.model_translation} lang={lang} />
        </div>
      )}

      {stage === 'reflect' && (
        <fieldset className="mt-4 rounded-md border border-stone-200 p-4 dark:border-stone-700">
          <legend className="px-1 text-sm font-semibold">
            {lang === 'ru' ? 'Проверьте свой вариант' : 'Check your draft'}
          </legend>
          <p className="mb-3 text-sm text-stone-500 dark:text-stone-400">
            {lang === 'ru'
              ? 'Сравните текст с заданием и примером. Отметьте каждый пункт перед исправлением.'
              : 'Compare your text with the task and model. Rate each point honestly before revising.'}
          </p>
          <CriterionReview entries={item.requirements} values={before} onChange={setBefore} lang={lang} />
        </fieldset>
      )}

      {(stage === 'revise' || stage === 'reassess' || stage === 'done') && (
        <WritingArea
          id={`${item.id}-revision`}
          value={revision}
          onChange={setRevision}
          words={revisionWords}
          minWords={item.min_words}
          lang={lang}
          label={lang === 'ru' ? 'Исправленный вариант' : 'Revised draft'}
          disabled={stage === 'reassess' || stage === 'done' || locked}
        />
      )}

      {/* Revise stage only, on demand, and by construction after the before-
          assessment: feedback shown earlier would anchor the calibration
          ratings the reflect stage exists to measure (docs/assist-design.md). */}
      {stage === 'revise' && (
        <AssistPanel
          item={item}
          text={revision}
          lang={lang}
          level={level}
          hints={assist}
          onHints={setAssist}
        />
      )}

      {stage === 'reassess' && <fieldset className="mt-4 rounded-md border border-stone-200 p-4 dark:border-stone-700">
        <legend className="px-1 text-sm font-semibold">{lang === 'ru' ? 'Проверьте исправленный вариант' : 'Check the revision'}</legend>
        <CriterionReview entries={item.requirements} values={after} onChange={setAfter} lang={lang} />
      </fieldset>}

      <div className="mt-4">
        {stage === 'draft' && (
          <ActionButton onClick={beginReflection} disabled={draftWords < item.min_words}>
            {lang === 'ru' ? 'Сравнить и проверить' : 'Compare and check'}
          </ActionButton>
        )}
        {stage === 'reflect' && (
          <ActionButton onClick={beginRevision} disabled={!before.every(Boolean)}>
            {lang === 'ru' ? 'Исправить текст' : 'Revise draft'}
          </ActionButton>
        )}
        {stage === 'revise' && (
          <ActionButton onClick={beginReassessment} disabled={revisionWords < item.min_words}>
            {lang === 'ru' ? 'Проверить исправления' : 'Check revision'}
          </ActionButton>
        )}
        {stage === 'reassess' && (
          <div className="flex flex-wrap items-center gap-3">
            <ActionButton
              onClick={submitRevision}
              disabled={!after.every(Boolean) || revisionWords < item.min_words}
            >
              {lang === 'ru' ? 'Сохранить исправленный вариант' : 'Save revised draft'}
            </ActionButton>
            <button
              type="button"
              onClick={resumeRevision}
              className="text-sm font-medium text-amber-700 hover:underline dark:text-amber-400"
            >
              {lang === 'ru' ? 'Ещё раз изменить текст' : 'Edit the text again'}
            </button>
          </div>
        )}
        {stage === 'done' && (
          <ActionButton onClick={onNext}>{nextLabel}</ActionButton>
        )}
      </div>
      {stage === 'done' && (
        <p className="mt-3 text-xs text-stone-500 dark:text-stone-400">
          {lang === 'ru'
            ? 'Оба варианта сохранены как практика письма, а не автоматически проверенная оценка.'
            : 'Both drafts are saved as writing practice, not as an automatically verified score.'}
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
        placeholder={lang === 'ru' ? 'Напишите ответ по-немецки…' : 'Write your answer in German…'}
      />
      <div className="mt-2 flex items-center justify-between text-xs text-stone-400">
        <span>{words} / {minWords} Wörter</span>
        {!disabled && <span>{lang === 'ru' ? 'Черновик сохраняется на этом устройстве' : 'Draft saved on this device'}</span>}
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
