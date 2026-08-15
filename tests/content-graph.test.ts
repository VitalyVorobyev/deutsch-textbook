/**
 * The content graph (`packages/content/src/graph.ts`) — one pass over the corpus, replacing eight.
 *
 * These are **tripwires on the shipping tree**, not fixtures: the counts are what the corpus holds
 * today, measured, and they exist so that a change to the loader that silently drops a directory
 * (a glob that stops matching, a level dir nobody thought of, a schema rename) fails loudly here
 * rather than showing up as a coverage figure that quietly got better. That failure mode is the
 * repo's history: `i18n-content.test.ts` guards its own glob with `expect(seen).toBeGreaterThan(50)`
 * for exactly this reason, and it caught a silently-empty glob during the workspace split.
 *
 * So when one of these numbers changes, the question is never "which number do I edit" but "did I
 * add content, or did I break the loader". Adding content: update the number in the same commit.
 */
import { describe, expect, test } from 'bun:test';
import { LEARNING_ACTIVITIES, LEVELS } from '@da/schema';
import { contentGraph } from '@da/content/graph';
import { graphPayload } from '@da/content/payload';
import { problems, topicProfile } from '@da/content/profile';
import { LESSON_STAGES, TOUCHES, type ElementKind, type LessonStage } from '@da/content/elements';
import { formatItemRef, parseItemRef, sameItem } from '@da/content/refs';

const graph = contentGraph();

describe('content graph', () => {
  test('loads every entity in the corpus with no schema notes', () => {
    // A note means a file did not match its schema. `bun run validate` is the gate; this asserts
    // the graph agrees with it, because the graph deliberately does not throw on a bad file.
    expect(graph.notes).toEqual([]);
    expect(graph.topics.size).toBe(57);
    expect(graph.sets.size).toBe(438);
    expect(graph.readings.size).toBe(85);
    expect(graph.vocab.size).toBe(129);
    expect(graph.listening.size).toBe(40);
    expect(graph.documents.size).toBe(5);
    expect(graph.discovery.size).toBe(12);
    expect(graph.wortfelder.size).toBe(2);
    expect(graph.wortnetze.size).toBe(10);
    expect(graph.units.length).toBe(57);
    expect(graph.outcomes.size).toBe(221);
    // 106 since 2026-08-15: the eight exact source-led A2 slices closed the DTZ tail with learner
    // evidence; they are inventory rows rather than aliases on broader existing structures.
    expect(graph.inventory.length).toBe(106);
    expect(graph.grammarTracks).toHaveLength(10);
    expect(graph.inventory.every((point) => graph.grammarTracks.some((track) => track.id === point.track))).toBe(true);
  });

  test('no element outranks the topic it belongs to', () => {
    const orphans = graph.elements.filter((e) => !graph.topics.has(e.topic));
    expect(orphans.map((e) => e.id)).toEqual([]);

    const rank = (level: string) => LEVELS.indexOf(level as (typeof LEVELS)[number]);

    // The CEFR rule, as it actually holds. Everything on the spine must sit exactly at its
    // topic's level — a set, a reading, an article, a recording or a document one level up is
    // how above-level German reaches a learner who has not met it.
    const spine = graph.elements.filter((e) => e.kind !== 'entdecken' && e.kind !== 'wortschatz');
    expect(spine.filter((e) => e.level !== graph.topics.get(e.topic)!.data.level).map((e) => e.id)).toEqual([]);

    // Two deliberate exemptions, and they are exemptions in opposite directions.
    // A deck may sit BELOW its topic — "A2 vocabulary recycles, never adopts" (CLAUDE.md), so the
    // A1 modal-verb deck hanging off the A2 modal-verb topic is the rule working, not a defect.
    const decks = graph.elements.filter((e) => e.kind === 'wortschatz');
    expect(decks.filter((e) => rank(e.level) > rank(graph.topics.get(e.topic)!.data.level))).toEqual([]);

    // Entdecken may sit ABOVE: it is outside the spine, carries no mastery and obligates the
    // learner to nothing, so a B1 piece is allowed to enrich an A2 topic. Six do today — and one
    // more (`klassiker-lesen`, an A2 piece on the B1 narrative topic) sits below, which is the
    // ordinary direction and needs no exemption.
    const off = graph.elements.filter(
      (e) => e.kind === 'entdecken' && e.level !== graph.topics.get(e.topic)!.data.level,
    );
    expect(off.filter((e) => rank(e.level) > rank(graph.topics.get(e.topic)!.data.level)).length).toBe(6);
    expect(off.length).toBe(7);
  });

  test('element ids are unique and every element kind is a declared one', () => {
    const ids = graph.elements.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);

    const counts = new Map<ElementKind, number>();
    for (const element of graph.elements) counts.set(element.kind, (counts.get(element.kind) ?? 0) + 1);
    expect(Object.fromEntries([...counts].sort())).toEqual({
      artikel: 57,
      checkpoint: 3,
      dokument: 5,
      drill: 19,
      einstufung: 3,
      entdecken: 19,
      hoertext: 40,
      'lesetext-extensiv': 17,
      'lesetext-intensiv': 68,
      praxis: 201,
      pretest: 57,
      probe: 152,
      pruefungspraxis: 3,
      wortfeld: 2,
      wortschatz: 47,
    });
    expect(graph.elements.length).toBe(693);
  });

  test('the lesson cycle and activity architecture are explicit', () => {
    const byStage = new Map<LessonStage, number>();
    for (const element of graph.elements) byStage.set(element.stage, (byStage.get(element.stage) ?? 0) + 1);
    for (const stage of byStage.keys()) expect(LESSON_STAGES).toContain(stage);

    expect(byStage.get('transfer')).toBe(118);
    expect(byStage.get('geruest')).toBe(77);
    expect(byStage.get('nachpruefung')).toBe(155);

    const teaching = graph.elements.filter((element) => element.activity);
    expect(teaching).toHaveLength(220);
    expect(Object.fromEntries(LEARNING_ACTIVITIES.map((activity) => [
      activity,
      teaching.filter((element) => element.activity === activity).length,
    ]))).toEqual({ core: 57, extension: 29, application: 115, remediation: 19 });
    expect([...graph.topics.keys()].filter((topic) =>
      !(graph.elementsByTopic.get(topic) ?? []).some(
        (element) => element.activity === 'application' && element.touches.includes('produktion'),
      ),
    )).toEqual([]);
  });

  test('every touch a topic delivers is one of the four, and production is reachable everywhere', () => {
    for (const element of graph.elements) {
      for (const touch of element.touches) expect(TOUCHES).toContain(touch);
    }
    // Every topic must have at least one element that asks the learner to produce German.
    const silent = [...graph.topics.keys()].filter(
      (id) => !(graph.elementsByTopic.get(id) ?? []).some((e) => e.touches.includes('produktion')),
    );
    expect(silent).toEqual([]);
  });

  test('82 decks belong to no topic — the Wortliste completion decks', () => {
    // Listing one of these in a topic's `vocab:` would flip its fresh-card gate and bury hundreds
    // of words behind that topic (CLAUDE.md). The count is here so a stray `vocab:` entry shows up.
    const unowned = [...graph.vocab.keys()].filter((id) => !graph.deckOwners.has(id));
    expect(unowned.length).toBe(82);
    expect(graph.deckOwners.size).toBe(47);
  });

  test('memoisation returns the same object, and can be bypassed', () => {
    expect(contentGraph()).toBe(graph);
    expect(contentGraph(graph.root, { fresh: true })).not.toBe(graph);
  });

  test('the completed A1–B1 profile queue contains no fictional blocker or attention finding', () => {
    const payload = graphPayload(graph);
    expect(payload.diagnostics).toHaveLength(payload.problems.length);
    expect(payload.diagnostics.filter((item) => item.severity === 'blocking')).toHaveLength(0);
    expect(payload.diagnostics.filter((item) => item.severity === 'attention')).toHaveLength(0);
    expect(payload.problems).toHaveLength(0);
  }, 20_000);

  test('reading length is visible as an indicator, never promoted to a defect by arithmetic', () => {
    const profile = topicProfile(graph, 'infinitiv-mit-zu');
    const length = profile?.checks.find((check) => check.id === 'lesetext-umfang');
    expect(length?.ok).toBe(true);
    expect(length?.detail).toMatch(/\d+ Wörter/);
    expect(problems(graph).some((problem) => problem.kind === 'lesetext-umfang')).toBe(false);
  });
});

describe('item references', () => {
  test('both spellings parse to the same item, and the canonical form is the double colon', () => {
    const double = parseItemRef('a2/perfekt-haben-sein::p1');
    const single = parseItemRef('a2/perfekt-haben-sein:p1');
    expect(double).toEqual({ setId: 'a2/perfekt-haben-sein', itemId: 'p1' });
    expect(single).toEqual(double!);
    expect(formatItemRef(single!)).toBe('a2/perfekt-haben-sein::p1');
    expect(sameItem('a2/x:i1', 'a2/x::i1')).toBe(true);
    expect(sameItem('a2/x::i1', 'a2/x::i2')).toBe(false);
  });

  test('rejects what is not a reference', () => {
    // `a::b::c` is in the list because a set id never contains a colon: without that check the
    // last-colon rule happily returns `{setId: "a::b", itemId: "c"}` for a malformed string.
    for (const bad of ['', '   ', 'no-colon', ':leading', 'trailing:', 'a::b::c', 'a:b:c']) {
      expect(parseItemRef(bad)).toBeUndefined();
    }
  });

  test('every arming key in the corpus parses, and resolves to an item that exists', () => {
    const unresolved: string[] = [];
    for (const set of graph.sets.values()) {
      for (const key of set.data.arming ?? []) {
        const ref = parseItemRef(key);
        if (!ref) {
          unresolved.push(`${set.id}: unparseable ${key}`);
          continue;
        }
        const target = graph.sets.get(ref.setId);
        if (!target?.data.items?.some((i) => i.id === ref.itemId)) unresolved.push(`${set.id}: ${key}`);
      }
    }
    expect(unresolved).toEqual([]);
  });
});
