/**
 * What a topic is made of, measured — and what is missing from it.
 *
 * THE RULE THIS MODULE OBEYS. There is no composite score. A single number invites optimising the
 * number, and this repo has a standing memory about self-certifying metrics drifting toward
 * flattery. What it produces instead is three things a reader can act on:
 *
 *   1. a **completeness count** — how many of the mechanically checkable requirements a topic
 *      meets, out of a fixed list. Earned: every check is a yes/no with a named reason.
 *   2. a **profile** — the lesson-cycle arc, the four touches, the response modes, and depth,
 *      each read against the LEVEL MEDIAN the report computes from the corpus. Never against an
 *      invented threshold; that is the `grammar-depth.ts` / `comprehensibility.ts` discipline, and
 *      it exists because a fabricated bar in a repo built on earned figures is a lie with a number
 *      in front of it.
 *   3. a **problem list** — derived, one row per named defect class.
 *
 * WHY MOST OF THESE ARE NOT VALIDATOR FAILURES. A topic profile combines hard structural facts with
 * editorial review prompts. The activity contract itself is hard-validated, including the 8–15
 * cognitive-load band for the one required core activity. Short listening, document and
 * open-production activities are judged by their declared job, never by a universal item minimum.
 *
 * One figure above was wrong on the first pass and is worth the warning: counting a reading's words
 * from the raw paragraph reported 37 rather than 17, because `[[Bahnsteig::platform::платформа]]`
 * is one German word and three whitespace-separated tokens. `readingWords()` flattens glosses the
 * way `scripts/validate.ts` does, through the same parser. Every count here is produced by a
 * command, and the command is the thing to re-run before quoting the number.
 */
import type { ExerciseItem, LearningActivity, Level } from '@da/schema';
import { LEARNING_ACTIVITIES, LEVELS } from '@da/schema';
import { parseGlosses } from '@da/schema/gloss';
import type { ContentGraph } from './graph';
import type { Element, LessonStage, Touch } from './elements';
import { SELECTION_TYPES } from './elements';
import { focusIntroducedBy } from './focus-tags';

/** The item-mix bar from CLAUDE.md, over a topic's `role: practice` sets. */
export const MIN_TRANSLATE = 2;
export const MAX_MC_PERCENT = 100 / 3;
export const MAX_SELECTION_PERCENT = 45;
/** `order` hands the learner every token — scaffolding, not a test, and it saturates. */
export const MAX_ORDER_PER_SET = 2;
/** Cognitive-load contract for the required core activity only. */
export const CORE_ITEMS = { min: 8, max: 15 } as const;
export const INTENSIVE_WORDS = { min: 90, max: 130 } as const;

export interface Check {
  id: string;
  /** German, like the rest of the editorial surface. */
  label: string;
  ok: boolean;
  /** Why it fails, or what it found. Empty when the check passes and has nothing to add. */
  detail?: string;
}

export interface TopicProfile {
  topic: string;
  level: Level;
  title: string;
  file: string;
  /** Every mechanically checkable requirement, in a stable order. */
  checks: Check[];
  /** How many passed, of how many. The only number here, and it is a count of yes/no answers. */
  met: number;
  total: number;
  /** Which lesson-cycle stages have at least one element. */
  arc: Record<LessonStage, number>;
  /** Authored teaching activities by pedagogical purpose. */
  activities: Record<LearningActivity, number>;
  /** How many elements deliver each kind of learning touch. */
  touches: Record<Touch, number>;
  /** Response modes the topic can actually record, and the modes its outcomes claim. */
  modesDelivered: string[];
  modesClaimed: string[];
  /** Teaching items (practice + drill), of which production; and distinct practice files. */
  depth: { items: number; production: number; files: number; probes: number };
  /** Focus tags the topic's elements carry, and grammar points those tags belong to. */
  focus: string[];
  points: string[];
  elements: Element[];
}

export interface LevelMedians {
  level: Level;
  topics: number;
  items: number;
  production: number;
  elements: number;
  met: number;
}

// ---------------------------------------------------------------------------
// Per-topic
// ---------------------------------------------------------------------------

const TEACHING_KINDS = new Set(['praxis', 'drill']);

function itemsOf(graph: ContentGraph, element: Element): ExerciseItem[] {
  const setId = element.id.split('#')[0]!;
  return graph.sets.get(setId)?.data.items ?? [];
}

/**
 * The German a learner actually reads: gloss markers flattened to their German half.
 *
 * Counting the raw paragraph instead reported **37** intensive readings outside the 90–130 band
 * where the honest figure is far lower, because `[[Bahnsteig::platform::платформа]]` is one German
 * word and three tokens. Same flattening as `scripts/validate.ts:1414-1418`, via the same parser,
 * so the two instruments cannot drift apart.
 */
export function readingWords(graph: ContentGraph, element: Element): number {
  const reading = graph.readings.get(element.id.split('#')[0]!);
  if (!reading) return 0;
  let words = 0;
  for (const paragraph of reading.data.text ?? []) {
    const plain = parseGlosses(paragraph)
      .segments.map((s) => (s.kind === 'gloss' ? s.gloss.de : s.text))
      .join('')
      .trim();
    if (plain) words += plain.split(/\s+/).length;
  }
  return words;
}

/**
 * The item mix, over the union of a topic's `role: practice` sets — the same denominator
 * `bun run validate` uses, so the two cannot disagree. `audio-comprehension` is on NEITHER side:
 * the bar's argument is that a learner never has to *produce*, and a listening task cannot ask
 * for production, so counting it in the denominator alone bought a topic more room for written
 * recognition.
 */
export function itemMix(graph: ContentGraph, topicId: string) {
  const practice = (graph.elementsByTopic.get(topicId) ?? []).filter((e) => e.kind === 'praxis');
  const items = practice.flatMap((e) => itemsOf(graph, e)).filter((i) => i.type !== 'audio-comprehension');
  const total = items.length;
  const count = (predicate: (i: ExerciseItem) => boolean) => items.filter(predicate).length;
  const translate = count((i) => i.type === 'translate');
  const mc = count((i) => i.type === 'mc');
  const selection = count((i) => SELECTION_TYPES.has(i.type));
  return {
    total,
    translate,
    mc,
    selection,
    mcPercent: total ? (mc / total) * 100 : 0,
    selectionPercent: total ? (selection / total) * 100 : 0,
    okTranslate: translate >= MIN_TRANSLATE,
    okMc: !total || (mc / total) * 100 <= MAX_MC_PERCENT,
    okSelection: !total || (selection / total) * 100 <= MAX_SELECTION_PERCENT,
  };
}

export function topicProfile(graph: ContentGraph, topicId: string): TopicProfile | undefined {
  const topic = graph.topics.get(topicId);
  if (!topic) return undefined;
  const elements = graph.elementsByTopic.get(topicId) ?? [];
  const node = topic.data;
  const of = (kind: string) => elements.filter((e) => e.kind === kind);

  const arc = {} as Record<LessonStage, number>;
  for (const element of elements) arc[element.stage] = (arc[element.stage] ?? 0) + 1;
  const activities = Object.fromEntries(
    LEARNING_ACTIVITIES.map((activity) => [
      activity,
      elements.filter((element) => element.activity === activity).length,
    ]),
  ) as Record<LearningActivity, number>;
  const touches = {} as Record<Touch, number>;
  for (const element of elements) for (const t of element.touches) touches[t] = (touches[t] ?? 0) + 1;

  const teaching = elements.filter((e) => TEACHING_KINDS.has(e.kind));
  const depth = {
    items: teaching.reduce((n, e) => n + e.depth.items, 0),
    production: teaching.reduce((n, e) => n + e.depth.production, 0),
    files: teaching.length,
    probes: of('probe').length,
  };

  const modesDelivered = [...new Set(elements.flatMap((e) => e.modes))].sort();
  const modesClaimed = [...new Set((node?.outcomes ?? []).map((o) => o.mode))].sort();
  const focus = [...new Set(elements.flatMap((e) => e.focus))].sort();
  const points = graph.inventory
    .filter((p) => (p.focus ?? []).some((tag) => focus.includes(tag)))
    .map((p) => p.id);

  const mix = itemMix(graph, topicId);
  const practice = of('praxis');
  const core = elements.find((element) => element.activity === 'core');
  const productiveApplication = elements.some(
    (element) => element.activity === 'application' && element.touches.includes('produktion'),
  );
  const pretestItems = of('pretest').reduce((n, e) => n + e.depth.items, 0);
  const untypedTranslate = practice
    .flatMap((e) => itemsOf(graph, e))
    .filter((i) => i.type === 'translate' && !(i as { key_tokens?: string[] }).key_tokens?.length);
  const intensive = of('lesetext-intensiv');
  const offBand = intensive.filter((e) => {
    const words = readingWords(graph, e);
    return words < INTENSIVE_WORDS.min || words > INTENSIVE_WORDS.max;
  });
  const unmeasured = (node?.outcomes ?? [])
    .map((o) => o.id)
    .filter((id) => !elements.some((e) => TEACHING_KINDS.has(e.kind) && e.outcomes.includes(id)))
    .filter((id) => !elements.some((e) => e.kind.startsWith('lesetext') && e.outcomes.includes(id)));

  const checks: Check[] = [
    {
      id: 'artikel-abschnitte',
      label: '## Erklärung hat ###-Abschnitte',
      ok: topic.erklaerungSubsections.length > 0,
      detail: topic.erklaerungSubsections.length
        ? `${topic.erklaerungSubsections.length} Abschnitte`
        : 'keine — die benannten Verwechslungen haben keinen Anker in der Prosa',
    },
    {
      id: 'pretest',
      label: 'Pretest mit 3 Aufgaben',
      ok: of('pretest').length === 1 && pretestItems === 3,
      detail: of('pretest').length ? `${pretestItems} Aufgaben` : 'fehlt',
    },
    {
      id: 'praxis',
      label: 'mindestens ein praxis-Set',
      ok: practice.length > 0,
      detail: practice.length ? `${practice.length} Set(s)` : 'fehlt',
    },
    {
      id: 'core-umfang',
      label: `Grundübung im Vertragsband ${CORE_ITEMS.min}–${CORE_ITEMS.max} Aufgaben`,
      ok: !!core && core.depth.items >= CORE_ITEMS.min && core.depth.items <= CORE_ITEMS.max,
      detail: core ? `${core.depth.items} Aufgaben` : 'fehlt',
    },
    {
      id: 'aufgabenmischung',
      label: 'Aufgabenmischung (≥2 translate, mc ≤ ⅓, Auswahl ≤ 45 %)',
      ok: mix.okTranslate && mix.okMc && mix.okSelection,
      detail: `${mix.translate}× translate · mc ${mix.mcPercent.toFixed(0)} % · Auswahl ${mix.selectionPercent.toFixed(0)} %`,
    },
    {
      id: 'key-tokens',
      label: 'jede translate-Aufgabe nennt key_tokens',
      ok: untypedTranslate.length === 0,
      detail: untypedTranslate.length ? `${untypedTranslate.length} ohne` : undefined,
    },
    {
      id: 'probe',
      label: 'Probe-Familie mit 3 Varianten',
      ok: depth.probes > 0 && of('probe').every((e) => e.depth.items === 3),
      detail: depth.probes ? `${depth.probes} Familie(n)` : 'keine — nichts fragt später nach',
    },
    {
      id: 'lesetext',
      label: 'Lesetext vorhanden',
      ok: intensive.length + of('lesetext-extensiv').length > 0,
      detail: intensive.length ? `${intensive.length} intensiv` : 'fehlt',
    },
    {
      id: 'lesetext-umfang',
      label: `intensiver Lesetext ${INTENSIVE_WORDS.min}–${INTENSIVE_WORDS.max} Wörter`,
      ok: offBand.length === 0,
      detail: offBand.length ? `${offBand.length} außerhalb` : undefined,
    },
    {
      id: 'outcomes',
      label: 'Atlas-Knoten mit 2–5 Outcomes',
      ok: (node.outcomes?.length ?? 0) >= 2 && (node.outcomes?.length ?? 0) <= 5,
      detail: `${node.outcomes?.length ?? 0}`,
    },
    {
      id: 'outcomes-gemessen',
      label: 'jedes Outcome wird von einer Aufgabe gemessen',
      ok: unmeasured.length === 0,
      detail: unmeasured.length ? unmeasured.join(', ') : undefined,
    },
    {
      id: 'modi',
      label: 'die Modi, die die Outcomes beanspruchen, werden geübt',
      ok: modesClaimed.every((m) => modesDelivered.includes(m)),
      detail: modesClaimed.filter((m) => !modesDelivered.includes(m)).join(', ') || undefined,
    },
    {
      id: 'transfer',
      label: 'mindestens eine produktive Anwendung im neuen Kontext',
      ok: productiveApplication,
      detail: productiveApplication ? `${activities.application} Anwendung(en)` : 'geübt oder nur gehört, aber nie produktiv in neuem Kontext verlangt',
    },
  ];

  return {
    topic: topicId,
    level: topic.data.level,
    title: topic.data.title_de,
    file: topic.file,
    checks,
    met: checks.filter((c) => c.ok).length,
    total: checks.length,
    arc,
    activities,
    touches,
    modesDelivered,
    modesClaimed,
    depth,
    focus,
    points,
    elements,
  };
}

// ---------------------------------------------------------------------------
// Level medians — what every row above is read against
// ---------------------------------------------------------------------------

const median = (values: number[]): number => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};

export function levelMedians(graph: ContentGraph): Map<Level, LevelMedians> {
  const out = new Map<Level, LevelMedians>();
  for (const level of LEVELS) {
    const profiles = [...graph.topics.values()]
      .filter((t) => t.data.level === level)
      .map((t) => topicProfile(graph, t.id))
      .filter((p): p is TopicProfile => !!p);
    out.set(level, {
      level,
      topics: profiles.length,
      items: median(profiles.map((p) => p.depth.items)),
      production: median(profiles.map((p) => p.depth.production)),
      elements: median(profiles.map((p) => p.elements.length)),
      met: median(profiles.map((p) => p.met)),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Problems
// ---------------------------------------------------------------------------

export interface Problem {
  /** The defect class. One row per kind in the editor's inbox. */
  kind: string;
  /** What is wrong, in German, naming the thing. */
  message: string;
  topic?: string;
  level?: Level;
  /** Repo-relative path, so a row is one click from its file. */
  file?: string;
}

export const PROBLEM_LABELS: Record<string, { de: string; why: string }> = {
  'artikel-ohne-abschnitte': {
    de: 'Erklärung ohne ###-Abschnitte',
    why: 'Die benannte Verwechslung hat keine Stelle in der Prosa, auf die ein Link zeigen könnte.',
  },
  'kein-transfer': {
    de: 'kein Transfer',
    why: 'Der Lernzyklus endet beim Üben: nichts verlangt die Struktur in einem neuen Kontext.',
  },
  'keine-probe': {
    de: 'keine Probe-Familie',
    why: 'Nichts fragt nach 2, 7 und 21 Tagen noch einmal nach — es gibt keinen Behaltensbeleg.',
  },
  'grunduebung-umfang': {
    de: 'Grundübung außerhalb des Vertragsbands',
    why: 'Nur die verpflichtende Grundübung muss 8–15 Aufgaben enthalten; das ist kein universelles Set-Limit.',
  },
  'translate-ohne-key-tokens': {
    de: 'translate ohne key_tokens',
    why: 'Eine leere Liste schreibt jeden Fehler im Satz dem Fokus-Tag zu.',
  },
  'lesetext-umfang': { de: 'intensiver Lesetext außerhalb 90–130 Wörtern', why: 'Kein Gate prüft die Spanne.' },
  'outcome-ohne-aufgabe': { de: 'Outcome ohne messende Aufgabe', why: 'Ein nur geprüftes Outcome wurde nie geübt.' },
  'modus-fehlt': { de: 'beanspruchter Modus wird nicht geübt', why: 'Das Outcome nennt Sprechen; nichts im Thema lässt sprechen.' },
  'tag-ohne-probe': { de: 'Fokus-Tag ohne Probe', why: 'Die Verwechslung wird geübt, aber nie später erneut gefragt.' },
  'tag-ohne-aufgabe': {
    de: 'Fokus-Tag ohne Aufgabe',
    why: 'Der Tag existiert, aber keine praxis-/drill-Aufgabe trägt ihn — eine benannte Verwechslung, die nichts übt.',
  },
  'punkt-ohne-thema': { de: 'Struktur ohne Thema', why: 'Eine Inventarzeile, die kein Thema unterrichtet.' },
  'deck-ohne-thema': { de: 'Deck ohne Thema', why: 'Wortlisten-Deck: bewusst frei, hier nur zur Übersicht.' },
};

export function problems(graph: ContentGraph): Problem[] {
  const out: Problem[] = [];
  const add = (kind: string, message: string, topic?: string, file?: string) =>
    out.push({ kind, message, topic, level: topic ? graph.topics.get(topic)?.data.level : undefined, file });

  for (const topic of graph.topics.values()) {
    const profile = topicProfile(graph, topic.id);
    if (!profile) continue;
    const fail = (id: string) => profile.checks.find((c) => c.id === id && !c.ok);

    if (fail('artikel-abschnitte')) add('artikel-ohne-abschnitte', topic.data.title_de, topic.id, topic.article);
    if (fail('transfer')) add('kein-transfer', topic.data.title_de, topic.id, topic.file);
    if (fail('probe')) add('keine-probe', topic.data.title_de, topic.id, topic.file);
    if (fail('lesetext-umfang')) add('lesetext-umfang', topic.data.title_de, topic.id, topic.file);

    const core = profile.elements.find((element) => element.activity === 'core');
    if (fail('core-umfang') && core) {
      add('grunduebung-umfang', `${core.id} — ${core.depth.items} Aufgaben`, topic.id, core.file);
    }

    for (const element of profile.elements.filter((e) => e.kind === 'praxis')) {
      for (const item of itemsOf(graph, element)) {
        if (item.type === 'translate' && !(item as { key_tokens?: string[] }).key_tokens?.length) {
          add('translate-ohne-key-tokens', `${element.id} · ${item.id}`, topic.id, element.file);
        }
      }
    }

    const unmeasured = profile.checks.find((c) => c.id === 'outcomes-gemessen');
    if (unmeasured && !unmeasured.ok) add('outcome-ohne-aufgabe', unmeasured.detail ?? '', topic.id, topic.file);
    const modes = profile.checks.find((c) => c.id === 'modi');
    if (modes && !modes.ok) add('modus-fehlt', `${topic.data.title_de}: ${modes.detail}`, topic.id, topic.file);
  }

  // A confusion that is drilled and never re-asked. Probe elements carry their family's tags.
  const probed = new Set(graph.elements.filter((e) => e.kind === 'probe').flatMap((e) => e.focus));
  for (const [tag, elements] of graph.elementsByTag) {
    if (probed.has(tag)) continue;
    if (!elements.some((e) => TEACHING_KINDS.has(e.kind))) continue;
    out.push({ kind: 'tag-ohne-probe', message: tag, level: elements[0]?.level });
  }

  /*
   * A named confusion that nothing practises — the counterpart to `tag-ohne-probe`, and the state
   * `ueber-dauer` is deliberately in: the DTZ settled it as an inventory row and a registered tag
   * with zero items behind it, so that the gap would be *counted* rather than invisible. Eight
   * today.
   *
   * Two siblings were written alongside this and deleted after measuring, which is worth recording
   * so nobody adds them again: `tag-nicht-registriert` can never fire, because `bun run validate`
   * already hard-rejects a tag missing from `focusIntroducedBy`; and `tag-ohne-struktur` reported
   * zero while asserting something nobody has established — a focus tag names a confusion, and
   * there is no rule that every confusion must be an inventory row. A problem class that cannot
   * fire, or that encodes an opinion as a defect, makes the inbox less trustworthy rather than more
   * complete.
   */
  const named = new Set(graph.inventory.flatMap((p) => p.focus ?? []));
  for (const tag of new Set([...Object.keys(focusIntroducedBy), ...named])) {
    const elements = graph.elementsByTag.get(tag) ?? [];
    if (!elements.some((e) => TEACHING_KINDS.has(e.kind))) {
      out.push({ kind: 'tag-ohne-aufgabe', message: tag, level: elements[0]?.level });
    }
  }

  for (const point of graph.inventory) {
    if (!graph.topicsByPoint.has(point.id)) {
      out.push({ kind: 'punkt-ohne-thema', message: `${point.id} — ${point.de}` });
    }
  }

  return out;
}
