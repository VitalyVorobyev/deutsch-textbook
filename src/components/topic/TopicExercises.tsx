import { useEffect, useMemo, useRef, useState } from 'react';
import type { ExerciseSet as ExerciseSetData, TaskSkill, VisualDocument } from '@da/schema';
import type { ExerciseStepId } from '@da/content/exercise-steps';
import type { RecordingScript } from '../../lib/audio';
import { getAttempts, withReadRetry } from '../../lib/store';
import { openingSet, workedSets, type PathSet } from '../../lib/exercise-path';
import { pick } from '../../lib/prefs';
import { t, type StringKey } from '../../lib/strings';
import { useExplainLang, useUiLang } from '../hooks';
import ExerciseSet from '../exercises/ExerciseSet';

export interface TopicExerciseSet {
  id: string;
  data: ExerciseSetData;
  document?: VisualDocument;
  documents?: Record<string, VisualDocument>;
  recording?: RecordingScript;
}

interface Props {
  /** the topic's steps in page order, as `exerciseSteps` groups them; `wiederholen` last */
  steps: { id: ExerciseStepId; sets: TopicExerciseSet[] }[];
  /** the Grundübung — the one set whose completion finishes the lesson */
  primarySetId?: string;
}

const STEP_LABEL = {
  ueben: { label: 'topic.stepUeben', hint: 'topic.stepUebenHint' },
  anwenden: { label: 'topic.stepAnwenden', hint: 'topic.stepAnwendenHint' },
  aufgaben: { label: 'topic.stepAufgaben', hint: 'topic.stepAufgabenHint' },
  wiederholen: { label: 'topic.stepWiederholen', hint: 'topic.stepWiederholenHint' },
} as const satisfies Record<ExerciseStepId, { label: StringKey; hint: StringKey }>;

const SKILL_LABEL = {
  hoeren: 'topic.skillHoeren',
  lesen: 'topic.skillLesen',
  schreiben: 'topic.skillSchreiben',
  sprechen: 'topic.skillSprechen',
} as const satisfies Record<TaskSkill, StringKey>;

const asPathSet = (set: TopicExerciseSet): PathSet => ({
  id: set.id,
  itemIds: set.data.items.map((item) => item.id),
});

/**
 * A topic's Übungen as one path: the steps across the top, the sets of the open step as chips,
 * and one set on screen. Every step and set is reachable at any time — the header is navigation,
 * not a gate — and the path opens on the first set the learner has not worked through.
 *
 * What is worked through is read off the attempt log and only decorates the path. Until that
 * read lands, and if it fails, no set carries a tick and the path stays on the Grundübung; the
 * topic's badge beside the title owns the error and its retry.
 */
export default function TopicExercises({ steps, primarySetId }: Props) {
  const lang = useExplainLang();
  const uiLang = useUiLang();
  const numbered = steps.filter((step) => step.id !== 'wiederholen');
  const allSets = useMemo(() => steps.flatMap((step) => step.sets), [steps]);
  const pathSets = useMemo(
    () => steps.filter((step) => step.id !== 'wiederholen').flatMap((step) => step.sets),
    [steps],
  );

  const [activeId, setActiveId] = useState(allSets[0]?.id);
  // null = the attempt log has not been read; a tick is never drawn from a guess
  const [worked, setWorked] = useState<ReadonlySet<string> | null>(null);
  const chose = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void withReadRetry(getAttempts, { surface: 'thema/uebungen' })
      .then((attempts) => {
        if (cancelled) return;
        const done = workedSets(allSets.map(asPathSet), attempts);
        // a set finished while the read was in flight stays finished
        setWorked((before) => new Set([...done, ...(before ?? [])]));
        if (!chose.current)
          setActiveId(openingSet(pathSets.map(asPathSet), done) ?? allSets[0]?.id);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [allSets, pathSets]);

  const activeStep = steps.find((step) => step.sets.some((set) => set.id === activeId)) ?? steps[0];
  const active = activeStep?.sets.find((set) => set.id === activeId) ?? activeStep?.sets[0];
  if (!activeStep || !active) return null;

  function open(setId: string) {
    chose.current = true;
    setActiveId(setId);
  }

  const title = (set: TopicExerciseSet) =>
    set.data.title_de ?? (set.data.title ? pick(lang, set.data.title) : set.id);
  const isWorked = (set: TopicExerciseSet) => worked?.has(set.id) ?? false;
  const stepWorked = (step: Props['steps'][number]) => step.sets.every(isWorked);

  // The set after this one: within the path proper, or within the drills — a finished path
  // never leads into the drills, which exist for one specific confusion each.
  const lane = activeStep.id === 'wiederholen' ? activeStep.sets : pathSets;
  const following = lane[lane.findIndex((set) => set.id === active.id) + 1];

  return (
    <div>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
        {steps.map((step, i) => {
          const current = step.id === activeStep.id;
          const done = stepWorked(step);
          const optional = step.id === 'wiederholen';
          return (
            <li key={step.id} className="flex items-center gap-2">
              {i > 0 && (
                <span className="text-stone-300 dark:text-stone-600" aria-hidden="true">
                  {optional ? '·' : '→'}
                </span>
              )}
              <button
                type="button"
                onClick={() =>
                  open(step.sets.find((set) => !isWorked(set))?.id ?? step.sets[0]!.id)
                }
                aria-current={current ? 'step' : undefined}
                className="flex min-h-11 items-center gap-1.5 rounded-md px-1 sm:min-h-0"
              >
                <span
                  aria-hidden="true"
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                    current
                      ? 'bg-amber-600 text-white'
                      : done
                        ? 'bg-green-600 text-white'
                        : 'border border-stone-300 text-stone-500 dark:border-stone-600 dark:text-stone-400'
                  }`}
                >
                  {done && !current ? '✓' : optional ? '+' : numbered.indexOf(step) + 1}
                </span>
                <span
                  lang={uiLang}
                  className={
                    current
                      ? 'font-semibold text-stone-900 dark:text-stone-100'
                      : 'text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
                  }
                >
                  {t(STEP_LABEL[step.id].label, uiLang)}
                </span>
                {done && <span className="sr-only">{t('topic.setDone', uiLang)}</span>}
              </button>
            </li>
          );
        })}
      </ol>

      <p lang={uiLang} className="mt-3 text-sm text-stone-500 dark:text-stone-400">
        {t(STEP_LABEL[activeStep.id].hint, uiLang)}
        {activeStep.id !== 'ueben' && (
          <span className="ml-2 rounded-full bg-stone-200 px-2 py-0.5 text-xs text-stone-600 dark:bg-stone-700 dark:text-stone-300">
            {t('topic.stepOptional', uiLang)}
          </span>
        )}
      </p>

      <ul className="mt-3 flex flex-wrap gap-2">
        {activeStep.sets.map((set) => {
          const current = set.id === active.id;
          const done = isWorked(set);
          return (
            <li key={set.id}>
              <button
                type="button"
                onClick={() => open(set.id)}
                aria-current={current ? 'true' : undefined}
                className={`flex min-h-11 max-w-full items-center gap-2 rounded-full border px-3 py-1 text-left text-sm sm:min-h-0 ${
                  current
                    ? 'border-amber-500 bg-amber-50 font-semibold text-stone-900 dark:bg-amber-950/40 dark:text-stone-100'
                    : 'border-stone-300 text-stone-600 hover:border-stone-400 dark:border-stone-600 dark:text-stone-300'
                }`}
              >
                {done && (
                  <span className="text-green-600 dark:text-green-400" aria-hidden="true">
                    ✓
                  </span>
                )}
                <span className="min-w-0">
                  {set.data.skill && (
                    <span
                      lang={uiLang}
                      className="mr-1.5 text-xs font-semibold uppercase tracking-wide text-stone-400"
                    >
                      {t(SKILL_LABEL[set.data.skill], uiLang)}
                    </span>
                  )}
                  <span lang={set.data.title_de ? 'de' : undefined}>{title(set)}</span>
                </span>
                {set.id === primarySetId && (
                  <span
                    lang={uiLang}
                    title={t('topic.pathRule', uiLang)}
                    className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                  >
                    {t('topic.countsForCompletion', uiLang)}
                  </span>
                )}
                {done && <span className="sr-only">{t('topic.setDone', uiLang)}</span>}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-4">
        <ExerciseSet
          key={active.id}
          setId={active.id}
          set={active.data}
          document={active.document}
          documents={active.documents}
          recording={active.recording}
          onFinished={() => setWorked((before) => new Set([...(before ?? []), active.id]))}
          nextAction={
            following && {
              label: `${t('topic.nextSet', uiLang)} ${title(following)} →`,
              onClick: () => open(following.id),
            }
          }
        />
      </div>
    </div>
  );
}
