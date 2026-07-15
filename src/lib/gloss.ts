/**
 * Inline gloss markers in reading texts:
 * `[[German phrase::en gloss::ru gloss]]` or, with an optional Ukrainian
 * fourth field, `[[German phrase::en gloss::ru gloss::uk gloss]]` — the
 * German phrase stays visible, the gloss is revealed on click in the current
 * explanation language. There is deliberately no `de` gloss field: the German
 * phrase is its own German half, so a 'de' reader gets the EN gloss fallback.
 */

export interface Gloss {
  de: string;
  en: string;
  ru: string;
  /** optional Ukrainian gloss (fourth `::`-field); absent on 3-field markers */
  uk?: string;
}

export type Segment = { kind: 'text'; text: string } | { kind: 'gloss'; gloss: Gloss };

/**
 * Splits a paragraph into plain-text and gloss segments.
 *
 * Malformed markup (unbalanced `[[`/`]]`, not exactly three or four `::`-separated
 * non-empty fields) is reported in `errors`; the offending region is kept as
 * plain text so rendering degrades gracefully. `bun run validate` treats any
 * error as fatal. Whether a reading may mix 3- and 4-field markers is a
 * per-reading rule (all-or-none) that lives in the validator, not here — a
 * single paragraph cannot know its siblings (see glossFieldParity).
 */
export function parseGlosses(paragraph: string): { segments: Segment[]; errors: string[] } {
  const segments: Segment[] = [];
  const errors: string[] = [];
  const pushText = (text: string) => {
    if (text.includes(']]')) errors.push('"]]" without a matching "[["');
    if (text.length > 0) segments.push({ kind: 'text', text });
  };

  let pos = 0;
  while (pos < paragraph.length) {
    const open = paragraph.indexOf('[[', pos);
    if (open === -1) {
      pushText(paragraph.slice(pos));
      break;
    }
    pushText(paragraph.slice(pos, open));
    const close = paragraph.indexOf(']]', open + 2);
    if (close === -1) {
      errors.push('"[[" without a matching "]]"');
      segments.push({ kind: 'text', text: paragraph.slice(open) });
      break;
    }
    const inner = paragraph.slice(open + 2, close);
    const fields = inner.split('::');
    if (
      inner.includes('[[') ||
      fields.length < 3 ||
      fields.length > 4 ||
      fields.some((f) => f.trim().length === 0)
    ) {
      errors.push(
        `malformed gloss "[[${inner}]]" — expected [[German phrase::en gloss::ru gloss]] ` +
          `(optionally ::uk gloss) with three or four non-empty fields`,
      );
      segments.push({ kind: 'text', text: fields[0] ?? inner });
    } else {
      const gloss: Gloss = { de: fields[0]!, en: fields[1]!, ru: fields[2]! };
      if (fields.length === 4) gloss.uk = fields[3]!;
      segments.push({ kind: 'gloss', gloss });
    }
    pos = close + 2;
  }
  return { segments, errors };
}

/**
 * Counts 3- vs 4-field glosses across a reading's paragraphs, for the
 * validator's all-or-none rule: a reading whose glosses mix the two shapes is
 * half-translated, and a UK reader would get a Russian-era gloss mid-text.
 * Malformed glosses are ignored here — parseGlosses already reports them.
 */
export function glossFieldParity(texts: readonly string[]): {
  withUk: number;
  withoutUk: number;
  mixed: boolean;
} {
  let withUk = 0;
  let withoutUk = 0;
  for (const text of texts) {
    for (const s of parseGlosses(text).segments) {
      if (s.kind !== 'gloss') continue;
      if (s.gloss.uk === undefined) withoutUk += 1;
      else withUk += 1;
    }
  }
  return { withUk, withoutUk, mixed: withUk > 0 && withoutUk > 0 };
}
