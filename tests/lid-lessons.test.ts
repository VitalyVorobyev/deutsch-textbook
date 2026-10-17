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
import {
  LID_LESSONS_DIR,
  LID_TOPICS_FILE,
  lidLessonProblems,
  loadLidLessons,
} from '@da/content/lid';
import { ukHalfCoverage } from '@da/content/coverage';
import { repoRoot } from '@da/content/repo-root';

const FIXTURE = readFileSync(
  join(import.meta.dir, 'fixtures', 'lid-lessons', 'zz-fixture.mdx'),
  'utf8',
);
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
    for (const [id, text] of Object.entries(lessons))
      writeFileSync(join(root, LID_LESSONS_DIR, `${id}.mdx`), text);
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
    const second = edit(
      edit(FIXTURE, 'order: 99', 'order: 2'),
      'topics: [staatssymbole]',
      'topics: [europa]',
    );
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
    expect(problemsOf({ Staatssymbole: FIXTURE }).join('\n')).toContain(
      '"Staatssymbole" is not a lesson id',
    );
  });

  test('the frontmatter schema: sources and terms are required, a status is draft or reviewed', () => {
    expect(only(edit(FIXTURE, 'status: draft', 'status: final')).join('\n')).toContain('status');
    const noSources = edit(
      FIXTURE,
      'sources:\n  - { title: "Grundgesetz, Art. 22", url: "https://www.gesetze-im-internet.de/gg/art_22.html" }\n',
      '',
    );
    expect(only(noSources).join('\n')).toContain('sources');
  });
});

describe('the body: German, "## Kurz gesagt" first, every section closed by a <Translation>', () => {
  const blocks = () => FIXTURE.match(/<Translation(?: open)?>[\s\S]*?<\/Translation>/g)!;

  test('missing "## Kurz gesagt"', () => {
    expect(only(edit(FIXTURE, '## Kurz gesagt\n', '')).join('\n')).toContain(
      'the first heading must be "## Kurz gesagt", found "## Die Flagge"',
    );
  });

  test('misplaced: another heading comes first', () => {
    expect(
      only(edit(FIXTURE, '## Kurz gesagt\n', '## Einleitung\n\nText.\n\n## Kurz gesagt\n')).join(
        '\n',
      ),
    ).toContain('the first heading must be "## Kurz gesagt", found "## Einleitung"');
  });

  test('misplaced: prose before it — though an MDX comment may stand there', () => {
    expect(
      only(edit(FIXTURE, '## Kurz gesagt\n', 'Ein Satz davor.\n\n## Kurz gesagt\n')).join('\n'),
    ).toContain('nothing but MDX comments may precede');
    expect(
      only(edit(FIXTURE, '## Kurz gesagt\n', '{/* Quelle geprüft */}\n\n## Kurz gesagt\n')),
    ).toEqual([]);
  });

  test('a section with German text and no translation, or two', () => {
    const [, flag] = blocks();
    expect(only(edit(FIXTURE, flag!, '')).join('\n')).toContain(
      '"## Die Flagge" closes with exactly one <Translation>, found 0',
    );
    expect(only(edit(FIXTURE, flag!, `${flag}\n\n${flag}`)).join('\n')).toContain('found 2');
    // Kurz gesagt is a section like any other: its German needs its translation too.
    expect(only(edit(FIXTURE, blocks()[0]!, '')).join('\n')).toContain(
      '"## Kurz gesagt" closes with exactly one <Translation>, found 0',
    );
  });

  test('the translation comes after the German it translates', () => {
    const [, flag] = blocks();
    const moved = edit(
      edit(FIXTURE, flag!, ''),
      '## Die Flagge\n\n',
      `## Die Flagge\n\n${flag}\n\n`,
    );
    expect(only(moved).join('\n')).toContain('"## Die Flagge": the <Translation> comes last');
  });

  test('a heading with only a subsection under it needs none, and may not have one', () => {
    const bare = edit(
      edit(FIXTURE, 'Die Bundesflagge ist schwarz-rot-gold. So steht es im Grundgesetz.\n\n', ''),
      blocks()[1]!,
      '',
    );
    expect(only(bare)).toEqual([]);
    const stray = edit(
      FIXTURE,
      'Die Bundesflagge ist schwarz-rot-gold. So steht es im Grundgesetz.\n\n',
      '',
    );
    expect(only(stray).join('\n')).toContain(
      '"## Die Flagge" has a <Translation> but no German text to translate',
    );
  });

  test("the summary's translation is open, and only the summary's", () => {
    expect(only(edit(FIXTURE, '<Translation open>', '<Translation>')).join('\n')).toContain(
      '"## Kurz gesagt": the summary\'s translation is <Translation open>',
    );
    const [, flag] = blocks();
    expect(
      only(edit(FIXTURE, flag!, flag!.replace('<Translation>', '<Translation open>'))).join('\n'),
    ).toContain('"## Die Flagge": only "## Kurz gesagt" opens its <Translation>');
  });

  test('every translation has an <En> and a <Ru> half', () => {
    const [, flag] = blocks();
    const noRu = flag!.replace(/<Ru>[\s\S]*?<\/Ru>\n/, '');
    expect(only(edit(FIXTURE, flag!, noRu)).join('\n')).toContain(
      '"## Die Flagge": its <Translation> has no <Ru> half',
    );
  });

  test('no <Bilingual> block — the old orientation-only shape is gone', () => {
    const bilingual = '<Bilingual>\n<En>\nOld.\n</En>\n<Ru>\nСтарое.\n</Ru>\n</Bilingual>';
    expect(
      only(edit(FIXTURE, '### Die Hauptstadt\n', `### Die Hauptstadt\n\n${bilingual}\n`)).join(
        '\n',
      ),
    ).toContain('1 <Bilingual> block(s)');
  });

  test('at least one German section follows, and no "#" heading', () => {
    const stub = FIXTURE.slice(0, FIXTURE.indexOf('## Die Flagge'));
    expect(only(stub).join('\n')).toContain('at least one "##" section');
    expect(only(edit(FIXTURE, '## Die Flagge', '# Die Flagge')).join('\n')).toContain(
      'no "#" heading',
    );
  });
});

describe('language discipline', () => {
  test('Cyrillic in <En>', () => {
    const problems = only(
      edit(FIXTURE, 'not teaching material.', 'not teaching material (не учебный).'),
    );
    expect(problems.join('\n')).toContain('Cyrillic inside <En> block 1');
  });

  test('Cyrillic in an English frontmatter field', () => {
    const problems = only(edit(FIXTURE, 'en: federal flag', 'en: federal флаг'));
    expect(problems.join('\n')).toContain('Cyrillic in English-facing field terms[0].en');
  });

  test('a paragraph over the prose-shape cap', () => {
    const wall = Array.from({ length: 125 }, () => 'word').join(' ');
    const problems = only(
      edit(FIXTURE, 'not teaching material.', `not teaching material. ${wall}`),
    );
    expect(problems.join('\n')).toContain('words (max 120)');
  });

  test('uk is all-or-none per file, across frontmatter and body', () => {
    const someUk = edit(
      FIXTURE,
      'ru: федеральный флаг }',
      'ru: федеральный флаг, uk: федеральний прапор }',
    );
    const problems = only(someUk).join('\n');
    expect(problems).toContain('terms[1].ru has no uk sibling');
    expect(problems).toContain('"## Kurz gesagt": its <Translation> has no <Uk> half');
  });
});

describe('UK parity coverage', () => {
  test('ukHalfCoverage counts a lesson like any other mdx — authored only with uk in frontmatter and body', () => {
    expect(ukHalfCoverage(rootWith({ 'zz-fixture': FIXTURE }))).toEqual({ authored: 0, total: 1 });

    const withUk = edit(
      edit(
        edit(FIXTURE, 'ru: федеральный флаг }', 'ru: федеральный флаг, uk: федеральний прапор }'),
        'ru: столица }',
        'ru: столица, uk: столиця }',
      ),
      '</Ru>\n',
      '</Ru>\n<Uk>\nТестовий урок для перевірки механізму уроків, а не навчальний матеріал.\n</Uk>\n',
    ).replaceAll('</Ru>\n</Translation>', '</Ru>\n<Uk>\nПереклад.\n</Uk>\n</Translation>');
    const root = rootWith({ 'zz-fixture': withUk });
    expect(lidLessonProblems(root)).toEqual([]);
    expect(ukHalfCoverage(root)).toEqual({ authored: 1, total: 1 });

    // The body alone is not enough: the glossary is the other ru-bearing side.
    const bodyOnly = edit(FIXTURE, '</Ru>\n', '</Ru>\n<Uk>\nТестовий урок.\n</Uk>\n');
    expect(ukHalfCoverage(rootWith({ 'zz-fixture': bodyOnly }))).toEqual({ authored: 0, total: 1 });
  });
});
