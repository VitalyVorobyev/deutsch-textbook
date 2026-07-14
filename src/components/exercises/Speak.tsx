import { useEffect, useRef, useState } from 'react';
import type { z } from 'zod';
import type { speakItemSchema } from '../../lib/schemas';
import { pick } from '../../lib/prefs';
import SpeakerButton from '../SpeakerButton';
import type { CriterionAssessment } from '../../lib/store';
import { CriterionReview, Instruction, Translation, type ItemProps } from './shared';

type SpeakItem = z.infer<typeof speakItemSchema>;
type Stage = 'first' | 'reflect' | 'second' | 'reassess' | 'done';

export function Speak({ item, lang, onResult, locked, onNext, nextLabel }: ItemProps<SpeakItem>) {
  const [stage, setStage] = useState<Stage>(locked ? 'done' : 'first');
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string>();
  const [recordingError, setRecordingError] = useState(false);
  const [before, setBefore] = useState<Array<CriterionAssessment | undefined>>(item.checklist.map(() => undefined));
  const [after, setAfter] = useState<Array<CriterionAssessment | undefined>>(item.checklist.map(() => undefined));
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const canRecord = typeof window !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined';

  useEffect(() => () => {
    stream.current?.getTracks().forEach((track) => track.stop());
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

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
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(URL.createObjectURL(new Blob(chunks.current, { type: next.mimeType || 'audio/webm' })));
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
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(undefined);
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
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(undefined);
    setStage('second');
  }

  const attempted = canRecord && !recordingError ? Boolean(audioUrl) : true;

  return (
    <div>
      <Instruction text={item.instruction} lang={lang} />
      <p className="text-lg font-medium">{pick(lang, item.prompt)}</p>
      <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{pick(lang, item.goal)}</p>

      {(stage === 'first' || stage === 'second') && (
        <div className="mt-4 rounded-md border border-stone-200 p-4 dark:border-stone-700">
          <p className="mb-3 text-sm font-semibold">
            {stage === 'first'
              ? (lang === 'ru' ? 'Первая попытка' : 'First attempt')
              : (lang === 'ru' ? 'Улучшенная попытка' : 'Improved attempt')}
          </p>
          {canRecord && !recordingError ? (
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
                <>
                  <audio controls src={audioUrl} className="max-w-full" />
                  <button type="button" onClick={deleteRecording} className="text-sm font-medium text-red-700 hover:underline dark:text-red-400">
                    {lang === 'ru' ? 'Удалить запись' : 'Delete recording'}
                  </button>
                </>
              )}
            </div>
          ) : (
            <p className="text-sm text-stone-600 dark:text-stone-300">
              {lang === 'ru'
                ? 'Запись недоступна в этом браузере. Произнесите ответ вслух; задание останется самопроверкой.'
                : 'Recording is unavailable in this browser. Say the answer aloud; this remains self-checked practice.'}
            </p>
          )}
          <button type="button" onClick={finishAttempt} disabled={!attempted || recording}
            className="mt-4 min-h-11 rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
            {stage === 'first'
              ? (lang === 'ru' ? 'Сравнить с примером' : 'Compare with model')
              : (lang === 'ru' ? 'Проверить вторую попытку' : 'Check the second attempt')}
          </button>
        </div>
      )}

      {(stage === 'reflect' || stage === 'second' || stage === 'reassess' || stage === 'done') && (
        <div className="mt-4 rounded-md border border-sky-200 bg-sky-50 px-4 py-3 dark:border-sky-800 dark:bg-sky-950/40">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
              {lang === 'ru' ? 'Пример ответа' : 'Model response'}
            </p>
            <SpeakerButton text={item.model_answer} />
          </div>
          <p lang="de" className="mt-2">{item.model_answer}</p>
          <Translation text={item.model_translation} lang={lang} />
        </div>
      )}

      {stage === 'reflect' && (
        <fieldset className="mt-4 rounded-md border border-stone-200 p-4 dark:border-stone-700">
          <legend className="px-1 text-sm font-semibold">{lang === 'ru' ? 'Самопроверка' : 'Self-check'}</legend>
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
