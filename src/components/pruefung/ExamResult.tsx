/**
 * The result of one finished run: the automatic score, the per-Teil breakdown, every item
 * with the answer given beside the key, the free part with its criteria self-assessment, the
 * module's Prüferblätter, and the earlier runs of the same set and module.
 *
 * Three things it deliberately does not do. It never names a pass mark — the booklets on hand
 * print none, and inventing one would be the simulator asserting a claim its source does not
 * make. It never sums the automatic score and a self-assessment without saying so — they are
 * different kinds of evidence. And it never writes a run: that happened exactly once when the
 * run finished; the only write reachable from here is attaching the self-assessment.
 */
import {
  isTextItem,
  itemCorrect,
  moduleFreeMax,
  type ExamAnswer,
  type ExamModuleSpec,
  type ExamRunRecord,
  type ExamSetSpec,
} from '../../lib/exam-sim';
import {
  answerLabel,
  formatDay,
  formatPoints,
  formatRunScore,
  CARD,
  MODE_LABEL,
  MODE_SHORT,
  MODULE_LABEL,
  PRIMARY_BUTTON,
  QUIET_BUTTON,
} from './shared';
import { AnswerPages, FreeTexts, SelfScorePanel } from './review';

interface Props {
  set: ExamSetSpec;
  module: ExamModuleSpec;
  run: ExamRunRecord;
  /** The clock reached 0:00 and the sheet submitted itself — the learner should hear that. */
  timedOut: boolean;
  /** Runs of this set+module from before this one, oldest first. */
  earlier: ExamRunRecord[];
  /** Present when the module has a free part: stores the criteria self-assessment. */
  onSelfScore?: (score: number, max: number) => void;
  onAgain: () => void;
  onOverview: () => void;
}

export default function ExamResult({ set, module, run, timedOut, earlier, onSelfScore, onAgain, onOverview }: Props) {
  const freeMax = moduleFreeMax(module);
  const freeSpec = module.teile.find((teil) => teil.free)?.free;
  // Shown only when the source actually rescales. In the Start Deutsch 1 booklets the
  // Antwortbogen maximum *is* the raw count, so a second identical number would suggest a
  // conversion that never happened.
  const showScaled = run.scaled !== run.raw || run.scaledMax !== run.rawMax;

  return (
    <section lang="de" className="space-y-4">
      <div className={`${CARD} p-6`}>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          {set.title} · {MODULE_LABEL[module.module]} · {MODE_LABEL[run.mode]}
        </p>
        <h2 className="mt-1 text-lg font-bold">Ergebnis</h2>

        {timedOut && (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            Die Zeit war um — der Antwortbogen wurde automatisch abgegeben.
          </p>
        )}

        <p className="mt-4 tabular-nums text-4xl font-bold">
          {run.raw}
          <span className="text-stone-400">/{run.rawMax}</span>
        </p>
        {freeMax > 0 && (
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            automatisch bewertete Aufgaben —{' '}
            {run.selfScore !== undefined
              ? `mit Selbstbewertung zusammen ${formatPoints(run.raw + run.selfScore)}/${formatPoints(run.rawMax + (run.selfScoreMax ?? freeMax))}`
              : `dazu kommen ${freeMax} Punkte des freien Teils, unten nach Kriterien selbst zu bewerten`}
          </p>
        )}
        {showScaled && (
          <p className="mt-1 tabular-nums text-sm text-stone-500 dark:text-stone-400">
            umgerechnet: {formatPoints(run.scaled)}/{formatPoints(run.scaledMax)}
          </p>
        )}
        <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">
          Die Hefte nennen keine Bestehensgrenze; das Ergebnis ist ein Rohwert.
        </p>

        <h3 className="mt-6 text-sm font-bold uppercase tracking-wide text-stone-500 dark:text-stone-400">
          Nach Teilen
        </h3>
        <ul className="mt-2 space-y-1">
          {module.teile.map((teil) => (
            <li key={teil.teil} className="flex items-baseline justify-between gap-3 text-sm">
              <span>Teil {teil.teil}</span>
              <span className="tabular-nums text-stone-500 dark:text-stone-400">
                {teil.items.length > 0
                  ? `${teil.items.filter((item) => itemCorrect(item, run.answers[item.nr])).length}/${teil.items.length}`
                  : run.selfScore !== undefined
                    ? `${formatPoints(run.selfScore)}/${formatPoints(teil.free?.points ?? 0)} (selbst bewertet)`
                    : 'nach Kriterien'}
              </span>
            </li>
          ))}
        </ul>

        {module.teile.some((teil) => teil.items.length > 0) && (
          <>
            <h3 className="mt-6 text-sm font-bold uppercase tracking-wide text-stone-500 dark:text-stone-400">
              Aufgaben
            </h3>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-400 dark:border-stone-700">
                    <th scope="col" className="py-1 pr-3 font-medium">Nr.</th>
                    <th scope="col" className="py-1 pr-3 font-medium">Deine Antwort</th>
                    <th scope="col" className="py-1 pr-3 font-medium">Lösung</th>
                    <th scope="col" className="py-1 font-medium"><span className="sr-only">Bewertung</span></th>
                  </tr>
                </thead>
                <tbody>
                  {module.teile.flatMap((teil) => teil.items).map((item) => {
                    const given = run.answers[item.nr] ?? null;
                    const correct = itemCorrect(item, given);
                    return (
                      <tr key={item.nr} className="border-b border-stone-100 last:border-0 dark:border-stone-700/60">
                        <td className="py-1.5 pr-3 tabular-nums text-stone-400">{item.nr}</td>
                        <td className="py-1.5 pr-3">
                          {isTextItem(item) ? (given ?? '—') : answerLabel(item.shape, given as ExamAnswer | null)}
                        </td>
                        <td className="py-1.5 pr-3 text-stone-500 dark:text-stone-400">
                          {isTextItem(item) ? item.answer : answerLabel(item.shape, item.key)}
                        </td>
                        <td
                          className={`py-1.5 font-semibold ${correct ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}
                        >
                          {correct ? '✓' : '✗'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {module.teile.some((teil) => teil.items.some(isTextItem)) && (
              <p className="mt-2 text-xs text-stone-400">
                Getippte Antworten werden wörtlich verglichen — eine abweichende richtige
                Schreibweise zählt selbst, mit der Lösung daneben.
              </p>
            )}
          </>
        )}

        <FreeTexts module={module} run={run} />
        <AnswerPages module={module} />
        {freeSpec && onSelfScore && (
          <SelfScorePanel free={freeSpec} current={run.selfScore} onApply={onSelfScore} />
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          <button type="button" onClick={onAgain} className={PRIMARY_BUTTON}>
            Noch einmal üben
          </button>
          <button type="button" onClick={onOverview} className={QUIET_BUTTON}>
            Zur Übersicht
          </button>
        </div>
      </div>

      {earlier.length > 0 && (
        <div className={`${CARD} p-6`}>
          <h3 className="text-sm font-bold uppercase tracking-wide text-stone-500 dark:text-stone-400">
            Frühere Durchgänge
          </h3>
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-stone-400">
                <th scope="col" className="py-1 pr-3 font-medium">Datum</th>
                <th scope="col" className="py-1 pr-3 font-medium">Modus</th>
                <th scope="col" className="py-1 font-medium">Ergebnis</th>
              </tr>
            </thead>
            <tbody>
              {[...earlier].reverse().map((previous, index) => (
                <tr key={`${previous.finishedAt}-${index}`} className="text-stone-600 dark:text-stone-300">
                  <td className="py-1 pr-3">{formatDay(previous.finishedAt)}</td>
                  <td className="py-1 pr-3">{MODE_SHORT[previous.mode]}</td>
                  <td className="py-1 tabular-nums">{formatRunScore(previous)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
