import { SLOW_RATE, speakGerman, ttsAvailable } from '../lib/speech';

interface Props {
  /** German text to speak */
  text: string;
  rate?: number;
  /** turtle button: slow playback for careful listening */
  slow?: boolean;
  className?: string;
}

/** Small tap-to-hear button; renders nothing when the browser has no TTS. */
export default function SpeakerButton({ text, rate, slow = false, className = '' }: Props) {
  if (!ttsAvailable()) return null;
  return (
    <button
      type="button"
      aria-label={slow ? 'Langsam anhören' : 'Anhören'}
      title={slow ? 'Langsam anhören' : 'Anhören'}
      onClick={() => speakGerman(text, { rate: rate ?? (slow ? SLOW_RATE : undefined) })}
      className={`inline-flex min-h-10 min-w-10 items-center justify-center rounded-md align-middle text-base leading-none hover:bg-stone-100 sm:min-h-8 sm:min-w-8 dark:hover:bg-stone-700 ${className}`}
    >
      {slow ? '🐢' : '🔊'}
    </button>
  );
}
