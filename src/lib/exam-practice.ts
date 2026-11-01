/**
 * The course's own exam-format sets, arranged the way the exam is: Übungssatz, then Modul, then
 * Teil.
 *
 * **The arrangement is read off the ids, not declared.** A set's file name already says which
 * Übungssatz and which Modul it is (`pruefung-a2-2-hoeren`), and an item's id says its Teil
 * (`teil3-…`). Declaring either again in the YAML would be a second statement of the same fact
 * that could disagree with the first. A level whose sets carry no number (`pruefung-a1-lesen`)
 * is one group, and a set whose items carry no Teil is one run with no Teil marks.
 */
import type { ExamModuleId } from './exam-sim';

/** The exam's own order of modules. */
export const MODUL_REIHENFOLGE: readonly ExamModuleId[] = [
  'lesen',
  'hoeren',
  'schreiben',
  'sprechen',
];

const SET_ID = /(?:^|\/)pruefung-[a-c][12](?:-(\d+))?-(lesen|hoeren|schreiben|sprechen)$/;
const TEIL_ID = /^teil(\d+)-/;

export interface PraxisModul<T> {
  modul: ExamModuleId;
  setId: string;
  set: T;
}

export interface Uebungssatz<T> {
  /** The set's number, or null for a level whose sets are not numbered. */
  nummer: number | null;
  module: PraxisModul<T>[];
}

/** Which Übungssatz and Modul a set id names, or null when it is not an exam-format set. */
export function praxisSet(setId: string): { nummer: number | null; modul: ExamModuleId } | null {
  const match = SET_ID.exec(setId);
  if (!match) return null;
  return { nummer: match[1] ? Number(match[1]) : null, modul: match[2] as ExamModuleId };
}

/**
 * The sets grouped into Übungssätze in number order, each with its modules in exam order. A set
 * whose id does not follow the pattern is left out rather than guessed at.
 */
export function uebungssaetze<T>(sets: readonly { id: string; data: T }[]): Uebungssatz<T>[] {
  const nachNummer = new Map<number | null, PraxisModul<T>[]>();
  for (const { id, data } of sets) {
    const art = praxisSet(id);
    if (!art) continue;
    const module = nachNummer.get(art.nummer) ?? [];
    module.push({ modul: art.modul, setId: id, set: data });
    nachNummer.set(art.nummer, module);
  }
  return [...nachNummer.entries()]
    .sort(([a], [b]) => (a ?? 0) - (b ?? 0))
    .map(([nummer, module]) => ({
      nummer,
      module: module.sort(
        (a, b) => MODUL_REIHENFOLGE.indexOf(a.modul) - MODUL_REIHENFOLGE.indexOf(b.modul),
      ),
    }));
}

/** One Teil of a module: its number and the run of items it covers, `bis` exclusive. */
export interface Teil {
  teil: number;
  von: number;
  bis: number;
}

/**
 * The Teile of a module in item order, or null when its items carry no Teil. Items of one Teil
 * are contiguous in every exam-format set; a Teil that came back after another would be an
 * authoring slip, and it is shown as written rather than merged out of order.
 */
export function teile(items: readonly { id: string }[]): Teil[] | null {
  const liste: Teil[] = [];
  for (const [index, item] of items.entries()) {
    const match = TEIL_ID.exec(item.id);
    if (!match) return null;
    const teil = Number(match[1]);
    const letzter = liste.at(-1);
    if (letzter && letzter.teil === teil) letzter.bis = index + 1;
    else liste.push({ teil, von: index, bis: index + 1 });
  }
  return liste.length > 0 ? liste : null;
}

/** The fragment that opens one module on the level page. */
export const modulAnker = (setId: string): string => `uebung-${setId.replace(/^.*\//, '')}`;
