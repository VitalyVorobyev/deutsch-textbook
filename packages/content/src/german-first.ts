/**
 * The German-first article (ADR 0023): a B1 topic whose explanation is written in German and read
 * as German, like a Leben-in-Deutschland lesson (ADR 0021), with the learner's language one click
 * away instead of in place.
 *
 * Every `##`/`###` section with German prose closes with two collapsed blocks, in this order:
 *
 *  1. `<Translation>` — the section's German translated, nothing added. English is authored first;
 *     a `<Ru>` or `<Uk>` half is optional and, like every optional half, all-or-none per file.
 *     `## Kurz gesagt` has `<Translation open>`, read in both languages at once.
 *  2. `<Erklaerung>` — the explanation written for the learner's language from the start, kept
 *     whole: `<En>` and `<Ru>`, and `<Uk>` once the file carries it. It may diverge from the German
 *     (a Russian contrast, an English false friend), which is why it is not the translation.
 *
 * A section with nothing but tables, examples or subsections has no prose to translate and takes
 * neither block. No `<Bilingual>` and no `<De>`: the German is the body.
 *
 * Pure — no node:fs — so the validator, the tests and the editor can share it.
 */
import { proseShapeProblems } from './prose-shape';

/** A file is German-first when it uses the fold; until all of B1 is converted, that opts it in. */
export function isGermanFirst(body: string): boolean {
  return /<Translation(?: open)?>/.test(body);
}

const COMMENTS = /\{\/\*[\s\S]*?\*\/\}/g;
const TRANSLATION = /<Translation(?: open)?>[\s\S]*?<\/Translation>/g;
const ERKLAERUNG = /<Erklaerung>[\s\S]*?<\/Erklaerung>/g;
const CYRILLIC = /[Ѐ-ӿ]/;

/**
 * The German prose of a section: what is left once folds, comments, tables, blockquotes, headings,
 * list-free structural lines and ❌/✅ example lines are taken out. Empty means "nothing to translate".
 */
export function germanProse(section: string): string {
  return section
    .replace(TRANSLATION, '')
    .replace(ERKLAERUNG, '')
    .replace(COMMENTS, '')
    .split('\n')
    .map((line) => {
      const t = line.trim();
      // A structural line becomes a blank one, so paragraph boundaries survive for the word cap.
      if (t.startsWith('|') || t.startsWith('>') || t.startsWith('#')) return '';
      if (/^(❌|✅)/.test(t)) return '';
      if (/^<[^>]+\/?>$/.test(t)) return '';
      return line;
    })
    .join('\n')
    .replace(/\n\s*\n(\s*\n)+/g, '\n\n')
    .trim();
}

export function germanFirstTopicProblems(body: string): string[] {
  const problems: string[] = [];
  const headings = [...body.matchAll(/^(#{1,6})[ \t]+(.+?)[ \t]*$/gm)].map((m) => ({
    depth: m[1]!.length,
    text: m[2]!,
    at: m.index,
    end: m.index + m[0].length,
  }));
  const first = headings[0];
  if (!first || first.depth !== 2 || first.text !== 'Kurz gesagt') {
    problems.push('the first heading must be "## Kurz gesagt"');
    return problems;
  }
  const bilinguals = (body.match(/<Bilingual\b/g) ?? []).length;
  if (bilinguals)
    problems.push(
      `${bilinguals} <Bilingual> block(s) — a German-first article writes German as the text and closes each section with <Translation> and <Erklaerung>`,
    );
  if (body.includes('<De>'))
    problems.push('a <De> half — in a German-first article the German is the body itself');

  const translations = body.match(TRANSLATION) ?? [];
  const erklaerungen = body.match(ERKLAERUNG) ?? [];
  const optional = (blocks: string[], half: string): boolean =>
    blocks.some((b) => b.includes(`<${half}>`));
  const translationHalves = ['En', ...['Ru', 'Uk'].filter((h) => optional(translations, h))];
  const erklaerungHalves = ['En', 'Ru', ...(optional(erklaerungen, 'Uk') ? ['Uk'] : [])];

  headings.forEach((h, i) => {
    const section = body.slice(h.end, headings[i + 1]?.at ?? body.length);
    const label = `"${'#'.repeat(h.depth)} ${h.text}"`;
    const ts = section.match(TRANSLATION) ?? [];
    const es = section.match(ERKLAERUNG) ?? [];
    const german = germanProse(section);
    if (!german) {
      if (ts.length || es.length)
        problems.push(`${label} has a fold but no German prose to go with it`);
      return;
    }
    if (ts.length !== 1 || es.length !== 1) {
      problems.push(
        `${label} closes with exactly one <Translation> and one <Erklaerung>, found ${ts.length} and ${es.length}`,
      );
      return;
    }
    const tail = section.replace(COMMENTS, '').trimEnd();
    if (!tail.endsWith('</Erklaerung>') || tail.indexOf(ts[0]!) > tail.indexOf(es[0]!))
      problems.push(
        `${label}: the section ends <Translation> then <Erklaerung>, after the German they serve`,
      );
    for (const half of translationHalves)
      if (!ts[0]!.includes(`<${half}>`))
        problems.push(
          `${label}: its <Translation> has no <${half}> half — the optional halves are all-or-none per file`,
        );
    for (const half of erklaerungHalves)
      if (!es[0]!.includes(`<${half}>`))
        problems.push(`${label}: its <Erklaerung> has no <${half}> half`);
    if (/<En>\s*TODO\s*<\/En>/.test(ts[0]!))
      problems.push(
        `${label}: its <Translation> is still a TODO stub — translate the German above it`,
      );
    const open = ts[0]!.startsWith('<Translation open>');
    if (h === first && !open)
      problems.push(
        `${label}: the summary's translation is <Translation open> — it is read in both languages at once`,
      );
    if (h !== first && open)
      problems.push(`${label}: only "## Kurz gesagt" opens its <Translation>`);
  });

  // The body and the English halves carry no Cyrillic; RU and UK halves are checked by mdxLangProblems.
  const outside = body.replace(/<(Ru|Uk)>[\s\S]*?<\/\1>/g, ' ');
  for (const line of outside.split('\n'))
    if (CYRILLIC.test(line))
      problems.push(`Cyrillic outside a <Ru>/<Uk> half: "${line.trim().slice(0, 70)}"`);

  // The German body is now the text a learner reads first, so the paragraph cap applies to it too.
  const prose = headings.map((h, i) =>
    germanProse(body.slice(h.end, headings[i + 1]?.at ?? body.length)),
  );
  for (const p of proseShapeProblems(`<De>\n${prose.join('\n\n')}\n</De>`))
    problems.push(p.replace(/^<De> block 1, /, 'German body, '));
  return problems;
}
