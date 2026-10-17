/**
 * The session pages' islands, fed from the shared content files instead of inline props
 * (src/lib/corpus-payload.ts, ADR 0022).
 *
 * Each wrapper fetches its file(s) and only then mounts the component it wraps, with the same
 * props that component always had. Until then it says it is loading; if the fetch fails it says
 * so, with a retry. It never mounts the session on an empty list: an empty card list would plan
 * "nothing due" and an empty set list "nothing to practise", and both are confident claims a
 * failed download must not make (the ADR 0018 rule, applied to content).
 */
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import { fetchCorpus } from '../../lib/corpus-client';
import type { CardDef } from '../../lib/srs';
import { t } from '../../lib/strings';
import type { TrainingSet } from '../../lib/training';
import { useUiLang } from '../hooks';
import FlashcardSession from '../srs/FlashcardSession';
import MixedTraining from '../training/MixedTraining';
import ProbeCatchUp from './ProbeCatchUp';
import SessionFlow from './SessionFlow';

type Corpus<T> = { state: 'loading' } | { state: 'failed' } | { state: 'ready'; data: T };

/**
 * Fetch every URL, then render `children` with the parsed files in the same order. Until all
 * have arrived it renders a loading line; if any fails, an error with a retry.
 */
export function CorpusGate<T extends unknown[]>({
  urls,
  children,
}: {
  urls: string[];
  children: (data: T) => ReactNode;
}) {
  const uiLang = useUiLang();
  const [corpus, setCorpus] = useState<Corpus<T>>({ state: 'loading' });
  const [round, setRound] = useState(0);
  const key = urls.join('\n');
  useEffect(() => {
    let live = true;
    Promise.all(key.split('\n').map((url) => fetchCorpus(url))).then(
      (data) => live && setCorpus({ state: 'ready', data: data as T }),
      () => live && setCorpus({ state: 'failed' }),
    );
    return () => {
      live = false;
    };
  }, [key, round]);

  if (corpus.state === 'ready') return children(corpus.data);
  if (corpus.state === 'failed') {
    return (
      <div
        role="alert"
        className="rounded-lg border border-red-300 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-950"
      >
        <p className="text-sm font-medium text-red-800 dark:text-red-200">
          {t('corpus.loadError', uiLang)}
        </p>
        <button
          type="button"
          onClick={() => {
            setCorpus({ state: 'loading' });
            setRound((r) => r + 1);
          }}
          className="mt-3 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
        >
          {t('persist.loadRetry', uiLang)}
        </button>
      </div>
    );
  }
  return (
    <p role="status" className="text-sm text-stone-500 dark:text-stone-400">
      {t('corpus.loading', uiLang)}
    </p>
  );
}

export function FlashcardSessionIsland({
  cardsUrl,
  ...props
}: Omit<ComponentProps<typeof FlashcardSession>, 'cards'> & { cardsUrl: string }) {
  return (
    <CorpusGate<[CardDef[]]> urls={[cardsUrl]}>
      {([cards]) => <FlashcardSession {...props} cards={cards} />}
    </CorpusGate>
  );
}

export function MixedTrainingIsland({
  setsUrl,
  ...props
}: Omit<ComponentProps<typeof MixedTraining>, 'sets'> & { setsUrl: string }) {
  return (
    <CorpusGate<[TrainingSet[]]> urls={[setsUrl]}>
      {([sets]) => <MixedTraining {...props} sets={sets} />}
    </CorpusGate>
  );
}

export function ProbeCatchUpIsland({ setsUrl }: { setsUrl: string }) {
  return (
    <CorpusGate<[TrainingSet[]]> urls={[setsUrl]}>
      {([sets]) => <ProbeCatchUp sets={sets} />}
    </CorpusGate>
  );
}

export function SessionFlowIsland({
  cardsUrl,
  setsUrl,
  ...props
}: Omit<ComponentProps<typeof SessionFlow>, 'cards' | 'sets'> & {
  cardsUrl: string;
  setsUrl: string;
}) {
  return (
    <CorpusGate<[CardDef[], TrainingSet[]]> urls={[cardsUrl, setsUrl]}>
      {([cards, sets]) => <SessionFlow {...props} cards={cards} sets={sets} />}
    </CorpusGate>
  );
}
