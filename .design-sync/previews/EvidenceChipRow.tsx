import { EvidenceChipRow } from 'deutsch-atlas';

// Unlike EvidenceChips, this takes a precomputed list — the Themen overview
// decides which chips a given tier's row should show. It renders nothing at all
// when the list is empty, so a badge-only mastered row spends no space.

/** A Geübt row: what is earned, plus a dashed slot for what is still left. */
export function EarnedAndOpen() {
  return (
    <EvidenceChipRow
      chips={[
        { label: 'evidence.read', state: 'earned' },
        { label: 'evidence.practiced', state: 'earned' },
        { label: 'evidence.spaced', state: 'open' },
      ]}
    />
  );
}

/** All three chip states side by side. */
export function AllThreeStates() {
  return (
    <EvidenceChipRow
      chips={[
        { label: 'evidence.read', state: 'earned' },
        { label: 'evidence.practiced', state: 'missing' },
        { label: 'evidence.spaced', state: 'open' },
      ]}
    />
  );
}

/** Just the still-to-do slots, which is the common overview case. */
export function OnlyOpenSlots() {
  return (
    <EvidenceChipRow
      chips={[
        { label: 'evidence.spaced', state: 'open' },
        { label: 'evidence.vocab', state: 'open' },
      ]}
    />
  );
}
