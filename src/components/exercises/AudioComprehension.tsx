import { useEffect, useMemo, useRef, useState } from 'react';
import type { z } from 'zod';
import type { audioComprehensionItemSchema } from '../../lib/schemas';
import { speakGermanSequence, ttsAvailable } from '../../lib/speech';
import { shuffle } from '../../lib/shuffle';
import { ActionRow, Feedback, Instruction, Translation, type ItemProps } from './shared';

type AudioItem = z.infer<typeof audioComprehensionItemSchema>;

export function AudioComprehension(props: ItemProps<AudioItem>) {
  const { item, lang, onResult, locked, onNext, nextLabel } = props;
  const [chosen, setChosen] = useState<number | null>(null);
  const [plays, setPlays] = useState(0);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const cancelRef = useRef<() => void>(() => {});
  const order = useMemo(() => shuffle(item.options.map((_, i) => i)), [item]);
  const turns = item.source.kind === 'tts' ? item.source.turns : item.source.transcript;
  const audioAvailable = item.source.kind === 'asset' || ttsAvailable();
  const checked = chosen !== null;
  const correct = chosen === item.correct;

  useEffect(() => () => cancelRef.current(), []);

  function play() {
    if (!audioAvailable || playing || plays >= item.max_replays) return;
    setPlays((n) => n + 1);
    setPlaying(true);
    if (item.source.kind === 'asset') {
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = 0;
      void audio.play();
    } else {
      cancelRef.current = speakGermanSequence(
        item.source.turns.map((t) => t.text),
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
      {item.source.kind === 'asset' && (
        <audio ref={audioRef} src={item.source.src} onEnded={() => setPlaying(false)} onError={() => setPlaying(false)} />
      )}
      {audioAvailable ? (
        <div className="mb-4 flex items-center gap-3">
          <button type="button" onClick={play} disabled={playing || plays >= item.max_replays}
            className="min-h-11 rounded-md bg-stone-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 dark:bg-stone-200 dark:text-stone-900 sm:min-h-0">
            {playing ? '…' : '▶ Anhören'}
          </button>
          <span className="text-xs text-stone-400">{plays} / {item.max_replays}</span>
        </div>
      ) : (
        <p className="mb-3 rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-800 dark:bg-sky-950 dark:text-sky-200">
          {lang === 'ru' ? 'Аудио недоступно: это задание проверяет чтение.' : 'Audio unavailable: this task is scored as reading.'}
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
