/**
 * The checks `bun run validate` runs on an item's `focus_evidence` predicates — pure, so a
 * fixture can watch each one fail (`tests/focus-evidence.test.ts`); the script only wires it.
 *
 * Every check asks the evaluator the islands log with (`evaluateFocusEvidence`,
 * `@da/grading/evidence`), never a regex of its own, so a predicate cannot pass here and behave
 * differently in the app — case sensitivity included.
 */
import type { ExerciseItem } from '@da/schema';
import { clozeGaps, fillCloze, normalizeSentence, normalizeTranslation } from '@da/grading/cloze';
import { evaluateFocusEvidence, focusPredicate } from '@da/grading/evidence';
import { insertionErrors } from './focus-tags';

/** Every combination of one choice per slot, or `undefined` past `cap` — no item comes near it. */
function combinations(slots: readonly (readonly string[])[], cap = 512): string[][] | undefined {
  let out: string[][] = [[]];
  for (const slot of slots) {
    out = out.flatMap((prefix) => slot.map((choice) => [...prefix, choice]));
    if (out.length > cap) return undefined;
  }
  return out;
}

/**
 * The responses an item accepts as correct, in the shape its predicates read: the typed sentence
 * for `translate` and `listen`, the filled sentence for `cloze`, the assembled chips for `order`,
 * and the asked cells joined by ` / ` for `table` (the islands' `response`, `src/lib/evidence.ts`).
 * A table cell is read as its authored answer; the case and stub-word variants `TableFill` also
 * takes differ only in case, which predicates ignore by default, or by a word the stub prints.
 */
function acceptedRenderings(item: ExerciseItem): string[] {
  if (item.type === 'translate') return [item.answer, ...item.accept];
  if (item.type === 'listen') return [item.text, ...item.accept];
  if (item.type === 'cloze')
    return (combinations(clozeGaps(item.text)) ?? []).map((values) => fillCloze(item.text, values));
  if (item.type === 'order')
    return [
      normalizeSentence(item.words),
      ...item.accept.map((s) => normalizeSentence(s.split(/\s+/))),
    ];
  if (item.type === 'table')
    return [
      item.rows
        .flatMap((row) => row.cells.filter((cell) => !cell.given).map((cell) => cell.answer))
        .join(' / '),
    ];
  return [];
}

/**
 * The insertion error a probe item's tag names, built from one accepted rendering: the tag's
 * word put in front of the last pinned token its `before` pattern matches. `undefined` when the
 * rendering offers no such site, or the word is already there.
 */
export function insertedRendering(
  rendering: string,
  keyTokens: readonly string[],
  focus: string,
): string | undefined {
  const error = insertionErrors[focus];
  if (!error) return undefined;
  const pins = new Set(keyTokens.map((token) => token.toLowerCase()));
  const tokens = normalizeTranslation(rendering).split(' ');
  let site = -1;
  tokens.forEach((token, i) => {
    if (pins.has(token.toLowerCase()) && error.before.test(token)) site = i;
  });
  if (site < 0) return undefined;
  if (site > 0 && tokens[site - 1]!.toLowerCase() === error.word.toLowerCase()) return undefined;
  return [...tokens.slice(0, site), error.word, ...tokens.slice(site)].join(' ');
}

/** Problems with one item's `focus_evidence`; `role` is the owning set's role. */
export function focusEvidenceProblems(item: ExerciseItem, role: string | undefined): string[] {
  const problems: string[] = [];
  const evidence = item.focus_evidence;

  if (evidence) {
    if (!item.focus) problems.push('focus_evidence requires a focus tag');
    let compiled = true;
    for (const pattern of [...evidence.retained, ...evidence.failed]) {
      try {
        focusPredicate(pattern, evidence);
      } catch (error) {
        compiled = false;
        problems.push(
          `invalid focus_evidence regex "${pattern}": ${error instanceof Error ? error.message : error}`,
        );
      }
    }
    if (!compiled) return problems;

    // A `failed` predicate that matches a correct sentence would charge the tag for an answer the
    // item itself accepts the moment a learner pairs it with any unrelated slip.
    for (const rendering of acceptedRenderings(item)) {
      for (const pattern of evidence.failed) {
        if (
          evaluateFocusEvidence(rendering, false, {
            ...evidence,
            retained: [],
            failed: [pattern],
          }) === 'failed'
        )
          problems.push(
            `focus_evidence.failed "${pattern}" fires on the accepted rendering "${rendering}"` +
              (evidence.case_sensitive
                ? ''
                : ' (predicates match case-insensitively unless case_sensitive: true)'),
          );
      }
    }
  }

  // The insertion the tag names must be caught where `key_tokens` cannot see it.
  if (role === 'probe' && item.type === 'translate' && item.focus && insertionErrors[item.focus]) {
    for (const rendering of acceptedRenderings(item)) {
      const inserted = insertedRendering(rendering, item.key_tokens ?? [], item.focus);
      if (!inserted) continue;
      if (!evidence?.failed.length) {
        problems.push(
          `"${item.focus}" names a word the learner adds ("${inserted}"), and key_tokens cannot ` +
            'attribute an inserted token — the probe would read that miss as the competence ' +
            'retained. Declare focus_evidence.failed predicates that catch it (docs/authoring/focus-tags.md, ' +
            '"Errors that add a word").',
        );
        break;
      }
      if (evaluateFocusEvidence(inserted, false, evidence) !== 'failed')
        problems.push(
          `no focus_evidence.failed predicate catches "${inserted}" — the word "${item.focus}" ` +
            'names as added, built from the accepted rendering — so the probe would read it as retained',
        );
    }
  }
  return problems;
}
