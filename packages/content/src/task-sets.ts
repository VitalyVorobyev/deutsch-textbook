/**
 * Task sets (ADR 0016, decisions 1 and 2): one exercise set built on one shared recording.
 *
 * A set with a set-level `recording` is a **task set**. Its 4–6 items climb one ladder — gist,
 * detail, who said it, the target form, a typed reply — and every item answers the same stimulus,
 * so the recording carries a task rather than a question. The schema holds the shape of one file
 * (`exerciseSetSchema`: no `source` on an item in a task set, `source` on every other
 * `audio-comprehension` item); this module holds what needs the rest of the corpus:
 *
 * a. the recording resolves and has the set's level;
 * b. the ladder: 4–6 items, every one on a rung, rungs never descending, `gist` first, `reply`
 *    last, at least four scored;
 * c. what each rung may be: `gist`/`detail`/`who` are `audio-comprehension` (`gist` and `detail`
 *    with four options or more, `who` with three or more names of the recording's speakers),
 *    `form` is `cloze` or `translate`, `reply` is `translate` or `write`;
 * d. the name: `<topic>-aufgabe[-<n>]`, `role: practice`, `stage: transfer`, and that suffix is
 *    for task sets only;
 * e. a *converted* topic — one whose `elements.exercises` lists a task set — asks no listening
 *    question outside a task set, probes excepted;
 * f. a `retired` set is listed by no manifest and armed by no probe.
 *
 * A retired set keeps its file so its ids stay reserved and old attempts resolve; set ids are file
 * paths, so no other file can take one, and `SET_ID_MIGRATION` keeps renamed ids out.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import YAML from 'yaml';
import {
  exerciseSetSchema,
  listeningArtifactSchema,
  topicElementsSchema,
  TASK_RUNGS,
  type ExerciseItem,
  type ExerciseSet,
  type TaskRung,
  type TopicElements,
} from '@da/schema';

/** `<topic>-aufgabe` or `<topic>-aufgabe-<n>`: the name of a task set, and of nothing else. */
export const TASK_SET_NAME = /-aufgabe(-\d+)?$/;

export const TASK_SET_MIN_ITEMS = 4;
export const TASK_SET_MAX_ITEMS = 6;
export const TASK_SET_MIN_SCORED = 4;
/** Options a `gist` or `detail` question offers at least: two would score a coin toss at 50%. */
export const TASK_SET_MIN_OPTIONS = 4;
/** Names a `who` question offers at least. */
export const TASK_SET_MIN_SPEAKERS = 3;

const RUNG_TYPES: Record<TaskRung, readonly ExerciseItem['type'][]> = {
  gist: ['audio-comprehension'],
  detail: ['audio-comprehension'],
  who: ['audio-comprehension'],
  form: ['cloze', 'translate'],
  reply: ['translate', 'write'],
};

/** Open production records practice, never a score. */
const UNSCORED_TYPES: ReadonlySet<string> = new Set(['write', 'speak']);

export const isTaskSet = (set: Pick<ExerciseSet, 'recording'>): boolean =>
  set.recording !== undefined;

export interface TaskSetCorpus {
  sets: ReadonlyMap<string, { file: string; data: ExerciseSet }>;
  topics: ReadonlyMap<string, { file: string; data: { elements: TopicElements } }>;
  recordings: ReadonlyMap<string, { data: { level: string; speakers: readonly string[] } }>;
}

/** Every task-set problem in a corpus, as `<file>: <message>` lines. */
export function taskSetProblems(corpus: TaskSetCorpus): string[] {
  const problems: string[] = [];
  const fail = (file: string, message: string) => problems.push(`${file}: ${message}`);

  for (const [setId, { file, data }] of corpus.sets) {
    const name = setId.split('/').at(-1)!;
    if (!isTaskSet(data)) {
      if (TASK_SET_NAME.test(name))
        fail(
          file,
          `"${setId}" is named like a task set but has no recording: — add the set recording it is built on, or rename it`,
        );
      continue;
    }
    checkTaskSet(setId, file, data, corpus, fail);
  }

  for (const [topicId, { file, data }] of corpus.topics) {
    const { exercises, pretest, probes, primary_practice: primary } = data.elements;
    for (const listed of [...exercises, ...probes, ...(pretest ? [pretest] : [])])
      if (corpus.sets.get(listed)?.data.retired)
        fail(
          file,
          `lists "${listed}", which is retired — a retired set is served nowhere; remove it from elements`,
        );
    if (primary && corpus.sets.get(primary)?.data.retired)
      fail(file, `elements.primary_practice "${primary}" is retired — name a live core set`);

    const converted = exercises.some((id) => {
      const set = corpus.sets.get(id)?.data;
      return set !== undefined && isTaskSet(set);
    });
    if (!converted) continue;
    for (const [setId, { file: setFile, data: set }] of corpus.sets) {
      if (set.topic !== topicId || set.retired || set.role === 'probe' || isTaskSet(set)) continue;
      const question = set.items.find((item) => item.type === 'audio-comprehension');
      if (question)
        fail(
          setFile,
          `"${setId}" asks the listening question "${question.id}" outside a task set, but topic "${topicId}" is converted — a recording carries a task, not a question: move it into a task set or retire this set`,
        );
    }
  }

  for (const [setId, { file, data }] of corpus.sets) {
    if (data.retired) continue;
    for (const key of data.arming) {
      const source = key.slice(0, Math.max(0, key.lastIndexOf('::')));
      if (corpus.sets.get(source)?.data.retired)
        fail(
          file,
          `"${setId}" is armed by "${key}", but "${source}" is retired — arm the family from a live set`,
        );
    }
  }

  return problems;
}

function checkTaskSet(
  setId: string,
  file: string,
  set: ExerciseSet,
  corpus: TaskSetCorpus,
  fail: (file: string, message: string) => void,
): void {
  const recordingId = set.recording!;
  const name = setId.split('/').at(-1)!;
  const level = setId.split('/')[0]!.toUpperCase();

  // d. naming, role and stage
  if (!TASK_SET_NAME.test(name))
    fail(file, `task set "${setId}" must be named <topic>-aufgabe or <topic>-aufgabe-<n>`);
  if (set.role !== 'practice')
    fail(file, `task set "${setId}" is role: ${set.role} — a task set is role: practice`);
  else if (set.stage !== 'transfer')
    fail(
      file,
      `task set "${setId}" has stage: ${set.stage ?? '(none)'} — a task set is stage: transfer`,
    );

  // a. the recording
  const recording = corpus.recordings.get(recordingId)?.data;
  if (!recording)
    fail(
      file,
      `task set "${setId}": recording "${recordingId}" does not resolve to content/listening/<level>/<id>.yaml`,
    );
  else if (recording.level !== level)
    fail(
      file,
      `task set "${setId}": recording "${recordingId}" is ${recording.level}, but the set is ${level}`,
    );

  // b. the ladder
  const items = set.items;
  if (items.length < TASK_SET_MIN_ITEMS || items.length > TASK_SET_MAX_ITEMS)
    fail(
      file,
      `task set "${setId}" has ${items.length} items — a task climbs its ladder in ${TASK_SET_MIN_ITEMS}–${TASK_SET_MAX_ITEMS}`,
    );
  const unranked = items.filter((item) => !item.rung).map((item) => item.id);
  if (unranked.length > 0)
    fail(file, `task set "${setId}": items ${unranked.join(', ')} have no rung: — give each one`);
  const ranked = items.filter((item) => item.rung);
  ranked.forEach((item, index) => {
    const previous = ranked[index - 1];
    if (previous && TASK_RUNGS.indexOf(item.rung!) < TASK_RUNGS.indexOf(previous.rung!))
      fail(
        file,
        `task set "${setId}": item "${item.id}" (${item.rung}) comes after "${previous.id}" (${previous.rung}) — rungs climb ${TASK_RUNGS.join(' → ')} and never go back`,
      );
  });
  if (items[0]?.rung && items[0].rung !== 'gist')
    fail(file, `task set "${setId}" opens on ${items[0].rung} — the first item is the gist`);
  const last = items.at(-1);
  if (last?.rung && last.rung !== 'reply')
    fail(file, `task set "${setId}" ends on ${last.rung} — the last item is the reply`);
  const scored = items.filter((item) => !UNSCORED_TYPES.has(item.type)).length;
  if (scored < TASK_SET_MIN_SCORED)
    fail(
      file,
      `task set "${setId}" scores ${scored} items — a recording carries at least ${TASK_SET_MIN_SCORED} scored items (write and speak are not scored)`,
    );

  // c. what each rung may be
  for (const item of items) {
    if (!item.rung) continue;
    const where = `task set "${setId}": item "${item.id}" (${item.rung})`;
    const allowed = RUNG_TYPES[item.rung];
    if (!allowed.includes(item.type)) {
      fail(file, `${where} is ${item.type} — a ${item.rung} item is ${allowed.join(' or ')}`);
      continue;
    }
    if (item.type !== 'audio-comprehension') continue;
    if (item.rung === 'who') {
      const speakers = new Set(recording?.speakers ?? []);
      const strangers = item.options.filter((option) => !speakers.has(option));
      if (recording && strangers.length > 0)
        fail(
          file,
          `${where} offers ${strangers.map((option) => `"${option}"`).join(', ')}, not a speaker of "${recordingId}" — a who item's options are the recording's speakers`,
        );
      if (item.options.length < TASK_SET_MIN_SPEAKERS)
        fail(
          file,
          `${where} offers ${item.options.length} names — a who item offers at least ${TASK_SET_MIN_SPEAKERS}`,
        );
    } else if (item.options.length < TASK_SET_MIN_OPTIONS)
      fail(
        file,
        `${where} offers ${item.options.length} options — a ${item.rung} item offers at least ${TASK_SET_MIN_OPTIONS}`,
      );
  }
}

const listYaml = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir, { recursive: true, encoding: 'utf8' })
        .filter((name) => name.endsWith('.yaml'))
        .sort()
        .map((name) => join(dir, name))
    : [];

/**
 * The corpus read from a checkout, for callers that have not loaded it already. A file that fails
 * its schema is left out: reporting it is `bun run validate`'s job, and its loader says why.
 */
export function loadTaskSetCorpus(root: string): TaskSetCorpus {
  const sets = new Map<string, { file: string; data: ExerciseSet }>();
  const exercisesDir = join(root, 'content', 'exercises');
  for (const path of listYaml(exercisesDir)) {
    const parsed = exerciseSetSchema.safeParse(YAML.parse(readFileSync(path, 'utf8')));
    if (!parsed.success) continue;
    const id = relative(exercisesDir, path)
      .split(sep)
      .join('/')
      .replace(/\.yaml$/, '');
    sets.set(id, { file: relative(root, path), data: parsed.data });
  }
  const topics = new Map<string, { file: string; data: { elements: TopicElements } }>();
  for (const path of listYaml(join(root, 'content', 'topics'))) {
    if (!path.endsWith('.topic.yaml')) continue;
    const raw = YAML.parse(readFileSync(path, 'utf8')) as { id?: string; elements?: unknown };
    const elements = topicElementsSchema.safeParse(raw?.elements);
    if (!raw?.id || !elements.success) continue;
    topics.set(raw.id, { file: relative(root, path), data: { elements: elements.data } });
  }
  const recordings = new Map<string, { data: { level: string; speakers: string[] } }>();
  for (const path of listYaml(join(root, 'content', 'listening'))) {
    const parsed = listeningArtifactSchema.safeParse(YAML.parse(readFileSync(path, 'utf8')));
    if (parsed.success) recordings.set(parsed.data.id, { data: parsed.data });
  }
  return { sets, topics, recordings };
}
