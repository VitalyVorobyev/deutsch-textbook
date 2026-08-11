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
 *    the moment it is chosen. It is study, and it says so.
 *
 * Nothing here writes: the finished run is handed to the parent, which records it exactly once.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  moduleItems,
  scoreModule,
  type ExamAnswer,
  type ExamItemSpec,
  type ExamModuleSpec,
  type ExamRunRecord,
  type ExamSetSpec,
  type ExamTeilSpec,
} from '../../lib/exam-sim';
import { withBase } from '../../lib/url';
import {
  answerLabel,
  formatClock,
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
  item: ExamItemSpec;
  chosen: ExamAnswer | undefined;
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

export default function ExamRunner({ set, module, mode, onFinish }: Props) {
  const items = useMemo(() => moduleItems(module), [module]);
  const [answers, setAnswers] = useState<Record<number, ExamAnswer>>({});
  const [confirming, setConfirming] = useState(false);
  const [remainingMs, setRemainingMs] = useState(module.timeLimitMin * 60_000);
  const [playState, setPlayState] = useState<PlayState>('idle');
  const [audioBroken, setAudioBroken] = useState(false);

  // The wall clock is read in an effect, never in render: a re-render must not be able to
  // move the start of a timed session (and reading it in render is impure by React's rules).
  const startRef = useRef<{ iso: string; ms: number } | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const finishedRef = useRef(false);
  // The countdown fires from an interval, which closes over the answers of its own render;
  // the ref is what lets an auto-submit at 0:00 score the sheet as it actually stands.
  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const answered = items.filter((item) => answers[item.nr] !== undefined).length;
  const correctSoFar = items.filter((item) => answers[item.nr] === item.key).length;
  const missing = items.length - answered;

  const finish = useCallback(
    (timedOut: boolean) => {
      if (finishedRef.current) return; // the clock and the button can both arrive
      finishedRef.current = true;
      audioRef.current?.pause();
      const given = answersRef.current;
      // Every item of the module appears in the record, so the result table can show an
      // unanswered one as such instead of silently omitting the row.
      const sheet: Record<number, ExamAnswer | null> = {};
      for (const item of items) sheet[item.nr] = given[item.nr] ?? null;
      onFinish(
        {
          setId: set.id,
          module: module.module,
          mode,
          startedAt: startRef.current?.iso ?? new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          ...scoreModule(module, given),
          answers: sheet,
        },
        timedOut,
      );
    },
    [items, mode, module, onFinish, set.id],
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

  function choose(item: ExamItemSpec, answer: ExamAnswer) {
    // In Üben an answered item is settled — its key is already on screen, so a second
    // choice would only edit the running score, never the knowledge it reports.
    if (mode === 'ueben' && answers[item.nr] !== undefined) return;
    setConfirming(false);
    setAnswers((current) => ({ ...current, [item.nr]: answer }));
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
              ? `richtig: ${correctSoFar}/${answered}`
              : `beantwortet: ${answered}/${items.length}`}
          </p>

          <div className="mt-3 space-y-4">
            {module.teile.map((teil) => (
              <div key={teil.teil}>
                <h3 className="text-sm font-semibold">Teil {teil.teil}</h3>
                {playsCaption(teil) && (
                  <p className="text-xs text-stone-400">{playsCaption(teil)}</p>
                )}
                <div className="mt-1">
                  {teil.items.map((item) => (
                    <OptionRow
                      key={item.nr}
                      item={item}
                      chosen={answers[item.nr]}
                      reveal={mode === 'ueben'}
                      onChoose={(answer) => choose(item, answer)}
                    />
                  ))}
                </div>
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
