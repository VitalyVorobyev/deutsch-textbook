import type { ExerciseItem } from '@da/schema';
import type { RecordingScript } from './audio';

/**
 * Which recording a listening question is answered from, as an identity shared by every question
 * on it: the reviewed recording's id, or, for an item that only ever speaks through TTS, its
 * script. Null for an item that plays nothing.
 *
 * Several `audio-comprehension` items carry the same `recording` (a `-hoeren` set asks two or
 * three questions about one dialogue). Each item mounts a player of its own and is unmounted when
 * the next one opens, so the play budget and the moment of reveal belong to the run that serves
 * the items, keyed by this — never to the player, which would start every question afresh.
 */
export function recordingKeyOf(item: ExerciseItem, setRecording?: RecordingScript): string | null {
  if (item.type !== 'audio-comprehension') return null;
  if (item.recording) return item.recording;
  const turns = item.source?.turns ?? setRecording?.turns;
  if (!item.source && setRecording?.id) return setRecording.id;
  return turns ? `tts:${turns.map((turn) => `${turn.speaker}: ${turn.text}`).join('\n')}` : null;
}

/**
 * Whether the question at `index` is the run's last on its recording: the transcript of a
 * recording is shown only once its last question is answered, because until then it holds the
 * answer to a question still open. A run is whatever the learner is served in order — a set, a
 * mixed-training session, a probe step — so a question served without its siblings reveals at
 * once, and one whose sibling comes later in the same session does not.
 */
export function isLastOnRecording(keys: readonly (string | null)[], index: number): boolean {
  const key = keys[index];
  if (key === null || key === undefined) return true;
  return !keys.slice(index + 1).includes(key);
}
