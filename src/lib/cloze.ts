/** Parsing for cloze texts with inline gaps: "Ich {{habe}} Fußball {{gespielt|gemacht}}." */

export type ClozePart =
  | { type: 'text'; value: string }
  | { type: 'gap'; answers: string[] };

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

/** Normalize a learner answer for comparison (whitespace only — case matters in German). */
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

export function answerMatches(given: string, accepted: string[]): boolean {
  const g = normalizeTranslation(given);
  return accepted.some((a) => {
    const key = normalizeTranslation(a);
    // An answer that IS punctuation would dissolve to '' and match empty input —
    // no such gap exists today, but if one is authored it must stay exact.
    if (key.length === 0) return normalizeAnswer(a) === normalizeAnswer(given);
    return key === g;
  });
}

/** Normalize an assembled sentence: join tokens, tidy space before punctuation. */
export function normalizeSentence(tokens: string[]): string {
  return tokens.join(' ').replace(/\s+([.,!?;:])/g, '$1').trim();
}

/**
 * Normalize a free-typed German sentence for comparison. Case matters in German;
 * punctuation and typography do not — they are not part of the graded surface.
 * No focus tag grades a comma or a dash, the model answer is always displayed
 * fully punctuated, and before this rule a missing internal period or dialogue
 * dash consumed the one-slip budget that exists for real typos.
 */
export function normalizeTranslation(s: string): string {
  return foldTypography(s)
    .split(/\s+/)
    .map(stripTokenPunctuation)
    .filter(Boolean)
    .join(' ');
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
