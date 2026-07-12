import { useEffect, useMemo, useState } from 'react';
import type { CardDef } from '../../lib/srs';
import { getCardStates, type CardStates } from '../../lib/store';
import { masteryCounts, rollupWords, type MasteryCounts, type WordMastery } from '../../lib/vocab-mastery';
import { useExplainLang } from '../hooks';

const ORDER: WordMastery[] = ['new', 'learning', 'established', 'strong'];
const COLORS: Record<WordMastery, string> = {
  new: 'bg-stone-200 dark:bg-stone-600', learning: 'bg-amber-300 dark:bg-amber-700',
  established: 'bg-sky-400 dark:bg-sky-700', strong: 'bg-emerald-500 dark:bg-emerald-700',
};
const LABELS: Record<WordMastery, [string, string]> = {
  new: ['New', 'Новые'], learning: ['Learning', 'Изучаются'],
  established: ['Established', 'Закрепляются'], strong: ['Strong', 'Прочные'],
};

function MasteryLegend() {
  const lang = useExplainLang();
  return <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500" aria-label={lang === 'ru' ? 'Легенда статусов слов' : 'Vocabulary status legend'}>{ORDER.map((status) => <span key={status}><i className={`mr-1 inline-block h-2.5 w-2.5 rounded-full ${COLORS[status]}`} />{LABELS[status][lang === 'ru' ? 1 : 0]}</span>)}</div>;
}

function useStates() {
  const [states, setStates] = useState<CardStates>();
  useEffect(() => { void getCardStates().then(setStates); }, []);
  return states;
}

export function MasteryBar({ counts, compact = false }: { counts: MasteryCounts; compact?: boolean }) {
  const lang = useExplainLang();
  const total = ORDER.reduce((n, status) => n + counts[status], 0);
  return <div>
    <div className="flex h-2 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-700" role="img" aria-label={ORDER.map((s) => `${LABELS[s][lang === 'ru' ? 1 : 0]} ${counts[s]}`).join(', ')}>
      {ORDER.map((status) => counts[status] > 0 && <span key={status} className={COLORS[status]} style={{ width: `${counts[status] / total * 100}%` }} />)}
    </div>
    {!compact && <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">{ORDER.map((status) => <span key={status}><i className={`mr-1 inline-block h-2 w-2 rounded-full ${COLORS[status]}`} />{LABELS[status][lang === 'ru' ? 1 : 0]} {counts[status]}</span>)}</div>}
  </div>;
}

export function DeckMasterySummary({ cards }: { cards: CardDef[] }) {
  const states = useStates();
  if (!states) return <div className="mt-3 h-2 rounded-full bg-stone-100 dark:bg-stone-700" />;
  const words = rollupWords(cards, states);
  return <div className="mt-3"><MasteryBar counts={masteryCounts(words)} compact /><p className="mt-1 text-xs text-stone-400">{words.filter((w) => w.due).length} Wörter fällig · {words.filter((w) => w.status === 'strong').length} sicher</p></div>;
}

export function VocabWordTable({ cards }: { cards: CardDef[] }) {
  const lang = useExplainLang();
  const states = useStates();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<WordMastery | 'all'>('all');
  const [pos, setPos] = useState('all');
  const words = useMemo(() => states ? rollupWords(cards, states) : [], [cards, states]);
  const defs = new Map(cards.filter((c) => c.dir === 'de-x').map((c) => [`${c.deckId}::${c.de}`, c]));
  const positions = [...new Set(words.map((w) => w.pos))].sort();
  const visible = words.filter((w) => (status === 'all' || w.status === status) && (pos === 'all' || w.pos === pos) && w.de.toLocaleLowerCase('de').includes(query.toLocaleLowerCase('de')));
  if (!states) return <p className="text-sm text-stone-400">Lernstand wird geladen…</p>;
  return <div>
    <MasteryBar counts={masteryCounts(words)} />
    <div className="mt-5 flex flex-wrap gap-2"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Wort suchen…" className="min-w-48 flex-1 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm dark:border-stone-600 dark:bg-stone-800" /><select value={status} onChange={(e) => setStatus(e.target.value as WordMastery | 'all')} className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm dark:border-stone-600 dark:bg-stone-800"><option value="all">Alle Lernstände</option>{ORDER.map((s) => <option key={s} value={s}>{LABELS[s][lang === 'ru' ? 1 : 0]}</option>)}</select><select value={pos} onChange={(e) => setPos(e.target.value)} className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm dark:border-stone-600 dark:bg-stone-800"><option value="all">Alle Wortarten</option>{positions.map((p) => <option key={p}>{p}</option>)}</select></div>
    <div className="mt-4 divide-y divide-stone-200 rounded-lg border border-stone-200 dark:divide-stone-700 dark:border-stone-700">{visible.map((word) => { const def = defs.get(word.key)!; return <details key={word.key} className="group p-3"><summary className="flex cursor-pointer list-none items-center gap-3"><span className={`h-2.5 w-2.5 rounded-full ${COLORS[word.status]}`} /><span className="font-semibold">{word.de}</span><span className="text-sm text-stone-500">{lang === 'ru' ? def.ru : def.en}</span>{word.due && <span className="ml-auto rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800 dark:bg-amber-900 dark:text-amber-200">fällig</span>}<span className={word.due ? '' : 'ml-auto'}>›</span></summary><div className="mt-3 grid gap-2 pl-5 text-xs text-stone-500 sm:grid-cols-2">{(['de-x','x-de'] as const).map((dir) => { const card = word.directions[dir].card; return <div key={dir} className="rounded bg-stone-50 p-2 dark:bg-stone-900/50"><b className="text-stone-700 dark:text-stone-300">{dir === 'de-x' ? 'Erkennen · DE→EN/RU' : 'Produzieren · EN/RU→DE'}</b><p className="mt-1">{card ? `${card.reps} Wiederholungen · Intervall ${card.scheduled_days} T. · ${card.lapses} Fehler` : 'Noch nicht begonnen'}</p>{card?.due && <p>Fällig: {new Date(card.due).toLocaleDateString()}</p>}</div>; })}</div></details>; })}{visible.length === 0 && <p className="p-4 text-sm text-stone-400">Keine Wörter entsprechen den Filtern.</p>}</div>
  </div>;
}

export interface VocabGroup { id: string; label: string; cardIds: string[] }
export function VocabularyProgress({ cards, groups }: { cards: CardDef[]; groups: Array<{ title: string; items: VocabGroup[] }> }) {
  const lang = useExplainLang();
  const states = useStates();
  if (!states) return null;
  return <section className="rounded-lg border border-stone-200 bg-white p-6 dark:border-stone-700 dark:bg-stone-800"><h2 className="text-sm font-semibold text-stone-600 dark:text-stone-300">Wortschatz nach Bereichen</h2><p className="mt-2 max-w-3xl text-xs leading-relaxed text-stone-500 dark:text-stone-400">{lang === 'ru' ? 'Показаны уникальные слова, уже добавленные в курс: два направления карточек считаются одним словом. Курсы A1 и A2 ещё дополняются; полосы показывают ваш прогресс только по существующему материалу.' : 'These are unique headwords currently authored in the course: two card directions count as one word. A1 and A2 are still being completed; the bars show your mastery of the material that exists today.'}</p><div className="mt-3"><MasteryLegend /></div>{groups.map((group) => <div key={group.title} className="mt-5"><h3 className="text-xs font-semibold uppercase tracking-wide text-stone-400">{group.title}{group.title === 'Niveau' && <span className="ml-2 font-normal normal-case tracking-normal">· {lang === 'ru' ? 'сейчас в курсе' : 'currently authored'}</span>}</h3><div className="mt-2 grid gap-3 sm:grid-cols-2">{group.items.map((item) => { const ids = new Set(item.cardIds); const words = rollupWords(cards.filter((card) => ids.has(card.id)), states); return words.length ? <div key={item.id} className="rounded-md bg-stone-50 p-3 dark:bg-stone-900/50"><div className="mb-2 flex justify-between gap-2 text-sm"><span className="font-medium">{item.label}</span><span className="text-stone-400">{words.length}</span></div><MasteryBar counts={masteryCounts(words)} compact /></div> : null; })}</div></div>)}</section>;
}
