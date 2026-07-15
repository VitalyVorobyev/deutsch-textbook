import { useEffect, useRef, useState } from 'react';
import type { z } from 'zod';
import type { speakItemSchema } from '../../lib/schemas';
import { pick, type ExplainLang } from '../../lib/prefs';
import SpeakerButton from '../SpeakerButton';
import type { CriterionAssessment } from '../../lib/store';
import { CriterionReview, Instruction, Translation, type ItemProps } from './shared';

type SpeakItem = z.infer<typeof speakItemSchema>;
type Stage = 'first' | 'reflect' | 'second' | 'reassess' | 'done';

/**
 * A labeled player for one take. `autoPlay` starts playback as soon as the take
 * exists — the listen-back is the feedback this exercise has, so it must not hide
 * behind a small native control. Autoplay can be refused (the `onstop` handler
 * runs after the Stop click's transient user activation may have expired,
 * especially in WKWebView), so a refusal falls back to a prominent play button
 * rather than a silent nothing.
 */
function RecordingPlayer({ src, label, lang, autoPlay = false, onEnded }: {
  src: string;
  label: string;
  lang: ExplainLang;
  autoPlay?: boolean;
  onEnded?: () => void;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!autoPlay) return;
    const el = audio.current;
    if (!el) return;
    let cancelled = false;
    el.play().catch(() => { if (!cancelled) setBlocked(true); });
    return () => { cancelled = true; };
  }, [src, autoPlay]);

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
        onEnded={() => { setPlaying(false); onEnded?.(); }}
      />
      {playing && (
        <p className="mt-1 text-xs text-stone-500 dark:text-stone-400" role="status">
          {lang === 'ru' ? 'Играет ваша запись…' : 'Playing your recording…'}
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
          ▶ {lang === 'ru' ? 'Прослушайте свою запись' : 'Listen to your recording'}
        </button>
      )}
    </div>
  );
}

export function Speak({ item, lang, onResult, locked, onNext, nextLabel }: ItemProps<SpeakItem>) {
  const [stage, setStage] = useState<Stage>(locked ? 'done' : 'first');
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string>();
  const [firstAudioUrl, setFirstAudioUrl] = useState<string>();
  // The current take has been heard to the end at least once. Listening is the
  // exercise's entire feedback loop, so advancing is gated on it (below).
  const [listened, setListened] = useState(false);
  const [recordingError, setRecordingError] = useState(false);
  const [before, setBefore] = useState<Array<CriterionAssessment | undefined>>(item.checklist.map(() => undefined));
  const [after, setAfter] = useState<Array<CriterionAssessment | undefined>>(item.checklist.map(() => undefined));
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  // Every object URL ever created, revoked only on unmount — the first take must
  // outlive re-records and stage changes so reassess can compare both takes.
  const urls = useRef<Set<string>>(new Set());
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
      setListened(false);
      media.getTracks().forEach((track) => track.stop());
      setRecording(false);
    };
    next.start();
    setRecording(true);
  }

  function stopRecording() {
    if (recorder.current?.state === 'recording') recorder.current.stop();
  }

  function deleteRecording() {
    setAudioUrl(undefined);
    setListened(false);
  }

  function finishAttempt() {
    if (stage === 'first') {
      setStage('reflect');
      return;
    }
    if (stage === 'second') {
      setStage('reassess');
      return;
    }
    if (stage !== 'reassess' || !after.every(Boolean)) return;
    setStage('done');
    onResult({
      correct: true,
      given: '',
      evidence: 'practice',
      responseMode: item.mode,
      practice: {
        kind: 'speaking',
        recorded: canRecord && !recordingError,
        before: before as CriterionAssessment[],
        after: after as CriterionAssessment[],
      },
    });
  }

  function beginSecondAttempt() {
    if (!before.every(Boolean)) return;
    // Keep the first take: "did the second attempt improve?" is unanswerable
    // from memory, so reassess plays both takes against the model.
    setFirstAudioUrl(audioUrl);
    setAudioUrl(undefined);
    setListened(false);
    setStage('second');
  }

  const attempted = canRecord && !recordingError ? Boolean(audioUrl) : true;
  const mustListen = Boolean(audioUrl) && !listened;
  const yourRecording = lang === 'ru' ? 'Ваша запись' : 'Your recording';
  const firstRecording = lang === 'ru' ? 'Первая запись' : 'First recording';
  const improvedRecording = lang === 'ru' ? 'Улучшенная запись' : 'Improved recording';

  return (
    <div>
      <Instruction text={item.instruction} lang={lang} />
      <p className="text-lg font-medium">{pick(lang, item.prompt)}</p>
      <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{pick(lang, item.goal)}</p>

      {(stage === 'first' || stage === 'second') && (
        <div className="mt-4 rounded-md border border-stone-200 p-4 dark:border-stone-700">
          <p className="mb-1 text-sm font-semibold">
            {stage === 'first'
              ? (lang === 'ru' ? 'Первая попытка' : 'First attempt')
              : (lang === 'ru' ? 'Улучшенная попытка' : 'Improved attempt')}
          </p>
          {canRecord && !recordingError ? (
            <>
              <p className="mb-3 text-sm text-stone-500 dark:text-stone-400">
                {lang === 'ru'
                  ? 'Запишите себя, прослушайте запись, затем сравните с примером.'
                  : 'Record yourself, listen back, then compare with the model.'}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                {!recording ? (
                  <button type="button" onClick={() => void startRecording()} className="min-h-11 rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800">
                    ● {lang === 'ru' ? 'Записать' : 'Record'}
                  </button>
                ) : (
                  <button type="button" onClick={stopRecording} className="min-h-11 rounded-md bg-stone-800 px-4 py-2 text-sm font-semibold text-white dark:bg-stone-200 dark:text-stone-900">
                    ■ {lang === 'ru' ? 'Остановить' : 'Stop'}
                  </button>
                )}
                {audioUrl && (
                  <button type="button" onClick={deleteRecording} className="text-sm font-medium text-red-700 hover:underline dark:text-red-400">
                    {lang === 'ru' ? 'Удалить запись' : 'Delete recording'}
                  </button>
                )}
              </div>
              {audioUrl && (
                <div className="mt-3">
                  <RecordingPlayer
                    src={audioUrl}
                    label={yourRecording}
                    lang={lang}
                    autoPlay
                    onEnded={() => setListened(true)}
                  />
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-stone-600 dark:text-stone-300">
              {lang === 'ru'
                ? 'Запись недоступна в этом браузере. Произнесите ответ вслух; задание останется самопроверкой.'
                : 'Recording is unavailable in this browser. Say the answer aloud; this remains self-checked practice.'}
            </p>
          )}
          <button type="button" onClick={finishAttempt} disabled={!attempted || recording || mustListen}
            className="mt-4 min-h-11 rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
            {stage === 'first'
              ? (lang === 'ru' ? 'Сравнить с примером' : 'Compare with model')
              : (lang === 'ru' ? 'Проверить вторую попытку' : 'Check the second attempt')}
          </button>
          {mustListen && !recording && (
            <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
              {lang === 'ru'
                ? 'Сначала прослушайте свою запись до конца — это и есть обратная связь.'
                : 'Listen to your recording to the end first — that is the feedback.'}
            </p>
          )}
        </div>
      )}

      {(stage === 'reflect' || stage === 'second' || stage === 'reassess' || stage === 'done') && (
        <div className="mt-4 flex flex-wrap items-stretch gap-3">
          {stage === 'reflect' && audioUrl && (
            <RecordingPlayer src={audioUrl} label={yourRecording} lang={lang} />
          )}
          {stage !== 'reflect' && firstAudioUrl && (
            <RecordingPlayer src={firstAudioUrl} label={firstRecording} lang={lang} />
          )}
          {(stage === 'reassess' || stage === 'done') && audioUrl && (
            <RecordingPlayer src={audioUrl} label={improvedRecording} lang={lang} />
          )}
          <div className="min-w-0 flex-1 rounded-md border border-sky-200 bg-sky-50 px-4 py-3 dark:border-sky-800 dark:bg-sky-950/40">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                {lang === 'ru' ? 'Пример ответа' : 'Model response'}
              </p>
              <SpeakerButton text={item.model_answer} />
            </div>
            <p lang="de" className="mt-2">{item.model_answer}</p>
            <Translation text={item.model_translation} lang={lang} />
          </div>
        </div>
      )}

      {stage === 'reflect' && (
        <fieldset className="mt-4 rounded-md border border-stone-200 p-4 dark:border-stone-700">
          <legend className="px-1 text-sm font-semibold">{lang === 'ru' ? 'Самопроверка' : 'Self-check'}</legend>
          {audioUrl && (
            <p className="mb-3 text-sm text-stone-500 dark:text-stone-400">
              {lang === 'ru'
                ? 'Включите свою запись и пример, прежде чем оценивать пункты.'
                : 'Play your recording and the model before judging each point.'}
            </p>
          )}
          <CriterionReview entries={item.checklist} values={before} onChange={setBefore} lang={lang} />
          <button type="button" onClick={beginSecondAttempt} disabled={!before.every(Boolean)} className="mt-4 min-h-11 rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
            {lang === 'ru' ? 'Попробовать ещё раз' : 'Try an improved version'}
          </button>
        </fieldset>
      )}

      {stage === 'reassess' && <fieldset className="mt-4 rounded-md border border-stone-200 p-4 dark:border-stone-700">
        <legend className="px-1 text-sm font-semibold">{lang === 'ru' ? 'Проверьте вторую попытку' : 'Check the second attempt'}</legend>
        <CriterionReview entries={item.checklist} values={after} onChange={setAfter} lang={lang} />
        <button type="button" onClick={finishAttempt} disabled={!after.every(Boolean)} className="mt-4 min-h-11 rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
          {lang === 'ru' ? 'Сохранить попытку' : 'Save attempt'}
        </button>
      </fieldset>}

      {stage === 'done' && (
        <div className="mt-4">
          <p className="mb-3 text-xs text-stone-500 dark:text-stone-400">
            {lang === 'ru' ? 'Запись осталась только в этой вкладке и не влияет на оценку.' : 'The recording stayed in this tab and does not affect your score.'}
          </p>
          <button type="button" onClick={onNext} className="min-h-11 rounded-md bg-stone-800 px-4 py-2 text-sm font-semibold text-white dark:bg-stone-200 dark:text-stone-900">{nextLabel}</button>
        </div>
      )}
    </div>
  );
}
