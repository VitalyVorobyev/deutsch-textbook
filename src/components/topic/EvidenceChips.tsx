import type { TopicEvidence } from '../../lib/mastery';

function Seg({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      lang="de"
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
        on
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200'
          : 'bg-stone-100 text-stone-400 dark:bg-stone-700 dark:text-stone-500'
      }`}
    >
      {on ? '✓ ' : ''}
      {label}
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
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <Seg on={evidence.read} label="Gelesen" />
      <Seg on={evidence.practiced} label="Geübt" />
      <Seg on={evidence.spaced} label="2 Tage" />
      {evidence.hasVocab && <Seg on={evidence.vocab} label="Vokabeln" />}
    </div>
  );
}
