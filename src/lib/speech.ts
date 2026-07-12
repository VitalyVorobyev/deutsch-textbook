/**
 * Browser TTS for German — no dependencies, works over plain HTTP (LAN dev
 * server on a phone included). All functions are safe to import server-side.
 */

let voices: SpeechSynthesisVoice[] = [];
let listenerAttached = false;
let warnedNoGerman = false;

export function ttsAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function refreshVoices(): void {
  voices = window.speechSynthesis.getVoices();
}

function ensureVoiceListener(): void {
  if (listenerAttached || !ttsAvailable()) return;
  listenerAttached = true;
  refreshVoices();
  window.speechSynthesis.addEventListener('voiceschanged', refreshVoices);
}

/**
 * Best available German voice, cached. Browsers (Safari especially) populate
 * the voice list lazily, so we refresh on 'voiceschanged' and retry on every
 * call while the list is still empty.
 */
export function bestGermanVoice(): SpeechSynthesisVoice | undefined {
  if (!ttsAvailable()) return undefined;
  ensureVoiceListener();
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

/**
 * Speak German text aloud. Cancels any current utterance first (Safari queues
 * otherwise). When the voice list has not arrived yet (Chrome fills it
 * asynchronously), speaking immediately would bind the default — often
 * English — voice, so we wait one bounded 'voiceschanged' tick first.
 */
export function speakGerman(text: string, opts: { rate?: number } = {}): void {
  if (!ttsAvailable()) return;
  ensureVoiceListener();
  if (voices.length === 0) refreshVoices();
  if (voices.length === 0) {
    let done = false;
    const onReady = () => {
      if (done) return;
      done = true;
      window.speechSynthesis.removeEventListener('voiceschanged', onReady);
      speakNow(text, opts);
    };
    window.speechSynthesis.addEventListener('voiceschanged', onReady);
    // iOS never fires voiceschanged before the first speak — don't wait forever.
    window.setTimeout(onReady, 300);
    return;
  }
  speakNow(text, opts);
}

function speakNow(text: string, opts: { rate?: number }): void {
  const u = new SpeechSynthesisUtterance(text);
  // lang is set even when no voice matched — iOS then picks its own German
  // voice (its getVoices() often stays empty until after the first speak).
  u.lang = 'de-DE';
  const voice = bestGermanVoice();
  if (voice) u.voice = voice;
  else if (voices.length > 0 && !warnedNoGerman) {
    warnedNoGerman = true;
    console.warn(
      'deutsch-atlas: no German TTS voice installed — the browser will read German with its default voice.',
    );
  }
  u.rate = opts.rate ?? 0.9;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

/** Speak several dialogue turns in order with one reliable German voice.
    Returns a cancel function; callers must not assume multiple voices exist. */
export function speakGermanSequence(
  texts: readonly string[],
  opts: { rate?: number } = {},
  onDone?: () => void,
): () => void {
  if (!ttsAvailable() || texts.length === 0) return () => {};
  ensureVoiceListener();
  if (voices.length === 0) refreshVoices();
  window.speechSynthesis.cancel();
  let cancelled = false;
  let index = 0;
  let stopWaiting: (() => void) | undefined;
  const next = () => {
    if (cancelled || index >= texts.length) {
      if (!cancelled) onDone?.();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(texts[index++]!);
    utterance.lang = 'de-DE';
    const voice = bestGermanVoice();
    if (voice) utterance.voice = voice;
    utterance.rate = opts.rate ?? 0.9;
    utterance.onend = next;
    utterance.onerror = next;
    window.speechSynthesis.speak(utterance);
  };

  if (voices.length === 0) {
    let started = false;
    const onReady = () => {
      if (started) return;
      started = true;
      stopWaiting?.();
      if (!cancelled) next();
    };
    window.speechSynthesis.addEventListener('voiceschanged', onReady);
    const timeout = window.setTimeout(onReady, 300);
    stopWaiting = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', onReady);
      window.clearTimeout(timeout);
    };
  } else {
    next();
  }

  return () => {
    cancelled = true;
    stopWaiting?.();
    window.speechSynthesis.cancel();
  };
}
