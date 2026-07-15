/**
 * The Schreib-Assistent panel: local advisory feedback on a `write` revision.
 *
 * Rendered by Write.tsx in the **revise stage only, on demand** — the stage
 * machine guarantees the before-assessment is already complete, so the hints
 * can never anchor the calibration ratings (docs/assist-design.md). Everything
 * shown here is advisory: hints live in component state (plus the SavedWriting
 * record, via onHints) and never reach onResult, attempts or the snapshot.
 */
import { useEffect, useRef, useState } from 'react';
import type { z } from 'zod';
import type { writeItemSchema } from '../../lib/schemas';
import {
  assistHiddenForSession,
  chooseAssistModel,
  hideAssistForSession,
  noteAssistFailure,
  probeAssist,
  quoteAnchored,
  reviewDraft,
  type AssistProbe,
  type ReviewedHints,
  type WriteHintCategory,
} from '../../lib/assist';
import { getAssistEnabled, pick, setAssistEnabled, setAssistModel, type ExplainLang } from '../../lib/prefs';
import { t } from '../../lib/strings';
import { useUiLang } from '../hooks';

type WriteItem = z.infer<typeof writeItemSchema>;

/** Explanation-language strings — one hoisted record per file (docs/i18n-design.md). */
const UI = {
  reenableTitle: {
    en: 'Turn local assistant hints back on',
    ru: 'Снова включить подсказки локального ассистента',
  },
  title: { en: 'Local assistant', ru: 'Локальный ассистент' },
  settings: { en: 'Assistant settings', ru: 'Настройки ассистента' },
  model: { en: 'Model', ru: 'Модель' },
  turnOff: { en: 'Turn the assistant off', ru: 'Выключить ассистента' },
  reading: { en: 'The assistant is reading your text…', ru: 'Ассистент читает ваш текст…' },
  noAnswer: { en: 'The assistant did not answer.', ru: 'Ассистент не ответил.' },
  retry: { en: 'Try again', ru: 'Попробовать ещё раз' },
  gone: {
    en: 'The assistant cannot produce useful hints right now — carry on without it.',
    ru: 'Ассистент сейчас не может дать полезные подсказки — продолжайте без него.',
  },
  nothingFlagged: {
    en: 'The assistant found nothing to flag.',
    ru: 'Ассистент не нашёл, к чему придраться.',
  },
  allResolved: {
    en: 'Your text no longer contains anything the assistant flagged.',
    ru: 'В тексте больше нет мест, которые ассистент отмечал.',
  },
  advisory: {
    en: 'The assistant never scores your writing and never affects progress.',
    ru: 'Ассистент не выставляет оценок и не влияет на прогресс.',
  },
} as const satisfies Record<string, { en: string; ru: string }>;

/** German labels stay always-visible, like every German content string. */
const CATEGORY_LABELS: Record<WriteHintCategory, string> = {
  grammar: 'Grammatik',
  'word-order': 'Wortstellung',
  'word-choice': 'Wortwahl',
  spelling: 'Rechtschreibung',
  task: 'Aufgabe',
};

type Status = 'idle' | 'loading' | 'shown' | 'failed' | 'gone';

export function AssistPanel({ item, text, lang, level, hints, onHints }: {
  item: WriteItem;
  /** the revision as it currently stands — what the model reviews */
  text: string;
  lang: ExplainLang;
  /** the topic's CEFR level, e.g. "A2" */
  level: string;
  /** lifted hint state — Write persists it into SavedWriting for same-day reloads */
  hints: ReviewedHints | null;
  onHints: (hints: ReviewedHints) => void;
}) {
  const uiLang = useUiLang();
  const [enabled, setEnabled] = useState(getAssistEnabled);
  const [probe, setProbe] = useState<AssistProbe | null>(null);
  const [status, setStatus] = useState<Status>(hints ? 'shown' : 'idle');
  const [model, setModel] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const disposedRef = useRef(false);

  // Probed even while the pref is off: the re-enable affordance below must
  // appear only where the assistant could actually answer.
  useEffect(() => {
    let cancelled = false;
    void probeAssist().then((result) => {
      if (!cancelled) setProbe(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Abort an in-flight review when the learner moves on; the disposed flag
  // keeps that unmount-abort from counting as a session failure.
  useEffect(
    () => () => {
      disposedRef.current = true;
      abortRef.current?.abort();
    },
    [],
  );

  // The gear's off switch is the only writer of the pref, so switching off must
  // not remove the way back: where the assistant could answer, the pref being
  // off renders one quiet re-enable line instead of nothing.
  if (!enabled) {
    if (!probe?.reachable || probe.models.length === 0 || assistHiddenForSession()) return null;
    return (
      <button
        type="button"
        onClick={() => {
          setAssistEnabled(true);
          setEnabled(true);
        }}
        title={pick(lang, UI.reenableTitle)}
        className="mt-4 block text-xs text-stone-400 hover:text-stone-600 hover:underline dark:text-stone-500 dark:hover:text-stone-300"
      >
        {t('assist.reenable', uiLang)}
      </button>
    );
  }
  const showingStored = status === 'shown' && hints !== null;
  if (!showingStored) {
    if (!probe?.reachable || probe.models.length === 0) return null;
    if (assistHiddenForSession() && status === 'idle') return null;
  }
  const activeModel = model ?? (probe ? chooseAssistModel(probe.models) : null);
  // A hint retires the moment the learner's edit removes its quoted words —
  // fixing a quoted error makes its hint disappear, which is the feedback.
  const liveHints = hints ? hints.hints.filter((hint) => quoteAnchored(hint.quote, text)) : [];

  async function request() {
    if (!activeModel) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus('loading');
    try {
      const result = await reviewDraft(
        {
          draft: text,
          taskPrompt: pick(lang, item.prompt),
          goal: pick(lang, item.goal),
          requirements: item.requirements.map((r) => pick(lang, r)),
          modelAnswer: item.model_answer,
          level,
          hintLang: lang,
        },
        { model: activeModel, signal: controller.signal },
      );
      if (disposedRef.current) return;
      if (result) {
        // Pinned to the reviewed text: a re-request replaces the whole set.
        onHints({ ...result, forText: text });
        setStatus('shown');
      } else {
        // Nothing usable despite the corrective retry — apologize once, then
        // the feature stays out of the way for the rest of the session.
        hideAssistForSession();
        setStatus('gone');
      }
    } catch {
      // Abbrechen or the 60 s budget. The second such failure hides the feature.
      if (disposedRef.current) return;
      noteAssistFailure();
      setStatus(assistHiddenForSession() ? 'gone' : 'failed');
    }
  }

  return (
    <div className="mt-4 rounded-md border border-stone-200 p-4 dark:border-stone-700">
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
          {pick(lang, UI.title)}
        </p>
        {probe && activeModel && status !== 'gone' && (
          <details className="relative ml-auto">
            <summary
              aria-label={pick(lang, UI.settings)}
              className="cursor-pointer list-none rounded px-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
            >
              ⚙
            </summary>
            <div className="absolute right-0 z-10 mt-1 w-60 rounded-md border border-stone-200 bg-white p-3 shadow-md dark:border-stone-600 dark:bg-stone-800">
              <label htmlFor={`${item.id}-assist-model`} className="text-xs font-medium">
                {pick(lang, UI.model)}
              </label>
              <select
                id={`${item.id}-assist-model`}
                value={activeModel}
                onChange={(event) => {
                  setAssistModel(event.target.value);
                  setModel(event.target.value);
                }}
                className="mt-1 w-full rounded-md border border-stone-300 bg-transparent px-2 py-1 text-sm dark:border-stone-600"
              >
                {probe.models.map((tag) => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  setAssistEnabled(false);
                  setEnabled(false);
                }}
                className="mt-3 text-xs font-medium text-red-700 hover:underline dark:text-red-400"
              >
                {pick(lang, UI.turnOff)}
              </button>
            </div>
          </details>
        )}
      </div>

      {status === 'idle' && (
        <button
          type="button"
          onClick={() => void request()}
          className="mt-2 min-h-11 rounded-md border border-stone-300 px-4 py-2 text-sm font-medium hover:border-amber-500 hover:text-amber-700 dark:border-stone-600 dark:hover:text-amber-400 sm:min-h-0 sm:py-1.5"
        >
          {t('assist.request', uiLang)}
        </button>
      )}

      {status === 'loading' && (
        <div className="mt-2 flex items-center gap-3">
          <span
            aria-hidden="true"
            className="h-4 w-4 animate-spin rounded-full border-2 border-stone-300 border-t-amber-600"
          />
          <span className="text-sm text-stone-500 dark:text-stone-400">
            {pick(lang, UI.reading)}
          </span>
          <button
            type="button"
            onClick={() => abortRef.current?.abort()}
            className="text-sm font-medium text-stone-600 hover:underline dark:text-stone-300"
          >
            {t('action.cancel', uiLang)}
          </button>
        </div>
      )}

      {status === 'failed' && (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
          <span className="text-stone-500 dark:text-stone-400">
            {pick(lang, UI.noAnswer)}
          </span>
          <button
            type="button"
            onClick={() => void request()}
            className="font-medium text-amber-700 hover:underline dark:text-amber-400"
          >
            {pick(lang, UI.retry)}
          </button>
        </div>
      )}

      {status === 'gone' && (
        <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
          {pick(lang, UI.gone)}
        </p>
      )}

      {status === 'shown' && hints && (
        <div className="mt-2">
          {hints.praise && <p className="text-sm text-green-800 dark:text-green-300">{hints.praise}</p>}
          {hints.hints.length === 0 ? (
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
              {pick(lang, UI.nothingFlagged)}
            </p>
          ) : liveHints.length === 0 ? (
            <p className="mt-1 text-sm text-green-800 dark:text-green-300">
              {t('assist.allDone', uiLang)}{' '}
              {pick(lang, UI.allResolved)}
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {liveHints.map((hint, index) => (
                <li key={index} className="rounded-md border border-stone-200 px-3 py-2 dark:border-stone-700">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">
                    {CATEGORY_LABELS[hint.category]}
                  </span>
                  <p className="mt-0.5 text-sm">
                    <q lang="de" className="italic">{hint.quote}</q>
                  </p>
                  <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">{hint.nudge}</p>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-stone-500 dark:text-stone-400">
            {t('assist.disclaimer', uiLang)}{' '}
            {pick(lang, UI.advisory)}
          </p>
        </div>
      )}
    </div>
  );
}
