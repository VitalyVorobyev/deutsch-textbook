/** Parsing for cloze texts with inline gaps: "Ich {{habe}} Fußball {{gespielt|gemacht}}." */

export type ClozePart = { type: 'text'; value: string } | { type: 'gap'; answers: string[] };

const GAP_RE = /\{\{([^{}]+)\}\}/g;

export function parseCloze(text: string): ClozePart[] {
  const parts: ClozePart[] = [];
  let last = 0;
  for (const m of text.matchAll(GAP_RE)) {
    if (m.index! > last) parts.push({ type: 'text', value: text.slice(last, m.index) });
    const answers = m[1]
      .split('|')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    parts.push({ type: 'gap', answers });
    last = m.index! + m[0].length;
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) });
  return parts;
}

export function clozeGaps(text: string): string[][] {
  return parseCloze(text)
    .filter((p): p is Extract<ClozePart, { type: 'gap' }> => p.type === 'gap')
    .map((p) => p.answers);
}

/** Normalize a learner answer for comparison (whitespace only — case matters in German, except
    for the first letter of a gap at a sentence head; see `answerMatches`). */
export function normalizeAnswer(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}

/**
 * Typography the learner cannot be expected to reproduce on their keyboard: curly
 * quotes and apostrophes, en/em dashes. Folded to plain ASCII before any comparison.
 */
function foldTypography(s: string): string {
  return s
    .replace(/[’‚‘]/g, "'")
    .replace(/[„“”«»]/g, ' ')
    .replace(/[–—]/g, '-');
}

/**
 * One token of the graded surface. Attached sentence punctuation goes (`Hause,` and
 * `Hause` are the same word), and a token that was nothing *but* punctuation dissolves
 * entirely — the dialogue dash in `Worauf wartet ihr? — Auf die Antwort.` used to
 * change the token count, which silently disabled slip forgiveness for anyone who
 * left it out. A word-internal hyphen or apostrophe stays: `E-Mail` and `geht's`
 * are spelling, not typography.
 */
function stripTokenPunctuation(w: string): string {
  if (/^[-.,!?;:…']+$/.test(w)) return '';
  return w.replace(/[.,!?;:…]+$/, '').replace(/^[.,!?;:…¿¡]+/, '');
}

/**
 * Which indices of `normalizeTranslation(s)`'s token stream begin a sentence?
 *
 * Sentence position is where German capitalization is orthography rather than grammar,
 * and normalization strips the very punctuation that marks it — so the mapping from the
 * raw string onto normalized token indices has to live here, beside the pipeline that
 * defines which raw tokens survive. A raw token that dissolves entirely (a dialogue
 * dash, a stray period) advances no index, but it may still close a sentence: a lone
 * `.` does, a lone `-` does not.
 */
export function sentenceInitialIndices(s: string): Set<number> {
  const heads = new Set<number>();
  let index = 0;
  walkTokens(s, (_raw, head) => {
    if (head) heads.add(index);
    index += 1;
  });
  return heads;
}

/**
 * The one walk both functions above and below share: every raw token that survives
 * normalization, with whether it opens a sentence. Returns the raw tokens, typography folded.
 */
function walkTokens(s: string, visit: (raw: string, head: boolean) => string | void): string[] {
  const out: string[] = [];
  let boundary = true;
  for (const raw of foldTypography(s).split(/\s+/)) {
    if (!raw) continue;
    let token = raw;
    if (stripTokenPunctuation(raw)) {
      token = visit(raw, boundary) ?? raw;
      boundary = false;
    }
    out.push(token);
    if (/[.!?…]['")\]]*$/.test(raw)) boundary = true;
  }
  return out;
}

/**
 * `s` with the first letter of every sentence head capitalized — what German orthography makes
 * of it whatever the learner typed. Only a lower-case letter moves, and only when it upper-cases
 * to one character (`ß` does not), so the result normalizes token for token as `s` does.
 */
export function capitalizeSentenceHeads(s: string): string {
  return walkTokens(s, (raw, head) =>
    head
      ? raw.replace(/^([^\p{L}\p{N}]*)(\p{Ll})/u, (whole, lead: string, letter: string) => {
          const upper = letter.toUpperCase();
          return upper.length === 1 ? lead + upper : whole;
        })
      : raw,
  ).join(' ');
}

/**
 * The text before a cloze gap ends a sentence — or a colon, after which German capitalizes a
 * full sentence and lower-cases a fragment, so a learner cannot know which the author chose. A
 * quote or a dialogue dash may stand between the boundary and the gap.
 */
const OPENS_SENTENCE = /(?:^|[.!?…:])[\s"'„“”»«‚‘’()[\]–—-]*$/u;

/**
 * Which gaps of a cloze text open a sentence, in gap order.
 *
 * At a sentence head the capital is orthography, not grammar: `{{Wenn}} ich Zeit habe, …` typed
 * `wenn` has the conjunction right, and charging it to `falls-wenn` blames the tag for a capital
 * the gap's position demanded. Each earlier gap is read as its first answer, because that is the
 * text the learner sees once they have filled it.
 */
export function clozeGapHeads(text: string): boolean[] {
  const heads: boolean[] = [];
  let before = '';
  for (const part of parseCloze(text)) {
    if (part.type === 'text') {
      before += part.value;
      continue;
    }
    // A cue in brackets closes the sentence it glosses — `… unterbrechen? (dürfen) {{Könnten}}` —
    // so it is read past, back to the punctuation before it.
    heads.push(OPENS_SENTENCE.test(before.replace(/\s*\([^()]*\)\s*$/u, ' ')));
    before += part.answers[0] ?? '';
  }
  return heads;
}

const lowerFirst = (w: string) => w.charAt(0).toLowerCase() + w.slice(1);

/**
 * Does a typed gap or cell match one of its accepted answers?
 *
 * `sentenceHead` folds the case of the first letter on both sides, for a gap `clozeGapHeads`
 * puts at a sentence head. Everywhere else case stays graded: mid-sentence it is grammar.
 */
export function answerMatches(
  given: string,
  accepted: string[],
  { sentenceHead = false }: { sentenceHead?: boolean } = {},
): boolean {
  const fold = sentenceHead ? lowerFirst : (s: string) => s;
  const g = fold(normalizeTranslation(given));
  return accepted.some((a) => {
    const key = normalizeTranslation(a);
    // An answer that IS punctuation would dissolve to '' and match empty input —
    // no such gap exists today, but if one is authored it must stay exact.
    if (key.length === 0) return normalizeAnswer(a) === normalizeAnswer(given);
    return fold(key) === g;
  });
}

/**
 * A cloze text with the learner's gap values in place of its gaps — the sentence an item's
 * `focus_evidence` predicates read, as a translate item's read the typed sentence.
 */
export function fillCloze(text: string, values: readonly string[]): string {
  let gap = 0;
  return parseCloze(text)
    .map((part) => (part.type === 'text' ? part.value : (values[gap++] ?? '').trim()))
    .join('');
}

/** Normalize an assembled sentence: join tokens, tidy space before punctuation. */
export function normalizeSentence(tokens: string[]): string {
  return tokens
    .join(' ')
    .replace(/\s+([.,!?;:])/g, '$1')
    .trim();
}

/**
 * Normalize a free-typed German sentence for comparison. Case matters in German;
 * punctuation and typography do not — they are not part of the graded surface.
 * No focus tag grades a comma or a dash, the model answer is always displayed
 * fully punctuated, and before this rule a missing internal period or dialogue
 * dash consumed the one-slip budget that exists for real typos.
 */
export function normalizeTranslation(s: string): string {
  return foldTypography(s).split(/\s+/).map(stripTokenPunctuation).filter(Boolean).join(' ');
}

/** True if a typed translation matches any of the accepted German sentences. */
export function translationMatches(given: string, accepted: string[]): boolean {
  const g = normalizeTranslation(given);
  return accepted.some((a) => normalizeTranslation(a) === g);
}

/**
 * Normalize a dictation answer: whitespace-normalized with ALL punctuation
 * stripped — you cannot hear commas or periods. Case stays significant, since
 * noun capitalization is part of what dictation drills.
 */
export function normalizeDictation(s: string): string {
  return normalizeAnswer(s.replace(/[.,!?;:„“”"«»'’…–—-]/g, ' '));
}

/** True if a typed dictation matches any of the accepted German sentences. */
export function dictationMatches(given: string, accepted: string[]): boolean {
  const g = normalizeDictation(given);
  return accepted.some((a) => normalizeDictation(a) === g);
}
