/**
 * Browser TTS for German — no dependencies, works over plain HTTP (LAN dev
 * server on a phone included). All functions are safe to import server-side.
 */

let voices: SpeechSynthesisVoice[] = [];
let listenerAttached = false;

export function ttsAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function refreshVoices(): void {
  voices = window.speechSynthesis.getVoices();
}

/**
 * Best available German voice, cached. Browsers (Safari especially) populate
 * the voice list lazily, so we refresh on 'voiceschanged' and retry on every
 * call while the list is still empty.
 */
export function bestGermanVoice(): SpeechSynthesisVoice | undefined {
  if (!ttsAvailable()) return undefined;
  if (!listenerAttached) {
    listenerAttached = true;
    window.speechSynthesis.addEventListener('voiceschanged', refreshVoices);
  }
  if (voices.length === 0) refreshVoices();
  const de = voices.filter((v) => v.lang.toLowerCase().startsWith('de'));
  return (
    de.find((v) => v.lang === 'de-DE' && v.default) ??
    de.find((v) => v.lang === 'de-DE' && v.localService) ??
    de.find((v) => v.lang === 'de-DE') ??
    de[0]
  );
}

export const SLOW_RATE = 0.7;

/** Speak German text aloud. Cancels any current utterance first (Safari queues otherwise). */
export function speakGerman(text: string, opts: { rate?: number } = {}): void {
  if (!ttsAvailable()) return;
  const u = new SpeechSynthesisUtterance(text);
  // lang is set even when no voice matched — iOS then picks its own German
  // voice (its getVoices() often stays empty until after the first speak).
  u.lang = 'de-DE';
  const voice = bestGermanVoice();
  if (voice) u.voice = voice;
  u.rate = opts.rate ?? 0.9;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}
