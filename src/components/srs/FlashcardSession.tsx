import { useEffect, useState } from 'react';
import { Rating, gradeCard, splitQueue, type CardDef, type Grade } from '../../lib/srs';
import { getCardStates, setCardState, type CardStates } from '../../lib/store';
import { shuffle } from '../../lib/shuffle';
import { useExplainLang } from '../hooks';

interface Props {
  cards: CardDef[];
  /** cap on never-seen cards mixed into this session */
  newLimit?: number;
}

interface SessionStats {
  reviewed: number;
  again: number;
}

const GRADE_BUTTONS: Array<{ grade: Grade; de: string; cls: string }> = [
  { grade: Rating.Again, de: 'Nochmal', cls: 'bg-red-600 hover:bg-red-700' },
  { grade: Rating.Hard, de: 'Schwer', cls: 'bg-orange-500 hover:bg-orange-600' },
  { grade: Rating.Good, de: 'Gut', cls: 'bg-green-600 hover:bg-green-700' },
  { grade: Rating.Easy, de: 'Leicht', cls: 'bg-sky-600 hover:bg-sky-700' },
];

export default function FlashcardSession({ cards, newLimit = 15 }: Props) {
  const lang = useExplainLang();
  const [queue, setQueue] = useState<CardDef[] | null>(null);
  const [states, setStates] = useState<CardStates>({});
  const [revealed, setRevealed] = useState(false);
  const [stats, setStats] = useState<SessionStats>({ reviewed: 0, again: 0 });

  useEffect(() => {
    let cancelled = false;
    void getCardStates().then((s) => {
      if (cancelled) return;
      const { due, fresh } = splitQueue(cards, s);
      setStates(s);
      setQueue([...shuffle(due), ...shuffle(fresh).slice(0, newLimit)]);
    });
    return () => {
      cancelled = true;
    };
  }, [cards, newLimit]);

  if (queue === null) {
    return <p className="text-sm text-stone-500">…</p>;
  }

  const card = queue[0];

  if (!card) {
    return (
      <div className="rounded-lg border border-stone-200 bg-white p-8 text-center dark:border-stone-700 dark:bg-stone-800">
        <p className="text-2xl">🎉</p>
        <p className="mt-2 font-semibold">
          {lang === 'ru' ? 'На сегодня всё!' : 'All done for now!'}
        </p>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          {stats.reviewed > 0
            ? lang === 'ru'
              ? `Карточек повторено: ${stats.reviewed}`
              : `Cards reviewed: ${stats.reviewed}`
            : lang === 'ru'
              ? 'Нет карточек к повторению.'
              : 'No cards due for review.'}
        </p>
      </div>
    );
  }

  const front = card.dir === 'de-x' ? card.de : `${card.en} · ${card.ru}`;
  const back = card.dir === 'de-x' ? `${card.en} · ${card.ru}` : card.de;

  async function grade(g: Grade) {
    if (!card) return;
    const nextState = gradeCard(states[card.id], g);
    await setCardState(card.id, nextState);
    setStates((s) => ({ ...s, [card.id]: nextState }));
    setStats((st) => ({ reviewed: st.reviewed + 1, again: st.again + (g === Rating.Again ? 1 : 0) }));
    setQueue((q) => {
      if (!q) return q;
      const rest = q.slice(1);
      // "Again" re-enters the session a few cards later
      if (g === Rating.Again) {
        const pos = Math.min(4, rest.length);
        return [...rest.slice(0, pos), card, ...rest.slice(pos)];
      }
      return rest;
    });
    setRevealed(false);
  }

  return (
    <div>
      <p className="mb-2 text-right text-xs text-stone-400">
        {lang === 'ru' ? 'Осталось' : 'Remaining'}: {queue.length}
      </p>
      <div className="rounded-lg border border-stone-200 bg-white p-8 dark:border-stone-700 dark:bg-stone-800">
        <p className="text-center text-xs uppercase tracking-wide text-stone-400">
          {card.dir === 'de-x' ? 'Deutsch →' : '→ Deutsch'}
        </p>
        <p lang={card.dir === 'de-x' ? 'de' : undefined} className="mt-4 text-center text-3xl font-bold">
          {front}
        </p>

        {revealed ? (
          <div className="mt-6 border-t border-stone-200 pt-6 text-center dark:border-stone-700">
            <p lang={card.dir === 'x-de' ? 'de' : undefined} className="text-2xl font-semibold">
              {back}
            </p>
            {card.deDetail && (
              <p lang="de" className="mt-1 text-sm text-stone-500 dark:text-stone-400">
                {card.deDetail}
              </p>
            )}
            <p lang="de" className="mt-4 text-sm italic text-stone-600 dark:text-stone-300">
              {card.exampleDe}
            </p>
            <p className="mt-1 text-xs text-stone-400">
              {lang === 'ru' ? card.exampleRu : card.exampleEn}
            </p>
            <div className="mt-6 flex justify-center gap-2">
              {GRADE_BUTTONS.map(({ grade: g, de, cls }) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => void grade(g)}
                  className={`rounded-md px-4 py-2 text-sm font-semibold text-white ${cls}`}
                >
                  {de}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="rounded-md bg-stone-800 px-6 py-2 font-semibold text-white hover:bg-stone-700 dark:bg-stone-200 dark:text-stone-900 dark:hover:bg-stone-300"
            >
              {lang === 'ru' ? 'Показать' : 'Reveal'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
