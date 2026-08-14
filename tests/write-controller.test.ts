/**
 * The write controller, held to the one promise that makes it safe to exist: it changes the field
 * it was asked for, in the file it was asked for, and **nothing else in that file moves**.
 *
 * Every refusal below was reproduced *failing* before it was asserted — a guard rail nobody has
 * watched fail is one nobody knows the shape of, and two of this repo's seven placement rules
 * turned out to be unreachable behind a schema error the first time they were tried.
 *
 * The fixture is a temporary tree, not the corpus: a test that writes into `content/` would make
 * `bun test` a mutation of the product, and a test that *reads* the corpus to prove a writer would
 * go red the day someone legitimately edits the file it happened to pick.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyPatch, writableFields } from '@da/content/write';

let ROOT: string;
const SET = 'content/exercises/a2/fixture-set.yaml';
const TOPIC = 'content/topics/a2/fixture-topic.topic.yaml';

/**
 * Deliberately awkward YAML: a full-line comment above the document, a trailing comment on the very
 * line a write reads, a blank line inside the mapping, double-quoted scalars that need no quotes and
 * a flow sequence. `YAML.stringify` normalises every one of them, which is the whole reason the
 * writer splices into the source text instead.
 */
const SET_SOURCE = `# A fixture set — the comment must survive every write.
topic: fixture-topic
role: practice   # trailing comment on the line being read

activity: application
title:
  de: "Übung"
  en: "Practice"
  ru: "Упражнение"
arming: []
items:
  - id: i1
    type: translate
    revision: 1
    outcomes: [fixture-outcome-a]
    prompt_en: "I am tired."
    prompt_ru: "Я устал."
    answer: "Ich bin müde."
    key_tokens: ["müde"]
`;

const TOPIC_SOURCE = `id: fixture-topic
level: A2
kind: grammar
strand: grammar
group: verbformen-zeit
title_de: "Fixture"
title_en: "Fixture"
title_ru: "Фикстура"
status: draft
tags: []
prerequisites: []
deepens: []
related: []
outcomes:
  - id: fixture-outcome-a
    mode: writing
    de: "Ich kann etwas."
    en: "I can do something."
    ru: "Я умею что-то."
  - id: fixture-outcome-b
    mode: writing
    de: "Ich kann etwas anderes."
    en: "I can do something else."
    ru: "Я умею другое."
elements:
  article: fixture-topic.mdx
  exercises:
    - a2/fixture-set
  primary_practice: a2/fixture-set
  probes: []
  reading: []
  vocab: []
`;

const reset = (): void => {
  writeFileSync(join(ROOT, SET), SET_SOURCE);
  writeFileSync(join(ROOT, TOPIC), TOPIC_SOURCE);
};
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');

beforeAll(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'da-write-'));
  mkdirSync(join(ROOT, 'content/exercises/a2'), { recursive: true });
  mkdirSync(join(ROOT, 'content/topics/a2'), { recursive: true });
  reset();
});
afterAll(() => rmSync(ROOT, { recursive: true, force: true }));

describe('the write controller writes', () => {
  test('adds a key that is absent, at the declared position, changing nothing else', () => {
    reset();
    const result = applyPatch({ file: SET, field: 'stage', value: 'transfer' }, ROOT);
    expect(result).toMatchObject({ ok: true, before: null, after: 'transfer', changed: true });

    const after = read(SET);
    // Placed after `role`, which is where `after: ['role', 'topic']` says it goes.
    expect(after).toContain('role: practice   # trailing comment on the line being read\nstage: transfer\n');
    // And the rest of the file is the fixture, byte for byte.
    expect(after.replace('stage: transfer\n', '')).toBe(SET_SOURCE);
  });

  test('replaces an existing scalar and keeps the comment on its line', () => {
    reset();
    expect(applyPatch({ file: TOPIC, field: 'status', value: 'reviewed' }, ROOT)).toMatchObject({
      ok: true,
      before: 'draft',
      after: 'reviewed',
    });
    expect(read(TOPIC)).toBe(TOPIC_SOURCE.replace('status: draft', 'status: reviewed'));
  });

  test('a required teaching-contract key cannot be removed', () => {
    reset();
    applyPatch({ file: SET, field: 'stage', value: 'transfer' }, ROOT);
    expect(applyPatch({ file: SET, field: 'stage', value: null }, ROOT)).toMatchObject({ ok: false });
    expect(read(SET)).toBe(SET_SOURCE.replace(
      'role: practice   # trailing comment on the line being read\n',
      'role: practice   # trailing comment on the line being read\nstage: transfer\n',
    ));
  });

  test('an unchanged write touches nothing', () => {
    reset();
    const result = applyPatch({ file: TOPIC, field: 'status', value: 'draft' }, ROOT);
    expect(result).toMatchObject({ ok: true, changed: false });
    expect(read(TOPIC)).toBe(TOPIC_SOURCE);
  });
});

describe('the write controller refuses', () => {
  const refused = (patch: Parameters<typeof applyPatch>[0]): string => {
    reset();
    const result = applyPatch(patch, ROOT);
    expect(result.ok).toBe(false);
    // Whatever the reason, the file is untouched — a refusal is not a partial write.
    expect(read(SET)).toBe(SET_SOURCE);
    expect(read(TOPIC)).toBe(TOPIC_SOURCE);
    return result.ok ? '' : result.error;
  };

  test('a path that escapes content/', () => {
    expect(refused({ file: '../../.ssh/config', field: 'stage', value: 'transfer' })).toContain('outside content/');
    expect(refused({ file: 'content/../package.json', field: 'stage', value: 'transfer' })).toContain(
      'outside content/',
    );
  });

  test('a file class it does not know', () => {
    // Real content files, all outside the two writable classes on purpose.
    expect(refused({ file: 'content/atlas.yaml', field: 'status', value: 'reviewed' })).toContain(
      'no writable file class',
    );
    expect(refused({ file: 'content/vocab/wohnen.yaml', field: 'status', value: 'reviewed' })).toContain(
      'no writable file class',
    );
    expect(refused({ file: 'content/topics/a2/fixture-topic.mdx', field: 'status', value: 'reviewed' })).toContain(
      'no writable file class',
    );
  });

  test('a field that is not on the allowlist', () => {
    // `revision`, `key_tokens` and `answers` decide what is graded; `outcomes` decides what an
    // attempt measures. None of them may move through a form.
    for (const field of ['revision', 'key_tokens', 'answers', 'items', 'topic', 'role', 'arming'])
      expect(refused({ file: SET, field, value: '1' })).toContain('is not writable');
    expect(refused({ file: TOPIC, field: 'level', value: 'B1' })).toContain('is not writable');
  });

  test('a value the field does not accept', () => {
    expect(refused({ file: SET, field: 'stage', value: 'scaffold' })).toContain('is not one of');
    // English is not the vocabulary here — the stages are German, like the rest of the editorial
    // surface, and a near-miss must fail rather than land as a typo'd enum.
    expect(refused({ file: TOPIC, field: 'status', value: 'published' })).toContain('is not one of');
  });

  test('a file that does not exist', () => {
    expect(refused({ file: 'content/exercises/a2/no-such-set.yaml', field: 'stage', value: 'transfer' })).toContain(
      'does not exist',
    );
  });

  test('a stale reviewed transition cannot overwrite an external change', () => {
    reset();
    const expectedRevision = '0'.repeat(64);
    const result = applyPatch({ file: TOPIC, field: 'status', value: 'reviewed' }, ROOT, { expectedRevision });
    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.error).toContain('changed on disk');
    expect(read(TOPIC)).toBe(TOPIC_SOURCE);
  });

  test('a result that would not validate against the schema', () => {
    // The backstop the allowlist cannot be. Break the file first — a valid patch onto an invalid
    // document must still refuse, because the writer would otherwise bless it by writing it.
    reset();
    writeFileSync(join(ROOT, TOPIC), TOPIC_SOURCE.replace('level: A2\n', ''));
    const result = applyPatch({ file: TOPIC, field: 'status', value: 'reviewed' }, ROOT);
    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.error).toContain('would not validate');
    reset();
  });
});

describe('the corpus check can undo a write the schema accepted', () => {
  /**
   * The hole this closes is real and not hypothetical: `status: reviewed` on a **B1** topic makes
   * `authorshipProvenanceProblems` demand provenance records, so a patch that is perfectly valid as
   * a manifest can still turn `bun run validate` red. A per-file check cannot see that by
   * construction, so the caller injects the gate — and the bytes go back if it complains.
   */
  test('a verify hook that reports a problem restores the file', () => {
    reset();
    const seen: string[] = [];
    const result = applyPatch({ file: TOPIC, field: 'status', value: 'reviewed' }, ROOT, {
      verify: (root) => {
        // It runs on the written tree, not on the old one: the reason it can catch anything.
        seen.push(readFileSync(join(root, TOPIC), 'utf8').includes('status: reviewed') ? 'written' : 'not-written');
        return 'content/topics/a2/fixture-topic.topic.yaml: a reviewed B1 topic needs provenance';
      },
    });
    expect(seen).toEqual(['written']);
    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.error).toContain('the corpus would not validate');
    expect(read(TOPIC)).toBe(TOPIC_SOURCE);
  });

  test('a silent verify hook lets the write stand, and an unchanged write never calls it', () => {
    reset();
    let calls = 0;
    const verify = () => {
      calls += 1;
      return undefined;
    };
    expect(applyPatch({ file: TOPIC, field: 'status', value: 'reviewed' }, ROOT, { verify })).toMatchObject({ ok: true });
    expect(read(TOPIC)).toContain('status: reviewed');
    expect(calls).toBe(1);
    // Writing the same value again changes no bytes, so there is nothing to verify — six seconds
    // of validator for a no-op is the kind of cost that gets a feature turned off.
    expect(applyPatch({ file: TOPIC, field: 'status', value: 'reviewed' }, ROOT, { verify })).toMatchObject({
      ok: true,
      changed: false,
    });
    expect(calls).toBe(1);
  });
});

describe('the writable surface is declared, not implied', () => {
  test('exactly three scalar fields, and all are editorial judgements', () => {
    expect(writableFields()).toEqual([
      {
        class: 'exercise-set',
        field: 'stage',
        values: ['pretest', 'modell', 'geruest', 'ausblenden', 'transfer', 'nachpruefung', 'keine'],
      },
      {
        class: 'exercise-set',
        field: 'activity',
        values: ['core', 'extension', 'application', 'remediation'],
      },
      { class: 'topic-manifest', field: 'status', values: ['draft', 'reviewed'] },
    ]);
  });
});
