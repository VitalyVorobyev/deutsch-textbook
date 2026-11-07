/**
 * Which build ships the reviewed listening recordings, and where they are served from.
 *
 * Client-safe on purpose: `AudioComprehension.tsx` and the build integration must agree on
 * one flag and one URL shape, and the component cannot import the integration (it reaches
 * for `node:fs`). Both import this instead.
 *
 * The served path is flat — `/audio/<id>.mp3` — while the source tree keeps the level
 * directory (`content/listening/<level>/<id>.mp3`) like every other content collection.
 * Artifact ids are globally unique by validated construction: `data/listening-plan.yaml`
 * rejects a duplicate id, every committed artifact must be planned, and the validator rejects
 * a duplicate on load. So the level buys nothing at runtime and would have to be threaded
 * through the item, which does not carry it.
 */

/**
 * Vite exposes only `PUBLIC_`-prefixed variables to client code, and the component needs it.
 *
 * **A build ships the recordings unless it is told not to.** The flag used to be opt-in, set by
 * the desktop release and by an environment variable in the Cloudflare dashboard. The dashboard
 * variable went missing, nothing in the repository could see that, and the public site served
 * browser TTS over every reviewed recording while every gate stayed green. So the default is now
 * the shipping build, and `0` or `false` asks for a lean one with no binaries, which is what a
 * quick preview or a bandwidth-limited mirror wants. The TTS path is not dead either way: it
 * remains the live fallback whenever a recording is absent or fails to load (`onError` in
 * `AudioComprehension`).
 */
export const AUDIO_BUNDLE_ENV = 'PUBLIC_ATLAS_AUDIO_BUNDLE';

/**
 * False for `0` and `false`; anything else, unset included, means this build ships the audio.
 *
 * Read it at the call site as `import.meta.env.PUBLIC_ATLAS_AUDIO_BUNDLE`, spelled out. Vite
 * substitutes that expression literally at build time and does **not** see through a computed
 * index, so `import.meta.env[AUDIO_BUNDLE_ENV]` would be `undefined` in the browser bundle and
 * the component and the copy step could disagree.
 */
export const bundlesAudio = (value: string | undefined): boolean =>
  value !== '0' && value !== 'false';

/** The URL a built site serves a reviewed recording at, before `withBase`. */
export const listeningAudioUrl = (id: string): string => `/audio/${id}.mp3`;

/** Where a shipped recording's turn cues are served, beside its MP3, before `withBase`. */
export const listeningCuesUrl = (id: string): string => `/audio/${id}.cues.json`;

/** Reviewed long-form narration uses a separate namespace from dialogue recordings. */
export const readingAudioUrl = (level: string, id: string): string =>
  `/audio/readings/${level.toLowerCase()}/${id}.mp3`;

/**
 * A recording as a player needs it: its id, which names the MP3 and cue files, and the turns that
 * are both the transcript shown after the answer and the browser-TTS fallback. An
 * `audio-comprehension` item builds one from its own `source`; a task set from its set recording.
 */
export interface RecordingScript {
  /** the reviewed recording's id; absent for an item that only ever speaks through TTS */
  id?: string;
  turns: readonly { speaker: string; text: string }[];
  /** browser-TTS rate for the fallback voice */
  rate?: number;
}
