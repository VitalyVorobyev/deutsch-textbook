import { useEffect, useState } from 'react';
import { getAttempts, getCardStates, getTopicsState } from '../../lib/store';
import { useExplainLang } from '../hooks';

interface Props {
  /** the first topic of the curriculum spine — where a new learner starts */
  first?: { path: string; title_de: string };
}

const STEPS: Array<{ de: string; en: string; ru: string }> = [
  {
    de: 'Lesen',
    en: 'Read a topic. Every rule is explained twice — in English and in Russian — while the German examples stay in German.',
    ru: 'Прочитайте тему. Каждое правило объясняется дважды — по-английски и по-русски, — а немецкие примеры остаются на немецком.',
  },
  {
    de: 'Üben',
    en: 'Answer the exercises. You type the German yourself, and a wrong answer explains the rule you tripped over instead of just marking it red.',
    ru: 'Решайте упражнения. Немецкий вы печатаете сами, а при ошибке появляется объяснение правила, а не просто красная пометка.',
  },
  {
    de: 'Wiederholen',
    en: 'Review the flashcards. They come back exactly when you are about to forget them — that spacing is what turns practice into memory.',
    ru: 'Повторяйте карточки. Они возвращаются ровно тогда, когда вы вот-вот забудете слово, — именно этот интервал превращает практику в память.',
  },
];

/**
 * The Heute page for someone who has just given their name: at zero evidence
 * every tile on it is empty or zero, which reads as broken rather than as new.
 * Disappears for good the moment any evidence exists.
 */
export default function FirstSteps({ first }: Props) {
  const lang = useExplainLang();
  const [fresh, setFresh] = useState(false);

  useEffect(() => {
    void Promise.all([getAttempts(), getCardStates(), getTopicsState()]).then(
      ([attempts, cards, topics]) => {
        setFresh(
          attempts.length === 0 &&
            Object.keys(cards).length === 0 &&
            Object.values(topics).every((t) => !t.readAt),
        );
      },
    );
  }, []);

  if (!fresh) return null;
  const t = (en: string, ru: string) => (lang === 'ru' ? ru : en);

  return (
    <section className="mt-8 rounded-lg border border-stone-200 bg-white p-6 dark:border-stone-700 dark:bg-stone-800">
      <h2 lang="de" className="text-lg font-bold">
        So funktioniert&apos;s
      </h2>
      <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
        {t(
          'Three moves, in a loop. Everything you do stays on this device.',
          'Три шага по кругу. Всё, что вы делаете, остаётся на этом устройстве.',
        )}
      </p>
      <ol className="mt-5 grid gap-5 sm:grid-cols-3">
        {STEPS.map((step, i) => (
          <li key={step.de}>
            <p className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                {i + 1}
              </span>
              <strong lang="de" className="font-semibold">
                {step.de}
              </strong>
            </p>
            <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">
              {t(step.en, step.ru)}
            </p>
          </li>
        ))}
      </ol>
      {first && (
        <a
          href={first.path}
          className="mt-6 inline-flex rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
        >
          {t('Start with', 'Начните с')} <span lang="de" className="ml-1">{first.title_de}</span> →
        </a>
      )}
    </section>
  );
}
