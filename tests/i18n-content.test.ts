import { beforeEach, describe, expect, test } from 'bun:test';

import {
  LANG_KEY,
  langKeyFor,
  getExplainLang,
  isExplainLang,
  pick,
  resolveExplainLang,
  setExplainLang,
} from '../src/lib/prefs';
import { PROFILE_KEY, PROFILES_KEY } from '../src/lib/profile';
import { glossFieldParity, parseGlosses } from '../src/lib/gloss';
import {
  deParityProblems,
  hasUkField,
  langFieldProblems,
  mdxLangProblems,
  ukParityProblems,
} from '../src/lib/langcheck';
import {
  bilingualSchema,
  outcomeSchema,
  topicSchema,
  translateItemSchema,
  type VocabEntry,
  type WordField,
} from '../src/lib/schemas';
import { buildDeck, wordFieldContexts } from '../src/lib/srs';
import type { TopicNode } from '../src/lib/mastery';

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.explainLang;
});

function registerActiveProfile(id: string) {
  localStorage.setItem(PROFILES_KEY, JSON.stringify([{ id, label: id }]));
  localStorage.setItem(PROFILE_KEY, id);
}

describe('pick over the four explanation languages', () => {
  const full = { en: 'E', ru: 'R', uk: 'U', de: 'D' };
  const core = { en: 'E', ru: 'R' };

  test('en and ru behave exactly as before', () => {
    expect(pick('en', core)).toBe('E');
    expect(pick('ru', core)).toBe('R');
    expect(pick('en', full)).toBe('E');
    expect(pick('ru', full)).toBe('R');
  });

  test('uk and de return their half when authored', () => {
    expect(pick('uk', full)).toBe('U');
    expect(pick('de', full)).toBe('D');
  });

  test('uk and de fall back to en when the half is absent', () => {
    expect(pick('uk', core)).toBe('E');
    expect(pick('de', core)).toBe('E');
  });

  test('undefined text is the empty string in every language', () => {
    expect(pick('en', undefined)).toBe('');
    expect(pick('uk', undefined)).toBe('');
    expect(pick('de', undefined)).toBe('');
  });
});

describe('explain-language preference with uk/de', () => {
  test('isExplainLang admits exactly the four values', () => {
    for (const v of ['en', 'ru', 'uk', 'de']) expect(isExplainLang(v)).toBe(true);
    expect(isExplainLang('ua')).toBe(false);
    expect(isExplainLang(null)).toBe(false);
  });

  test('a stored uk/de profile choice round-trips', () => {
    registerActiveProfile('olha');
    setExplainLang('uk');
    expect(document.documentElement.dataset.explainLang).toBe('uk');
    expect(getExplainLang()).toBe('uk');
    expect(localStorage.getItem(langKeyFor('olha'))).toBe('uk');
    expect(resolveExplainLang('olha')).toBe('uk');
    setExplainLang('de');
    expect(resolveExplainLang('olha')).toBe('de');
  });

  test('garbage on the root attribute or in storage resolves to en / null', () => {
    document.documentElement.dataset.explainLang = 'xx';
    expect(getExplainLang()).toBe('en');
    localStorage.setItem(langKeyFor('vitaly'), 'xx');
    expect(resolveExplainLang('vitaly')).toBeNull();
  });

  test('the legacy device key stays en/ru-only: a hand-edited uk there is never copied forward', () => {
    localStorage.setItem(LANG_KEY, 'uk');
    expect(resolveExplainLang('vitaly')).toBeNull();
    expect(localStorage.getItem(langKeyFor('vitaly'))).toBeNull();
    // ...while a real legacy value still migrates.
    localStorage.setItem(LANG_KEY, 'ru');
    expect(resolveExplainLang('vitaly')).toBe('ru');
    expect(localStorage.getItem(langKeyFor('vitaly'))).toBe('ru');
  });
});

describe('parseGlosses with an optional fourth field', () => {
  test('a 3-field gloss parses exactly as before, uk undefined', () => {
    const { segments, errors } = parseGlosses('Er hat [[den Termin::the appointment::встречу]] verpasst.');
    expect(errors).toEqual([]);
    expect(segments).toEqual([
      { kind: 'text', text: 'Er hat ' },
      { kind: 'gloss', gloss: { de: 'den Termin', en: 'the appointment', ru: 'встречу' } },
      { kind: 'text', text: ' verpasst.' },
    ]);
  });

  test('a 4-field gloss carries uk', () => {
    const { segments, errors } = parseGlosses('[[der Zug::the train::поезд::потяг]]');
    expect(errors).toEqual([]);
    expect(segments).toEqual([
      { kind: 'gloss', gloss: { de: 'der Zug', en: 'the train', ru: 'поезд', uk: 'потяг' } },
    ]);
  });

  test('2 and 5 fields are malformed', () => {
    expect(parseGlosses('[[nur::only]]').errors).toHaveLength(1);
    expect(parseGlosses('[[a::b::c::d::e]]').errors).toHaveLength(1);
  });

  test('an empty fourth field is malformed, not silently 3-field', () => {
    expect(parseGlosses('[[a::b::c::]]').errors).toHaveLength(1);
  });

  test('glossFieldParity flags a reading that mixes the two shapes', () => {
    const mixed = glossFieldParity(['[[a::b::c]]', '[[d::e::f::g]]']);
    expect(mixed).toEqual({ withUk: 1, withoutUk: 1, mixed: true });
    expect(glossFieldParity(['[[a::b::c]] und [[x::y::z]]']).mixed).toBe(false);
    expect(glossFieldParity(['[[a::b::c::d]]']).mixed).toBe(false);
    expect(glossFieldParity(['kein Gloss']).mixed).toBe(false);
  });
});

describe('langFieldProblems (letter-set purity)', () => {
  test('Ukrainian-only letters in a ru field fail', () => {
    expect(langFieldProblems({ ru: 'привіт' })).toHaveLength(1);
    expect(langFieldProblems({ items: [{ prompt_ru: 'Довідка' }] })).toHaveLength(1);
  });

  test('Russian-only letters in a uk field fail', () => {
    expect(langFieldProblems({ uk: 'привэт' })).toHaveLength(1);
    expect(langFieldProblems({ example_uk: 'ёлка' })).toHaveLength(1);
  });

  test('Cyrillic in de and en fields fails (the relocated EN rule included)', () => {
    expect(langFieldProblems({ de: 'дом' })).toHaveLength(1);
    expect(langFieldProblems({ en: 'дом' })).toHaveLength(1);
    expect(langFieldProblems({ title_en: 'ещё' })).toHaveLength(1);
  });

  test('clean multilingual content passes', () => {
    expect(
      langFieldProblems({
        de: 'die Wohnung',
        en: 'the flat',
        ru: 'квартира (жильё)',
        uk: 'квартира (житло)',
        nested: [{ example_ru: 'объём', example_uk: 'обсяг' }],
      }),
    ).toEqual([]);
  });
});

describe('ukParityProblems', () => {
  test('a file with no uk fields owes nothing', () => {
    expect(ukParityProblems({ title_ru: 'Тема', items: [{ ru: 'да' }] })).toEqual([]);
  });

  test('any uk field makes every ru field owe a sibling', () => {
    const halfDone = {
      title_ru: 'Тема',
      title_uk: 'Тема',
      items: [{ prompt_ru: 'Переведите', prompt_uk: 'Перекладіть' }, { prompt_ru: 'Ещё раз' }],
    };
    const problems = ukParityProblems(halfDone);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('items[1].prompt_ru');
    expect(problems[0]).toContain('prompt_uk');
  });

  test('full parity is silent', () => {
    expect(
      ukParityProblems({ title_ru: 'Тема', title_uk: 'Тема', note: { ru: 'да', uk: 'так' } }),
    ).toEqual([]);
  });

  test('forceUk bridges uk content the walker cannot see (4-field glosses)', () => {
    const reading = { title_ru: 'Текст' };
    expect(ukParityProblems(reading)).toEqual([]);
    expect(ukParityProblems(reading, { forceUk: true })).toHaveLength(1);
  });

  test('hasUkField sees nested uk strings and nothing else', () => {
    expect(hasUkField({ a: [{ uk: 'так' }] })).toBe(true);
    expect(hasUkField({ a: [{ ru: 'да' }], uklike: 'no' })).toBe(false);
  });
});

describe('deParityProblems', () => {
  test('fires on a half-de file, naming the de-less records', () => {
    const half = {
      explain: { en: 'e', ru: 'r', de: 'd' },
      instruction: { en: 'e', ru: 'r' },
    };
    const problems = deParityProblems(half);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('instruction');
  });

  test('silent when no record or every record carries de', () => {
    expect(deParityProblems({ a: { en: 'e', ru: 'r' }, b: { en: 'e', ru: 'r' } })).toEqual([]);
    expect(
      deParityProblems({ a: { en: 'e', ru: 'r', de: 'd' }, b: { en: 'e', ru: 'r', uk: 'u', de: 'd' } }),
    ).toEqual([]);
  });

  test('outcome-shaped records are structurally excluded — their de is the German can-do', () => {
    const node = {
      outcomes: [{ id: 'x', mode: 'reading', de: 'Ich kann …', en: 'I can …', ru: 'Я могу …' }],
      explain: { en: 'e', ru: 'r' },
    };
    expect(deParityProblems(node)).toEqual([]);
  });
});

describe('mdxLangProblems', () => {
  const clean = `<Bilingual><En>The case (der Kasus).</En><Ru>Падеж (der Kasus).</Ru></Bilingual>`;

  test('a clean en/ru body reports nothing', () => {
    const r = mdxLangProblems(clean);
    expect(r.balance).toEqual([]);
    expect(r.letters).toEqual([]);
    expect(r.parity).toEqual([]);
  });

  test('unbalanced <Uk>/<De> tags are reported', () => {
    expect(mdxLangProblems('<Uk>так').balance).toHaveLength(1);
    expect(mdxLangProblems('<De>Also …').balance).toHaveLength(1);
  });

  test('wrong-alphabet leaks inside blocks are errors', () => {
    expect(mdxLangProblems('<Uk>привэт</Uk>').letters).toHaveLength(1);
    expect(mdxLangProblems('<Ru>привіт</Ru>').letters).toHaveLength(1);
    expect(mdxLangProblems('<De>дом</De>').letters).toHaveLength(1);
    expect(mdxLangProblems('<En>дом</En>').letters).toHaveLength(1);
  });

  test('any <Uk> in a body demands one in every <Bilingual> block (same for <De>)', () => {
    const half =
      '<Bilingual><En>a</En><Ru>б</Ru><Uk>в</Uk></Bilingual>\n' +
      '<Bilingual><En>c</En><Ru>г</Ru></Bilingual>';
    const r = mdxLangProblems(half);
    expect(r.parity).toHaveLength(1);
    expect(r.parity[0]).toContain('block 2');

    const halfDe =
      '<Bilingual><En>a</En><Ru>б</Ru><De>x</De></Bilingual>\n' +
      '<Bilingual><En>c</En><Ru>г</Ru></Bilingual>';
    expect(mdxLangProblems(halfDe).parity).toHaveLength(1);
  });
});

describe('schema widening', () => {
  test('bilingualSchema accepts the optional halves and rejects empty ones', () => {
    expect(bilingualSchema.parse({ en: 'e', ru: 'r', uk: 'u', de: 'd' })).toEqual({
      en: 'e',
      ru: 'r',
      uk: 'u',
      de: 'd',
    });
    expect(bilingualSchema.parse({ en: 'e', ru: 'r' })).toEqual({ en: 'e', ru: 'r' });
    expect(bilingualSchema.safeParse({ en: 'e', ru: 'r', uk: '' }).success).toBe(false);
    expect(bilingualSchema.safeParse({ en: 'e', ru: 'r', de: '' }).success).toBe(false);
  });

  test('translate items may carry prompt_uk, and the prompt pick serves it', () => {
    const item = translateItemSchema.parse({
      id: 'probe-1',
      type: 'translate',
      prompt_en: 'I am tired.',
      prompt_ru: 'Я устал.',
      prompt_uk: 'Я втомився.',
      answer: 'Ich bin müde.',
    });
    expect(item.prompt_uk).toBe('Я втомився.');
    // the record Translate.tsx builds for its prompt line
    const prompt = { en: item.prompt_en, ru: item.prompt_ru, uk: item.prompt_uk };
    expect(pick('uk', prompt)).toBe('Я втомився.');
    // no prompt_de exists by design — 'de' mode falls back to the EN prompt
    expect(pick('de', prompt)).toBe('I am tired.');
  });

  test('topics and outcomes may carry uk titles/halves', () => {
    const topic = topicSchema.parse({
      id: 'akkusativ',
      title_de: 'Akkusativ',
      title_en: 'The accusative',
      title_ru: 'Аккузатив',
      title_uk: 'Знахідний відмінок',
      level: 'A1',
      kind: 'grammar',
    });
    expect(topic.title_uk).toBe('Знахідний відмінок');

    const outcome = outcomeSchema.parse({
      id: 'akk-artikel',
      mode: 'writing',
      de: 'Ich kann den Akkusativ benutzen.',
      en: 'I can use the accusative.',
      ru: 'Я могу использовать аккузатив.',
      uk: 'Я можу вживати знахідний відмінок.',
    });
    expect(outcome.uk).toContain('відмінок');
  });
});

describe('uk reaches the runtime surfaces', () => {
  const entry: VocabEntry = {
    de: 'Bahnhof',
    ipa: 'ˈbaːnhoːf',
    pos: 'noun',
    gender: 'm',
    plural: 'die Bahnhöfe',
    en: 'train station',
    ru: 'вокзал',
    uk: 'вокзал',
    example_de: 'Der Bahnhof ist neu.',
    example_en: 'The station is new.',
    example_ru: 'Вокзал новый.',
    example_uk: 'Вокзал новий.',
    accept: [],
  };

  test('buildDeck carries uk/exampleUk into both card directions', () => {
    const cards = buildDeck('reisen', [entry]);
    expect(cards).toHaveLength(2);
    for (const card of cards) {
      expect(card.uk).toBe('вокзал');
      expect(card.exampleUk).toBe('Вокзал новий.');
    }
  });

  test('uk never enters card identity: ids are the same with and without it', () => {
    const withUk = buildDeck('reisen', [entry]).map((c) => c.id);
    const withoutUk = buildDeck('reisen', [{ ...entry, uk: undefined, example_uk: undefined }]).map(
      (c) => c.id,
    );
    expect(withUk).toEqual(['reisen::Bahnhof::de-x', 'reisen::Bahnhof::x-de']);
    expect(withoutUk).toEqual(withUk);
  });

  test('wordFieldContexts carries the relation explanation/example uk halves', () => {
    const field: WordField = {
      id: 'reisen-feld',
      topic: 'reisen',
      level: 'A1',
      title_de: 'Reisen',
      title_en: 'Travel',
      title_ru: 'Путешествия',
      members: [
        {
          kind: 'card',
          ref: { deck: 'reisen', de: 'Bahnhof' },
          role: 'active',
          relations: [
            {
              type: 'collocation',
              de: 'am Bahnhof',
              explanation: { en: 'at the station', ru: 'на вокзале', uk: 'на вокзалі' },
              example_de: 'Wir treffen uns am Bahnhof.',
              example: { en: 'We meet at the station.', ru: 'Встречаемся на вокзале.', uk: 'Зустрічаємось на вокзалі.' },
            },
          ],
        },
      ],
    };
    const context = wordFieldContexts([field])['reisen::Bahnhof']![0]!;
    expect(context.uk).toBe('на вокзалі');
    expect(context.exampleUk).toBe('Зустрічаємось на вокзалі.');
  });

  test('TopicNode carries title_uk and title picks fall back to en without it', () => {
    const node: TopicNode = {
      id: 'akkusativ',
      path: '/topics/a1/akkusativ',
      level: 'A1',
      kind: 'grammar',
      title_de: 'Akkusativ',
      title_en: 'The accusative',
      title_ru: 'Аккузатив',
      title_uk: 'Знахідний відмінок',
      prerequisites: [],
      exerciseSets: [],
      vocabIds: [],
      readingIds: [],
    };
    // the record every topic-title surface builds (NextTopic, TopicDetail, OverviewTable, CurriculumPath)
    const title = { en: node.title_en, ru: node.title_ru, uk: node.title_uk };
    expect(pick('uk', title)).toBe('Знахідний відмінок');
    expect(pick('uk', { ...title, uk: undefined })).toBe('The accusative');
  });
});
