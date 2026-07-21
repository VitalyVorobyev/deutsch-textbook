import { useEffect, useState } from 'react';
import { getAttempts, getCardStates, getTopicsState } from '../../lib/store';
import { hasStartedLearning } from '../../lib/placement';
import { pick } from '../../lib/prefs';
import { t, type StringKey } from '../../lib/strings';
import { useExplainLang, useUiLang } from '../hooks';

interface Props {
  /** the first topic of the curriculum spine — where a new learner starts */
  first?: { path: string; title_de: string };
  /**
   * The lowest level's entry test, for a learner who does not start from zero.
   *
   * `setIds` covers every level's placement set, not just the linked one: it is what
   * separates "answered a placement item" from "started learning" in the freshness check
   * below, and that distinction has to hold for any level's test.
   */
  placement?: { path: string; setIds: string[] };
}

/** Explanation-language strings — one hoisted record per file (docs/i18n-design.md). */
const UI = {
  loop: {
    en: 'Three moves, in a loop. Everything you do stays on this device.',
    ru: 'Три шага по кругу. Всё, что вы делаете, остаётся на этом устройстве.',
  },
  startWith: { en: 'Start with', ru: 'Начните с' },
  placementHint: {
    en: 'Not starting from zero? Take the placement test and the topics you already know leave your path.',
    ru: 'Начинаете не с нуля? Пройдите тест на уровень — и темы, которые вы уже знаете, уйдут с вашего пути.',
  },
  placementResumeHint: {
    en: 'Your placement test is unfinished — your answers are still there.',
    ru: 'Тест на уровень не завершён — ваши ответы сохранены.',
  },
} as const satisfies Record<string, { en: string; ru: string }>;

/** Step names are chrome (German today); their explanations follow the explanation language. */
const STEPS: Array<{ label: StringKey; text: { en: string; ru: string } }> = [
  {
    label: 'today.stepRead',
    text: {
      en: 'Read a topic. Every rule is explained twice — in English and in Russian — while the German examples stay in German.',
      ru: 'Прочитайте тему. Каждое правило объясняется дважды — по-английски и по-русски, — а немецкие примеры остаются на немецком.',
    },
  },
  {
    label: 'today.stepPractice',
    text: {
      en: 'Answer the exercises. You type the German yourself, and a wrong answer explains the rule you tripped over instead of just marking it red.',
      ru: 'Решайте упражнения. Немецкий вы печатаете сами, а при ошибке появляется объяснение правила, а не просто красная пометка.',
    },
  },
  {
    label: 'today.stepReview',
    text: {
      en: 'Review the flashcards. They come back exactly when you are about to forget them — that spacing is what turns practice into memory.',
      ru: 'Повторяйте карточки. Они возвращаются ровно тогда, когда вы вот-вот забудете слово, — именно этот интервал превращает практику в память.',
    },
  },
];

/**
 * The Heute page for someone who has just given their name: at zero evidence
 * every tile on it is empty or zero, which reads as broken rather than as new.
 * Disappears for good the moment any evidence exists.
 */
export default function FirstSteps({ first, placement }: Props) {
  const lang = useExplainLang();
  const uiLang = useUiLang();
  const [fresh, setFresh] = useState(false);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    void Promise.all([getAttempts(), getCardStates(), getTopicsState()]).then(
      ([attempts, cards, topics]) => {
        // The rule itself lives in `hasStartedLearning` (src/lib/placement.ts), pure and
        // tested: a placement attempt is not evidence of having started learning, and
        // counting one here hid this card — and with it the only link back into a
        // half-finished test — the moment the learner answered a single question.
        const setIds = placement?.setIds ?? [];
        setStarted(attempts.some((a) => setIds.includes(a.setId)));
        setFresh(!hasStartedLearning(attempts, Object.keys(cards), topics, setIds));
      },
    );
  }, [placement?.setIds]);

  if (!fresh) return null;

  return (
    <section className="mt-8 rounded-lg border border-stone-200 bg-white p-6 dark:border-stone-700 dark:bg-stone-800">
      <h2 lang={uiLang} className="text-lg font-bold">
        {t('today.howItWorks', uiLang)}
      </h2>
      <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
        {pick(lang, UI.loop)}
      </p>
      <ol className="mt-5 grid gap-5 sm:grid-cols-3">
        {STEPS.map((step, i) => (
          <li key={step.label}>
            <p className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                {i + 1}
              </span>
              <strong lang={uiLang} className="font-semibold">
                {t(step.label, uiLang)}
              </strong>
            </p>
            <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">
              {pick(lang, step.text)}
            </p>
          </li>
        ))}
      </ol>
      {first && (
        <a
          href={first.path}
          className="mt-6 inline-flex rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
        >
          {pick(lang, UI.startWith)} <span lang="de" className="ml-1">{first.title_de}</span> →
        </a>
      )}
      {/* Deliberately here and not in FirstRunGate: that gate is a blocking identity dialog
          that reloads on submit, and bolting a second unrelated decision onto it would make
          naming yourself feel like committing to a test. This card already renders exactly
          for the zero-evidence learner and disappears on its own once evidence exists —
          which is the right lifetime for an entry test. */}
      {placement && (
        <p className="mt-4 text-sm text-stone-500 dark:text-stone-400">
          {pick(lang, started ? UI.placementResumeHint : UI.placementHint)}{' '}
          <a
            href={placement.path}
            lang={uiLang}
            className="font-medium text-amber-700 hover:underline dark:text-amber-400"
          >
            {t(started ? 'placement.resume' : 'placement.entry', uiLang)} →
          </a>
        </p>
      )}
    </section>
  );
}
