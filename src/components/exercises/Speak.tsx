import { useEffect, useRef, useState } from 'react';
import type { z } from 'zod';
import type { speakItemSchema } from '../../lib/schemas';
import { pick, type ExplainLang } from '../../lib/prefs';
import SpeakerButton from '../SpeakerButton';
import { Instruction, Translation, type ItemProps } from './shared';

type SpeakItem = z.infer<typeof speakItemSchema>;
type Stage = 'attempt' | 'compare';

/** Explanation-language strings — one hoisted record per file (docs/i18n-design.md). */
const UI = {
  playing: { en: 'Playing your recording…', ru: 'Играет ваша запись…' },
  listenBack: { en: 'Listen to your recording', ru: 'Прослушайте свою запись' },
  record: { en: 'Record', ru: 'Записать' },
  recordAgain: { en: 'Record again', ru: 'Записать ещё раз' },
  stop: { en: 'Stop', ru: 'Остановить' },
  speakHint: {
    en: 'Say your answer out loud — recording is optional and plays back as soon as you stop.',
    ru: 'Скажите ответ вслух — запись по желанию, она проигрывается сразу после остановки.',
  },
  noRecording: {
    en: 'Recording is unavailable in this browser. Just say the answer aloud.',
    ru: 'Запись недоступна в этом браузере. Просто произнесите ответ вслух.',
  },
  yourRecording: { en: 'Your recording', ru: 'Ваша запись' },
  showModel: { en: 'Show model', ru: 'Показать пример' },
  modelResponse: { en: 'Model response', ru: 'Пример ответа' },
  checkYourself: { en: 'Check for yourself', ru: 'Проверьте себя' },
  privacyNote: {
    en: 'The recording stayed in this tab and does not affect your score.',
    ru: 'Запись осталась только в этой вкладке и не влияет на оценку.',
  },
} as const satisfies Record<string, { en: string; ru: string }>;

/**
 * Deliberately minimal ceremony: the app cannot verify free speech, so it never
 * charges steps for feedback it cannot give. The flow is speak (recording
 * optional) → one press → model answer beside the learner's own take. The
 * checklist renders as guidance text, never as a gated form.
 */

/**
 * A labeled player for the learner's take. `autoPlay` starts playback as soon as
 * the take exists — hearing yourself back is the one real feedback this exercise
 * has, so it must not hide behind a small native control. Autoplay can be
 * refused (the `onstop` handler runs after the Stop click's transient user
 * activation may have expired, especially in WKWebView), so a refusal falls back
 * to a prominent play button rather than a silent nothing.
 */
function RecordingPlayer({ src, label, lang, played }: {
  src: string;
  label: string;
  lang: ExplainLang;
  /**
   * Takes that already auto-played, shared across the stage change: a new take
   * plays immediately wherever it was recorded, while the player remounting on
   * another screen does not replay a take the learner has already heard.
   */
  played: Set<string>;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const el = audio.current;
    if (!el || played.has(src)) return;
    played.add(src);
    let cancelled = false;
    el.play().catch(() => { if (!cancelled) setBlocked(true); });
    return () => { cancelled = true; };
  }, [src, played]);

  return (
    <div className="min-w-0 flex-1 rounded-md border border-stone-200 px-3 py-2 dark:border-stone-700">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">{label}</p>
      <audio
        ref={audio}
        controls
        src={src}
        aria-label={label}
        className="mt-2 w-full max-w-full"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
      {playing && (
        <p className="mt-1 text-xs text-stone-500 dark:text-stone-400" role="status">
          {pick(lang, UI.playing)}
        </p>
      )}
      {blocked && (
        <button
          type="button"
          onClick={() => {
            setBlocked(false);
            void audio.current?.play().catch(() => setBlocked(true));
          }}
          className="mt-2 min-h-11 rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
        >
          ▶ {pick(lang, UI.listenBack)}
        </button>
      )}
    </div>
  );
}

export function Speak({ item, lang, onResult, locked, onNext, nextLabel }: ItemProps<SpeakItem>) {
  const [stage, setStage] = useState<Stage>(locked ? 'compare' : 'attempt');
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string>();
  const [recordingError, setRecordingError] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  // Every object URL ever created, revoked only on unmount — a take must survive
  // re-records and the stage change so the compare screen can keep playing it.
  const urls = useRef<Set<string>>(new Set());
  // State, not a ref, because it is read during render (passed as a prop); the
  // Set identity is stable and only its contents mutate, inside effects.
  const [played] = useState(() => new Set<string>());
  const canRecord = typeof window !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined';

  useEffect(() => () => {
    stream.current?.getTracks().forEach((track) => track.stop());
    urls.current.forEach((url) => URL.revokeObjectURL(url));
    urls.current.clear();
  }, []);

  async function startRecording() {
    if (!canRecord || recording) return;
    let media: MediaStream;
    try {
      media = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setRecordingError(true);
      return;
    }
    stream.current = media;
    chunks.current = [];
    const next = new MediaRecorder(media);
    recorder.current = next;
    next.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
    next.onstop = () => {
      const url = URL.createObjectURL(new Blob(chunks.current, { type: next.mimeType || 'audio/webm' }));
      urls.current.add(url);
      setAudioUrl(url);
      media.getTracks().forEach((track) => track.stop());
      setRecording(false);
    };
    next.start();
    setRecording(true);
  }

  function stopRecording() {
    if (recorder.current?.state === 'recording') recorder.current.stop();
  }

  function showModel() {
    if (recording) return;
    setStage('compare');
    onResult({
      correct: true,
      given: '',
      evidence: 'practice',
      responseMode: item.mode,
      practice: { kind: 'speaking', recorded: Boolean(audioUrl) },
    });
  }

  const supported = canRecord && !recordingError;
  const recordControls = supported && (
    <div className="flex flex-wrap items-center gap-3">
      {!recording ? (
        <button type="button" onClick={() => void startRecording()} className="min-h-11 rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800">
          ● {audioUrl ? pick(lang, UI.recordAgain) : pick(lang, UI.record)}
        </button>
      ) : (
        <button type="button" onClick={stopRecording} className="min-h-11 rounded-md bg-stone-800 px-4 py-2 text-sm font-semibold text-white dark:bg-stone-200 dark:text-stone-900">
          ■ {pick(lang, UI.stop)}
        </button>
      )}
    </div>
  );

  return (
    <div>
      <Instruction text={item.instruction} lang={lang} />
      <p className="text-lg font-medium">{pick(lang, item.prompt)}</p>
      <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{pick(lang, item.goal)}</p>

      {stage === 'attempt' && (
        <div className="mt-4 rounded-md border border-stone-200 p-4 dark:border-stone-700">
          <p className="mb-3 text-sm text-stone-500 dark:text-stone-400">
            {supported ? pick(lang, UI.speakHint) : pick(lang, UI.noRecording)}
          </p>
          {recordControls}
          {audioUrl && (
            <div className="mt-3">
              <RecordingPlayer
                src={audioUrl}
                label={pick(lang, UI.yourRecording)}
                lang={lang}
                played={played}
              />
            </div>
          )}
          <button type="button" onClick={showModel} disabled={recording}
            className="mt-4 min-h-11 rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
            {pick(lang, UI.showModel)}
          </button>
        </div>
      )}

      {stage === 'compare' && (
        <>
          <div className="mt-4 flex flex-wrap items-stretch gap-3">
            {audioUrl && (
              <RecordingPlayer
                src={audioUrl}
                label={pick(lang, UI.yourRecording)}
                lang={lang}
                played={played}
              />
            )}
            <div className="min-w-0 flex-1 rounded-md border border-sky-200 bg-sky-50 px-4 py-3 dark:border-sky-800 dark:bg-sky-950/40">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                  {pick(lang, UI.modelResponse)}
                </p>
                <SpeakerButton text={item.model_answer} />
              </div>
              <p lang="de" className="mt-2">{item.model_answer}</p>
              <Translation text={item.model_translation} lang={lang} />
            </div>
          </div>

          <div className="mt-4 rounded-md border border-stone-200 p-4 dark:border-stone-700">
            <p className="text-sm font-semibold">{pick(lang, UI.checkYourself)}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-stone-600 dark:text-stone-300">
              {item.checklist.map((entry, index) => <li key={index}>{pick(lang, entry)}</li>)}
            </ul>
            {!locked && supported && (
              <div className="mt-3">
                {recordControls}
              </div>
            )}
          </div>

          <div className="mt-4">
            <p className="mb-3 text-xs text-stone-500 dark:text-stone-400">
              {pick(lang, UI.privacyNote)}
            </p>
            <button type="button" onClick={onNext} className="min-h-11 rounded-md bg-stone-800 px-4 py-2 text-sm font-semibold text-white dark:bg-stone-200 dark:text-stone-900">{nextLabel}</button>
          </div>
        </>
      )}
    </div>
  );
}
