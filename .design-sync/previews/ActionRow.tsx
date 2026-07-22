import { ActionRow } from 'deutsch-atlas';

// The advance button occupies the very slot the Prüfen button did, so checking
// an answer never moves the button under the learner's finger. Labels come from
// the German-pinned chrome strings.

const noop = () => {};

/** Before submission: the amber Prüfen button. */
export function BeforeChecking() {
  return <ActionRow checked={false} correct={false} onCheck={noop} onNext={noop} nextLabel="Weiter →" />;
}

/** Prüfen disabled — nothing has been entered yet. */
export function CheckDisabled() {
  return (
    <ActionRow checked={false} correct={false} onCheck={noop} checkDisabled onNext={noop} nextLabel="Weiter →" />
  );
}

/** After a correct answer: the button swaps to Weiter and the verdict chip appears. */
export function CheckedCorrect() {
  return <ActionRow checked correct onCheck={noop} onNext={noop} nextLabel="Weiter →" />;
}

/** After a wrong answer — same layout, different verdict. */
export function CheckedIncorrect() {
  return <ActionRow checked correct={false} onCheck={noop} onNext={noop} nextLabel="Weiter →" />;
}

/**
 * Items that submit on click (mc, match) pass no `onCheck` — they never had a
 * Prüfen button in that slot, so the advance button is there from the start.
 */
export function SubmitOnClickItem() {
  return <ActionRow checked={false} correct={false} onNext={noop} nextLabel="Weiter →" />;
}

/** The end-of-set wording the runner passes instead of "Weiter →". */
export function EndOfSetLabel() {
  return <ActionRow checked correct onCheck={noop} onNext={noop} nextLabel="Übung beenden" />;
}
