import { useEffect, useMemo, useRef, useState } from 'react';
import type { z } from 'zod';
import type { audioComprehensionItemSchema } from '../../lib/schemas';
import { speakGermanSequence, ttsAvailable } from '../../lib/speech';
import { bundlesAudio, listeningAudioUrl } from '../../lib/audio';
import { withBase } from '../../lib/url';
import { shuffle } from '../../lib/shuffle';
import { pick } from '../../lib/prefs';
import { t } from '../../lib/strings';
import { useUiLang } from '../hooks';
import { ActionRow, Feedback, Instruction, Translation, type ItemProps } from './shared';

type AudioItem = z.infer<typeof audioComprehensionItemSchema>;

/** Explanation-language strings — one hoisted record per file (docs/i18n-design.md). */
const UI = {
  noAudio: {
    en: 'Audio unavailable: this task is scored as reading.',
    ru: 'Аудио недоступно: это задание проверяет чтение.',
  },
} as const satisfies Record<string, { en: string; ru: string }>;

export function AudioComprehension(props: ItemProps<AudioItem>) {
  const { item, lang, onResult, locked, onNext, nextLabel } = props;
  const uiLang = useUiLang();
  const [chosen, setChosen] = useState<number | null>(null);
  const [plays, setPlays] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [recordingFailed, setRecordingFailed] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const cancelRef = useRef<() => void>(() => {});
  const order = useMemo(() => shuffle(item.options.map((_, i) => i)), [item]);
  const turns = item.source.turns;
  /**
   * A reviewed recording plays only where the build shipped it. The desktop bundle sets
   * PUBLIC_ATLAS_AUDIO_BUNDLE and carries the WAVs; the web demo does not, and speaks the
   * same script through browser TTS instead. The item is identical either way — the
   * validator holds `source.turns` equal to the recording's transcript — so this changes the
   * voice, never the question or the score.
   */
  const configuredUrl = item.recording && bundlesAudio(import.meta.env.PUBLIC_ATLAS_AUDIO_BUNDLE)
    ? withBase(listeningAudioUrl(item.recording))
    : undefined;
  // A configured URL is a promise, not a guarantee: a file missing or corrupt in a shipped
  // build would otherwise leave the learner with a Play button that does nothing at all.
  // Failing over to TTS keeps the task answerable, and the fallback below stays the last resort.
  const recordingUrl = recordingFailed ? undefined : configuredUrl;
  const audioAvailable = recordingUrl !== undefined || ttsAvailable();
  const checked = chosen !== null;
  const correct = chosen === item.correct;

  useEffect(() => () => cancelRef.current(), []);

  function play() {
    if (!audioAvailable || playing || plays >= item.max_replays) return;
    setPlays((n) => n + 1);
    setPlaying(true);
    if (recordingUrl) {
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = 0;
      void audio.play();
    } else {
      cancelRef.current = speakGermanSequence(
        turns.map((t) => t.text),
        { rate: item.source.rate },
        () => setPlaying(false),
      );
    }
  }

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
          src={recordingUrl}
          onEnded={() => setPlaying(false)}
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
          <button type="button" onClick={play} disabled={playing || plays >= item.max_replays}
            className="min-h-11 rounded-md bg-stone-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 dark:bg-stone-200 dark:text-stone-900 sm:min-h-0">
            {playing ? '…' : t('action.play', uiLang)}
          </button>
          <span className="text-xs text-stone-400">{plays} / {item.max_replays}</span>
        </div>
      ) : (
        <p className="mb-3 rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-800 dark:bg-sky-950 dark:text-sky-200">
          {pick(lang, UI.noAudio)}
        </p>
      )}
      {(!audioAvailable || checked) && (
        <div className="mb-4 space-y-1 rounded-md border border-stone-200 p-3 text-sm dark:border-stone-700">
          {turns.map((turn, i) => <p key={i} lang="de"><strong>{turn.speaker}:</strong> {turn.text}</p>)}
        </div>
      )}
      <p lang="de" className="mb-3 text-lg font-medium">{item.question}</p>
      <div className="space-y-2">
        {order.map((index) => (
          <button key={index} type="button" disabled={checked} onClick={() => choose(index)}
            className={`block min-h-11 w-full rounded-md border px-4 py-2 text-left ${checked && index === item.correct ? 'border-green-500 bg-green-50 dark:bg-green-950' : checked && index === chosen ? 'border-red-500 bg-red-50 dark:bg-red-950' : 'border-stone-300 hover:border-amber-500 dark:border-stone-600'}`}>
            {item.options[index]}
          </button>
        ))}
      </div>
      <Translation text={item.translation} lang={lang} />
      <ActionRow checked={checked} correct={correct} onNext={onNext} nextLabel={nextLabel} />
      {checked && <Feedback correct={correct} correctAnswer={item.options[item.correct]} explain={item.explain} lang={lang} />}
    </div>
  );
}
