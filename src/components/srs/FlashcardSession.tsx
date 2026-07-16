import { useEffect, useRef, useState } from 'react';
import { Rating, gradeCard, type CardDef, type Grade } from '../../lib/srs';
import { planReview, type ReviewGate } from '../../lib/decks';
import {
  getAttempts,
  getCardStates,
  getLearningGoal,
  getTopicsState,
  setCardState,
  type CardStates,
} from '../../lib/store';
import { getCardInputMode, pick, pickSecond, setCardInputMode, type CardInputMode } from '../../lib/prefs';
import { t, type StringKey } from '../../lib/strings';
import {
  articledForm,
  checkTypedAnswer,
  diffExpected,
  normalizeTyped,
  type AnswerVerdict,
} from '../../lib/typing';
import { SLOW_RATE, speakGerman, ttsAvailable } from '../../lib/speech';
import SpeakerButton from '../SpeakerButton';
import { useExplainLang, useUiLang } from '../hooks';

/** Explanation-language strings — one hoisted record per file (docs/i18n-design.md). */
const UI = {
  allDone: { en: 'All done for now!', ru: 'На сегодня всё!' },
  cardsReviewed: { en: 'Cards reviewed', ru: 'Карточек повторено' },
  noCardsDue: { en: 'No cards due for review.', ru: 'Нет карточек к повторению.' },
  remaining: { en: 'Remaining', ru: 'Осталось' },
  reveal: { en: 'Reveal', ru: 'Показать' },
} as const satisfies Record<string, { en: string; ru: string }>;

interface Props {
  cards: CardDef[];
  /** cap on never-seen cards mixed into this session */
  newLimit?: number;
  /** when set, never-graded cards are limited to eligible decks (due cards
      always pass) — the per-deck page omits it, studying a deck is an opt-in */
  gate?: ReviewGate;
  /** a pre-planned queue (e.g. from SessionFlow's planReview) — when given,
      this session skips its own planning and reviews exactly these cards */
  queue?: CardDef[];
  /** called once, exactly when the review queue runs empty */
  onFinished?: () => void;
}

interface SessionStats {
  reviewed: number;
  again: number;
}

const GRADE_BUTTONS: Array<{ grade: Grade; label: StringKey; cls: string }> = [
  { grade: Rating.Again, label: 'grade.again', cls: 'bg-red-600 hover:bg-red-700' },
  { grade: Rating.Hard, label: 'grade.hard', cls: 'bg-orange-500 hover:bg-orange-600' },
  { grade: Rating.Good, label: 'grade.good', cls: 'bg-green-600 hover:bg-green-700' },
  { grade: Rating.Easy, label: 'grade.easy', cls: 'bg-sky-600 hover:bg-sky-700' },
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

export default function FlashcardSession({
  cards,
  newLimit = 15,
  gate,
  queue: presetQueue,
  onFinished,
}: Props) {
  const lang = useExplainLang();
  const uiLang = useUiLang();
  const [queue, setQueue] = useState<CardDef[] | null>(null);
  const [states, setStates] = useState<CardStates>({});
  const [revealed, setRevealed] = useState(false);
  const canTts = ttsAvailable();
  const [inputMode, setInputMode] = useState<CardInputMode>(() => {
    const m = getCardInputMode();
    return m === 'listen' && !ttsAvailable() ? 'typed' : m;
  });
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
  // iOS allows programmatic TTS only after one user-gesture speak — track it
  const hasPlayedManually = useRef(false);

  useEffect(() => {
    let cancelled = false;
    if (presetQueue) {
      // Pre-planned queue: states still load for grading, planning is skipped.
      void getCardStates().then((s) => {
        if (cancelled) return;
        setStates(s);
        setQueue([...presetQueue]);
      });
      return () => {
        cancelled = true;
      };
    }
    void Promise.all([
      getCardStates(),
      gate ? getAttempts() : [],
      gate ? getTopicsState() : {},
      gate ? getLearningGoal() : undefined,
    ]).then(([s, attempts, topics, goal]) => {
      if (cancelled) return;
      setStates(s);
      setQueue(planReview(cards, gate, { attempts, cards: s, topics, goal }, { newLimit }).queue);
    });
    return () => {
      cancelled = true;
    };
  }, [cards, newLimit, gate, presetQueue]);

  const card = queue?.[0];
  // 'listen' turns recognition (de-x) cards into dictation; production (x-de)
  // cards fall back to typed there — hearing the answer would spoil recall.
  const listening = !!card && card.dir === 'de-x' && inputMode === 'listen' && canTts;
  const typing =
    !!card && ((card.dir === 'x-de' && inputMode !== 'reveal') || listening);
  const answered = typing ? verdict !== null : revealed;
  const suggested: Grade = verdict?.kind === 'correct' ? Rating.Good : Rating.Again;

  // Focus the answer field whenever a typed card is waiting for input.
  useEffect(() => {
    if (typing && verdict === null) inputRef.current?.focus();
  }, [typing, verdict, card?.id]);

  // Dictation auto-play for each new card — only after the learner has tapped
  // play once (iOS unlocks speechSynthesis on the first user-gesture speak).
  useEffect(() => {
    if (listening && verdict === null && card && hasPlayedManually.current) {
      speakGerman(articledForm(card.de, card.gender));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?.id, listening, verdict === null]);

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
          {pick(lang, UI.allDone)}
        </p>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          {stats.reviewed > 0
            ? `${pick(lang, UI.cardsReviewed)}: ${stats.reviewed}`
            : pick(lang, UI.noCardsDue)}
        </p>
      </div>
    );
  }

  // Nouns are shown and must be answered WITH their article ("der Apfel").
  const answerDe = articledForm(card.de, card.gender);
  // The meaning side: EN plus the explanation-language gloss (pickSecond) —
  // `en · ru` today, `en · uk` where a wave authored it, EN alone under 'uk'
  // without a gloss and always under 'de' (a meaning side is never German).
  // Used by the x-de front and the de-x back only; the de-x front stays the
  // German answer, and dictation keeps its behavior (the German side is the
  // hidden audio prompt, so the visible "front" after answering is the
  // meaning). Display-only: card identity never carries a gloss language.
  const second = pickSecond(lang, { ru: card.ru, uk: card.uk });
  const meaning = second ? `${card.en} · ${second}` : card.en;
  const front = card.dir === 'de-x' && !listening ? answerDe : meaning;
  const back = card.dir === 'de-x' ? meaning : answerDe;

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
    setVerdict(checkTypedAnswer(typed, articledForm(card.de, card.gender), card.pos, card.accept));
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

  // Back side only: on an x-de card, and on a de-x card in dictation mode, the
  // Lautschrift on the front would give the answer away.
  const backDetails = (
    <>
      {(card.ipa || card.deDetail) && (
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          {card.ipa && (
            <span translate="no" className="mr-2">
              [{card.ipa}]
            </span>
          )}
          {card.deDetail && <span lang="de">{card.deDetail}</span>}
        </p>
      )}
      <p lang="de" className="mt-4 text-sm italic text-stone-600 dark:text-stone-300">
        {card.exampleDe}
        <SpeakerButton text={card.exampleDe} className="ml-1 not-italic text-stone-400" />
      </p>
      <p className="mt-1 text-xs text-stone-400">
        {pick(lang, { en: card.exampleEn, ru: card.exampleRu, uk: card.exampleUk })}
      </p>
      {card.context?.length ? <div className="mt-4 space-y-2 border-t border-stone-200 pt-3 text-left dark:border-stone-700">
        {card.context.slice(0, 3).map((context, index) => <div key={`${context.type}-${index}`} className="text-sm">
          <span className="mr-2 rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-stone-500 dark:bg-stone-700 dark:text-stone-300">{context.type}</span>
          <strong lang="de">{context.de}</strong>
          {/* Destructured, never pick(lang, context): the context record's `de`
              key is the related German word itself, and under ExplainLang 'de'
              pick() would show it as its own gloss (same trap as reading
              glosses). The German explanation half travels as explanationDe. */}
          <span className="ml-2 text-stone-500 dark:text-stone-400">{pick(lang, { en: context.en, ru: context.ru, uk: context.uk, de: context.explanationDe })}</span>
          {context.exampleDe && <p lang="de" className="mt-1 text-xs italic text-stone-500">{context.exampleDe} — {pick(lang, { en: context.exampleEn ?? '', ru: context.exampleRu ?? '', uk: context.exampleUk })}</p>}
        </div>)}
      </div> : null}
    </>
  );

  const gradeButtons = (withSuggestion: boolean) => (
    <>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {GRADE_BUTTONS.map(({ grade: g, label, cls }) => (
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
            {t(label, uiLang)}
          </button>
        ))}
      </div>
      {withSuggestion && (
        <p className="mt-3 text-[11px] text-stone-400">
          ↵ {suggested === Rating.Good ? t('grade.good', uiLang) : t('grade.again', uiLang)} · 1–4
        </p>
      )}
    </>
  );

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-xs">
          <span className="text-stone-400">{t('flashcards.input', uiLang)}</span>
          {(
            [
              ['typed', 'flashcards.modeTyped'],
              ['reveal', 'flashcards.modeReveal'],
              ['listen', 'flashcards.modeListen'],
            ] as Array<[CardInputMode, StringKey]>
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => switchMode(mode)}
              disabled={mode === 'listen' && !canTts}
              title={
                mode === 'listen' && !canTts
                  ? t('flashcards.ttsUnavailable', uiLang)
                  : undefined
              }
              className={`rounded px-2 py-1.5 font-medium disabled:cursor-not-allowed disabled:opacity-40 sm:py-0.5 ${
                inputMode === mode
                  ? 'bg-stone-800 text-white dark:bg-stone-200 dark:text-stone-900'
                  : 'text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
              }`}
            >
              {t(label, uiLang)}
            </button>
          ))}
        </div>
        <p className="text-xs text-stone-400">
          {pick(lang, UI.remaining)}: {queue.length}
        </p>
      </div>
      <div className="rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-800 sm:p-8">
        <p className="text-center text-xs uppercase tracking-wide text-stone-400">
          {listening
            ? t('flashcards.dirListen', uiLang)
            : card.dir === 'de-x'
              ? t('flashcards.dirFromDe', uiLang)
              : t('flashcards.dirToDe', uiLang)}
        </p>
        {listening && verdict === null ? (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                hasPlayedManually.current = true;
                speakGerman(answerDe);
              }}
              className="min-h-11 rounded-md bg-stone-800 px-5 py-2 font-semibold text-white hover:bg-stone-700 sm:min-h-0 dark:bg-stone-200 dark:text-stone-900 dark:hover:bg-stone-300"
            >
              {t('action.play', uiLang)}
            </button>
            <button
              type="button"
              onClick={() => {
                hasPlayedManually.current = true;
                speakGerman(answerDe, { rate: SLOW_RATE });
              }}
              className="min-h-11 rounded-md border border-stone-300 px-4 py-2 text-sm font-semibold hover:border-amber-500 sm:min-h-0 dark:border-stone-600"
            >
              {t('action.playSlow', uiLang)}
            </button>
          </div>
        ) : (
          <p
            lang={card.dir === 'de-x' && !listening ? 'de' : undefined}
            className="mt-4 text-center text-2xl font-bold sm:text-3xl"
          >
            {front}
            {card.dir === 'de-x' && !listening && (
              <SpeakerButton text={answerDe} className="ml-2 text-stone-400" />
            )}
          </p>
        )}

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
                  placeholder={t('flashcards.typePlaceholder', uiLang)}
                  className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-center text-lg text-stone-900 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100"
                />
                <button
                  type="button"
                  onClick={check}
                  className="shrink-0 rounded-md bg-stone-800 px-4 py-2 font-semibold text-white hover:bg-stone-700 dark:bg-stone-200 dark:text-stone-900 dark:hover:bg-stone-300"
                >
                  {t('action.check', uiLang)}
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
                {verdict.kind === 'correct'
                  ? t('flashcards.typedCorrect', uiLang)
                  : t('flashcards.typedWrong', uiLang)}
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
                <SpeakerButton text={answerDe} className="ml-1 text-stone-400" />
              </p>
              {verdict.kind !== 'correct' && givenNorm !== '' && (
                <p className="mt-1 text-sm text-stone-400">
                  {t('flashcards.yourInput', uiLang)}{' '}
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
              {card.dir === 'x-de' && (
                <SpeakerButton text={answerDe} className="ml-1 text-stone-400" />
              )}
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
              {pick(lang, UI.reveal)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
