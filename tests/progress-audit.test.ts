import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SUPPORTED_SNAPSHOT_VERSIONS } from '../src/lib/snapshot-schema';
import {
  buildAudit,
  readSnapshot,
  renderMarkdown,
  resolveSnapshotPath,
  run,
  type AuditAttempt,
  type AuditSnapshot,
  type CatalogItem,
} from '../scripts/progress-audit';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function tempRoot() {
  const root = mkdtempSync(join(tmpdir(), 'deutsch-atlas-audit-'));
  roots.push(root);
  return root;
}

const ts = (day: number) => Date.UTC(2026, 6, day, 12);

function snapshot(over: Partial<AuditSnapshot> = {}): AuditSnapshot {
  const value: AuditSnapshot = {
    version: 5,
    exportedAt: new Date(ts(13)).toISOString(),
    profile: 'Vitaly',
    attempts: [],
    cards: {},
    sessions: [],
    topics: {},
    ...over,
  };
  value.attempts = value.attempts.map((attempt) =>
    'itemRevision' in attempt ? attempt : { ...attempt, itemRevision: 1 });
  return value;
}

function catalog(...items: CatalogItem[]) {
  return new Map(items.map((item) => [
    `${item.setId}:${item.id}`,
    { revision: 1, ...item },
  ]));
}

describe('progress audit', () => {
  test('selects the newest snapshot or an explicit path', () => {
    const root = tempRoot();
    const dir = join(root, 'progress', 'vitaly');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, '2026-07-10.json'), '{}');
    writeFileSync(join(dir, '2026-07-13.json'), '{}');
    expect(resolveSnapshotPath(root, 'vitaly')).toBe(join(dir, '2026-07-13.json'));
    expect(resolveSnapshotPath(root, undefined, 'progress/vitaly/2026-07-10.json'))
      .toBe(join(dir, '2026-07-10.json'));
  });

  // Iterates the schema's own version list: when a v7 is added there, this test starts
  // exercising it through `readSnapshot` automatically — the audit rejected live v6
  // snapshots for a day because its accepted-version list was a hand-written copy.
  test('reads every supported snapshot version and supplies fields missing from legacy ones', () => {
    const root = tempRoot();
    expect(SUPPORTED_SNAPSHOT_VERSIONS).toContain(6);
    for (const version of SUPPORTED_SNAPSHOT_VERSIONS) {
      const path = join(root, `${version}.json`);
      writeFileSync(path, JSON.stringify({
        version,
        exportedAt: new Date(ts(13)).toISOString(),
        attempts: [],
        cards: {},
      }));
      const parsed = readSnapshot(path);
      expect(parsed.version).toBe(version);
      expect(parsed.sessions).toEqual([]);
      expect(parsed.topics).toEqual({});
    }
  });

  test('never replays an attempt whose revision is known to have changed', () => {
    const item: CatalogItem = {
      setId: 'a2/x', id: 'changed', revision: 2, type: 'translate',
      answer: 'Ich fahre morgen.', key_tokens: ['fahre'], focus: 'verb-position',
    };
    const audit = buildAudit(snapshot({ attempts: [{
      setId: item.setId, itemId: item.id, itemType: 'translate', correct: false,
      given: 'Ich fahre morgen.', focus: item.focus, itemRevision: 1, ts: ts(11),
    }] }), { snapshotPath: 'snapshot.json', catalog: catalog(item), now: ts(13) });

    // The learner answered revision 1; the item ships revision 2. Grading that answer against
    // today's key would grade a question they were never asked, so it keeps its logged result.
    expect(audit.gradingCandidates).toEqual([]);
    expect(audit.counts.revisionKnown).toBe(1);
    expect(audit.counts.revisionMismatch).toBe(1);
  });

  // No attempt logged before the v5 contract carries a revision, so an absent one must mean
  // "legacy", not "changed". Treating it as changed retired the entire history from this audit:
  // the review queue went permanently empty, and its `excluded` set with it — quietly re-admitting
  // rejections that today's grader accepts back into the focus signal.
  test('keeps legacy attempts without a revision in the grading review', () => {
    const item: CatalogItem = {
      setId: 'a2/x', id: 'stable', type: 'translate',
      answer: 'Ich fahre morgen.', key_tokens: ['fahre'], focus: 'verb-position',
    };
    const audit = buildAudit(snapshot({ attempts: [{
      setId: item.setId, itemId: item.id, itemType: 'translate', correct: false,
      given: 'Ich fahre morgen.', focus: item.focus, itemRevision: undefined, ts: ts(10),
    }] }), { snapshotPath: 'snapshot.json', catalog: catalog(item), now: ts(13) });

    // logged wrong, but the current grader accepts it verbatim: surfaced for review …
    expect(audit.gradingCandidates).toHaveLength(1);
    expect(audit.gradingCandidates[0]?.ref).toBe('a2/x:stable');
    expect(audit.counts.revisionKnown).toBe(0);
    expect(audit.counts.revisionMismatch).toBe(0);
    // … and withheld from the focus signal rather than counted as a `verb-position` failure
    expect(audit.focusSignals.find((signal) => signal.focus === 'verb-position')).toBeUndefined();
  });

  test('regrades a legacy probe against the current key', () => {
    // `delayedSummary` selects probes with /(^|\/)probe-/ — a setId that cannot match makes
    // every probe assertion below vacuously true, which is how this path went untested.
    const item: CatalogItem = {
      setId: 'a2/probe-x', id: 'p1', type: 'translate',
      answer: 'Ich fahre morgen.', key_tokens: ['fahre'], focus: 'verb-position',
    };
    const audit = buildAudit(snapshot({ attempts: [{
      setId: item.setId, itemId: item.id, itemType: 'translate', correct: false,
      given: 'Ich fahre morgen.', focus: item.focus, itemRevision: undefined, ts: ts(10),
    }] }), { snapshotPath: 'snapshot.json', catalog: catalog(item), now: ts(13) });

    expect(audit.delayed.probes.attempts).toBe(1);
    expect(audit.delayed.probes.loggedCorrect).toBe(0);
    // "correct under the current contract" must mean that, not merely echo the logged grade
    expect(audit.delayed.probes.currentCorrect).toBe(1);
  });

  // The gate asks whether the *competence* survived the interval, not whether the sentence did.
  // Read against whole-attempt correctness the A1 cohort scores 18%; read against target retention
  // it scores 59%. Those are different findings, and the audit must not conflate them.
  test('counts a target-retained miss as retention, not as a failure', () => {
    const item: CatalogItem = {
      setId: 'a1/probe-x', id: 'p1', type: 'translate',
      answer: 'Ich fahre mit dem Bus.', key_tokens: ['fahre'], focus: 'verbzweit',
    };
    const audit = buildAudit(snapshot({ attempts: [{
      // `fahre` — the token `verbzweit` grades — is right and in position 2. The error is `den`
      // for `dem`: a real one (closed-class swaps are never forgiven as typos), but a dative
      // error, not a word-order one. So the attempt is wrong, and `verbzweit` was retained.
      setId: item.setId, itemId: item.id, itemType: 'translate', correct: false,
      given: 'Ich fahre mit den Bus.', focus: item.focus, itemRevision: undefined, ts: ts(10),
    }] }), { snapshotPath: 'snapshot.json', catalog: catalog(item), now: ts(13) });

    expect(audit.delayed.probes.focusFailed).toBe(0);
    expect(audit.delayed.probes.focusRetained).toBe(1);
    const row = audit.delayed.probes.byCompetence.find((r) => r.focus === 'verbzweit');
    expect(row?.level).toBe('A1');
    expect(row?.retained).toBe(1);
    expect(row?.retentionPct).toBe(100);
  });

  // A family serves one variant per interval, so a single-family competence caps at one attempt
  // per scheduled interval. A row below that floor is mid-schedule, not evidence — and 2/2 is two
  // data points, never a 100% pass.
  test('reports a competence below the interval count as pending, never as a pass', () => {
    const items: CatalogItem[] = [
      { setId: 'a1/probe-a', id: 'v1', type: 'translate', answer: 'Ich bin da.', focus: 'kopula-sein' },
      { setId: 'a1/probe-a', id: 'v2', type: 'translate', answer: 'Du bist da.', focus: 'kopula-sein' },
      { setId: 'a1/probe-b', id: 'v1', type: 'translate', answer: 'Ich habe Zeit.', focus: 'genus' },
      { setId: 'a1/probe-b', id: 'v2', type: 'translate', answer: 'Er hat Zeit.', focus: 'genus' },
      { setId: 'a1/probe-b', id: 'v3', type: 'translate', answer: 'Wir haben Zeit.', focus: 'genus' },
    ];
    const audit = buildAudit(snapshot({
      attempts: items.map((item, i) => ({
        setId: item.setId, itemId: item.id, itemType: 'translate' as const, correct: true,
        given: item.answer!, focus: item.focus, itemRevision: undefined, ts: ts(8 + i),
      })),
    }), { snapshotPath: 'snapshot.json', catalog: catalog(...items), now: ts(13) });

    const kopula = audit.delayed.probes.byCompetence.find((r) => r.focus === 'kopula-sein');
    const genus = audit.delayed.probes.byCompetence.find((r) => r.focus === 'genus');
    // Both are at 100%; only the one with an attempt per interval may be read as such.
    expect(kopula?.attempts).toBe(2);
    expect(kopula?.readable).toBe(false);
    expect(genus?.attempts).toBe(3);
    expect(genus?.readable).toBe(true);

    const report = renderMarkdown(audit);
    expect(report).toContain('## Retention by competence');
    expect(report).toContain('**A1: 1/1 readable competences at ≥80% retention** (1 pending');
  });

  // An untagged family has no tag to attribute a miss to, so every miss lands in `retained` and
  // the row reads 100% however badly it went. That is an instrument gap and must never be readable.
  test('never lets an untagged probe family count toward the gate', () => {
    const item: CatalogItem = {
      setId: 'a1/probe-untagged', id: 'p1', type: 'translate', answer: 'Hallo, ich heiße Marta.',
    };
    const audit = buildAudit(snapshot({
      attempts: [10, 11, 12].map((day) => ({
        setId: item.setId, itemId: item.id, itemType: 'translate' as const, correct: false,
        given: 'völlig falsch', focus: undefined, itemRevision: undefined, ts: ts(day),
      })),
    }), { snapshotPath: 'snapshot.json', catalog: catalog(item), now: ts(13) });

    const row = audit.delayed.probes.byCompetence.find((r) => r.focus === undefined);
    expect(row?.attempts).toBe(3); // enough attempts …
    expect(row?.retentionPct).toBe(100); // … and a perfect score it did not earn …
    expect(row?.readable).toBe(false); // … which is exactly why it is excluded.
    // With nothing readable left, the level verdict must say so outright rather than print a
    // percentage over an empty set.
    expect(renderMarkdown(audit)).toContain('**A1: no competence is readable yet**');
    expect(renderMarkdown(audit)).toContain('carry no focus tag (1)');
  });

  test('aggregates partial credit, response modes, cards, probes and delayed evidence', () => {
    const audit = buildAudit(snapshot({
      attempts: [
        { setId: 'a1/x', itemId: 'table', itemType: 'table', correct: false,
          correctParts: 3, totalParts: 4, given: '', responseMode: 'writing', ts: ts(1) },
        { setId: 'a1/x', itemId: 'table', itemType: 'table', correct: true,
          given: '', responseMode: 'writing', ts: ts(4) },
        { setId: 'a1/probe-x', itemId: 'variant-a', itemType: 'translate', correct: true,
          given: 'Gut.', responseMode: 'writing', ts: ts(4) },
        { setId: 'a1/x', itemId: 'speak', itemType: 'speak', correct: true,
          evidence: 'practice', given: '', responseMode: 'spoken-production', ts: ts(4) },
      ],
      cards: {
        'deck::wort::de-x': { lapses: 1 },
        'deck::wort::x-de': { lapses: 2 },
      },
    }), { snapshotPath: 'snapshot.json', catalog: catalog(), now: ts(13) });

    const table = audit.byItemType.find((row) => row.name === 'table')!;
    expect(table.score).toBe(1.75);
    expect(table.possible).toBe(2);
    expect(audit.byResponseMode.find((row) => row.name === 'spoken-production')?.verified).toBe(0);
    expect(audit.byTopic.find((row) => row.name === 'a1/x')?.attempts).toBe(3);
    expect(audit.cards.lapses).toBe(3);
    expect(audit.cards.byDirection).toEqual([
      { direction: 'de-x', cards: 1, lapses: 1 },
      { direction: 'x-de', cards: 1, lapses: 2 },
    ]);
    expect(renderMarkdown(audit)).toContain('Deck (top 10 by lapses)');
    expect(audit.delayed).toEqual({
      attempts: 1,
      correct: 1,
      probes: {
        attempts: 1,
        loggedCorrect: 1,
        currentCorrect: 1,
        focusRetained: 0,
        focusFailed: 0,
        byCompetence: [{
          level: 'A1', focus: undefined, families: 1, attempts: 1,
          correct: 1, retained: 0, failed: 0,
          retentionPct: 100, maxElapsedDays: 0, readable: false,
          formats: { translate: { attempts: 1, survived: 1 } },
        }],
        byReadability: [],
        projectTo: '2026-08-03',
        dueNow: 0,
        overdue: 0,
        maxOverdueDays: 0,
        maxTakenInOneDay: 1,
        actualIntervals: [],
      },
    });
  });

  test('queues intact-focus and repeated rejected renderings without declaring them valid', () => {
    const item: CatalogItem = {
      setId: 'a2/perfekt',
      id: 'pizza',
      type: 'translate',
      focus: 'haben-sein',
      prompt_en: 'Yesterday we ate a pizza.',
      answer: 'Gestern haben wir eine Pizza gegessen.',
      key_tokens: ['haben', 'gegessen'],
    };
    const rejected = {
      setId: item.setId,
      itemId: item.id,
      itemType: 'translate',
      correct: false,
      given: 'Gestern haben wir die Pizza gegessen.',
      focus: 'haben-sein',
    };
    const audit = buildAudit(snapshot({ attempts: [
      { ...rejected, ts: ts(10) },
      { ...rejected, ts: ts(11) },
    ] }), { snapshotPath: 'snapshot.json', catalog: catalog(item), now: ts(13) });

    expect(audit.gradingCandidates).toHaveLength(1);
    expect(audit.gradingCandidates[0]?.rejected[0]?.count).toBe(2);
    expect(audit.gradingCandidates[0]?.rejected[0]?.reasons).toContain(
      'all graded key tokens remain intact in the closest authored rendering',
    );
    expect(audit.counts.gradingReviewExcluded).toBe(2);
    expect(audit.focusSignals).toEqual([]);
    expect(renderMarkdown(audit)).toContain('needs linguistic review');
    expect(renderMarkdown(audit)).not.toContain('valid answer');
  });

  test('keeps review reasons on the rendering that earned them', () => {
    const item: CatalogItem = {
      setId: 'a2/perfekt', id: 'pizza', type: 'translate', focus: 'haben-sein',
      answer: 'Gestern haben wir eine Pizza gegessen.', key_tokens: ['haben', 'gegessen'],
    };
    const audit = buildAudit(snapshot({ attempts: [
      { setId: item.setId, itemId: item.id, itemType: 'translate', correct: false,
        given: 'Gestern haben wir die Pizza gegessen.', focus: 'haben-sein', ts: ts(10) },
      { setId: item.setId, itemId: item.id, itemType: 'translate', correct: false,
        given: 'Gestern sind wir eine Pizza gegessen.', focus: 'haben-sein', ts: ts(11) },
    ] }), { snapshotPath: 'snapshot.json', catalog: catalog(item), now: ts(13) });

    const rows = audit.gradingCandidates[0]!.rejected;
    const queued = rows.find((row) => row.given.includes('haben'));
    expect(queued?.reasons).toContain(
      'all graded key tokens remain intact in the closest authored rendering',
    );
    expect(rows.some((row) => row.given.includes('sind'))).toBe(false);
    expect(audit.counts.gradingReviewExcluded).toBe(1);
  });

  test('mirrors grader casing when a sentence-initial key token moves', () => {
    const item: CatalogItem = {
      setId: 'a2/probe-time',
      id: 'wrong-preposition',
      type: 'translate',
      focus: 'um-am-zeit',
      answer: 'Am Donnerstag mache ich um sechs Uhr Sport.',
      accept: ['Ich mache am Donnerstag um sechs Uhr Sport.'],
      key_tokens: ['Am', 'um'],
    };
    const audit = buildAudit(snapshot({ attempts: [
      {
        setId: item.setId,
        itemId: item.id,
        itemType: 'translate',
        correct: false,
        given: 'Ich mache im Donnerstag um sechs Uhr Sport.',
        focus: item.focus,
        ts: ts(12),
      },
    ] }), { snapshotPath: 'snapshot.json', catalog: catalog(item), now: ts(13) });

    expect(audit.gradingCandidates).toEqual([]);
    expect(audit.counts.gradingReviewExcluded).toBe(0);
    expect(audit.focusSignals).toContainEqual(expect.objectContaining({
      focus: 'um-am-zeit',
      wrong: 1,
      distinctWrongItems: 1,
    }));
  });

  test('replays probe translations against the current grading contract', () => {
    const items: CatalogItem[] = [
      { setId: 'a2/probe-time', id: 'accepted', type: 'translate', focus: 'um-am-zeit',
        answer: 'Am Donnerstag mache ich um sechs Uhr Sport.',
        accept: ['Am Donnerstag um sechs Uhr mache ich Sport.'], key_tokens: ['Am', 'um'] },
      { setId: 'a2/probe-case', id: 'retained', type: 'translate',
        focus: 'trennbar-wortstellung', answer: 'Am Samstag bringt meine Freundin ihre Kinder mit.',
        key_tokens: ['bringt', 'mit'] },
      { setId: 'a2/probe-case', id: 'failed', type: 'translate', focus: 'dativ-artikel',
        answer: 'Am Samstag spreche ich mit meinen Freunden.',
        key_tokens: ['meinen', 'Freunden'] },
    ];
    const attempts: AuditAttempt[] = [
      { setId: items[0]!.setId, itemId: 'accepted', itemType: 'translate', correct: false,
        given: 'Am Donnerstag um sechs Uhr mache ich Sport.', focus: 'um-am-zeit', ts: ts(10) },
      { setId: items[1]!.setId, itemId: 'retained', itemType: 'translate', correct: false,
        given: 'Am Samstag bringt meine Freundin den Kindern mit.', ts: ts(10) },
      { setId: items[2]!.setId, itemId: 'failed', itemType: 'translate', correct: false,
        given: 'Am Samstag spreche ich mit meine Freunde.', focus: 'dativ-artikel', ts: ts(10) },
    ];
    const audit = buildAudit(snapshot({ attempts }), {
      snapshotPath: 'snapshot.json', catalog: catalog(...items), now: ts(13),
    });

    expect(audit.delayed.probes).toEqual({
      attempts: 3,
      loggedCorrect: 0,
      currentCorrect: 1,
      focusRetained: 1,
      focusFailed: 1,
      // The same three verdicts, split by the competence each was aimed at — one row per focus,
      // and each row is one attempt deep, so none of them is readable.
      byCompetence: [
        { level: 'A2', focus: 'dativ-artikel', families: 1, attempts: 1,
          correct: 0, retained: 0, failed: 1,
          retentionPct: 0, maxElapsedDays: 0, readable: false,
          formats: { translate: { attempts: 1, survived: 0 } } },
        { level: 'A2', focus: 'trennbar-wortstellung', families: 1, attempts: 1,
          correct: 0, retained: 1, failed: 0,
          retentionPct: 100, maxElapsedDays: 0, readable: false,
          formats: { translate: { attempts: 1, survived: 1 } } },
        { level: 'A2', focus: 'um-am-zeit', families: 1, attempts: 1,
          correct: 1, retained: 0, failed: 0,
          retentionPct: 100, maxElapsedDays: 0, readable: false,
          formats: { translate: { attempts: 1, survived: 1 } } },
      ],
      byReadability: [],
      projectTo: '2026-08-03',
      dueNow: 0,
      overdue: 0,
      maxOverdueDays: 0,
      maxTakenInOneDay: 3,
      actualIntervals: [],
    });
    expect(renderMarkdown(audit)).toContain('1 correct under the current contract');
  });

  /**
   * A competence probed by two families of different type is measured through two response
   * demands, and a `cloze` gap is the easier one — the frame is handed over and only the
   * graded token is asked for. Pooling is the right headline, but pooling silently would let
   * the percentage rise when the second format is added and read as improved retention. The
   * split is the check on the headline, so it has to survive in the data, not just the render.
   */
  test('splits a competence by response format so a format effect cannot hide', () => {
    const items: CatalogItem[] = [
      { setId: 'a1/probe-zeit', id: 'variant-a', type: 'translate', topic: 'alltag-zeit',
        role: 'probe', focus: 'um-am-zeit', answer: 'Der Bus fährt um elf Uhr.',
        key_tokens: ['um'] },
      { setId: 'a1/probe-zeit-luecken', id: 'variant-a', type: 'cloze', topic: 'alltag-zeit',
        role: 'probe', focus: 'um-am-zeit' },
      { setId: 'a1/probe-zeit-luecken', id: 'variant-b', type: 'cloze', topic: 'alltag-zeit',
        role: 'probe', focus: 'um-am-zeit' },
    ];
    const attempts: AuditAttempt[] = [
      // the hard format missed the target …
      { setId: 'a1/probe-zeit', itemId: 'variant-a', itemType: 'translate', correct: false,
        given: 'Der Bus fährt am elf Uhr.', ts: ts(4) },
      // … while the easy one carried it twice
      { setId: 'a1/probe-zeit-luecken', itemId: 'variant-a', itemType: 'cloze', correct: true,
        given: 'um', ts: ts(4) },
      { setId: 'a1/probe-zeit-luecken', itemId: 'variant-b', itemType: 'cloze', correct: true,
        given: 'im', ts: ts(9) },
    ];
    const audit = buildAudit(snapshot({ attempts }), {
      snapshotPath: 'snapshot.json', catalog: catalog(...items), now: ts(10),
    });

    const row = audit.delayed.probes.byCompetence.find((r) => r.focus === 'um-am-zeit')!;
    // Pooled, the competence reads 67% — a figure two thirds built from the easier format.
    expect(row.attempts).toBe(3);
    expect(row.retentionPct).toBe(67);
    expect(row.formats).toEqual({
      translate: { attempts: 1, survived: 0 },
      cloze: { attempts: 2, survived: 2 },
    });
    const md = renderMarkdown(audit);
    expect(md).toContain('cloze 2/2 · translate 0/1');
    expect(md).toContain('read a rise against the split');
  });

  test('reports probe debt and the actually-elapsed interval distribution', () => {
    // Two probe families derived from the catalog, armed by their topics' practice sets —
    // everything below is computed from the attempt log, exactly like the scheduler does.
    const items: CatalogItem[] = [
      { setId: 'a1/akkusativ', id: 'p1', type: 'cloze', topic: 'akkusativ', role: 'practice' },
      { setId: 'a1/probe-akkusativ', id: 'variant-a', type: 'mc', topic: 'akkusativ', role: 'probe' },
      { setId: 'a1/probe-akkusativ', id: 'variant-b', type: 'mc', topic: 'akkusativ', role: 'probe' },
      { setId: 'a1/probe-akkusativ', id: 'variant-c', type: 'mc', topic: 'akkusativ', role: 'probe' },
      { setId: 'a1/wohnen', id: 'p1', type: 'cloze', topic: 'wohnen', role: 'practice' },
      { setId: 'a1/probe-wohnen', id: 'variant-a', type: 'mc', topic: 'wohnen', role: 'probe' },
      { setId: 'a1/probe-wohnen', id: 'variant-b', type: 'mc', topic: 'wohnen', role: 'probe' },
    ];
    const attempts: AuditAttempt[] = [
      // both topics practised on day 1 → both families armed at ts(1)
      { setId: 'a1/akkusativ', itemId: 'p1', itemType: 'cloze', correct: true, given: '', ts: ts(1) },
      { setId: 'a1/wohnen', itemId: 'p1', itemType: 'cloze', correct: true, given: '', ts: ts(1) },
      // the 2-day probes actually happened after 3 days …
      { setId: 'a1/probe-akkusativ', itemId: 'variant-a', itemType: 'mc', correct: true, given: '', ts: ts(4) },
      { setId: 'a1/probe-wohnen', itemId: 'variant-a', itemType: 'mc', correct: true, given: '', ts: ts(4) },
      // … and akkusativ's 7-day probe after 11
      { setId: 'a1/probe-akkusativ', itemId: 'variant-b', itemType: 'mc', correct: false, given: '', ts: ts(12) },
    ];
    const audit = buildAudit(snapshot({ attempts }), {
      snapshotPath: 'snapshot.json', catalog: catalog(...items), now: ts(13),
    });

    expect(audit.delayed.probes).toMatchObject({
      // wohnen's 7-day probe fell due on day 8 and is still open at the day-13 export;
      // akkusativ's 21-day probe is not due yet
      dueNow: 1,
      overdue: 1,
      maxOverdueDays: 5,
      actualIntervals: [
        { days: 3, count: 2 },
        { days: 11, count: 1 },
      ],
    });
    expect(renderMarkdown(audit))
      .toContain('Actual probe intervals (nominal 2/7/21): 3d ×2 · 11d ×1.');
  });

  test('requires distinct items plus recency or a probe for a persistent focus', () => {
    const attempts: AuditAttempt[] = [
      { setId: 'a2/x', itemId: 'one', itemType: 'cloze', correct: false,
        given: '', focus: 'dativ-artikel', ts: ts(10) },
      { setId: 'a2/x', itemId: 'two', itemType: 'translate', correct: false,
        given: '', focus: 'dativ-artikel', ts: ts(11) },
      { setId: 'a2/x', itemId: 'two', itemType: 'translate', correct: true,
        given: '', focus: 'dativ-artikel', ts: ts(12) },
      { setId: 'a1/y', itemId: 'one', itemType: 'mc', correct: false,
        given: '', focus: 'genus', ts: ts(1) },
    ];
    const audit = buildAudit(snapshot({ attempts }), {
      snapshotPath: 'snapshot.json', catalog: catalog(), now: ts(13),
    });
    expect(audit.focusSignals[0]).toMatchObject({
      focus: 'dativ-artikel', status: 'persistent', distinctWrongItems: 2, recovered: true,
    });
    expect(audit.focusSignals.find((row) => row.focus === 'genus')?.status).toBe('historical');
  });

  test('is deterministic when snapshot attempts arrive in a different order', () => {
    const attempts: AuditAttempt[] = [
      { setId: 'a2/z', itemId: 'two', itemType: 'cloze', correct: false,
        given: 'z', focus: 'dativ-artikel', ts: ts(10) },
      { setId: 'a2/a', itemId: 'one', itemType: 'cloze', correct: true,
        given: 'a', focus: 'dativ-artikel', ts: ts(10) },
    ];
    const options = { snapshotPath: 'snapshot.json', catalog: catalog(), now: ts(13) };
    const forward = buildAudit(snapshot({ attempts }), options);
    const reverse = buildAudit(snapshot({ attempts: [...attempts].reverse() }), options);
    expect(reverse).toEqual(forward);
  });

  test('caps focus signals but never the review queue, and renders item detail on demand', () => {
    const items: CatalogItem[] = [];
    const attempts: AuditAttempt[] = [];
    for (let index = 0; index < 12; index++) {
      items.push({
        setId: 'a2/x', id: `i${index}`, type: 'translate', answer: 'Ich bin hier.',
        focus: `focus-${index}`, key_tokens: ['bin'],
      });
      attempts.push({
        setId: 'a2/x', itemId: `i${index}`, itemType: 'translate', correct: false,
        given: 'Ich bin dort.', focus: `focus-${index}`, ts: ts(10) + index,
      });
      attempts.push({
        setId: 'a2/y', itemId: `i${index}`, itemType: 'translate', correct: false,
        given: 'Ich bin dort.', focus: `focus-${index}`, ts: ts(11) + index,
      });
    }
    const audit = buildAudit(snapshot({ attempts }), {
      snapshotPath: 'snapshot.json',
      catalog: catalog(...items),
      now: ts(13),
      itemRef: 'a2/x:i0',
    });
    // The queue is deliberately uncapped: a queue that hides rows cannot drain, and a
    // hidden row once shipped a plan sized to a fourteen-rendering mirage of a 32-row queue.
    expect(audit.gradingCandidates).toHaveLength(12);
    expect(audit.focusSignals).toHaveLength(10);
    expect(audit.detail?.attempts).toHaveLength(1);
    expect(renderMarkdown(audit)).toContain('Item detail');
  });
});

// The retention table answers "what is the percentage" and cannot answer "will there BE a
// percentage" — it is keyed off attempts that have already happened, so a competence whose
// family has never been probed is invisible in it. The gate is read on a fixed date, and a
// competence below the floor is excluded from the verdict rather than counted, so whether
// the gate can be read at all is decided by arming dates and the schedule, not by effort.
describe('the readability projection', () => {
  const probeItems: CatalogItem[] = [
    { setId: 'a1/probe-a', id: 'v1', type: 'translate', answer: 'Ich bin da.', focus: 'kopula-sein', topic: 't1', role: 'probe', outcomes: ['o1'] },
    { setId: 'a1/probe-a', id: 'v2', type: 'translate', answer: 'Du bist da.', focus: 'kopula-sein', topic: 't1', role: 'probe', outcomes: ['o1'] },
    { setId: 'a1/probe-a', id: 'v3', type: 'translate', answer: 'Er ist da.', focus: 'kopula-sein', topic: 't1', role: 'probe', outcomes: ['o1'] },
  ];
  const practice: CatalogItem = {
    setId: 'a1/t1-practice', id: 'p1', type: 'translate', answer: 'Ich bin hier.',
    focus: 'kopula-sein', topic: 't1', role: 'practice', outcomes: ['o1'],
  };

  test('an armed family that cannot serve its longest interval is unreachable by that date', () => {
    // Armed on day 12, projected to day 20: the 2- and 7-day probes fit, the 21-day one
    // cannot. No amount of studying changes that, and the retention table would call it
    // "pending" — the same word it uses for a row that effort would fix.
    const audit = buildAudit(snapshot({
      attempts: [{
        setId: practice.setId, itemId: practice.id, itemType: 'translate' as const,
        correct: true, given: 'Ich bin hier.', focus: 'kopula-sein', ts: ts(12),
      }],
    }), {
      snapshotPath: 'snapshot.json',
      catalog: catalog(...probeItems, practice),
      now: ts(13),
      projectTo: ts(20),
    });
    const row = audit.delayed.probes.byReadability.find((r) => r.focus === 'kopula-sein');
    expect(row?.ceilingEver).toBe(3);
    expect(row?.ceilingByTarget).toBe(2);
    expect(row?.reachableByTarget).toBe(false);
    expect(renderMarkdown(audit)).toContain('unreachable by date');
  });

  test('the same family reaches the floor when the horizon is far enough out', () => {
    const audit = buildAudit(snapshot({
      attempts: [{
        setId: practice.setId, itemId: practice.id, itemType: 'translate' as const,
        correct: true, given: 'Ich bin hier.', focus: 'kopula-sein', ts: ts(12),
      }],
    }), {
      snapshotPath: 'snapshot.json',
      catalog: catalog(...probeItems, practice),
      now: ts(13),
      projectTo: ts(40),
    });
    const row = audit.delayed.probes.byReadability.find((r) => r.focus === 'kopula-sein');
    expect(row?.ceilingByTarget).toBe(3);
    expect(row?.reachableByTarget).toBe(true);
  });

  // An unarmed family has not started its schedule, but that is a door the learner can still
  // open by practising the topic. Projecting it as zero would report "unreachable" for a
  // competence that is one lesson away — the opposite of actionable.
  test('an unarmed family is projected from today, not written off', () => {
    const audit = buildAudit(snapshot({ attempts: [] }), {
      snapshotPath: 'snapshot.json',
      catalog: catalog(...probeItems, practice),
      now: ts(13),
      projectTo: ts(40),
    });
    const row = audit.delayed.probes.byReadability.find((r) => r.focus === 'kopula-sein');
    expect(row?.unarmedFamilies).toBe(1);
    expect(row?.attempts).toBe(0);
    expect(row?.ceilingByTarget).toBe(3);
    expect(row?.reachableByTarget).toBe(true);
    expect(renderMarkdown(audit)).toContain('unarmed — needs the lesson opened');
  });

  test('an untagged family is never reachable, however much time is left', () => {
    const untagged: CatalogItem[] = probeItems.map((item) => ({
      ...item, setId: 'a1/probe-untagged', focus: undefined,
    }));
    const audit = buildAudit(snapshot({ attempts: [] }), {
      snapshotPath: 'snapshot.json',
      catalog: catalog(...untagged),
      now: ts(13),
      projectTo: ts(90),
    });
    const row = audit.delayed.probes.byReadability.find((r) => r.focus === undefined);
    expect(row?.ceilingByTarget).toBe(3);
    expect(row?.reachableByTarget).toBe(false);
  });
});

// Codex review, PR #91. `Date.parse` does not reject a date that does not exist — it rolls
// over, silently: 2026-02-30 becomes 2026-03-02 and 2026-02-29 becomes 2026-03-01. The
// readability section is a projection *to a named date*, so a typo would publish figures
// for a horizon nobody asked about.
describe('--project rejects a date that does not exist', () => {
  function auditRoot() {
    const root = tempRoot();
    mkdirSync(join(root, 'progress', 'p'), { recursive: true });
    // The positive control runs the whole pipeline, which loads the exercise catalog —
    // an empty directory is enough, and it is what makes "accepts a real date" a real
    // assertion rather than one that passes because parsing threw first.
    for (const dir of ['exercises', 'reading']) {
      mkdirSync(join(root, 'content', dir), { recursive: true });
    }
    writeFileSync(
      join(root, 'progress', 'p', '2026-07-13.json'),
      JSON.stringify(snapshot({ attempts: [] })),
    );
    return root;
  }

  test.each([
    ['2026-02-30', 'no such date'],
    ['2026-02-29', 'no such date'],
    ['2026-13-01', 'expected YYYY-MM-DD'],
    ['2026-8-2', 'expected YYYY-MM-DD'],
    ['not-a-date', 'expected YYYY-MM-DD'],
  ])('rejects %s', (value, message) => {
    expect(() => run(['--profile', 'p', '--project', value], auditRoot())).toThrow(message);
  });

  // The positive control asserts only that a real date is ACCEPTED. This root has an empty
  // catalog, so there are no probe families and the readability section is correctly
  // omitted — asserting the date appears here would be asserting the wrong thing. That the
  // horizon reaches the report is covered by the buildAudit tests above, which have families.
  test('accepts a real date', () => {
    expect(() => run(['--profile', 'p', '--project', '2026-08-02'], auditRoot())).not.toThrow();
  });
});
