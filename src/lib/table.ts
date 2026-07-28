/**
 * Continuation stubs in `type: table` items.
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

/** The shape `continuationWord` needs — `tableItemSchema`'s cell, structurally. */
export interface TableCellLike {
  answer: string;
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
  return stub.answer.replace(/[…\s]+$/u, '').split(/\s+/).pop() || undefined;
}

/**
 * Every rendering of `cells[index]` the grader accepts: the authored answer, plus the same answer
 * with the stub's trailing word restated in front of it.
 *
 * Exactly one word of tolerance, and only the word the learner was just shown. Retyping more of
 * the stub (`Ich komme nicht, weil ich heute arbeite`) still fails — the instruction asks for the
 * second half of the sentence, and that part of it is not ambiguous.
 */
export function acceptedCellAnswers(
  cells: readonly TableCellLike[],
  index: number,
): string[] {
  const answer = cells[index].answer;
  const word = continuationWord(cells, index);
  return word ? [answer, `${word} ${answer}`] : [answer];
}
