import { EvidenceChips } from 'deutsch-atlas';

// The four chips ARE the four mastery requirements, which is why a passed
// placement is deliberately not rendered as a fifth green one: placement means
// the requirements were never measured, not that a fifth was met.

/** Nothing earned yet — the neutral not-yet state, not an error state. */
export function Untouched() {
  return (
    <EvidenceChips
      evidence={{ read: false, practiced: false, spaced: false, hasVocab: true, vocab: false }}
    />
  );
}

// No separate PartiallyEarned cell: it is the same chip state as
// WaitingOnTheSecondDay below, which shows it with the explanation that makes
// it worth a card.

/** Everything earned — this is the row a Gemeistert badge sits on. */
export function FullyEarned() {
  return (
    <EvidenceChips
      evidence={{ read: true, practiced: true, spaced: true, hasVocab: true, vocab: true }}
    />
  );
}

/**
 * A topic that owns no vocab deck: `hasVocab: false` drops the Wortschatz chip
 * entirely rather than showing it permanently unearned.
 */
export function NoVocabDeck() {
  return (
    <EvidenceChips
      evidence={{ read: true, practiced: true, spaced: true, hasVocab: false, vocab: false }}
    />
  );
}

/** The state that most needs explaining: all-green except the two-day chip. */
export function WaitingOnTheSecondDay() {
  return (
    <div className="flex flex-col gap-2">
      <EvidenceChips
        evidence={{ read: true, practiced: true, spaced: false, hasVocab: true, vocab: true }}
      />
      <p className="max-w-md text-xs text-stone-500 dark:text-stone-400">
        Mastery must survive a night&apos;s sleep — this is why an otherwise complete row is
        still badged Geübt.
      </p>
    </div>
  );
}
