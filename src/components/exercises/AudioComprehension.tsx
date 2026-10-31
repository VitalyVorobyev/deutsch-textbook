import { useEffect, useMemo, useRef, useState } from 'react';
import type { z } from 'zod';
import type { audioComprehensionItemSchema, ListeningCue } from '@da/schema';
import { speakGermanSequence, ttsAvailable } from '../../lib/speech';
import { bundlesAudio, listeningAudioUrl, listeningCuesUrl } from '../../lib/audio';
import { withBase } from '../../lib/url';
import { shuffle } from '../../lib/shuffle';
import { pick } from '../../lib/prefs';
import { t } from '../../lib/strings';
import { useUiLang } from '../hooks';
import { ActionRow, Feedback, Instruction, Translation, type ItemProps } from './shared';

type AudioItem = z.infer<typeof audioComprehensionItemSchema>;

/** Explanation-language strings — one hoisted record per file (docs/adrs/0005-explanation-languages.md). */
const UI = {
  noAudio: {
    en: 'Audio unavailable: this task is scored as reading.',
    ru: 'Аудио недоступно: это задание проверяет чтение.',
  },
  replayTurn: {
    en: 'Play this line again',
    ru: 'Прослушать эту реплику ещё раз',
  },
  slower: {
    en: 'Slower',
    ru: 'Медленнее',
  },
  afterAnswer: {
    en: 'Now listen as often as you like. Tap a line to hear it alone.',
    ru: 'Теперь слушайте сколько угодно. Нажмите на реплику, чтобы услышать только её.',
  },
} as const satisfies Record<string, { en: string; ru: string }>;

/**
 * How much slower the slow replay is. Pitch is preserved, so it is the same voice taking longer,
 * not a lower one.
 */
export const SLOW_RATE = 0.75;

/**
 * The turn a moment of the recording belongs to, or null in the lead-in before the first.
 * Cues are in transcript order with non-decreasing starts, so the last one started is the one.
 */
export function turnAt(cues: readonly ListeningCue[], ms: number): number | null {
  let found: number | null = null;
  cues.forEach((cue, index) => {
    if (cue.start_ms <= ms && ms < cue.end_ms) found = index;
  });
  return found;
}

export function AudioComprehension(props: ItemProps<AudioItem>) {
  const { item, lang, onResult, locked, onNext, nextLabel } = props;
  const uiLang = useUiLang();
  const [chosen, setChosen] = useState<number | null>(null);
  const [plays, setPlays] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [recordingFailed, setRecordingFailed] = useState(false);
  const [cues, setCues] = useState<readonly ListeningCue[] | null>(null);
  const [seekableUrl, setSeekableUrl] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const [activeTurn, setActiveTurn] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const cancelRef = useRef<() => void>(() => {});
  /** Where a single-turn replay stops, in ms of the recording; null plays to the end. */
  const stopAtRef = useRef<number | null>(null);
  const frameRef = useRef(0);
  /** The cues as the follow loop reads them: it runs across renders, so it reads a ref. */
  const cuesRef = useRef<readonly ListeningCue[] | null>(null);
  const order = useMemo(() => shuffle(item.options.map((_, i) => i)), [item]);
  const turns = item.source.turns;
  /**
   * A reviewed recording plays only where the build shipped it. The desktop bundle sets
   * PUBLIC_ATLAS_AUDIO_BUNDLE and carries the WAVs; the web demo does not, and speaks the
   * same script through browser TTS instead. The item is identical either way — the
   * validator holds `source.turns` equal to the recording's transcript — so this changes the
   * voice, never the question or the score.
   */
  const configuredUrl =
    item.recording && bundlesAudio(import.meta.env.PUBLIC_ATLAS_AUDIO_BUNDLE)
      ? withBase(listeningAudioUrl(item.recording))
      : undefined;
  // A configured URL is a promise, not a guarantee: a file missing or corrupt in a shipped
  // build would otherwise leave the learner with a Play button that does nothing at all.
  // Failing over to TTS keeps the task answerable, and the fallback below stays the last resort.
  const recordingUrl = recordingFailed ? undefined : configuredUrl;
  const audioAvailable = recordingUrl !== undefined || ttsAvailable();
  const checked = chosen !== null;
  const correct = chosen === item.correct;

  useEffect(
    () => () => {
      cancelRef.current();
      cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  // The cues are wanted only once the item is answered, and only for a recording: before the
  // answer nothing about the task may change, and browser TTS speaks a turn without them.
  const cueUrl =
    checked && recordingUrl && item.recording ? listeningCuesUrl(item.recording) : null;
  useEffect(() => {
    if (!cueUrl || !recordingUrl) return;
    const controller = new AbortController();
    let local: string | null = null;
    fetch(withBase(cueUrl), { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then(async (body: { cues?: ListeningCue[] } | null) => {
        // A file that does not describe exactly these turns is not used: a cue for the wrong
        // line would replay the wrong sentence under the right text.
        if (body?.cues?.length !== turns.length) return;
        // Replaying a turn is a seek, and a browser can seek only in a file served with byte
        // ranges. A blob URL is always seekable, so the take is read once more into memory
        // rather than trusting every host — the desktop shell's scheme handler included — to
        // honour `Range`. Without it, the direct URL is tried; most hosts do seek.
        const audio = await fetch(recordingUrl, { signal: controller.signal })
          .then((response) => (response.ok ? response.blob() : null))
          .catch(() => null);
        if (audio && !controller.signal.aborted) {
          local = URL.createObjectURL(audio);
          setSeekableUrl(local);
        }
        cuesRef.current = body.cues;
        setCues(body.cues);
      })
      .catch(() => undefined);
    return () => {
      controller.abort();
      if (local) URL.revokeObjectURL(local);
    };
  }, [cueUrl, recordingUrl, turns.length]);

  /** Before the answer a play is counted against `max_replays`; after it, listening is free. */
  const capped = !checked && plays >= item.max_replays;
  const ttsRate = (item.source.rate ?? 0.9) * (checked && slow ? SLOW_RATE : 1);

  function stopFollowing() {
    cancelAnimationFrame(frameRef.current);
    stopAtRef.current = null;
    setActiveTurn(null);
  }

  /** Track the recording's position: highlight the turn being heard, and end a one-turn replay. */
  function follow() {
    const audio = audioRef.current;
    if (!audio) return;
    const ms = audio.currentTime * 1000;
    if (stopAtRef.current !== null && ms >= stopAtRef.current) {
      audio.pause();
      setPlaying(false);
      stopFollowing();
      return;
    }
    if (cuesRef.current) setActiveTurn(turnAt(cuesRef.current, ms));
    frameRef.current = requestAnimationFrame(follow);
  }

  function startRecording(fromMs: number, stopAt: number | null) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = checked && slow ? SLOW_RATE : 1;
    audio.preservesPitch = true;
    audio.currentTime = fromMs / 1000;
    stopAtRef.current = stopAt;
    void Promise.resolve(audio.play()).catch(() => setPlaying(false));
    if (checked) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(follow);
    }
  }

  function play() {
    if (!audioAvailable || playing || capped) return;
    if (!checked) setPlays((n) => n + 1);
    setPlaying(true);
    if (recordingUrl) {
      startRecording(0, null);
    } else {
      cancelRef.current = speakGermanSequence(
        turns.map((t) => t.text),
        { rate: ttsRate },
        () => setPlaying(false),
      );
    }
  }

  /** One line, alone — after the answer only, and never counted. */
  function replayTurn(index: number) {
    if (!checked || playing) return;
    const cue = cues?.[index];
    if (recordingUrl) {
      if (!cue) return;
      setPlaying(true);
      setActiveTurn(index);
      startRecording(cue.start_ms, cue.end_ms);
      return;
    }
    setPlaying(true);
    setActiveTurn(index);
    cancelRef.current = speakGermanSequence([turns[index]!.text], { rate: ttsRate }, () => {
      setPlaying(false);
      setActiveTurn(null);
    });
  }

  /** A line can be replayed alone when its voice can: a cued recording, or browser TTS. */
  const turnsReplayable = checked && (recordingUrl ? cues !== null : audioAvailable);

  function choose(index: number) {
    if (checked || locked) return;
    setChosen(index);
    onResult({ correct: index === item.correct, given: item.options[index]! });
  }

  return (
    <div>
      <Instruction text={item.instruction} lang={lang} />
      {recordingUrl && (
        <audio
          ref={audioRef}
          src={seekableUrl ?? recordingUrl}
          onEnded={() => {
            setPlaying(false);
            stopFollowing();
          }}
          onError={() => {
            // Give this replay back: the learner heard nothing, so it did not cost one.
            setPlaying(false);
            setPlays((n) => Math.max(0, n - 1));
            setRecordingFailed(true);
          }}
        />
      )}
      {audioAvailable ? (
        <div className="mb-4 flex items-center gap-3">
          <button
            type="button"
            onClick={play}
            disabled={playing || capped}
            className="min-h-11 rounded-md bg-stone-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 dark:bg-stone-200 dark:text-stone-900 sm:min-h-0"
          >
            {playing ? '…' : t('action.play', uiLang)}
          </button>
          {checked ? (
            <label className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
              <input type="checkbox" checked={slow} onChange={(e) => setSlow(e.target.checked)} />
              {pick(lang, UI.slower)}
            </label>
          ) : (
            <span className="text-xs text-stone-400">
              {plays} / {item.max_replays}
            </span>
          )}
        </div>
      ) : (
        <p className="mb-3 rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-800 dark:bg-sky-950 dark:text-sky-200">
          {pick(lang, UI.noAudio)}
        </p>
      )}
      {(!audioAvailable || checked) && (
        <div className="mb-4 space-y-1 rounded-md border border-stone-200 p-3 text-sm dark:border-stone-700">
          {turnsReplayable && (
            <p className="mb-2 text-xs text-stone-500 dark:text-stone-400">
              {pick(lang, UI.afterAnswer)}
            </p>
          )}
          {turns.map((turn, i) =>
            turnsReplayable ? (
              <button
                key={i}
                type="button"
                lang="de"
                aria-current={activeTurn === i ? 'true' : undefined}
                disabled={playing && activeTurn !== i}
                onClick={() => replayTurn(i)}
                className={`block w-full rounded px-2 py-1 text-left ${activeTurn === i ? 'bg-amber-100 dark:bg-amber-900/40' : 'hover:bg-stone-100 dark:hover:bg-stone-800'}`}
              >
                <span aria-hidden="true" className="mr-2 text-stone-400">
                  ▶
                </span>
                <span className="sr-only">{pick(lang, UI.replayTurn)}: </span>
                <strong>{turn.speaker}:</strong> {turn.text}
              </button>
            ) : (
              <p key={i} lang="de">
                <strong>{turn.speaker}:</strong> {turn.text}
              </p>
            ),
          )}
        </div>
      )}
      <p lang="de" className="mb-3 text-lg font-medium">
        {item.question}
      </p>
      <div className="space-y-2">
        {order.map((index) => (
          <button
            key={index}
            type="button"
            disabled={checked}
            onClick={() => choose(index)}
            className={`block min-h-11 w-full rounded-md border px-4 py-2 text-left ${checked && index === item.correct ? 'border-green-500 bg-green-50 dark:bg-green-950' : checked && index === chosen ? 'border-red-500 bg-red-50 dark:bg-red-950' : 'border-stone-300 hover:border-amber-500 dark:border-stone-600'}`}
          >
            {item.options[index]}
          </button>
        ))}
      </div>
      <Translation text={item.translation} lang={lang} />
      <ActionRow checked={checked} correct={correct} onNext={onNext} nextLabel={nextLabel} />
      {checked && (
        <Feedback
          correct={correct}
          correctAnswer={item.options[item.correct]}
          explain={item.explain}
          lang={lang}
        />
      )}
    </div>
  );
}
