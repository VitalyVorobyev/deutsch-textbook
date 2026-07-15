import { useEffect, useState } from 'react';
import {
  getArtifactFeedback,
  setArtifactFeedback,
  type ArtifactFeedback as Feedback,
} from '../../lib/store';
import { pick } from '../../lib/prefs';
import { useExplainLang } from '../hooks';

/** Explanation-language strings — one hoisted record per file (docs/i18n-design.md). */
const UI = {
  title: { en: 'How did this read?', ru: 'Как читалось?' },
  note: {
    en: 'This is editorial feedback, not a learning score.',
    ru: 'Это редакционная обратная связь, а не оценка знаний.',
  },
  tooEasy: { en: 'Too easy', ru: 'Слишком легко' },
  comfortable: { en: 'Comfortable', ru: 'Комфортно' },
  tooHard: { en: 'Too hard', ru: 'Слишком сложно' },
  useful: { en: 'Useful', ru: 'Полезно' },
  wantsMore: { en: 'I want another', ru: 'Хочу ещё' },
} as const satisfies Record<string, { en: string; ru: string }>;

export default function ArtifactFeedback({ artifactId }: { artifactId: string }) {
  const lang = useExplainLang();
  const [entry, setEntry] = useState<Feedback>();
  useEffect(() => { void getArtifactFeedback().then((all) => setEntry(all[artifactId])); }, [artifactId]);

  async function save(patch: Partial<Omit<Feedback, 'artifactId' | 'ts'>>) {
    const next = await setArtifactFeedback({
      artifactId,
      ...(entry?.difficulty ? { difficulty: entry.difficulty } : {}),
      ...(entry?.useful !== undefined ? { useful: entry.useful } : {}),
      ...(entry?.wantsMore !== undefined ? { wantsMore: entry.wantsMore } : {}),
      ...patch,
    });
    setEntry(next);
  }

  return <aside className="mt-10 rounded-lg border border-stone-200 bg-stone-50 p-5 dark:border-stone-700 dark:bg-stone-900/40">
    <h2 className="text-lg font-semibold">{pick(lang, UI.title)}</h2>
    <p className="mt-1 text-sm text-stone-500">{pick(lang, UI.note)}</p>
    <div className="mt-4 flex flex-wrap gap-2">
      {([
        ['too-easy', pick(lang, UI.tooEasy)],
        ['comfortable', pick(lang, UI.comfortable)],
        ['too-hard', pick(lang, UI.tooHard)],
      ] as const).map(([value, label]) => <button key={value} onClick={() => void save({ difficulty: value })} aria-pressed={entry?.difficulty === value} className={`rounded-md border px-3 py-2 text-sm ${entry?.difficulty === value ? 'border-amber-600 bg-amber-50 dark:bg-amber-950/30' : 'border-stone-300 dark:border-stone-600'}`}>{label}</button>)}
    </div>
    <div className="mt-4 flex flex-wrap gap-2">
      <button onClick={() => void save({ useful: !(entry?.useful ?? false) })} aria-pressed={entry?.useful ?? false} className="rounded-md border border-stone-300 px-3 py-2 text-sm dark:border-stone-600">{pick(lang, UI.useful)}</button>
      <button onClick={() => void save({ wantsMore: !(entry?.wantsMore ?? false) })} aria-pressed={entry?.wantsMore ?? false} className="rounded-md border border-stone-300 px-3 py-2 text-sm dark:border-stone-600">{pick(lang, UI.wantsMore)}</button>
    </div>
  </aside>;
}
