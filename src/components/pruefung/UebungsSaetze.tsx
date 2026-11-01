/**
 * The course's own exam-format sets on a level page, arranged the way the exam is: a card per
 * Übungssatz, its modules in exam order, and one module open at a time, its progress grouped by
 * Teil.
 *
 * **One module is on screen, not all of them.** Every set used to be live at once, one stacked
 * under the next, so the page was a long column of half-started tasks with nothing to say which
 * belonged together. The open module is named in the URL fragment, so a reload, a shared link
 * and the browser's Back button all land where the learner was.
 *
 * Nothing here writes. Each module is the ordinary `ExerciseSet`, which logs its attempts and
 * keeps today's place exactly as it does everywhere else; the status on a card is that same
 * resume state read back, so it says "today" and means it.
 */
import { useEffect, useRef, useState } from 'react';
import type { ExerciseSet as ExerciseSetData, VisualDocument } from '@da/schema';
import { modulAnker, teile, type Uebungssatz } from '../../lib/exam-practice';
import { loadResume } from '../../lib/resume';
import ExerciseSet from '../exercises/ExerciseSet';
import { CARD, MODULE_LABEL } from './shared';

interface Props {
  saetze: Uebungssatz<ExerciseSetData>[];
  documents: Record<string, VisualDocument>;
}

/** How far today's run of a module got, from the state `ExerciseSet` keeps for it. */
function heute(setId: string, items: ExerciseSetData['items']): number {
  const saved = loadResume<{ answered?: { itemId?: unknown }[] }>(`exset:${setId}`);
  const answered = saved?.answered;
  if (!Array.isArray(answered) || answered.length > items.length) return 0;
  // A run saved against other items is stale, and ExerciseSet will start it over.
  return answered.every((a, i) => a.itemId === items[i]?.id) ? answered.length : 0;
}

function aufgaben(n: number): string {
  return n === 1 ? '1 Aufgabe' : `${n} Aufgaben`;
}

const satzTitel = (nummer: number | null) => (nummer === null ? 'Übungen' : `Übungssatz ${nummer}`);

function useAnker(): string {
  const [anker, setAnker] = useState(() => window.location.hash.slice(1));
  useEffect(() => {
    const folgen = () => setAnker(window.location.hash.slice(1));
    window.addEventListener('hashchange', folgen);
    return () => window.removeEventListener('hashchange', folgen);
  }, []);
  return anker;
}

export default function UebungsSaetze({ saetze, documents }: Props) {
  const anker = useAnker();
  const offen = saetze
    .flatMap((satz) => satz.module.map((modul) => ({ satz, modul })))
    .find(({ modul }) => modulAnker(modul.setId) === anker);
  const ansicht = useRef<HTMLDivElement>(null);

  // A module opened from a card should start at its top, not wherever the picker was scrolled.
  const offenId = offen?.modul.setId;
  useEffect(() => {
    if (offenId) ansicht.current?.scrollIntoView({ block: 'start' });
  }, [offenId]);

  if (offen) {
    const { satz, modul } = offen;
    return (
      <div ref={ansicht} className="scroll-mt-20 space-y-4" lang="de">
        <nav
          className="flex flex-wrap items-center gap-x-4 gap-y-2"
          aria-label={satzTitel(satz.nummer)}
        >
          <a
            href="#practice"
            className="text-sm text-stone-500 hover:text-amber-700 dark:text-stone-400 dark:hover:text-amber-400"
          >
            ← Alle Übungssätze
          </a>
          <span className="text-sm font-semibold">{satzTitel(satz.nummer)}</span>
          <ul className="flex flex-wrap gap-1">
            {satz.module.map((m) => {
              const aktiv = m.setId === modul.setId;
              return (
                <li key={m.setId}>
                  <a
                    href={`#${modulAnker(m.setId)}`}
                    aria-current={aktiv ? 'page' : undefined}
                    className={`rounded-full border px-3 py-1 text-sm ${
                      aktiv
                        ? 'border-amber-600 bg-amber-600 font-semibold text-white'
                        : 'border-stone-300 text-stone-600 hover:border-amber-500 dark:border-stone-600 dark:text-stone-300'
                    }`}
                  >
                    {MODULE_LABEL[m.modul]}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
        <ExerciseSet
          key={modul.setId}
          setId={modul.setId}
          set={modul.set}
          documents={documents}
          teile={teile(modul.set.items)}
        />
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" lang="de">
      {saetze.map((satz) => (
        <section
          key={satz.nummer ?? 'ohne'}
          className={`${CARD} p-4`}
          aria-label={satzTitel(satz.nummer)}
        >
          <h3 className="font-semibold">{satzTitel(satz.nummer)}</h3>
          <ul className="mt-3 space-y-2">
            {satz.module.map((modul) => {
              const items = modul.set.items;
              const teilListe = teile(items);
              const geschafft = heute(modul.setId, items);
              return (
                <li key={modul.setId}>
                  <a
                    href={`#${modulAnker(modul.setId)}`}
                    className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-stone-200 px-3 py-2 hover:border-amber-500 dark:border-stone-600 dark:hover:border-amber-500"
                  >
                    <span>
                      <span className="block font-medium">{MODULE_LABEL[modul.modul]}</span>
                      <span className="block text-xs text-stone-500 dark:text-stone-400">
                        {aufgaben(items.length)}
                        {teilListe && teilListe.length > 1 ? ` · ${teilListe.length} Teile` : ''}
                      </span>
                    </span>
                    {geschafft > 0 && (
                      <span
                        className={`shrink-0 text-xs ${
                          geschafft === items.length
                            ? 'font-semibold text-green-700 dark:text-green-400'
                            : 'text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {geschafft === items.length
                          ? 'heute erledigt'
                          : `heute ${geschafft}/${items.length}`}
                      </span>
                    )}
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
