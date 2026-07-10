import { useEffect, useRef, useState } from 'react';
import { Rating, gradeCard, splitQueue, type CardDef, type Grade } from '../../lib/srs';
import { getCardStates, setCardState, type CardStates } from '../../lib/store';
import { shuffle } from '../../lib/shuffle';
import { getCardInputMode, setCardInputMode, type CardInputMode } from '../../lib/prefs';
import {
  articledForm,
  checkTypedAnswer,
  diffExpected,
  normalizeTyped,
  type AnswerVerdict,
} from '../../lib/typing';
import { useExplainLang } from '../hooks';

interface Props {
  cards: CardDef[];
  /** cap on never-seen cards mixed into this session */
  newLimit?: number;
  /** called once, exactly when the review queue runs empty */
  onFinished?: () => void;
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

const UMLAUT_KEYS = ['ä', 'ö', 'ü', 'ß'];

function verdictHint(v: AnswerVerdict, canonical: string, given: string): string | null {
  if (v.kind === 'article') {
    return v.givenArticle
      ? `Artikel: ${canonical}, nicht ${v.givenArticle} ${v.noun}`
      : `Artikel nicht vergessen: ${canonical}`;
  }
  if (v.kind === 'umlaut') {
    return `Umlaute! ${canonical}, nicht ${given}`;
  }
  return null;
}

export default function FlashcardSession({ cards, newLimit = 15, onFinished }: Props) {
  const lang = useExplainLang();
  const [queue, setQueue] = useState<CardDef[] | null>(null);
  const [states, setStates] = useState<CardStates>({});
  const [revealed, setRevealed] = useState(false);
  const [inputMode, setInputMode] = useState<CardInputMode>(() => getCardInputMode());
  const [typed, setTyped] = useState('');
  const [verdict, setVerdict] = useState<AnswerVerdict | null>(null);
  const [stats, setStats] = useState<SessionStats>({ reviewed: 0, again: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  // timeStamp of the keydown that submitted the answer — the same native event
  // bubbles on to window after React flushes the verdict, and must not also
  // confirm the suggested grade (Enter double-fire).
  const submitTs = useRef(0);
  // ensures onFinished fires at most once per mounted session
  const finishedFired = useRef(false);

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

  const card = queue?.[0];
  const typing = !!card && card.dir === 'x-de' && inputMode === 'typed';
  const answered = typing ? verdict !== null : revealed;
  const suggested: Grade = verdict?.kind === 'correct' ? Rating.Good : Rating.Again;

  // Focus the answer field whenever a typed card is waiting for input.
  useEffect(() => {
    if (typing && verdict === null) inputRef.current?.focus();
  }, [typing, verdict, card?.id]);

  // Keyboard grading once the back side is visible: 1–4 pick a grade,
  // Enter confirms the suggested grade (typed mode only).
  useEffect(() => {
    if (!answered) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      if (ev.key >= '1' && ev.key <= '4') {
        ev.preventDefault();
        void grade(GRADE_BUTTONS[Number(ev.key) - 1].grade);
      } else if (ev.key === 'Enter' && verdict !== null) {
        if (ev.timeStamp === submitTs.current) return;
        ev.preventDefault();
        void grade(suggested);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Completion signal: fires exactly once, when the queue has emptied.
  useEffect(() => {
    if (queue !== null && queue.length === 0 && !finishedFired.current) {
      finishedFired.current = true;
      onFinished?.();
    }
  }, [queue, onFinished]);

  if (queue === null) {
    return <p className="text-sm text-stone-500">…</p>;
  }

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

  // Nouns are shown and must be answered WITH their article ("der Apfel").
  const answerDe = articledForm(card.de, card.gender);
  const front = card.dir === 'de-x' ? answerDe : `${card.en} · ${card.ru}`;
  const back = card.dir === 'de-x' ? `${card.en} · ${card.ru}` : answerDe;

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
    setTyped('');
    setVerdict(null);
  }

  function switchMode(mode: CardInputMode) {
    if (mode === inputMode) return;
    setCardInputMode(mode);
    setInputMode(mode);
    setRevealed(false);
    setTyped('');
    setVerdict(null);
  }

  function check() {
    if (!card) return;
    setVerdict(checkTypedAnswer(typed, articledForm(card.de, card.gender), card.pos));
  }

  function insertChar(ch: string) {
    const el = inputRef.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    setTyped(el.value.slice(0, start) + ch + el.value.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + 1, start + 1);
    });
  }

  const givenNorm = normalizeTyped(typed);
  const hint = verdict ? verdictHint(verdict, answerDe, givenNorm) : null;

  const backDetails = (
    <>
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
    </>
  );

  const gradeButtons = (withSuggestion: boolean) => (
    <>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {GRADE_BUTTONS.map(({ grade: g, de, cls }) => (
          <button
            key={g}
            type="button"
            onClick={() => void grade(g)}
            className={`min-h-11 rounded-md px-3 py-2 text-sm font-semibold text-white sm:min-h-0 sm:px-4 ${cls} ${
              withSuggestion && g === suggested
                ? 'ring-2 ring-stone-900 ring-offset-2 ring-offset-white dark:ring-stone-100 dark:ring-offset-stone-800'
                : ''
            }`}
          >
            {de}
          </button>
        ))}
      </div>
      {withSuggestion && (
        <p className="mt-3 text-[11px] text-stone-400">
          ↵ {suggested === Rating.Good ? 'Gut' : 'Nochmal'} · 1–4
        </p>
      )}
    </>
  );

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-xs">
          <span className="text-stone-400">Eingabe:</span>
          {(
            [
              ['typed', 'Tippen'],
              ['reveal', 'Aufdecken'],
            ] as Array<[CardInputMode, string]>
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => switchMode(mode)}
              className={`rounded px-2 py-1.5 font-medium sm:py-0.5 ${
                inputMode === mode
                  ? 'bg-stone-800 text-white dark:bg-stone-200 dark:text-stone-900'
                  : 'text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-stone-400">
          {lang === 'ru' ? 'Осталось' : 'Remaining'}: {queue.length}
        </p>
      </div>
      <div className="rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-800 sm:p-8">
        <p className="text-center text-xs uppercase tracking-wide text-stone-400">
          {card.dir === 'de-x' ? 'Deutsch →' : '→ Deutsch'}
        </p>
        <p lang={card.dir === 'de-x' ? 'de' : undefined} className="mt-4 text-center text-2xl font-bold sm:text-3xl">
          {front}
        </p>

        {typing ? (
          verdict === null ? (
            <div className="mt-8">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  lang="de"
                  type="text"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      submitTs.current = e.timeStamp;
                      check();
                    }
                  }}
                  autoCapitalize="off"
                  autoCorrect="off"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Auf Deutsch …"
                  className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-center text-lg text-stone-900 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100"
                />
                <button
                  type="button"
                  onClick={check}
                  className="shrink-0 rounded-md bg-stone-800 px-4 py-2 font-semibold text-white hover:bg-stone-700 dark:bg-stone-200 dark:text-stone-900 dark:hover:bg-stone-300"
                >
                  Prüfen
                </button>
              </div>
              <div className="mt-2 flex justify-center gap-2">
                {UMLAUT_KEYS.map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    lang="de"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => insertChar(ch)}
                    className="min-h-10 w-10 rounded-md border border-stone-300 py-1 text-sm font-semibold text-stone-700 hover:bg-stone-100 dark:border-stone-600 dark:text-stone-200 dark:hover:bg-stone-700 sm:min-h-0 sm:w-9"
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-6 border-t border-stone-200 pt-6 text-center dark:border-stone-700">
              <p
                className={`text-sm font-semibold ${
                  verdict.kind === 'correct'
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {verdict.kind === 'correct' ? '✓ Richtig!' : '✗ Falsch'}
              </p>
              <p lang="de" className="mt-2 text-2xl font-semibold">
                {verdict.kind === 'correct'
                  ? answerDe
                  : diffExpected(answerDe, givenNorm).map((seg, i) =>
                      seg.miss ? (
                        <mark
                          key={i}
                          className="rounded bg-red-100 px-0.5 text-red-700 dark:bg-red-900/50 dark:text-red-300"
                        >
                          {seg.text}
                        </mark>
                      ) : (
                        <span key={i}>{seg.text}</span>
                      ),
                    )}
              </p>
              {verdict.kind !== 'correct' && givenNorm !== '' && (
                <p className="mt-1 text-sm text-stone-400">
                  Deine Eingabe:{' '}
                  <span lang="de" className="line-through">
                    {givenNorm}
                  </span>
                </p>
              )}
              {hint && (
                <p lang="de" className="mt-2 text-sm font-medium text-amber-700 dark:text-amber-400">
                  {hint}
                </p>
              )}
              {backDetails}
              {gradeButtons(true)}
            </div>
          )
        ) : revealed ? (
          <div className="mt-6 border-t border-stone-200 pt-6 text-center dark:border-stone-700">
            <p lang={card.dir === 'x-de' ? 'de' : undefined} className="text-2xl font-semibold">
              {back}
            </p>
            {backDetails}
            {gradeButtons(false)}
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
