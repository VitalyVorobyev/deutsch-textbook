import { useEffect, useState } from 'react';
import { getAttempts, withReadRetry } from '../../lib/store';
import { ownMistakes, type MistakeEntry, type OwnMistake } from '../../lib/own-mistakes';
import { pick } from '../../lib/prefs';
import { t } from '../../lib/strings';
import { useExplainLang, useUiLang } from '../hooks';

interface Props {
  /** what the block can print for each item of the topic's sets, built with the page */
  catalog: MistakeEntry[];
}

/**
 * "Meine Fehler": the topic's items the learner last answered wrong, with their own answer beside
 * the expected one. Rendered only once the log is read and holds such an item — a learner with no
 * mistakes here sees no heading, and a read that fails shows nothing rather than "no mistakes".
 */
export default function TopicMistakes({ catalog }: Props) {
  const lang = useExplainLang();
  const uiLang = useUiLang();
  const [mistakes, setMistakes] = useState<OwnMistake[]>([]);

  useEffect(() => {
    let cancelled = false;
    void withReadRetry(getAttempts, { surface: 'thema/fehler' })
      .then((attempts) => {
        if (!cancelled) setMistakes(ownMistakes(catalog, attempts));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [catalog]);

  if (mistakes.length === 0) return null;

  return (
    <section className="mt-10" aria-labelledby="own-mistakes">
      <h2 id="own-mistakes" lang={uiLang} className="text-2xl font-bold">
        {t('topic.sectionOwnMistakes', uiLang)}
      </h2>
      <p lang={uiLang} className="mt-1 mb-4 text-sm text-stone-500 dark:text-stone-400">
        {t('topic.ownMistakesHint', uiLang)}
      </p>
      <ul className="flex flex-col gap-3">
        {mistakes.map(({ entry, given }) => (
          <li
            key={`${entry.setId}::${entry.itemId}`}
            className="rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-800"
          >
            {entry.promptDe && (
              <p lang="de" className="mb-1 text-sm text-stone-600 dark:text-stone-300">
                {entry.promptDe}
              </p>
            )}
            {entry.prompt && (
              <p className="mb-2 text-sm italic text-stone-500 dark:text-stone-400">
                {pick(lang, entry.prompt)}
              </p>
            )}
            <p lang="de" className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span>
                <span aria-hidden="true">❌ </span>
                <s className="text-stone-500 decoration-red-400 dark:text-stone-400">
                  {given || '—'}
                </s>
              </span>
              <span className="font-semibold">
                <span aria-hidden="true">✅ </span>
                {entry.correct}
              </span>
            </p>
            {entry.explain && (
              <p className="mt-2 max-w-[68ch] text-sm text-stone-600 dark:text-stone-300">
                {pick(lang, entry.explain)}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
