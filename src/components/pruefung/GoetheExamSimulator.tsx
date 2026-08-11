/**
 * The Goethe exam simulator island (`/pruefung/goethe-a1`).
 *
 * It owns four screens — set picker, mode picker, run, result — plus the one state that
 * matters most here: **absence**. The official materials never enter the repository
 * (ADR 0009), so a build made anywhere but the owner's machine serves no manifest at all.
 * That is the normal case, not an error case: the island says plainly that the materials are
 * not on this device and names the command that would put them there. No spinner theatre, no
 * player with nothing behind it.
 *
 * The only write in the whole feature is `recordExamRun`, into its own localStorage key. Exam
 * results are calibration, never mastery: nothing here touches the profile store, the SRS,
 * mastery, tiers or probes, and nothing here syncs.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  EXAM_MANIFEST_URL,
  loadExamHistory,
  parseExamManifest,
  priorRuns,
  recordExamRun,
  type ExamManifest,
  type ExamModuleId,
  type ExamRunRecord,
  type ExamSetSpec,
} from '../../lib/exam-sim';
import { withBase } from '../../lib/url';
import ExamResult from './ExamResult';
import ExamRunner from './ExamRunner';
import {
  formatDay,
  runnableModules,
  CARD,
  LevelBadge,
  MODULE_LABEL,
  PRIMARY_BUTTON,
  QUIET_BUTTON,
  type ExamMode,
} from './shared';

type Load =
  | { status: 'loading' }
  | { status: 'absent' }
  | { status: 'ready'; manifest: ExamManifest };

type Screen =
  | { kind: 'picker' }
  | { kind: 'setup'; setId: string; module?: ExamModuleId }
  | { kind: 'run'; setId: string; module: ExamModuleId; mode: ExamMode }
  | {
      kind: 'result';
      setId: string;
      module: ExamModuleId;
      run: ExamRunRecord;
      timedOut: boolean;
      earlier: ExamRunRecord[];
    };

function AbsenceCard() {
  return (
    <div lang="de" className={`${CARD} p-6`}>
      <p className="font-medium">Die offiziellen Materialien sind auf diesem Gerät nicht vorhanden.</p>
      <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
        Sie bleiben absichtlich lokal: Dateien ablegen, <code className="rounded bg-stone-100 px-1 py-0.5 text-xs dark:bg-stone-900">bun run exam:ingest</code>{' '}
        ausführen — die Anleitung steht in{' '}
        <code className="rounded bg-stone-100 px-1 py-0.5 text-xs dark:bg-stone-900">docs/architecture/exam-trainer.md</code>.
      </p>
    </div>
  );
}

function SetCard({ set, onChoose }: { set: ExamSetSpec; onChoose: () => void }) {
  return (
    <button
      type="button"
      onClick={onChoose}
      className={`${CARD} block w-full p-5 text-left hover:border-amber-500 dark:hover:border-amber-500`}
    >
      <span className="flex flex-wrap items-center gap-2">
        <LevelBadge level={set.level} />
        <span className="font-semibold">{set.title}</span>
      </span>
      <span className="mt-2 flex flex-wrap gap-2">
        {runnableModules(set).map((module) => (
          <span
            key={module.module}
            className="rounded-full border border-stone-200 px-2.5 py-0.5 text-xs text-stone-500 dark:border-stone-600 dark:text-stone-400"
          >
            {MODULE_LABEL[module.module]} · {module.timeLimitMin} Min.
          </span>
        ))}
      </span>
    </button>
  );
}

export default function GoetheExamSimulator() {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  // Lazy initializer, not an effect: the island is `client:only`, so localStorage is there on
  // the first render and the repeat warning is correct before the learner can click anything.
  const [history, setHistory] = useState<ExamRunRecord[]>(loadExamHistory);
  const [screen, setScreen] = useState<Screen>({ kind: 'picker' });
  // Bumped on every start, so "Noch einmal üben" on the same set+module remounts the runner
  // instead of reusing a component whose sheet is already filled in.
  const [runNonce, setRunNonce] = useState(0);

  useEffect(() => {
    let live = true;
    const settle = (next: Load) => {
      if (live) setLoad(next);
    };
    fetch(withBase(EXAM_MANIFEST_URL))
      .then((response) => (response.ok ? response.json() : null))
      .then((value: unknown) => {
        const manifest = parseExamManifest(value);
        // A manifest whose sets all lack runnable modules is the absence state too: there is
        // nothing to sit, and a picker with no working card would be worse than saying so.
        const sets = manifest ? manifest.sets.filter((set) => runnableModules(set).length > 0) : [];
        settle(
          manifest && sets.length > 0
            ? { status: 'ready', manifest: { ...manifest, sets } }
            : { status: 'absent' },
        );
      })
      .catch(() => settle({ status: 'absent' }));
    return () => {
      live = false;
    };
  }, []);

  const finish = useCallback((run: ExamRunRecord, timedOut: boolean) => {
    // Read the earlier runs before writing this one, so the result screen's history table
    // lists what came before rather than the run the learner is looking at.
    const earlier = priorRuns(loadExamHistory(), run.setId, run.module);
    setHistory(recordExamRun(run));
    setScreen({ kind: 'result', setId: run.setId, module: run.module, run, timedOut, earlier });
  }, []);

  if (load.status === 'loading') {
    return <p lang="de" className="text-sm text-stone-500 dark:text-stone-400">Lade…</p>;
  }
  if (load.status === 'absent') return <AbsenceCard />;

  const sets = load.manifest.sets;
  const activeSet = screen.kind === 'picker' ? undefined : sets.find((set) => set.id === screen.setId);
  // A screen naming a set or module the manifest no longer has (a re-ingest between visits)
  // falls back to the picker rather than rendering half a session.
  if (screen.kind !== 'picker' && !activeSet) {
    return <SetPicker sets={sets} onChoose={(id) => setScreen({ kind: 'setup', setId: id })} />;
  }

  if (screen.kind === 'run' && activeSet) {
    const module = activeSet.modules.find((entry) => entry.module === screen.module);
    if (module) {
      return (
        <ExamRunner
          key={`${activeSet.id}:${module.module}:${screen.mode}:${runNonce}`}
          set={activeSet}
          module={module}
          mode={screen.mode}
          onFinish={finish}
        />
      );
    }
  }

  if (screen.kind === 'result' && activeSet) {
    const module = activeSet.modules.find((entry) => entry.module === screen.module);
    if (module) {
      return (
        <ExamResult
          set={activeSet}
          module={module}
          run={screen.run}
          timedOut={screen.timedOut}
          earlier={screen.earlier}
          onAgain={() => setScreen({ kind: 'setup', setId: activeSet.id, module: module.module })}
          onOverview={() => setScreen({ kind: 'picker' })}
        />
      );
    }
  }

  if (screen.kind === 'setup' && activeSet) {
    const modules = runnableModules(activeSet);
    // One module means there is nothing to choose; the chip still shows which one it is.
    const selected = screen.module ?? (modules.length === 1 ? modules[0]?.module : undefined);
    const active = modules.find((module) => module.module === selected);
    const priors = active ? priorRuns(history, activeSet.id, active.module) : [];
    const last = priors[priors.length - 1];

    return (
      <section lang="de" className="space-y-4">
        <div className={`${CARD} p-5`}>
          <div className="flex flex-wrap items-center gap-2">
            <LevelBadge level={activeSet.level} />
            <h2 className="font-semibold">{activeSet.title}</h2>
          </div>

          <h3 className="mt-5 text-sm font-bold uppercase tracking-wide text-stone-500 dark:text-stone-400">
            Modul
          </h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {modules.map((module) => {
              const picked = module.module === selected;
              return (
                <button
                  key={module.module}
                  type="button"
                  aria-pressed={picked}
                  onClick={() => setScreen({ kind: 'setup', setId: activeSet.id, module: module.module })}
                  className={`min-h-11 rounded-full border px-4 text-sm font-medium ${
                    picked
                      ? 'border-amber-600 bg-amber-600 text-white'
                      : 'border-stone-300 text-stone-600 hover:border-amber-500 dark:border-stone-600 dark:text-stone-300'
                  }`}
                >
                  {MODULE_LABEL[module.module]} · {module.timeLimitMin} Min.
                </button>
              );
            })}
          </div>

          {active && (
            <>
              <h3 className="mt-6 text-sm font-bold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                Modus
              </h3>
              {last && (
                <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                  Zuletzt bearbeitet am {formatDay(last.finishedAt)}, Ergebnis {last.raw}/{last.rawMax}. Eine
                  Wiederholung misst auch das Gedächtnis für die Aufgaben, nicht nur die Kompetenz.
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setRunNonce((n) => n + 1);
                    setScreen({ kind: 'run', setId: activeSet.id, module: active.module, mode: 'pruefung' });
                  }}
                  className={PRIMARY_BUTTON}
                >
                  Prüfungsmodus · {active.timeLimitMin} Min.
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRunNonce((n) => n + 1);
                    setScreen({ kind: 'run', setId: activeSet.id, module: active.module, mode: 'ueben' });
                  }}
                  className={QUIET_BUTTON}
                >
                  Üben · ohne Zeit
                </button>
              </div>
              <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
                Im Prüfungsmodus läuft die Uhr und die Aufnahme läuft einmal durch. Beim Üben wird jede
                Antwort sofort aufgelöst.
              </p>
            </>
          )}

          <button type="button" onClick={() => setScreen({ kind: 'picker' })} className={`mt-6 ${QUIET_BUTTON}`}>
            Zurück zur Übersicht
          </button>
        </div>
      </section>
    );
  }

  return <SetPicker sets={sets} onChoose={(id) => setScreen({ kind: 'setup', setId: id })} />;
}

function SetPicker({ sets, onChoose }: { sets: ExamSetSpec[]; onChoose: (setId: string) => void }) {
  return (
    <section lang="de" className="space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-wide text-stone-500 dark:text-stone-400">
        Prüfungssatz wählen
      </h2>
      {sets.map((set) => (
        <SetCard key={set.id} set={set} onChoose={() => onChoose(set.id)} />
      ))}
    </section>
  );
}
