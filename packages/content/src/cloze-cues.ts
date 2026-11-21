/**
 * A cloze gap whose answer is a whole phrase must be cued.
 *
 * A one- or two-word gap is a grammar decision the sentence frames: an article, an ending, a
 * preposition, a verb form. A gap of three or more words is a phrase — *zwischen dem ersten und
 * dem dritten Mai*, *Mit dem Kursbeginn* — and when nothing on screen names its content words
 * the learner is not asked for the grammar any more but for the sentence the author had in mind.
 *
 * A gap is cued by what the learner sees before answering, and the cloze schema has exactly
 * three such surfaces (`Cloze.tsx` renders the instruction above the sentence and the
 * translation under it; there is no word bank or hint field):
 *
 * - **bracket** — a `( … )` in `text`, outside the gaps, that names a content word of the gap
 *   (the convention: `… {{über drei Tage}} gedauert. (über + drei Tage)`);
 * - **instruction** — an `instruction` half that names a content word of the gap, the way a
 *   probe lists its three Angaben;
 * - **translation** — any `translation`: it gives the sentence's meaning, so the phrase is named
 *   in the learner's language. Its words cannot be compared with the German, so its presence is
 *   the cue.
 *
 * A bracket or instruction names a gap when one of its words and one of the gap's words share
 * their first four letters, umlauts folded — so a base form in the cue matches the inflected
 * form in the answer (*meine Meinung* → *meiner Meinung*, *der Park* → *den Park*, *Haus* →
 * *Häusern*) while a bracket that cues a different gap (`(abfahren)`) does not count for this one.
 *
 * Pure — no filesystem — so the validator and its test share it.
 */
import { clozeGaps } from '@da/grading/cloze';

/** The first alternative of a gap at or above this many words is a phrase and must be cued. */
export const PHRASE_GAP_WORDS = 3;

/** Letters two words must share from the start for a cue word to name a gap word. */
const SHARED_PREFIX = 4;

export type ClozeCue = 'bracket' | 'instruction' | 'translation';

type Halves = Partial<Record<string, string>>;

/** The fields of a cloze item that decide whether its gaps are cued. */
export interface ClozeCueItem {
  text: string;
  instruction?: Halves;
  translation?: Halves;
}

export interface PhraseGap {
  /** every accepted answer of the gap, the first being the one counted */
  answers: string[];
  /** the surfaces that name it; empty means uncued */
  cues: ClozeCue[];
}

const fold = (word: string) =>
  word.toLowerCase().replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss');

const words = (s: string) => (s.match(/\p{L}+/gu) ?? []).map(fold);

/** True when some word of `cue` and some word of the gap share their first four letters. */
function names(cue: string, answers: readonly string[]): boolean {
  const stems = new Set(
    words(cue)
      .filter((w) => w.length >= SHARED_PREFIX)
      .map((w) => w.slice(0, SHARED_PREFIX)),
  );
  return answers.some((answer) =>
    words(answer).some((w) => w.length >= SHARED_PREFIX && stems.has(w.slice(0, SHARED_PREFIX))),
  );
}

const nonEmpty = (halves: Halves | undefined) =>
  Object.values(halves ?? {}).filter((v): v is string => typeof v === 'string' && v.length > 0);

/** Every phrase gap of a cloze item, with the surfaces that cue it. */
export function phraseGaps(item: ClozeCueItem): PhraseGap[] {
  const outside = item.text.replace(/\{\{[^{}]+\}\}/g, ' ');
  const brackets = (outside.match(/\([^()]*\)/g) ?? []).join(' ');
  const instruction = nonEmpty(item.instruction).join(' ');
  const translated = nonEmpty(item.translation).length > 0;
  return clozeGaps(item.text)
    .filter((answers) => (answers[0] ?? '').trim().split(/\s+/).length >= PHRASE_GAP_WORDS)
    .map((answers) => {
      const cues: ClozeCue[] = [];
      if (names(brackets, answers)) cues.push('bracket');
      if (names(instruction, answers)) cues.push('instruction');
      if (translated) cues.push('translation');
      return { answers, cues };
    });
}

/** One message per uncued phrase gap; empty when every phrase gap is cued. */
export function clozeCueProblems(item: ClozeCueItem): string[] {
  return phraseGaps(item)
    .filter((gap) => gap.cues.length === 0)
    .map(
      (gap) =>
        `cloze gap {{${gap.answers.join('|')}}} asks for a ${gap.answers[0]!.split(/\s+/).length}-word ` +
        'phrase that nothing on screen names — name the base words in brackets after the ' +
        'sentence (`… {{über drei Tage}} gedauert. (über + drei Tage)`), or give the item a translation',
    );
}
