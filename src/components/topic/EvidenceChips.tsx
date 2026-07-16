import type { TopicEvidence } from '../../lib/mastery';
import { t, type StringKey, type UiLang } from '../../lib/strings';
import { useUiLang } from '../hooks';

function Seg({ on, label, uiLang }: { on: boolean; label: StringKey; uiLang: UiLang }) {
  return (
    <span
      lang={uiLang}
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
        on
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200'
          : 'bg-stone-100 text-stone-400 dark:bg-stone-700 dark:text-stone-500'
      }`}
    >
      {on ? '✓ ' : ''}
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
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <Seg on={evidence.read} label="evidence.read" uiLang={uiLang} />
      <Seg on={evidence.practiced} label="evidence.practiced" uiLang={uiLang} />
      <Seg on={evidence.spaced} label="evidence.spaced" uiLang={uiLang} />
      {evidence.hasVocab && <Seg on={evidence.vocab} label="evidence.vocab" uiLang={uiLang} />}
    </div>
  );
}
