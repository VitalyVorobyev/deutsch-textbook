/**
 * "Meine Fehler" on a topic page: the items of the topic the learner last answered wrong, each
 * with what they wrote and what was expected. It is read off the attempt log and shown; it feeds
 * no tier, no weakness signal and no queue — `src/lib/weakness.ts` and `src/lib/training.ts` own
 * those.
 *
 * Two halves, because a page never ships a set twice: `mistakeCatalog` runs at build time and
 * keeps, per item, only what the block prints; `ownMistakes` joins it to the log in the browser.
 */
import type { Bilingual, ExerciseItem } from '@da/schema';
import { fillCloze, normalizeSentence, normalizeTranslation, parseCloze } from '@da/grading/cloze';
import { translationCandidates } from '@da/grading/production';

export interface MistakeEntry {
  setId: string;
  itemId: string;
  revision?: number;
  /** the sentence's meaning, or the question asked; what the answer was an answer to */
  prompt?: Bilingual;
  /** an `mc` question, German */
  promptDe?: string;
  /** a cloze text, so the learner's gap values can be shown inside their sentence */
  cloze?: string;
  /** the expected answer, as a whole sentence wherever the item has one */
  correct: string;
  /** a `translate` item's accepted renderings, normalized — an answer among them is no mistake */
  accepted?: string[];
  explain?: Bilingual;
}

export interface OwnMistake {
  entry: MistakeEntry;
  /** what the learner wrote, as a whole sentence wherever the item has one; '' when left empty */
  given: string;
  ts: number;
}

type CatalogSet = { id: string; items: readonly ExerciseItem[] };

/**
 * What the block can print for an item, or nothing. Four types have an answer that reads as one
 * line beside the learner's own: a table or a match is many cells, and dictation, writing and
 * speaking are not errors of this topic's rule.
 */
function entryFor(setId: string, item: ExerciseItem): MistakeEntry | undefined {
  const base = { setId, itemId: item.id, revision: item.revision, explain: item.explain };
  switch (item.type) {
    case 'translate':
      return {
        ...base,
        prompt: {
          en: item.prompt_en,
          ru: item.prompt_ru,
          ...(item.prompt_uk ? { uk: item.prompt_uk } : {}),
        },
        correct: item.answer,
        accepted: translationCandidates(item).map(normalizeTranslation),
      };
    case 'cloze':
      return {
        ...base,
        prompt: item.translation,
        cloze: item.text,
        correct: parseCloze(item.text)
          .map((part) => (part.type === 'text' ? part.value : part.answers[0]))
          .join(''),
      };
    case 'mc':
      return {
        ...base,
        prompt: item.translation,
        promptDe: item.prompt,
        correct: item.options[item.correct] ?? '',
      };
    case 'order':
      return { ...base, prompt: item.translation, correct: normalizeSentence(item.words) };
    default:
      return undefined;
  }
}

/** Every item of these sets the block can print, in set and item order. */
export function mistakeCatalog(sets: readonly CatalogSet[]): MistakeEntry[] {
  return sets.flatMap((set) =>
    set.items.flatMap((item) => {
      const entry = entryFor(set.id, item);
      return entry ? [entry] : [];
    }),
  );
}

interface LoggedAttempt {
  setId: string;
  itemId: string;
  itemRevision?: number;
  correct: boolean;
  given: string;
  evidence?: 'verified' | 'practice';
  ts: number;
}

/**
 * The learner's standing mistakes, newest first, at most `limit`. An item is one only while its
 * **latest** attempt is wrong: answering it correctly anywhere it is served takes it off the
 * list. An attempt against an older revision of the item is not about today's task and is
 * skipped, as is unverified practice and a rendering the item accepts today.
 */
export function ownMistakes(
  catalog: readonly MistakeEntry[],
  attempts: readonly LoggedAttempt[],
  limit = 5,
): OwnMistake[] {
  const entries = new Map(catalog.map((entry) => [`${entry.setId}::${entry.itemId}`, entry]));
  const latest = new Map<string, LoggedAttempt>();
  for (const attempt of attempts) {
    const key = `${attempt.setId}::${attempt.itemId}`;
    const entry = entries.get(key);
    if (!entry || attempt.evidence === 'practice') continue;
    if (attempt.itemRevision !== undefined && attempt.itemRevision !== entry.revision) continue;
    const seen = latest.get(key);
    if (!seen || attempt.ts >= seen.ts) latest.set(key, attempt);
  }
  const mistakes: OwnMistake[] = [];
  for (const [key, attempt] of latest) {
    if (attempt.correct) continue;
    const entry = entries.get(key)!;
    if (entry.accepted?.includes(normalizeTranslation(attempt.given))) continue;
    const given = entry.cloze
      ? fillCloze(
          entry.cloze,
          attempt.given.split(' / ').map((value) => value.trim() || '___'),
        )
      : attempt.given.trim();
    mistakes.push({ entry, given, ts: attempt.ts });
  }
  return mistakes.sort((a, b) => b.ts - a.ts).slice(0, limit);
}
