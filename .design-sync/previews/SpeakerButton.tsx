import { SpeakerButton } from 'deutsch-atlas';

// Renders nothing at all when the browser has no speechSynthesis, so it never
// leaves a dead control on the page. The turtle variant plays the same text at
// SLOW_RATE for careful listening.

/** The normal tap-to-hear button. */
export function Default() {
  return <SpeakerButton text="Wir sind am Sonntag nach Berlin gefahren." />;
}

/** The turtle button: slow playback. */
export function Slow() {
  return <SpeakerButton text="Wir sind am Sonntag nach Berlin gefahren." slow />;
}

/** Both offered together, which is the usual pairing. */
export function BothRates() {
  return (
    <div className="flex items-center gap-1">
      <SpeakerButton text="Wir sind am Sonntag nach Berlin gefahren." />
      <SpeakerButton text="Wir sind am Sonntag nach Berlin gefahren." slow />
    </div>
  );
}

/** Beside the German sentence it speaks — how it is actually composed. */
export function BesideASentence() {
  return (
    <blockquote className="max-w-xl border-l-4 border-amber-400 bg-amber-50 px-4 py-1 not-italic dark:border-amber-500 dark:bg-stone-800">
      <p lang="de" className="flex flex-wrap items-center gap-1">
        Wir sind am Sonntag nach Berlin gefahren.
        <SpeakerButton text="Wir sind am Sonntag nach Berlin gefahren." />
        <SpeakerButton text="Wir sind am Sonntag nach Berlin gefahren." slow />
      </p>
    </blockquote>
  );
}
