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
 * **Both shipping builds set it.** It began as the desktop/web split — the desktop app carried the
 * recordings and the public demo spoke browser TTS — and that is no longer what it means: the
 * corpus is 14.2 MB against a 69 MB site, so withholding it from Pages bought nothing and cost the
 * demo the audio it was built to show. What the flag distinguishes now is a *shipping* build from
 * a lean one: unset, the site carries no binaries at all, which is what a quick preview or a
 * bandwidth-limited mirror wants. The TTS path is not dead either way — it remains the live
 * fallback whenever a recording is absent or fails to load (`onError` in `AudioComprehension`).
 */
export const AUDIO_BUNDLE_ENV = 'PUBLIC_ATLAS_AUDIO_BUNDLE';

/**
 * Truthy for `1` and `true`; anything else — unset included — means this build ships no audio.
 *
 * Read it at the call site as `import.meta.env.PUBLIC_ATLAS_AUDIO_BUNDLE`, spelled out. Vite
 * substitutes that expression literally at build time and does **not** see through a computed
 * index, so `import.meta.env[AUDIO_BUNDLE_ENV]` would silently be `undefined` in the browser
 * bundle and every recording would fall back to TTS in a build that shipped the WAVs.
 */
export const bundlesAudio = (value: string | undefined): boolean => value === '1' || value === 'true';

/** The URL a built site serves a reviewed recording at, before `withBase`. */
export const listeningAudioUrl = (id: string): string => `/audio/${id}.mp3`;

/** Reviewed long-form narration uses a separate namespace from dialogue recordings. */
export const readingAudioUrl = (level: string, id: string): string =>
  `/audio/readings/${level.toLowerCase()}/${id}.mp3`;
