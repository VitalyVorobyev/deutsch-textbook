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

export function answerMatches(given: string, accepted: string[]): boolean {
  const g = normalizeAnswer(given);
  return accepted.some((a) => normalizeAnswer(a) === g);
}

/** Normalize an assembled sentence: join tokens, tidy space before punctuation. */
export function normalizeSentence(tokens: string[]): string {
  return tokens.join(' ').replace(/\s+([.,!?;:])/g, '$1').trim();
}
