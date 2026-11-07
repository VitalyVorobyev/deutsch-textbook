/**
 * A topic's exercises are three steps (ADR 0019): **Üben** practises the forms (`core`, then
 * `extension`), **Anwenden** uses the same points in new sentences (`application`), and
 * **Aufgaben** gives one situation per skill around one stimulus (`task`, each with its `skill`).
 * The `remediation` drills follow, folded. This module holds both halves of that contract: the
 * grouping the topic page renders, and the one-kind-of-work rules `bun run validate` enforces.
 *
 * Pure — no filesystem — so the page and the validator share it.
 */
import { TASK_SKILLS, type ExerciseItem, type ExerciseSet, type TaskSkill } from '@da/schema';

export const EXERCISE_STEPS = ['ueben', 'anwenden', 'aufgaben', 'wiederholen'] as const;
export type ExerciseStepId = (typeof EXERCISE_STEPS)[number];

type StepSet = { data: Pick<ExerciseSet, 'activity' | 'skill'> };

export interface ExerciseStep<S extends StepSet> {
  id: ExerciseStepId;
  /** the step's sets, in page order */
  sets: S[];
  /** Aufgaben only: its sets by skill, in `TASK_SKILLS` order, each skill present at least once */
  skills?: { skill: TaskSkill; sets: S[] }[];
}

/**
 * The steps of one topic's page, from its sets in manifest order. Üben opens on the Grundübung
 * and keeps the manifest order after it; every other step keeps the manifest order, Aufgaben
 * within each skill. A step with no sets is left out, and a set with no activity is in none.
 */
export function exerciseSteps<S extends StepSet>(sets: readonly S[]): ExerciseStep<S>[] {
  const having = (...activities: ExerciseSet['activity'][]) =>
    sets.filter((set) => activities.includes(set.data.activity));
  const tasks = having('task');
  const skills = TASK_SKILLS.map((skill) => ({
    skill,
    sets: tasks.filter((set) => set.data.skill === skill),
  })).filter((group) => group.sets.length > 0);
  const steps: ExerciseStep<S>[] = [
    { id: 'ueben', sets: [...having('core'), ...having('extension')] },
    { id: 'anwenden', sets: having('application') },
    { id: 'aufgaben', sets: skills.flatMap((group) => group.sets), skills },
    { id: 'wiederholen', sets: having('remediation') },
  ];
  return steps.filter((step) => step.sets.length > 0);
}

/** Item types a learner answers by listening. */
const AUDIO_TYPES: ReadonlySet<ExerciseItem['type']> = new Set(['listen', 'audio-comprehension']);

/**
 * What an `activity: application` set may not hold, item by item: it practises the topic's points
 * in new sentences, so a listening item, a spoken item or a document belongs to a task.
 * A set-level document is reported as `(stimulus)`.
 */
export function applicationIntruders(set: Pick<ExerciseSet, 'stimulus' | 'items'>): string[] {
  const intruders = set.items.flatMap((item) => {
    if (AUDIO_TYPES.has(item.type)) return [`${item.id} (${item.type})`];
    if (item.type === 'speak') return [`${item.id} (speak)`];
    if (item.stimulus) return [`${item.id} (document)`];
    return [];
  });
  return set.stimulus ? ['(stimulus)', ...intruders] : intruders;
}

/**
 * Why a task set's items do not fit its skill, item by item (empty when they fit):
 * - `hoeren`: the set has a recording or every item is a listening item; in a recording task set
 *   the `form` and `reply` rungs of ADR 0016 stay allowed;
 * - `lesen`: the set has a document, its own or one on every item, and no listening item;
 * - `schreiben`: every item is `write`;
 * - `sprechen`: every item is `speak`.
 */
export function skillMisfits(
  set: Pick<ExerciseSet, 'skill' | 'recording' | 'stimulus' | 'items'>,
): string[] {
  const misfit = (item: ExerciseItem, why: string) => `${item.id} (${item.type}): ${why}`;
  switch (set.skill) {
    case 'hoeren':
      return set.items.flatMap((item) =>
        AUDIO_TYPES.has(item.type) ||
        (set.recording && (item.rung === 'form' || item.rung === 'reply'))
          ? []
          : [
              misfit(
                item,
                'a Hören task is listening, besides the form and reply rungs of a recording',
              ),
            ],
      );
    case 'lesen': {
      const documented = set.stimulus || set.items.every((item) => item.stimulus);
      return [
        ...(documented ? [] : ['(set): a Lesen task is built on a document — give it a stimulus']),
        ...set.items.flatMap((item) =>
          AUDIO_TYPES.has(item.type) ? [misfit(item, 'a Lesen task asks nothing by ear')] : [],
        ),
      ];
    }
    case 'schreiben':
      return set.items.flatMap((item) =>
        item.type === 'write' ? [] : [misfit(item, 'a Schreiben task is write items')],
      );
    case 'sprechen':
      return set.items.flatMap((item) =>
        item.type === 'speak' ? [] : [misfit(item, 'a Sprechen task is speak items')],
      );
    default:
      return [];
  }
}

/**
 * The application sets that still mix in listening, speaking or a document, waiting to hand those
 * items to the topic's tasks. The list only shrinks: `exerciseStepProblems` fails a new mixed set
 * and an entry that no longer mixes, and `tests/exercise-steps.test.ts` holds its length.
 */
export const MIXED_APPLICATION_PENDING: readonly string[] = [
  'a1/alltag-zeit-produktion',
  'a1/erste-schritte-produktion',
  'a1/essen-trinken-produktion',
  'a1/freizeit-koennen-produktion',
  'a1/menschen-familie-produktion',
  'a1/ort-richtung-praepositionen-produktion',
  'a1/praesens-wortstellung-produktion',
  'a1/stadt-wege-produktion',
  'a1/wohnen-produktion',
  'a2/adjektive-deklination-produktion',
  'a2/aemter-dienstleistungen-produktion',
  'a2/alltag-tagesablauf-produktion',
  'a2/arbeit-beruf-produktion',
  'a2/biografie-erfahrungen-produktion',
  'a2/dativ-produktion',
  'a2/einkaufen-reklamation-produktion',
  'a2/gesundheit-arzttermin-produktion',
  'a2/infinitiv-mit-zu-produktion',
  'a2/lernen-verstehen-produktion',
  'a2/man-und-besitz-produktion',
  'a2/modalverben-produktion',
  'a2/natur-wetter-produktion',
  'a2/nebensaetze-plaene-produktion',
  'a2/perfekt-haben-sein-produktion',
  'a2/reisen-verkehr-produktion',
  'a2/relativsaetze-produktion',
  'a2/termine-vereinbaren-produktion',
  'a2/trennbare-verben-produktion',
  'a2/verben-mit-kasus-produktion',
  'a2/verben-mit-praepositionen-produktion',
  'a2/verbindungen-folgen-produktion',
  'a2/wohnen-umzug-produktion',
  'a2/zeit-praepositionen-produktion',
  'b1/arbeit-bewerbung-produktion',
  'b1/bildungswege-produktion',
  'b1/digitales-leben-produktion',
  'b1/erfahrungen-erzaehlen-produktion',
  'b1/geld-vertraege-produktion',
  'b1/gesellschaft-zusammenleben-produktion',
  'b1/gespraech-steuern-produktion',
  'b1/gesundheit-wohlbefinden-produktion',
  'b1/informationen-vermitteln-produktion',
  'b1/konsum-umwelt-produktion',
  'b1/kultur-freizeit-produktion',
  'b1/leben-veraendern-produktion',
  'b1/lernen-zukunft-produktion',
  'b1/meinung-medien-produktion',
  'b1/polizei-anzeige-produktion',
  'b1/regeln-verantwortung-produktion',
  'b1/reisen-probleme-produktion',
  'b1/sucht-lebensstil-produktion',
  'b1/unfall-notruf-produktion',
  'b1/versicherungen-behoerden-produktion',
];

/**
 * Every one-kind-of-work problem in a corpus of sets, as `<file>: <message>` lines. Retired sets
 * are served nowhere and are skipped; `pending` defaults to the shipped list.
 */
export function exerciseStepProblems(
  sets: ReadonlyMap<string, { file: string; data: ExerciseSet }>,
  pending: readonly string[] = MIXED_APPLICATION_PENDING,
): string[] {
  const problems: string[] = [];
  const waiting = new Set(pending);
  for (const [setId, { file, data }] of sets) {
    if (data.retired) continue;
    if (data.activity === 'application') {
      const intruders = applicationIntruders(data);
      if (intruders.length > 0 && !waiting.has(setId))
        problems.push(
          `${file}: an application set holds no listening, speaking or document item (ADR 0019) — move ${intruders.join(', ')} to a task of this topic`,
        );
      if (intruders.length === 0 && waiting.has(setId))
        problems.push(
          `${file}: "${setId}" no longer mixes kinds of work — remove it from MIXED_APPLICATION_PENDING (packages/content/src/exercise-steps.ts) and lower the ceiling in tests/exercise-steps.test.ts`,
        );
    } else if (waiting.has(setId))
      problems.push(
        `${file}: "${setId}" is in MIXED_APPLICATION_PENDING but is not an application set — remove it`,
      );
    if (data.activity === 'task')
      for (const misfit of skillMisfits(data))
        problems.push(`${file}: task set "${setId}" is skill: ${data.skill} — ${misfit}`);
  }
  for (const setId of waiting)
    if (!sets.has(setId))
      problems.push(`MIXED_APPLICATION_PENDING names "${setId}", which is not a set — remove it`);
  return problems;
}
