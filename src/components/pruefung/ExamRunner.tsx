/**
 * One session against one module of one official set.
 *
 * The two modes are deliberately different instruments, not a setting:
 *
 *  - **Prüfungsmodus** reproduces the exam's constraints — the clock runs, and the recording
 *    plays once, from a single button, with no seek bar and no replay. That is not a
 *    restriction invented here: the real Tonträger already contains every repetition and
 *    pause the Kandidatenblätter promise, so a replay control would hand the learner a
 *    listening budget the exam does not give. Pausing stays possible (a doorbell is not a
 *    reason to lose a run) and says plainly that the real recording would have run on.
 *  - **Üben** removes the clock, hands the audio its native controls, and answers each item
 *    the moment it is chosen — a typed blank on request, since typing needs an "I'm done".
 *
 * A module may carry three kinds of asking: letter items (the Antwortbogen), typed blanks
 * (Schreiben Teil 1 — compared literally, official answer always shown beside a ✗), and a
 * free part (Schreiben Teil 2 — written here, never graded here; the result screen holds the
 * criteria and the self-assessment). Nothing here writes: the finished run is handed to the
 * parent, which records it exactly once.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  isTextItem,
  itemCorrect,
  moduleItems,
  scoreModule,
  type ExamAnswer,
  type ExamChoiceItemSpec,
  type ExamModuleSpec,
  type ExamRunRecord,
  type ExamSetSpec,
  type ExamTeilSpec,
  type ExamTextItemSpec,
} from '../../lib/exam-sim';
import { withBase } from '../../lib/url';
import {
  answerLabel,
  countWords,
  formatClock,
  hasText,
  CARD,
  MODE_LABEL,
  MODULE_LABEL,
  OPTIONS,
  PRIMARY_BUTTON,
  QUIET_BUTTON,
  type ExamMode,
} from './shared';

interface Props {
  set: ExamSetSpec;
  module: ExamModuleSpec;
  mode: ExamMode;
  /** Called exactly once per run — the parent turns it into the single `recordExamRun` call. */
  onFinish: (run: ExamRunRecord, timedOut: boolean) => void;
}

type PlayState = 'idle' | 'playing' | 'paused' | 'ended';

const WARN_MS = 5 * 60_000;
const ALARM_MS = 60_000;

const clockTone = (remaining: number): string =>
  remaining < ALARM_MS
    ? 'text-red-600 dark:text-red-400'
    : remaining < WARN_MS
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-stone-700 dark:text-stone-200';

/** How often the recording presents this Teil, as its instruction line states it. */
const playsCaption = (teil: ExamTeilSpec): string | null =>
  teil.plays === 'twice' ? 'Sie hören zweimal.' : teil.plays === 'once' ? 'Sie hören einmal.' : null;

function OptionRow({
  item,
  chosen,
  reveal,
  onChoose,
}: {
  item: ExamChoiceItemSpec;
  chosen: string | undefined;
  /** Üben only: the item is answered, so its key is shown and its buttons are settled. */
  reveal: boolean;
  onChoose: (answer: ExamAnswer) => void;
}) {
  const settled = reveal && chosen !== undefined;
  return (
    <div className="flex flex-wrap items-center gap-2 py-1" role="group" aria-label={`Aufgabe ${item.nr}`}>
      <span className="w-6 shrink-0 tabular-nums text-sm text-stone-400">{item.nr}</span>
      <div className="flex flex-wrap gap-1.5">
        {OPTIONS[item.shape].map((option) => {
          const picked = chosen === option.value;
          const isKey = option.value === item.key;
          const tone = settled
            ? isKey
              ? 'border-green-600 bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-300'
              : picked
                ? 'border-red-500 bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300'
                : 'border-stone-200 text-stone-400 dark:border-stone-700'
            : picked
              ? 'border-amber-600 bg-amber-600 text-white'
              : 'border-stone-300 text-stone-600 hover:border-amber-500 dark:border-stone-600 dark:text-stone-300';
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={picked}
              disabled={settled}
              onClick={() => onChoose(option.value)}
              className={`min-h-11 min-w-11 rounded-md border px-3 text-sm font-medium ${tone}`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {settled && (
        <span
          className={`text-xs font-medium ${chosen === item.key ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}
        >
          {chosen === item.key ? '✓' : `✗ Lösung: ${answerLabel(item.shape, item.key)}`}
        </span>
      )}
    </div>
  );
}

function TextRow({
  item,
  value,
  settled,
  ueben,
  onChange,
  onSettle,
}: {
  item: ExamTextItemSpec;
  value: string | undefined;
  /** Üben only: checked on request — typing needs an explicit "I'm done", unlike a click. */
  settled: boolean;
  ueben: boolean;
  onChange: (value: string) => void;
  onSettle: () => void;
}) {
  const correct = itemCorrect(item, value);
  return (
    <div className="py-1" role="group" aria-label={`Aufgabe ${item.nr}`}>
      <div className="flex items-center gap-2">
        <span className="w-6 shrink-0 tabular-nums text-sm text-stone-400">{item.nr}</span>
        <input
          type="text"
          value={value ?? ''}
          disabled={settled}
          aria-label={`Antwort zu Aufgabe ${item.nr}`}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={
            ueben
              ? (event) => {
                  if (event.key === 'Enter') onSettle();
                }
              : undefined
          }
          className="min-h-11 w-full min-w-0 rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-800 focus:border-amber-500 focus:outline-none disabled:opacity-70 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100"
        />
        {ueben && !settled && (
          <button
            type="button"
            onClick={onSettle}
            disabled={!hasText(value)}
            className="min-h-11 shrink-0 rounded-md border border-stone-300 px-3 text-sm font-medium text-stone-600 hover:border-amber-500 disabled:opacity-40 dark:border-stone-600 dark:text-stone-300"
          >
            Prüfen
          </button>
        )}
      </div>
      {settled && (
        <p
          className={`mt-1 pl-8 text-xs font-medium ${correct ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}
        >
          {correct ? '✓' : `✗ Lösung: ${item.answer}`}
        </p>
      )}
    </div>
  );
}

export default function ExamRunner({ set, module, mode, onFinish }: Props) {
  const items = useMemo(() => moduleItems(module), [module]);
  const freeTeile = useMemo(() => module.teile.filter((teil) => teil.free), [module]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [texts, setTexts] = useState<Record<number, string>>({});
  // Üben only: which typed blanks have been checked. A letter item settles by being chosen;
  // a blank settles on request, so half-typed text is never graded behind the learner's back.
  const [settledText, setSettledText] = useState<Record<number, boolean>>({});
  const [confirming, setConfirming] = useState(false);
  const [remainingMs, setRemainingMs] = useState(module.timeLimitMin * 60_000);
  const [playState, setPlayState] = useState<PlayState>('idle');
  const [audioBroken, setAudioBroken] = useState(false);

  // The wall clock is read in an effect, never in render: a re-render must not be able to
  // move the start of a timed session (and reading it in render is impure by React's rules).
  const startRef = useRef<{ iso: string; ms: number } | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const finishedRef = useRef(false);
  // The countdown fires from an interval, which closes over the state of its own render;
  // the refs are what let an auto-submit at 0:00 record the sheet as it actually stands.
  const answersRef = useRef(answers);
  const textsRef = useRef(texts);
  useEffect(() => {
    answersRef.current = answers;
    textsRef.current = texts;
  }, [answers, texts]);

  const answered = items.filter((item) => hasText(answers[item.nr])).length;
  const missing = items.length - answered;
  // Üben's running tally counts only settled items — a typed but unchecked blank is neither.
  const settledCount = items.filter((item) =>
    isTextItem(item) ? settledText[item.nr] : answers[item.nr] !== undefined,
  ).length;
  const correctSoFar = items.filter(
    (item) =>
      (isTextItem(item) ? settledText[item.nr] : answers[item.nr] !== undefined) &&
      itemCorrect(item, answers[item.nr]),
  ).length;

  const finish = useCallback(
    (timedOut: boolean) => {
      if (finishedRef.current) return; // the clock and the button can both arrive
      finishedRef.current = true;
      audioRef.current?.pause();
      const given = answersRef.current;
      // Every item of the module appears in the record, so the result table can show an
      // unanswered one as such instead of silently omitting the row.
      const sheet: Record<number, string | null> = {};
      for (const item of items) {
        const value = given[item.nr];
        sheet[item.nr] = hasText(value) ? value.trim() : null;
      }
      const writtenTexts: Record<number, string> = {};
      for (const teil of freeTeile) {
        const text = textsRef.current[teil.teil];
        if (hasText(text)) writtenTexts[teil.teil] = text.trim();
      }
      onFinish(
        {
          setId: set.id,
          module: module.module,
          mode,
          startedAt: startRef.current?.iso ?? new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          ...scoreModule(module, given),
          answers: sheet,
          ...(Object.keys(writtenTexts).length > 0 ? { texts: writtenTexts } : {}),
        },
        timedOut,
      );
    },
    [freeTeile, items, mode, module, onFinish, set.id],
  );

  useEffect(() => {
    // `??=`: the session's start is stamped once for both modes, and stays put even if this
    // effect were ever re-run — a restarted countdown would silently hand back lost minutes.
    const started = (startRef.current ??= { iso: new Date().toISOString(), ms: Date.now() });
    if (mode !== 'pruefung') return;
    const deadline = started.ms + module.timeLimitMin * 60_000;
    const tick = () => {
      const left = deadline - Date.now();
      setRemainingMs(Math.max(0, left));
      if (left <= 0) finish(true);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [finish, mode, module.timeLimitMin]);

  // Capture the element on mount: React detaches the ref before passive cleanups run at
  // unmount, so reading `audioRef.current` in here would find null and leave audio playing.
  useEffect(() => {
    const audio = audioRef.current;
    return () => audio?.pause();
  }, []);

  function choose(item: ExamChoiceItemSpec, answer: ExamAnswer) {
    // In Üben an answered item is settled — its key is already on screen, so a second
    // choice would only edit the running score, never the knowledge it reports.
    if (mode === 'ueben' && answers[item.nr] !== undefined) return;
    setConfirming(false);
    setAnswers((current) => ({ ...current, [item.nr]: answer }));
  }

  function typeAnswer(item: ExamTextItemSpec, value: string) {
    if (mode === 'ueben' && settledText[item.nr]) return;
    setConfirming(false);
    setAnswers((current) => ({ ...current, [item.nr]: value }));
  }

  function settleText(item: ExamTextItemSpec) {
    if (!hasText(answers[item.nr])) return;
    setSettledText((current) => ({ ...current, [item.nr]: true }));
  }

  function toggleExamAudio() {
    const audio = audioRef.current;
    if (!audio || audioBroken || playState === 'ended') return;
    if (playState === 'playing') {
      audio.pause();
      setPlayState('paused');
      return;
    }
    // No `currentTime` reset anywhere: "Abspielen" starts the recording once, and resuming
    // after a pause continues where it stopped. That is the whole no-replay rule.
    audio.play().then(
      () => setPlayState('playing'),
      () => setAudioBroken(true),
    );
  }

  function submit() {
    if (mode === 'pruefung' && missing > 0 && !confirming) {
      setConfirming(true);
      return;
    }
    finish(false);
  }

  const examAudioLabel =
    playState === 'playing' ? 'Pause' : playState === 'paused' ? 'Fortsetzen' : 'Abspielen';

  return (
    <section lang="de" className="space-y-4">
      <div className={`${CARD} flex flex-wrap items-center justify-between gap-3 p-4`}>
        <div>
          <p className="font-semibold">{set.title}</p>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            {MODULE_LABEL[module.module]} · {MODE_LABEL[mode]}
            {mode === 'ueben' && ' · ohne Zeit'}
          </p>
        </div>
        {mode === 'pruefung' && (
          <span role="timer" aria-label="Verbleibende Zeit" className={`tabular-nums text-3xl font-bold ${clockTone(remainingMs)}`}>
            {formatClock(remainingMs)}
          </span>
        )}
      </div>

      {module.audio && (
        <div className={`${CARD} p-4`}>
          <audio
            ref={audioRef}
            src={withBase(module.audio)}
            controls={mode === 'ueben'}
            className={mode === 'ueben' ? 'w-full' : undefined}
            onEnded={() => setPlayState('ended')}
            onError={() => setAudioBroken(true)}
          />
          {mode === 'pruefung' && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={toggleExamAudio}
                disabled={audioBroken || playState === 'ended'}
                className={PRIMARY_BUTTON}
              >
                {playState === 'ended' ? 'Aufnahme beendet' : examAudioLabel}
              </button>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Die Aufnahme läuft einmal durch. Alle Wiederholungen und Pausen sind darin enthalten.
              </p>
            </div>
          )}
          {mode === 'pruefung' && playState === 'paused' && (
            <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              Pause angehalten — in der Prüfung läuft die Aufnahme durch.
            </p>
          )}
          {audioBroken && (
            <p className="mt-3 rounded-md bg-stone-100 px-3 py-2 text-sm text-stone-600 dark:bg-stone-900 dark:text-stone-300">
              Die Aufnahme lässt sich auf diesem Gerät nicht abspielen.
            </p>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="overflow-x-auto">
          <div className="space-y-3">
            {module.pages.map((page, index) => (
              <img
                key={page}
                src={withBase(page)}
                loading="lazy"
                alt={`Aufgabenblatt Seite ${index + 1}`}
                className="max-w-full rounded-md border border-stone-200 dark:border-stone-700"
              />
            ))}
          </div>
        </div>

        <div className={`${CARD} self-start p-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto`}>
          <h2 className="text-sm font-bold uppercase tracking-wide text-stone-500 dark:text-stone-400">
            Antwortbogen
          </h2>
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
            {mode === 'ueben'
              ? `richtig: ${correctSoFar}/${settledCount}`
              : `beantwortet: ${answered}/${items.length}`}
          </p>

          <div className="mt-3 space-y-4">
            {module.teile.map((teil) => (
              <div key={teil.teil}>
                <h3 className="text-sm font-semibold">Teil {teil.teil}</h3>
                {playsCaption(teil) && (
                  <p className="text-xs text-stone-400">{playsCaption(teil)}</p>
                )}
                {teil.items.some(isTextItem) && (
                  <p className="text-xs text-stone-400">
                    Wörtlicher Vergleich — prüfe eine abgelehnte eigene Schreibweise mit der Lösung.
                  </p>
                )}
                <div className="mt-1">
                  {teil.items.map((item) =>
                    isTextItem(item) ? (
                      <TextRow
                        key={item.nr}
                        item={item}
                        value={answers[item.nr]}
                        settled={mode === 'ueben' && settledText[item.nr] === true}
                        ueben={mode === 'ueben'}
                        onChange={(value) => typeAnswer(item, value)}
                        onSettle={() => settleText(item)}
                      />
                    ) : (
                      <OptionRow
                        key={item.nr}
                        item={item}
                        chosen={answers[item.nr]}
                        reveal={mode === 'ueben'}
                        onChoose={(answer) => choose(item, answer)}
                      />
                    ),
                  )}
                </div>
                {teil.free && (
                  <div className="mt-2">
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      {teil.free.label} · {teil.free.points} Punkte nach Kriterien
                    </p>
                    <textarea
                      value={texts[teil.teil] ?? ''}
                      rows={7}
                      aria-label={`Text zu Teil ${teil.teil}`}
                      onChange={(event) =>
                        setTexts((current) => ({ ...current, [teil.teil]: event.target.value }))
                      }
                      className="mt-1 w-full rounded-md border border-stone-300 bg-white p-2 text-sm text-stone-800 focus:border-amber-500 focus:outline-none dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100"
                    />
                    <p className="text-xs text-stone-400">
                      Wörter: {countWords(texts[teil.teil] ?? '')} · Bewertung nach dem Abgeben, mit
                      den Kriterien der Prüferblätter.
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-5 border-t border-stone-200 pt-4 dark:border-stone-700">
            {confirming ? (
              <div className="space-y-3">
                <p className="text-sm text-stone-700 dark:text-stone-200">
                  {missing === 1
                    ? '1 Aufgabe ohne Antwort — trotzdem abgeben?'
                    : `${missing} Aufgaben ohne Antwort — trotzdem abgeben?`}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => finish(false)} className={PRIMARY_BUTTON}>
                    Ja, abgeben
                  </button>
                  <button type="button" onClick={() => setConfirming(false)} className={QUIET_BUTTON}>
                    Weiter bearbeiten
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={submit} className={PRIMARY_BUTTON}>
                {mode === 'pruefung' ? 'Abgeben' : 'Beenden'}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
