/**
 * The Hörprobe's rules, apart from the DOM: which key is which verdict, how verdicts combine, what
 * counts as judged, and where a *gut* is remembered.
 *
 * **gut is exclusive, the problems combine.** A recording can be too fast *and* have two voices
 * nobody can tell apart, so the five problem verdicts are toggles; *gut* says there is nothing to
 * file and clears them, and any problem clears *gut*.
 *
 * **gut writes nothing to the repository.** The shared queue holds findings, requests and
 * questions (ADR 0014), and the owner's acceptance of a file is Redaktion's Prüfen action. So a
 * *gut* is remembered in this browser, against the published audio's digest: the recording is not
 * offered again in this pass, and a re-recorded file, whose bytes differ, is offered again. A
 * problem verdict is remembered by the queue itself, which the view reads back on load.
 */
import type { HoerprobeRow } from './contracts';

export const GUT = 'gut';
export const PROBLEME = ['Tempo', 'Pausen', 'Stimme', 'Aussprache', 'Text'] as const;

/** One key per verdict, printed beside it. Digits, because no letter is free of a second meaning. */
export const URTEIL_TASTEN: readonly { taste: string; urteil: string }[] = [
  { taste: '1', urteil: GUT },
  ...PROBLEME.map((urteil, stelle) => ({ taste: String(stelle + 2), urteil })),
];

export function urteilFuerTaste(taste: string): string | undefined {
  return URTEIL_TASTEN.find((eintrag) => eintrag.taste === taste)?.urteil;
}

/** The verdicts after one toggle, in the order they are offered. */
export function umschalten(auswahl: readonly string[], urteil: string): string[] {
  if (urteil === GUT) return auswahl.includes(GUT) ? [] : [GUT];
  const ohneGut = auswahl.filter((eintrag) => eintrag !== GUT);
  const an = ohneGut.includes(urteil)
    ? ohneGut.filter((eintrag) => eintrag !== urteil)
    : [...ohneGut, urteil];
  return PROBLEME.filter((problem) => an.includes(problem));
}

const KEY = 'tonwerk:hoerprobe-gut';

/** Recording id → the published audio digest that was heard as *gut*. */
export type GutGedaechtnis = Record<string, string>;

export function gemerktesGut(): GutGedaechtnis {
  try {
    const roh = window.localStorage.getItem(KEY);
    const gelesen: unknown = roh ? JSON.parse(roh) : {};
    return gelesen && typeof gelesen === 'object' ? (gelesen as GutGedaechtnis) : {};
  } catch {
    return {};
  }
}

export function merkeGut(gedaechtnis: GutGedaechtnis): void {
  try {
    if (Object.keys(gedaechtnis).length)
      window.localStorage.setItem(KEY, JSON.stringify(gedaechtnis));
    else window.localStorage.removeItem(KEY);
  } catch {
    /* site data blocked: the pass is remembered until the tab closes */
  }
}

/** What a row already carries: the verdicts filed on it, or *gut* heard on these bytes. */
export function urteileVon(row: HoerprobeRow, gut: GutGedaechtnis): string[] {
  const gefunden = row.entries.flatMap((entry) => entry.verdicts);
  if (gefunden.length) return PROBLEME.filter((problem) => gefunden.includes(problem));
  return row.audio_sha256 && gut[row.id] === row.audio_sha256 ? [GUT] : [];
}

/**
 * The next row nobody has judged, after `aktuell` and then from the top: a pass offers each
 * recording once, and a row skipped earlier is still owed. `undefined` when the pass is done.
 */
export function naechsteOffene(
  ids: readonly string[],
  offen: ReadonlySet<string>,
  aktuell: string | undefined,
): string | undefined {
  const ab = aktuell === undefined ? 0 : ids.indexOf(aktuell) + 1;
  return [...ids.slice(ab), ...ids.slice(0, ab)].find((id) => offen.has(id) && id !== aktuell);
}
