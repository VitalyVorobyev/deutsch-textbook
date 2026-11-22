import { useEffect, useMemo, useState } from 'react';
import {
  getAttempts,
  getCardStates,
  getSessionLog,
  withReadRetry,
  type Attempt,
  type CardStates,
  type SessionLogEntry,
} from '../../lib/store';
import { hasSeenData } from '../../lib/write-journal';
import ProgressLoadError from '../ProgressLoadError';
import { scoreTotal, verifiedOnly } from '../../lib/scoring';
import { pick } from '../../lib/prefs';
import type { StringKey } from '../../lib/strings';
import { withBase } from '../../lib/url';
import { useExplainLang } from '../hooks';
import { Heatmap } from './Heatmap';
import { deckCardRefs, type DeckWords } from '../../lib/vocab-mastery';
import { VocabularyProgress, type VocabGroup } from '../vocab/VocabMastery';
import { ProbeResults } from './ProbeResults';
import type { ProbeFamily } from '../../lib/probes';

interface Data {
  attempts: Attempt[];
  cards: CardStates;
  sessions: SessionLogEntry[];
}

/** The view the page remembered while it had sub-tabs. Removed on load, so no profile keeps a
    pointer to a tab that no longer exists. */
const LEGACY_VIEW_KEY = 'da:progress-view';

/** Explanation-language strings — one hoisted record per file (docs/adrs/0005-explanation-languages.md). */
const UI = {
  untouched: {
    en: 'Nothing to show yet. Answer your first exercise or review your first flashcard, and this page fills up: what you practised, on which days, and which confusions keep costing you points.',
    ru: 'Пока показывать нечего. Решите первое упражнение или повторите первую карточку — и эта страница заполнится: что вы отрабатывали, в какие дни и какие ошибки повторяются чаще всего.',
  },
  answers: { en: 'Answers', ru: 'Ответов' },
  accuracy: { en: 'Accuracy', ru: 'Точность' },
  cardsStarted: { en: 'Cards started', ru: 'Карточек начато' },
} as const satisfies Record<string, { en: string; ru: string }>;

interface Props {
  /** Every deck as headwords: the vocabulary bars need card identities, never card content.
      The built cards inlined here made /progress a 12.2 MB page. */
  decks: DeckWords[];
  /** group titles are chrome-string keys, rendered by VocabularyProgress */
  vocabularyGroups: Array<{ title: StringKey; items: VocabGroup[] }>;
  probeFamilies: ProbeFamily[];
  /** probe set id → the topic's German title, for the results list */
  probeLabels: Record<string, string>;
  probeTopicPaths: Record<string, string>;
}

/**
 * Fortschritt is one page: activity, vocabulary, and what the delayed checks say did not
 * survive. "Progress by topic" is not here on purpose — the Themen page's "Alle Themen" table
 * answers it. Export, import and the account are on /konto: they move the progress, they do not
 * describe it.
 */
export default function ProgressPanel({
  decks,
  vocabularyGroups,
  probeFamilies,
  probeLabels,
  probeTopicPaths,
}: Props) {
  const lang = useExplainLang();
  const cardRefs = useMemo(() => decks.flatMap(deckCardRefs), [decks]);
  const [data, setData] = useState<Data | null>(null);
  const [loadError, setLoadError] = useState(false);

  async function loadData(): Promise<Data> {
    const [attempts, cards, sessions] = await withReadRetry(
      () => Promise.all([getAttempts(), getCardStates(), getSessionLog()]),
      { surface: 'fortschritt' },
    );
    // A profile that has persisted progress before and reads back nothing at all
    // is a stalled store, not an empty history — "no progress" must never be
    // faked by a read failure (the desktop symptom this guards was exactly that).
    if (
      attempts.length === 0 &&
      Object.keys(cards).length === 0 &&
      (hasSeenData('cards') || hasSeenData('attempts'))
    ) {
      throw new Error('implausibly empty progress read');
    }
    return { attempts, cards, sessions };
  }

  async function refresh() {
    try {
      setData(await loadData());
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }

  useEffect(() => {
    // The account lived on this page's Daten tab, and links to it are still out there
    // (bookmarks, an OAuth round trip started before the move). Forward them with every
    // other parameter intact: a failed sign-in's ?auth= reason must reach /konto.
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') === 'daten') {
      params.delete('tab');
      const query = params.toString();
      window.location.replace(
        `${withBase('/konto')}${query ? `?${query}` : ''}${window.location.hash}`,
      );
      return;
    }
    localStorage.removeItem(LEGACY_VIEW_KEY);
    void loadData().then(
      (d) => {
        setData(d);
        setLoadError(false);
      },
      () => setLoadError(true),
    );
  }, []);

  const verified = data ? verifiedOnly(data.attempts) : [];
  const correct = scoreTotal(verified);
  const accuracy = verified.length ? Math.round((correct / verified.length) * 100) : 0;
  // Nothing measured yet: an empty heatmap over empty charts says "broken", not
  // "new". Say what will fill them instead.
  const untouched = !!data && data.attempts.length === 0 && Object.keys(data.cards).length === 0;

  return (
    <div className="space-y-5">
      {loadError && <ProgressLoadError onRetry={() => void refresh()} />}
      {untouched && (
        <section className="rounded-lg border border-dashed border-stone-300 p-6 text-sm text-stone-500 dark:border-stone-600 dark:text-stone-400">
          {pick(lang, UI.untouched)}
        </section>
      )}

      {/* Side by side on a wide window, so the page is read without scrolling. */}
      <div className="grid items-start gap-5 lg:grid-cols-2">
        {/* One activity card: the stat tiles and the calendar answer the same
            "how am I doing" question, and splitting them buried the calendar at
            the bottom of the page. */}
        {data && (
          <section className="rounded-lg border border-stone-200 bg-white p-6 dark:border-stone-700 dark:bg-stone-800">
            <dl className="grid grid-cols-3 gap-3 text-center sm:gap-4">
              <div>
                <dt className="text-xs uppercase tracking-wide text-stone-400">
                  {pick(lang, UI.answers)}
                </dt>
                <dd className="mt-1 text-2xl font-bold">{data.attempts.length}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-stone-400">
                  {pick(lang, UI.accuracy)}
                </dt>
                <dd className="mt-1 text-2xl font-bold">{accuracy}%</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-stone-400">
                  {pick(lang, UI.cardsStarted)}
                </dt>
                <dd className="mt-1 text-2xl font-bold">{Object.keys(data.cards).length}</dd>
              </div>
            </dl>
            <div className="mt-6 border-t border-stone-100 pt-5 dark:border-stone-700">
              <Heatmap attempts={data.attempts} sessions={data.sessions} cards={data.cards} />
            </div>
          </section>
        )}

        {data && (
          <VocabularyProgress cards={cardRefs} groups={vocabularyGroups} states={data.cards} />
        )}
      </div>

      {data && !untouched && (
        <ProbeResults
          families={probeFamilies}
          labels={probeLabels}
          topicPaths={probeTopicPaths}
          attempts={data.attempts}
          lang={lang}
        />
      )}
    </div>
  );
}
