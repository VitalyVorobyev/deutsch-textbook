import { useEffect, useRef, useState } from 'react';
import type { ListeningCue } from '@da/schema';
import { speakGermanSequence, ttsAvailable } from '../../lib/speech';
import {
  bundlesAudio,
  listeningAudioUrl,
  listeningCuesUrl,
  type RecordingScript,
} from '../../lib/audio';
import { withBase } from '../../lib/url';
import { pick, type ExplainLang } from '../../lib/prefs';
import { t } from '../../lib/strings';
import { useUiLang } from '../hooks';

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

/** Browser-TTS rate when a script names none — the `audioSourceSchema` default. */
const DEFAULT_TTS_RATE = 0.9;

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

interface Props {
  script: RecordingScript;
  /** plays allowed before `revealed`; after it, listening is free */
  maxReplays: number;
  /**
   * Whether the task this recording serves is answered. Before it: one player, a counted play
   * budget, no transcript. After it: the transcript, each line replayable alone, and slower.
   */
  revealed: boolean;
  lang: ExplainLang;
}

/**
 * One recording and its play budget — the player of a single `audio-comprehension` item and the
 * shared panel of a task set alike, so the two cannot drift apart in what they let a learner do
 * before the answer.
 *
 * A reviewed recording plays only where the build shipped it, which every build does unless
 * PUBLIC_ATLAS_AUDIO_BUNDLE says 0; a lean build speaks the same script through browser TTS
 * instead. The validator holds an item's `source.turns` equal to its recording's transcript, and
 * a task set's script *is* its recording's transcript, so this changes the voice, never the
 * question or the score.
 */
export function RecordingPlayer({ script, maxReplays, revealed, lang }: Props) {
  const uiLang = useUiLang();
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
  const turns = script.turns;
  const configuredUrl =
    script.id && bundlesAudio(import.meta.env.PUBLIC_ATLAS_AUDIO_BUNDLE)
      ? withBase(listeningAudioUrl(script.id))
      : undefined;
  // A configured URL is a promise, not a guarantee: a file missing or corrupt in a shipped
  // build would otherwise leave the learner with a Play button that does nothing at all.
  // Failing over to TTS keeps the task answerable, and the fallback below stays the last resort.
  const recordingUrl = recordingFailed ? undefined : configuredUrl;
  const audioAvailable = recordingUrl !== undefined || ttsAvailable();

  useEffect(
    () => () => {
      cancelRef.current();
      cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  // The cues are wanted only once the task is answered, and only for a recording: before the
  // answer nothing about the task may change, and browser TTS speaks a turn without them.
  const cueUrl = revealed && recordingUrl && script.id ? listeningCuesUrl(script.id) : null;
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

  /** Before the answer a play is counted against the budget; after it, listening is free. */
  const capped = !revealed && plays >= maxReplays;
  const ttsRate = (script.rate ?? DEFAULT_TTS_RATE) * (revealed && slow ? SLOW_RATE : 1);

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
    audio.playbackRate = revealed && slow ? SLOW_RATE : 1;
    audio.preservesPitch = true;
    audio.currentTime = fromMs / 1000;
    stopAtRef.current = stopAt;
    void Promise.resolve(audio.play()).catch(() => setPlaying(false));
    if (revealed) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(follow);
    }
  }

  function play() {
    if (!audioAvailable || playing || capped) return;
    if (!revealed) setPlays((n) => n + 1);
    setPlaying(true);
    if (recordingUrl) {
      startRecording(0, null);
    } else {
      cancelRef.current = speakGermanSequence(
        turns.map((turn) => turn.text),
        { rate: ttsRate },
        () => setPlaying(false),
      );
    }
  }

  /** One line, alone — after the answer only, and never counted. */
  function replayTurn(index: number) {
    if (!revealed || playing) return;
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
  const turnsReplayable = revealed && (recordingUrl ? cues !== null : audioAvailable);

  return (
    <div>
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
          {revealed ? (
            <label className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
              <input type="checkbox" checked={slow} onChange={(e) => setSlow(e.target.checked)} />
              {pick(lang, UI.slower)}
            </label>
          ) : (
            <span className="text-xs text-stone-400">
              {plays} / {maxReplays}
            </span>
          )}
        </div>
      ) : (
        <p className="mb-3 rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-800 dark:bg-sky-950 dark:text-sky-200">
          {pick(lang, UI.noAudio)}
        </p>
      )}
      {(!audioAvailable || revealed) && (
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
    </div>
  );
}
