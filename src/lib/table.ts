/**
 * Which typed text a `type: table` cell takes — its answer, its authored `accept` forms and the
 * continuation-stub reading below.
 *
 * A `given` cell whose text ends in `…` is a **continuation prompt**: the learner is handed the
 * first half of a sentence and types the rest into the next cell. `TableFill` draws each cell as
 * an independent `<td>`, so nothing in the rendering joins the two — shown `Ich komme nicht,
 * weil …` beside an input, the learner cannot tell whether the connector belongs in what they
 * type.
 *
 * That ambiguity is not fixable by picking a side, and this repo tried both. `a2/verbindungen-
 * folgen:table-drei-wortarten` graded the connector **in** at revision 1 and **out** at revision 2,
 * and produced a false 0/3 each time — same learner, same three word orders correct
 * (verb-final after *weil*, V2 after *denn*, inversion after *Deshalb*), rejected once for
 * omitting the connector and once for restating it (`progress/vitaly/2026-07-26.json`,
 * 2026-07-20 and 2026-07-24). A third answer key would only choose which correct answer to
 * reject next.
 *
 * So the grader accepts **both** readings, and the word it tolerates is derived from the stub
 * rather than authored: `continuationWord` is the one definition of "what the stub just handed
 * over", used by `TableFill` to widen the accepted answers and by `bun run validate` to keep the
 * answer key canonical.
 */
import { answerMatches } from '@da/grading/cloze';

/** The shape `continuationWord` needs — `tableItemSchema`'s cell, structurally. */
export interface TableCellLike {
  answer: string;
  /** authored alternatives, equally correct in this cell */
  accept?: readonly string[];
  given?: boolean;
}

/**
 * The verbatim trailing token of the continuation stub preceding `cells[index]`, or `undefined`
 * when the preceding cell is not one.
 *
 * **Verbatim, case preserved** — `Deshalb`, not `deshalb`. The grader concatenates it in front of
 * the answer and compares case-sensitively, and a sentence-initial *Deshalb* has to be capital;
 * `validate.ts` folds case itself before comparing, so returning the raw token serves both.
 *
 * Only a trailing `…` counts. A medial one is a slot marker, not a continuation — `a2/
 * relativsaetze.yaml` uses five of them (`Ich habe einen Freund, … in Wien arbeitet.`) and the
 * shape is unambiguous on screen because the sentence closes after the gap.
 */
export function continuationWord(
  cells: readonly TableCellLike[],
  index: number,
): string | undefined {
  const stub = index > 0 ? cells[index - 1] : undefined;
  if (!stub?.given || !/…\s*$/u.test(stub.answer)) return undefined;
  return (
    stub.answer
      .replace(/[…\s]+$/u, '')
      .split(/\s+/)
      .pop() || undefined
  );
}

/**
 * The same string with its first letter capitalized, or `undefined` when it does not start with a
 * lower-case letter.
 *
 * A cell is a box the learner types a **fragment** into, not a line they write a sentence on.
 * Shown `Das Auto gehört meinem Bruder.` beside an input, a learner who typed `Das Auto von
 * meinem Bruder` against a key of `das Auto von meinem Bruder` was scored wrong on one character
 * (`a2/man-und-besitz:table-wem-gehoert`) — correct German, rejected for something no
 * `focus` tag grades. 198 of the 232 asked cells in the corpus start lower-case, so the hazard is
 * the shape of the item type rather than one author's slip.
 *
 * **One direction only.** A key that starts *upper*-case still demands it, so the capitalization
 * German does grade — nouns, names, a sentence-initial `Deshalb` — stays strict.
 */
function capitalized(answer: string): string | undefined {
  const first = answer[0];
  if (!first || !/\p{Ll}/u.test(first)) return undefined;
  const upper = first.toUpperCase();
  // ß uppercases to two characters; no German word starts with one, but the key must stay 1:1.
  if (upper === first || upper.length !== 1) return undefined;
  return upper + answer.slice(1);
}

/**
 * Does `cells[index]` open a sentence the learner can see? When its key is a whole sentence
 * (`Ich hätte eine Bitte.`), or when it is the row's first cell and the row label continues it
 * (`… Sie mir bitte helfen?` beside a `Könnten` cell). There the key's capital is the position's,
 * not the grammar's, and a typed `könnten` has the form right.
 */
function opensSentence(
  cells: readonly TableCellLike[],
  index: number,
  label: string | undefined,
): boolean {
  if (/[.!?]$/u.test(cells[index].answer.trim())) return true;
  return index === 0 && label !== undefined && /^\s*…/u.test(label);
}

/** The same string with its first letter lower-cased, or `undefined` when it does not start
    with an upper-case letter. */
function decapitalized(answer: string): string | undefined {
  const first = answer[0];
  if (!first || !/\p{Lu}/u.test(first)) return undefined;
  return first.toLowerCase() + answer.slice(1);
}

/**
 * Every rendering of `cells[index]` the grader accepts: the authored answer and each authored
 * `accept` form, plus each of them with the stub's trailing word restated in front of it, plus
 * any of those capitalized — and, where the cell opens a sentence (`opensSentence`), lower-cased.
 *
 * This is the one reader of a cell's key. `TableFill` grades with it and `bun run validate`
 * checks the key with it, so the two cannot disagree about which forms a cell takes — an
 * `accept` form read in one place and not the other would mark the learner's `gehe` right on
 * the page and wrong in the audit, or the reverse.
 *
 * Exactly one word of tolerance, and only the word the learner was just shown. Retyping more of
 * the stub (`Ich komme nicht, weil ich heute arbeite`) still fails — the instruction asks for the
 * second half of the sentence, and that part of it is not ambiguous.
 */
export function acceptedCellAnswers(
  cells: readonly TableCellLike[],
  index: number,
  label?: string,
): string[] {
  const cell = cells[index];
  const forms = [cell.answer, ...(cell.accept ?? [])];
  const word = continuationWord(cells, index);
  const keys = word ? forms.flatMap((form) => [form, `${word} ${form}`]) : forms;
  const head = opensSentence(cells, index, label);
  return keys.flatMap((key) => {
    const upper = capitalized(key);
    const lower = head ? decapitalized(key) : undefined;
    return [key, ...(upper ? [upper] : []), ...(lower ? [lower] : [])];
  });
}

/**
 * Why each authored `accept` form on `cells[index]` is dead weight, if it is: a given cell is
 * never asked, so its forms are never read; and a form the grader already takes — the answer
 * itself, an earlier form, or a case or stub-word variant of either — adds nothing and hides the
 * one form the author meant to add. Asked through `acceptedCellAnswers` and `answerMatches`, the
 * pair `TableFill` grades with, so "already taken" means exactly what it means on the page.
 */
export function cellAcceptProblems(
  cells: readonly TableCellLike[],
  index: number,
  label?: string,
): string[] {
  const cell = cells[index];
  const accept = cell.accept ?? [];
  if (accept.length === 0) return [];
  if (cell.given) return [`cell "${cell.answer}" is given, so its accept list is never graded`];
  const problems: string[] = [];
  accept.forEach((form, k) => {
    const before = cells.map((c, i) => (i === index ? { ...c, accept: accept.slice(0, k) } : c));
    if (answerMatches(form, acceptedCellAnswers(before, index, label)))
      problems.push(
        `cell "${cell.answer}": accept form "${form}" is already accepted — it repeats the ` +
          `answer or an earlier form up to case or the stub's word`,
      );
  });
  return problems;
}
