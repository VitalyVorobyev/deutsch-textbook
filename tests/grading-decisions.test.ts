import { describe, expect, test } from 'bun:test';
import {
  checkGradingDecisions,
  decisionKey,
  type DecisionTarget,
} from '../src/lib/grading-decisions';
import { gradingDecisionSchema, type GradingDecision } from '../src/lib/schemas';
import {
  buildAudit,
  renderMarkdown,
  type AuditAttempt,
  type AuditSnapshot,
  type CatalogItem,
} from '../scripts/progress-audit';

const ts = (day: number) => Date.UTC(2026, 6, day, 12);

function snapshot(attempts: AuditAttempt[]): AuditSnapshot {
  return {
    version: 5,
    exportedAt: new Date(ts(13)).toISOString(),
    profile: 'Vitaly',
    attempts,
    cards: {},
    sessions: [],
    topics: {},
  };
}

function catalog(...items: CatalogItem[]) {
  return new Map(items.map((item) => [
    `${item.setId}:${item.id}`,
    { revision: 1, ...item },
  ]));
}

function decision(over: Partial<GradingDecision>): GradingDecision {
  return {
    item: 'a2/x:item',
    given: 'Ich bin hier.',
    decision: 'confirm',
    note: 'a reason',
    decidedAt: '2026-07-14',
    ...over,
  };
}

/** The pizza item from the real queue: die-for-eine is outside the graded tokens. */
const pizza: CatalogItem = {
  setId: 'a2/perfekt',
  id: 'pizza',
  type: 'translate',
  focus: 'haben-sein',
  prompt_en: 'Yesterday we ate a pizza.',
  answer: 'Gestern haben wir eine Pizza gegessen.',
  key_tokens: ['haben', 'gegessen'],
};

const rejectedPizza = (given: string, focus: string, day: number): AuditAttempt => ({
  setId: pizza.setId,
  itemId: pizza.id,
  itemType: 'translate',
  correct: false,
  given,
  focus,
  itemRevision: 1,
  ts: ts(day),
});

describe('grading decision schema', () => {
  test('accepts a complete ruling', () => {
    expect(gradingDecisionSchema.parse({
      item: 'a2/drill-mir-mich:uebersetzen-hilf-mir',
      given: 'Kanst du mir bitte helfen?',
      decision: 'accept',
      note: 'non-word slip, outside the graded tokens',
      decidedAt: '2026-07-14',
    }).decision).toBe('accept');
  });

  test('rejects unknown rulings, empty notes, malformed refs and dates', () => {
    const valid = decision({});
    expect(gradingDecisionSchema.safeParse({ ...valid, decision: 'maybe' }).success).toBe(false);
    expect(gradingDecisionSchema.safeParse({ ...valid, note: '' }).success).toBe(false);
    expect(gradingDecisionSchema.safeParse({ ...valid, item: 'no-item-separator' }).success)
      .toBe(false);
    expect(gradingDecisionSchema.safeParse({ ...valid, decidedAt: 'July 14' }).success).toBe(false);
  });
});

describe('decision matching', () => {
  test('matches via the translation normalizer, not raw text', () => {
    expect(decisionKey('a2/x:item', ' Ich bin  hier. ')).toBe(decisionKey('a2/x:item', 'Ich bin hier'));
    expect(decisionKey('a2/x:item', 'Ich bin hier')).not.toBe(decisionKey('a2/x:item', 'ich bin hier'));
  });
});

describe('audit with grading decisions', () => {
  test('a decided rendering leaves the queue; an undecided one stays', () => {
    const attempts = [
      // grader-accepted today (matches the accept list) → queued when undecided
      rejectedPizza('Wir haben gestern eine Pizza gegessen.', 'haben-sein', 10),
      // recurring rendering → queued when undecided
      rejectedPizza('Gestern haben wir die Pizza gegessen.', 'haben-sein', 11),
      rejectedPizza('Gestern haben wir die Pizza gegessen.', 'haben-sein', 12),
    ];
    const item = { ...pizza, accept: ['Wir haben gestern eine Pizza gegessen.'] };
    const undecidedOnly = buildAudit(snapshot(attempts), {
      snapshotPath: 'snapshot.json',
      catalog: catalog(item),
      decisions: [decision({
        item: 'a2/perfekt:pizza',
        given: 'Wir haben gestern eine Pizza gegessen.',
        decision: 'accept',
      })],
      now: ts(13),
    });

    expect(undecidedOnly.gradingDecisions).toEqual({ ruled: 1, undecided: 1, orphaned: 0 });
    const rejected = undecidedOnly.gradingCandidates.flatMap((c) => c.rejected.map((r) => r.given));
    expect(rejected).toEqual(['Gestern haben wir die Pizza gegessen.']);
    expect(renderMarkdown(undecidedOnly))
      .toContain('1 rendering(s) ruled; 1 awaiting linguistic review');
  });

  test('accept keeps the attempts excluded from focus signals', () => {
    const attempts = [
      rejectedPizza('Wir haben gestern eine Pizza gegessen.', 'haben-sein', 10),
    ];
    const item = { ...pizza, accept: ['Wir haben gestern eine Pizza gegessen.'] };
    const audit = buildAudit(snapshot(attempts), {
      snapshotPath: 'snapshot.json',
      catalog: catalog(item),
      decisions: [decision({
        item: 'a2/perfekt:pizza',
        given: 'Wir haben gestern eine Pizza gegessen.',
        decision: 'accept',
      })],
      now: ts(13),
    });

    // ruled and out of the queue, but never a haben-sein error either
    expect(audit.gradingCandidates).toEqual([]);
    expect(audit.counts.gradingReviewExcluded).toBe(1);
    expect(audit.focusSignals).toEqual([]);
  });

  test('confirm lifts the exclusion but never replays the stored focus tag', () => {
    // die-for-eine: today's grader leaves the divergence outside the graded tokens,
    // so the stored haben-sein tag (an older grader's attribution) must NOT re-enter.
    const attempts = [
      rejectedPizza('Gestern haben wir die Pizza gegessen.', 'haben-sein', 10),
      rejectedPizza('Gestern haben wir die Pizza gegessen.', 'haben-sein', 11),
    ];
    const audit = buildAudit(snapshot(attempts), {
      snapshotPath: 'snapshot.json',
      catalog: catalog(pizza),
      decisions: [decision({
        item: 'a2/perfekt:pizza',
        given: 'Gestern haben wir die Pizza gegessen.',
        decision: 'confirm',
      })],
      now: ts(13),
    });

    expect(audit.gradingCandidates).toEqual([]);
    expect(audit.gradingDecisions).toEqual({ ruled: 1, undecided: 0, orphaned: 0 });
    // exclusion lifted …
    expect(audit.counts.gradingReviewExcluded).toBe(0);
    // … but the attempts re-enter unattributed: no haben-sein signal appears
    expect(audit.focusSignals).toEqual([]);
  });

  test('confirm re-enters with the attribution today\'s grader computes', () => {
    // sind-for-haben: a graded token is what diverged, so today's grader attributes
    // haben-sein — even though the stored tag says perfekt-satzklammer.
    const attempts = [
      rejectedPizza('Gestern sind wir eine Pizza gegessen.', 'perfekt-satzklammer', 10),
      rejectedPizza('Gestern sind wir eine Pizza gegessen.', 'perfekt-satzklammer', 11),
    ];
    const audit = buildAudit(snapshot(attempts), {
      snapshotPath: 'snapshot.json',
      catalog: catalog(pizza),
      decisions: [decision({
        item: 'a2/perfekt:pizza',
        given: 'Gestern sind wir eine Pizza gegessen.',
        decision: 'confirm',
      })],
      now: ts(13),
    });

    expect(audit.counts.gradingReviewExcluded).toBe(0);
    expect(audit.focusSignals).toContainEqual(expect.objectContaining({
      focus: 'haben-sein',
      wrong: 2,
    }));
    expect(audit.focusSignals.find((row) => row.focus === 'perfekt-satzklammer')).toBeUndefined();
  });

  test('a decision matching no logged rendering is an orphan, not an error', () => {
    const audit = buildAudit(snapshot([
      rejectedPizza('Gestern haben wir die Pizza gegessen.', 'haben-sein', 10),
    ]), {
      snapshotPath: 'snapshot.json',
      catalog: catalog(pizza),
      decisions: [decision({
        item: 'a2/perfekt:pizza',
        given: 'Eine Rendering, die nie geloggt wurde.',
        decision: 'confirm',
      })],
      now: ts(13),
    });

    expect(audit.gradingDecisions.orphaned).toBe(1);
    expect(renderMarkdown(audit)).toContain('1 ruling(s) match no logged rendering (orphaned)');
  });

  test('a decision on a revision-mismatched attempt counts as ruled, not orphaned', () => {
    // The paired content edit bumps the item's revision, so the logged attempt keeps
    // its result and leaves the queue via the mismatch rule — the ruling still applied.
    const bumped = { ...pizza, revision: 2 };
    const audit = buildAudit(snapshot([
      rejectedPizza('Gestern haben wir die Pizza gegessen.', 'haben-sein', 10),
    ]), {
      snapshotPath: 'snapshot.json',
      catalog: catalog(bumped),
      decisions: [decision({
        item: 'a2/perfekt:pizza',
        given: 'Gestern haben wir die Pizza gegessen.',
        decision: 'accept',
      })],
      now: ts(13),
    });

    expect(audit.gradingCandidates).toEqual([]);
    expect(audit.gradingDecisions).toEqual({ ruled: 1, undecided: 0, orphaned: 0 });
  });

  test('accept exclusion survives the revision bump the ruling itself causes', () => {
    // The paired content edit bumps the revision, so the logged attempt is a known
    // mismatch — but the ruling judged the rendering the learner actually faced, so
    // its stored focus must stay withheld from the signals, not leak back in.
    const bumped = { ...pizza, revision: 2 };
    const audit = buildAudit(snapshot([
      rejectedPizza('Gestern haben wir die Pizza gegessen.', 'haben-sein', 10),
    ]), {
      snapshotPath: 'snapshot.json',
      catalog: catalog(bumped),
      decisions: [decision({
        item: 'a2/perfekt:pizza',
        given: 'Gestern haben wir die Pizza gegessen.',
        decision: 'accept',
      })],
      now: ts(13),
    });

    expect(audit.counts.gradingReviewExcluded).toBe(1);
    expect(audit.focusSignals.find((signal) => signal.focus === 'haben-sein')).toBeUndefined();
  });
});

describe('checkGradingDecisions', () => {
  const targets = new Map<string, DecisionTarget>([
    ['a2/perfekt:pizza', {
      type: 'translate',
      answer: pizza.answer,
      accept: ['Wir haben gestern eine Pizza gegessen.'],
      focus: pizza.focus,
      keyTokens: pizza.key_tokens,
    }],
    ['a2/hoeren:diktat', { type: 'listen' }],
  ]);
  const itemFor = (ref: string) => targets.get(ref);

  test('fails a dangling item ref', () => {
    const { errors } = checkGradingDecisions(
      [decision({ item: 'a2/perfekt:vanished' })], itemFor);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('does not resolve');
  });

  test('fails an accept ruling today\'s grader rejects', () => {
    const { errors } = checkGradingDecisions([decision({
      item: 'a2/perfekt:pizza',
      given: 'Gestern haben wir die Pizza gegessen.',
      decision: 'accept',
    })], itemFor);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("today's grader still rejects");
  });

  test('passes an accept ruling the scorer\'s slip-forgiveness covers', () => {
    // one non-word edit (gegesen), outside the graded tokens? No — gegessen IS graded,
    // so use a scaffolding token instead: Pizzza.
    const { errors, warnings } = checkGradingDecisions([decision({
      item: 'a2/perfekt:pizza',
      given: 'Gestern haben wir eine Pizzza gegessen.',
      decision: 'accept',
    })], itemFor);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });

  test('passes an accept ruling paid for via the item accept list', () => {
    const { errors } = checkGradingDecisions([decision({
      item: 'a2/perfekt:pizza',
      given: 'Wir haben gestern eine Pizza gegessen.',
      decision: 'accept',
    })], itemFor);
    expect(errors).toEqual([]);
  });

  test('warns when the ruled item is not a graded translate item', () => {
    const { errors, warnings } = checkGradingDecisions(
      [decision({ item: 'a2/hoeren:diktat' })], itemFor);
    expect(errors).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('matches nothing queueable');
  });

  test('fails duplicate rulings for one rendering', () => {
    const twice = decision({ item: 'a2/perfekt:pizza', given: 'Gestern haben wir die Pizza gegessen.' });
    const { errors } = checkGradingDecisions(
      [twice, { ...twice, given: 'Gestern haben wir die Pizza gegessen' }], itemFor);
    expect(errors.some((error) => error.includes('duplicate ruling'))).toBe(true);
  });
});
