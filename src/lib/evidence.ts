import type { ExerciseItem } from './schemas';
import type { Attempt } from './store';

export type ResponseMode = NonNullable<Attempt['responseMode']>;

/** The channel the learner actually used; curriculum outcomes may target a different CEFR mode. */
export function responseModeForItem(item: ExerciseItem): ResponseMode {
  switch (item.type) {
    case 'mc':
    case 'match':
      return 'selection';
    case 'audio-comprehension':
    case 'listen':
      return 'listening';
    case 'speak':
      return item.mode;
    case 'cloze':
    case 'order':
    case 'table':
    case 'translate':
    case 'write':
      return 'writing';
  }
}
