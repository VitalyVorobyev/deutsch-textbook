/**
 * Inline gloss markers in reading texts:
 * `[[German phrase::en gloss::ru gloss]]` — the German phrase stays visible,
 * the EN/RU gloss is revealed on click in the current explanation language.
 */

export interface Gloss {
  de: string;
  en: string;
  ru: string;
}

export type Segment = { kind: 'text'; text: string } | { kind: 'gloss'; gloss: Gloss };

/**
 * Splits a paragraph into plain-text and gloss segments.
 *
 * Malformed markup (unbalanced `[[`/`]]`, not exactly three `::`-separated
 * non-empty fields) is reported in `errors`; the offending region is kept as
 * plain text so rendering degrades gracefully. `bun run validate` treats any
 * error as fatal.
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
    if (inner.includes('[[') || fields.length !== 3 || fields.some((f) => f.trim().length === 0)) {
      errors.push(
        `malformed gloss "[[${inner}]]" — expected [[German phrase::en gloss::ru gloss]] with three non-empty fields`,
      );
      segments.push({ kind: 'text', text: fields[0] ?? inner });
    } else {
      segments.push({ kind: 'gloss', gloss: { de: fields[0]!, en: fields[1]!, ru: fields[2]! } });
    }
    pos = close + 2;
  }
  return { segments, errors };
}
