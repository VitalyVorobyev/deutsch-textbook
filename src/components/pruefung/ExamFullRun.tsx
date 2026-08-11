/**
 * The full written exam of one set, in booklet order: Hören → Lesen → Schreiben, each under
 * its real clock, with an interstitial between modules so the learner controls the pacing —
 * and no score shown until the last sheet is in, because the real exam reveals nothing
 * between modules either.
 *
 * Every module run is recorded through the same single-write path as a solo run the moment it
 * finishes, so aborting a full run keeps what was actually sat. The summary sums what can be
 * summed: automatic scores, plus the Schreiben self-assessment once it is entered — and the
 * sum always says when it contains one.
 */
import { useState } from 'react';
import {
  moduleFreeMax,
  type ExamModuleSpec,
  type ExamRunRecord,
  type ExamSetSpec,
} from '../../lib/exam-sim';
import ExamRunner from './ExamRunner';
import { AnswerPages, FreeTexts, SelfScorePanel } from './review';
import { formatPoints, CARD, MODULE_LABEL, PRIMARY_BUTTON, QUIET_BUTTON } from './shared';

interface Props {
  set: ExamSetSpec;
  /** The written modules in booklet order — the parent guarantees all three are scorable. */
  modules: ExamModuleSpec[];
  /** Records one finished module run — the same single write a solo run gets. */
  onRecord: (run: ExamRunRecord) => void;
  /** Stores the self-assessment on an already-recorded run; returns the patched record. */
  onSelfScore: (run: ExamRunRecord, score: number, max: number) => ExamRunRecord;
  onExit: () => void;
}

interface FinishedRun {
  run: ExamRunRecord;
  timedOut: boolean;
}

export default function ExamFullRun({ set, modules, onRecord, onSelfScore, onExit }: Props) {
  const [finished, setFinished] = useState<FinishedRun[]>([]);
  const [running, setRunning] = useState(false);

  const step = finished.length;
  const current = modules[step];

  if (current && running) {
    return (
      <ExamRunner
        key={current.module}
        set={set}
        module={current}
        mode="pruefung"
        onFinish={(run, timedOut) => {
          onRecord(run);
          setFinished((entries) => [...entries, { run, timedOut }]);
          setRunning(false);
        }}
      />
    );
  }

  if (current) {
    return (
      <section lang="de" className="space-y-4">
        <div className={`${CARD} p-6`}>
          <p className="text-sm text-stone-500 dark:text-stone-400">{set.title} · Ganze schriftliche Prüfung</p>
          <h2 className="mt-1 text-lg font-bold">
            Modul {step + 1} von {modules.length}: {MODULE_LABEL[current.module]}
          </h2>
          <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">
            {current.timeLimitMin} Minuten, Prüfungsmodus. Ergebnisse gibt es erst nach dem
            letzten Modul — wie in der Prüfung.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => setRunning(true)} className={PRIMARY_BUTTON}>
              {MODULE_LABEL[current.module]} starten
            </button>
            <button type="button" onClick={onExit} className={QUIET_BUTTON}>
              {step === 0 ? 'Abbrechen' : 'Abbrechen — bisherige Module bleiben gespeichert'}
            </button>
          </div>
        </div>
      </section>
    );
  }

  // All modules are in — the one summary. Self-assessment patches replace the entry in place.
  const moduleFor = (run: ExamRunRecord): ExamModuleSpec | undefined =>
    modules.find((module) => module.module === run.module);
  const freeMaxFor = (run: ExamRunRecord): number => {
    const module = moduleFor(run);
    return module ? moduleFreeMax(module) : 0;
  };
  const total = finished.reduce((sum, entry) => sum + entry.run.raw + (entry.run.selfScore ?? 0), 0);
  const totalMax = finished.reduce((sum, entry) => sum + entry.run.rawMax + freeMaxFor(entry.run), 0);
  const pendingSelf = finished.some(
    (entry) => freeMaxFor(entry.run) > 0 && entry.run.selfScore === undefined,
  );
  const containsSelf = finished.some((entry) => entry.run.selfScore !== undefined);

  return (
    <section lang="de" className="space-y-4">
      <div className={`${CARD} p-6`}>
        <p className="text-sm text-stone-500 dark:text-stone-400">{set.title}</p>
        <h2 className="mt-1 text-lg font-bold">Ganze schriftliche Prüfung — Ergebnis</h2>

        <p className="mt-4 tabular-nums text-4xl font-bold">
          {formatPoints(total)}
          <span className="text-stone-400">/{formatPoints(totalMax)}</span>
        </p>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          {pendingSelf
            ? 'Der freie Teil (Schreiben Teil 2) ist noch nicht selbst bewertet — unten nachholen.'
            : containsSelf
              ? 'Enthält die Selbstbewertung des freien Teils.'
              : 'Rohwert der automatisch bewerteten Aufgaben.'}
        </p>
        <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
          Die Hefte nennen keine Bestehensgrenze; das Ergebnis ist ein Rohwert.
        </p>

        <ul className="mt-5 space-y-1">
          {finished.map((entry) => {
            const module = moduleFor(entry.run);
            const freeMax = module ? moduleFreeMax(module) : 0;
            return (
              <li key={entry.run.module} className="flex items-baseline justify-between gap-3 text-sm">
                <span>
                  {MODULE_LABEL[entry.run.module]}
                  {entry.timedOut && ' · Zeit abgelaufen'}
                </span>
                <span className="tabular-nums text-stone-500 dark:text-stone-400">
                  {entry.run.raw}/{entry.run.rawMax}
                  {freeMax > 0 &&
                    (entry.run.selfScore !== undefined
                      ? ` + ${formatPoints(entry.run.selfScore)}/${formatPoints(freeMax)} selbst bewertet`
                      : ` + …/${freeMax} nach Kriterien`)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {finished.map((entry) => {
        const module = moduleFor(entry.run);
        if (!module) return null;
        const freeSpec = module.teile.find((teil) => teil.free)?.free;
        if (!freeSpec && (!module.answerPages || module.answerPages.length === 0)) return null;
        return (
          <div key={`review-${entry.run.module}`} className={`${CARD} p-6`}>
            <h3 className="text-sm font-bold uppercase tracking-wide text-stone-500 dark:text-stone-400">
              {MODULE_LABEL[entry.run.module]}
            </h3>
            <FreeTexts module={module} run={entry.run} />
            <AnswerPages module={module} />
            {freeSpec && (
              <SelfScorePanel
                free={freeSpec}
                current={entry.run.selfScore}
                onApply={(score, max) => {
                  const patched = onSelfScore(entry.run, score, max);
                  setFinished((entries) =>
                    entries.map((item) => (item.run.module === patched.module ? { ...item, run: patched } : item)),
                  );
                }}
              />
            )}
          </div>
        );
      })}

      <div className={`${CARD} p-4`}>
        <button type="button" onClick={onExit} className={QUIET_BUTTON}>
          Zur Übersicht
        </button>
      </div>
    </section>
  );
}
