import { useEffect, useState } from 'react';
import {
  getArtifactFeedback,
  setArtifactFeedback,
  type ArtifactFeedback as Feedback,
} from '../../lib/store';
import { useExplainLang } from '../hooks';

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
    <h2 className="text-lg font-semibold">{lang === 'ru' ? 'Как читалось?' : 'How did this read?'}</h2>
    <p className="mt-1 text-sm text-stone-500">{lang === 'ru' ? 'Это редакционная обратная связь, а не оценка знаний.' : 'This is editorial feedback, not a learning score.'}</p>
    <div className="mt-4 flex flex-wrap gap-2">
      {([
        ['too-easy', lang === 'ru' ? 'Слишком легко' : 'Too easy'],
        ['comfortable', lang === 'ru' ? 'Комфортно' : 'Comfortable'],
        ['too-hard', lang === 'ru' ? 'Слишком сложно' : 'Too hard'],
      ] as const).map(([value, label]) => <button key={value} onClick={() => void save({ difficulty: value })} aria-pressed={entry?.difficulty === value} className={`rounded-md border px-3 py-2 text-sm ${entry?.difficulty === value ? 'border-amber-600 bg-amber-50 dark:bg-amber-950/30' : 'border-stone-300 dark:border-stone-600'}`}>{label}</button>)}
    </div>
    <div className="mt-4 flex flex-wrap gap-2">
      <button onClick={() => void save({ useful: !(entry?.useful ?? false) })} aria-pressed={entry?.useful ?? false} className="rounded-md border border-stone-300 px-3 py-2 text-sm dark:border-stone-600">{lang === 'ru' ? 'Полезно' : 'Useful'}</button>
      <button onClick={() => void save({ wantsMore: !(entry?.wantsMore ?? false) })} aria-pressed={entry?.wantsMore ?? false} className="rounded-md border border-stone-300 px-3 py-2 text-sm dark:border-stone-600">{lang === 'ru' ? 'Хочу ещё' : 'I want another'}</button>
    </div>
  </aside>;
}
