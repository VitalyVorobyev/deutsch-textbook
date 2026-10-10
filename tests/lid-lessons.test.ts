/**
 * Leben-in-Deutschland lessons (`content/lid/lessons/<id>.mdx`, ADR 0021): what `bun run validate`
 * holds them to through `lidProblems` → `lidLessonProblems`, and how `loadLidLessons` reads them.
 *
 * Every case runs against a throwaway root holding the real `content/lid/topics.yaml` and one
 * fixture lesson (`tests/fixtures/lid-lessons/zz-fixture.mdx`), never against
 * `content/lid/lessons/` — the real lessons are authored elsewhere, and a test that read them
 * would protect whatever they happen to say. Each broken variant is the fixture with one edit,
 * and `edit` throws when its target is missing, so a fixture change cannot quietly turn a case
 * into a copy of the valid one.
 */
import { afterAll, describe, expect, test } from 'bun:test';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LID_LESSONS_DIR, LID_TOPICS_FILE, lidLessonProblems, loadLidLessons } from '@da/content/lid';
import { ukHalfCoverage } from '@da/content/coverage';
import { repoRoot } from '@da/content/repo-root';

const FIXTURE = readFileSync(join(import.meta.dir, 'fixtures', 'lid-lessons', 'zz-fixture.mdx'), 'utf8');
const roots: string[] = [];

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

/** A root with the real topics and the given lessons, by id. `null` = no lessons directory. */
function rootWith(lessons: Record<string, string> | null): string {
  const root = mkdtempSync(join(tmpdir(), 'lid-lessons-'));
  roots.push(root);
  mkdirSync(join(root, 'content', 'lid'), { recursive: true });
  cpSync(join(repoRoot(), LID_TOPICS_FILE), join(root, LID_TOPICS_FILE));
  if (lessons) {
    mkdirSync(join(root, LID_LESSONS_DIR), { recursive: true });
    for (const [id, text] of Object.entries(lessons)) writeFileSync(join(root, LID_LESSONS_DIR, `${id}.mdx`), text);
  }
  return root;
}

/** The fixture with `from` replaced by `to` — and a loud failure if `from` is not in it. */
function edit(text: string, from: string, to: string): string {
  if (!text.includes(from)) throw new Error(`fixture has no ${JSON.stringify(from)}`);
  return text.replace(from, to);
}

const problemsOf = (lessons: Record<string, string> | null) => lidLessonProblems(rootWith(lessons));
const only = (text: string) => problemsOf({ 'zz-fixture': text });

describe('a valid lesson', () => {
  test('the fixture passes and loads with its id, order and body path', () => {
    const root = rootWith({ 'zz-fixture': FIXTURE });
    expect(lidLessonProblems(root)).toEqual([]);
    const [lesson] = loadLidLessons(root);
    expect(lesson).toMatchObject({
      id: 'zz-fixture',
      order: 99,
      topics: ['staatssymbole'],
      status: 'draft',
      bodyPath: `${LID_LESSONS_DIR}/zz-fixture.mdx`,
    });
  });

  test('zero lessons is valid — an empty directory, or none at all', () => {
    expect(problemsOf({})).toEqual([]);
    expect(problemsOf(null)).toEqual([]);
    expect(loadLidLessons(rootWith(null))).toEqual([]);
  });

  test('loadLidLessons sorts by order, not by file name', () => {
    const second = edit(edit(FIXTURE, 'order: 99', 'order: 2'), 'topics: [staatssymbole]', 'topics: [europa]');
    const first = edit(FIXTURE, 'order: 99', 'order: 1');
    const root = rootWith({ 'aa-second': second, 'zz-first': first });
    expect(lidLessonProblems(root)).toEqual([]);
    expect(loadLidLessons(root).map((lesson) => lesson.id)).toEqual(['zz-first', 'aa-second']);
  });

  test('a lesson without any uk passes: uk parity fires only once a file carries some', () => {
    expect(FIXTURE).not.toMatch(/<Uk>|\buk:/);
    expect(only(FIXTURE)).toEqual([]);
  });
});

describe('the cross-file rules', () => {
  test('an unknown topic', () => {
    expect(only(edit(FIXTURE, 'topics: [staatssymbole]', 'topics: [staatssymbol]'))).toEqual([
      `${LID_LESSONS_DIR}/zz-fixture.mdx: "staatssymbol" is not a topic in ${LID_TOPICS_FILE}`,
    ]);
  });

  test('a topic in two lessons', () => {
    const other = edit(FIXTURE, 'order: 99', 'order: 98');
    const problems = problemsOf({ 'zz-fixture': FIXTURE, 'zz-other': other });
    expect(problems).toEqual([
      `${LID_LESSONS_DIR}/zz-other.mdx: topic "staatssymbole" already belongs to lesson "zz-fixture" — a topic belongs to at most one lesson`,
    ]);
  });

  test('a duplicate order', () => {
    const other = edit(FIXTURE, 'topics: [staatssymbole]', 'topics: [europa]');
    expect(problemsOf({ 'zz-fixture': FIXTURE, 'zz-other': other })).toEqual([
      `${LID_LESSONS_DIR}/zz-other.mdx: order 99 is already taken by lesson "zz-fixture"`,
    ]);
  });

  test('the file name is the id, and it is kebab-case ASCII', () => {
    expect(problemsOf({ Staatssymbole: FIXTURE }).join('\n')).toContain('"Staatssymbole" is not a lesson id');
  });

  test('the frontmatter schema: sources and terms are required, a status is draft or reviewed', () => {
    expect(only(edit(FIXTURE, 'status: draft', 'status: final')).join('\n')).toContain('status');
    const noSources = edit(FIXTURE, 'sources:\n  - { title: "Grundgesetz, Art. 22", url: "https://www.gesetze-im-internet.de/gg/art_22.html" }\n', '');
    expect(only(noSources).join('\n')).toContain('sources');
  });
});

describe('the body: "## Kurz gesagt" first, one bilingual block, German after it', () => {
  test('missing "## Kurz gesagt"', () => {
    expect(only(edit(FIXTURE, '## Kurz gesagt\n', '')).join('\n')).toContain(
      'the first heading must be "## Kurz gesagt", found "## Die Flagge"',
    );
  });

  test('misplaced: another heading comes first', () => {
    expect(only(edit(FIXTURE, '## Kurz gesagt\n', '## Einleitung\n\nText.\n\n## Kurz gesagt\n')).join('\n')).toContain(
      'the first heading must be "## Kurz gesagt", found "## Einleitung"',
    );
  });

  test('misplaced: prose before it — though an MDX comment may stand there', () => {
    expect(only(edit(FIXTURE, '## Kurz gesagt\n', 'Ein Satz davor.\n\n## Kurz gesagt\n')).join('\n')).toContain(
      'nothing but MDX comments may precede',
    );
    expect(only(edit(FIXTURE, '## Kurz gesagt\n', '{/* Quelle geprüft */}\n\n## Kurz gesagt\n'))).toEqual([]);
  });

  test('"## Kurz gesagt" holds exactly one Bilingual block, with an En and a Ru half', () => {
    const block = FIXTURE.match(/<Bilingual>[\s\S]*?<\/Bilingual>/)![0];
    expect(only(edit(FIXTURE, block, 'Nur Deutsch.')).join('\n')).toContain('exactly one <Bilingual> block, found 0');
    expect(only(edit(FIXTURE, block, `${block}\n\n${block}`)).join('\n')).toContain('exactly one <Bilingual> block, found 2');
    const noRu = block.replace(/<Ru>[\s\S]*?<\/Ru>\n/, '');
    expect(only(edit(FIXTURE, block, noRu)).join('\n')).toContain('needs an <En> and a <Ru> half');
  });

  test('no Bilingual block after it — the rest of the lesson is German', () => {
    const block = FIXTURE.match(/<Bilingual>[\s\S]*?<\/Bilingual>/)![0];
    expect(only(edit(FIXTURE, '### Die Hauptstadt\n', `### Die Hauptstadt\n\n${block}\n`)).join('\n')).toContain(
      '1 <Bilingual> block(s) outside "## Kurz gesagt"',
    );
  });

  test('at least one German section follows, and no "#" heading', () => {
    const stub = FIXTURE.slice(0, FIXTURE.indexOf('## Die Flagge'));
    expect(only(stub).join('\n')).toContain('at least one "##" section');
    expect(only(edit(FIXTURE, '## Die Flagge', '# Die Flagge')).join('\n')).toContain('no "#" heading');
  });
});

describe('language discipline', () => {
  test('Cyrillic in <En>', () => {
    const problems = only(edit(FIXTURE, 'not teaching material.', 'not teaching material (не учебный).'));
    expect(problems.join('\n')).toContain('Cyrillic inside <En> block 1');
  });

  test('Cyrillic in an English frontmatter field', () => {
    const problems = only(edit(FIXTURE, 'en: federal flag', 'en: federal флаг'));
    expect(problems.join('\n')).toContain('Cyrillic in English-facing field terms[0].en');
  });

  test('a paragraph over the prose-shape cap', () => {
    const wall = Array.from({ length: 125 }, () => 'word').join(' ');
    const problems = only(edit(FIXTURE, 'not teaching material.', `not teaching material. ${wall}`));
    expect(problems.join('\n')).toContain('words (max 120)');
  });

  test('uk is all-or-none per file, across frontmatter and body', () => {
    const someUk = edit(FIXTURE, 'ru: федеральный флаг }', 'ru: федеральный флаг, uk: федеральний прапор }');
    const problems = only(someUk).join('\n');
    expect(problems).toContain('terms[1].ru has no uk sibling');
    expect(problems).toContain('<Bilingual> block 1 has no <Uk> half');
  });
});

describe('UK parity coverage', () => {
  test('ukHalfCoverage leaves lessons out, as it does the notes (ADR 0021, P31-1)', () => {
    const root = rootWith({ 'zz-fixture': FIXTURE });
    expect(ukHalfCoverage(root)).toEqual({ authored: 0, total: 0 });
    mkdirSync(join(root, 'content', 'discovery', 'a1'), { recursive: true });
    writeFileSync(join(root, 'content', 'discovery', 'a1', 'x.mdx'), '---\ntitle_ru: Тема\n---\n');
    expect(ukHalfCoverage(root)).toEqual({ authored: 0, total: 1 });
  });
});
