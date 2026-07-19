import type { TopicEvidence } from '../../lib/mastery';
import { t, type StringKey, type UiLang } from '../../lib/strings';
import { useUiLang } from '../hooks';

/** How a single chip renders: `earned` (green ✓), `missing` (dim filled — the
    neutral not-yet state), or `open` (dashed outline — a Geübt row's
    "still left to do" slot in the Themen overview). */
export type ChipState = 'earned' | 'missing' | 'open';

/** One chip of a precomputed list (see overviewChips in atlas/course.ts). */
export interface EvidenceChipView {
  label: StringKey;
  state: ChipState;
}

const STATE_CLS: Record<ChipState, string> = {
  earned: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200',
  missing: 'bg-stone-100 text-stone-400 dark:bg-stone-700 dark:text-stone-500',
  open: 'border border-dashed border-stone-300 text-stone-500 dark:border-stone-600 dark:text-stone-400',
};

function Seg({ state, label, uiLang }: { state: ChipState; label: StringKey; uiLang: UiLang }) {
  return (
    <span
      lang={uiLang}
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${STATE_CLS[state]}`}
    >
      {state === 'earned' ? '✓ ' : ''}
      {t(label, uiLang)}
    </span>
  );
}

/**
 * The evidence behind a topic's tier. "2 Tage" is the one that explains an
 * all-green row still badged Geübt: mastery must survive a night's sleep.
 */
export function EvidenceChips({
  evidence,
  className = '',
}: {
  evidence: TopicEvidence;
  className?: string;
}) {
  const uiLang = useUiLang();
  const state = (on: boolean): ChipState => (on ? 'earned' : 'missing');
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <Seg state={state(evidence.read)} label="evidence.read" uiLang={uiLang} />
      <Seg state={state(evidence.practiced)} label="evidence.practiced" uiLang={uiLang} />
      <Seg state={state(evidence.spaced)} label="evidence.spaced" uiLang={uiLang} />
      {evidence.hasVocab && <Seg state={state(evidence.vocab)} label="evidence.vocab" uiLang={uiLang} />}
    </div>
  );
}

/**
 * A precomputed chip list — the Themen overview's per-tier filtered view
 * (overviewChips in atlas/course.ts decides what the list contains; the
 * Fortschritt list keeps the always-full EvidenceChips above). Renders
 * nothing at all when the list is empty, so a badge-only mastered row
 * spends no space on an empty container.
 */
export function EvidenceChipRow({
  chips,
  className = '',
}: {
  chips: readonly EvidenceChipView[];
  className?: string;
}) {
  const uiLang = useUiLang();
  if (chips.length === 0) return null;
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {chips.map((chip) => (
        <Seg key={chip.label} state={chip.state} label={chip.label} uiLang={uiLang} />
      ))}
    </div>
  );
}
