/**
 * The input-load instrument (src/lib/comprehensibility.ts).
 *
 * Every fixture here is written out in full and every assertion depends only on
 * what its own fixture states. Nothing reads `content/` — a test that asserted a
 * corpus-wide figure would turn red the next time an article was edited, and
 * would be protecting the number rather than the mechanism. The corpus decides
 * the medians; these decide what a token, a sentence and a term are.
 */
import { describe, expect, test } from 'bun:test';
import {
  articleGerman,
  articleSentenceLines,
  GRAMMAR_TERMS,
  isCountedAsAhead,
  isGrammarTerm,
  isKnown,
  isNumberWord,
  itemGerman,
  median,
  nebensatzMarkers,
  parseWortliste,
  reduceGlosses,
  sentenceStats,
  splitSentences,
  terminologyDensity,
  tokens,
} from '../src/lib/comprehensibility';

/** A known set built from a word list, as `measureSpine` builds one. */
const knowing = (...words: string[]) => {
  const set = new Set(words.flatMap((w) => tokens(w)));
  return (t: string) => set.has(t);
};

describe('tokenization', () => {
  test('folds to bare lowercase German, dropping digits and punctuation', () => {
    expect(tokens('Die Rechnung: 160,00 € — bezahlt!')).toEqual([
      'die',
      'rechnung',
      'bezahlt',
    ]);
  });

  test('emphasis inside a word does not cut the word in two', () => {
    // A paradigm table bolds the ending it teaches: `wohn**st**`. Letting
    // normalization turn the asterisks into spaces reported `wohn` and `st` as
    // two words the learner had never met.
    expect(tokens('wohn**st**')).toEqual(['wohnst']);
    expect(tokens('**Ich lerne Deutsch.**')).toEqual(['ich', 'lerne', 'deutsch']);
  });

  test('a bound morpheme is not a word', () => {
    // `| ich | wohn**e** | -e |` — the third column is a suffix, not vocabulary.
    expect(tokens('| Endung | -st | -chen |')).toEqual(['endung']);
    // …but a hyphen inside or at the end of a word is untouched.
    expect(tokens('E-Mail')).toEqual(['e', 'mail']);
    expect(tokens('Vor- und Nachteile')).toEqual(['vor', 'und', 'nachteile']);
  });
});

describe('what counts as ahead of the learner', () => {
  test('a known token is known', () => {
    expect(isKnown('rechnung', knowing('Rechnung'))).toBe(true);
  });

  test('the light fallback strips an ending to reach a known stem', () => {
    // The known set holds what a deck or a manifest lists — singulars and
    // infinitives — while a text shows forms.
    expect(isKnown('rechnungen', knowing('Rechnung'))).toBe(true);
    expect(isKnown('spielt', knowing('spielen'))).toBe(true);
    expect(isKnown('arbeitet', knowing('arbeiten'))).toBe(true);
  });

  test('the light fallback also adds an ending to reach a known form', () => {
    expect(isKnown('spiel', knowing('spiele'))).toBe(true);
  });

  test('an umlaut folds, so a plural reaches its singular', () => {
    expect(isKnown('sätze', knowing('Satz'))).toBe(true);
    expect(isKnown('fährt', knowing('fahren'))).toBe(true);
  });

  test('an unrelated word stays ahead', () => {
    expect(isKnown('kostenvoranschlag', knowing('Rechnung', 'bezahlen'))).toBe(false);
    // The fold is generous but not unbounded: three letters in common is not a match.
    expect(isKnown('reklamation', knowing('Regel'))).toBe(false);
  });

  test('closed-class function words are known without any list saying so', () => {
    // The manifests are lemma lists: `sein` is on them, `ist` is not, and `dem`,
    // `im` and `sich` are on none of the three. Without this the first topic on
    // the spine — which has no prior surface to fall back on — read `ist` as a
    // word ahead of the learner.
    const nothing = () => false;
    for (const word of ['ist', 'hat', 'wird', 'dem', 'im', 'sich', 'eure', 'kann']) {
      expect(isKnown(word, nothing)).toBe(true);
    }
  });

  test('numbers, single letters and Roman numerals are never load', () => {
    expect(isCountedAsAhead('haus')).toBe(true);
    expect(isCountedAsAhead('a')).toBe(false);
    expect(isCountedAsAhead('ii')).toBe(false);
    // `listen` items write numbers as words, by authoring rule.
    expect(isCountedAsAhead('hundertfünfundsiebzig')).toBe(false);
    expect(isCountedAsAhead('siebzehnten')).toBe(false);
  });

  test('a word that merely starts like a number is still a word', () => {
    expect(isNumberWord('achtung')).toBe(false);
    expect(isNumberWord('einsam')).toBe(false);
    expect(isNumberWord('zweifel')).toBe(false);
    // tails may only follow a stem, or `Enten` and `ersten` become numbers
    expect(isNumberWord('enten')).toBe(false);
    expect(isNumberWord('ersten')).toBe(false);
    expect(isNumberWord('dreißigsten')).toBe(true);
  });
});

describe('the Wortliste as a known set', () => {
  const manifest = [
    '# Goethe-A1 — headwords only',
    '',
    '# --- zahlen ---',
    'null',
    'Apfel',
    '~euer',
    'manch-',
    'zu Hause',
  ].join('\n');

  test('comments are dropped and a leading ~ is not part of the word', () => {
    const set = parseWortliste(manifest);
    expect(set.has('apfel')).toBe(true);
    expect(set.has('euer')).toBe(true);
    expect(set.has('goethe')).toBe(false);
  });

  test('a stem headword expands over its endings, and only those', () => {
    const set = parseWortliste(manifest);
    expect(set.has('manch')).toBe(true);
    expect(set.has('manche')).toBe(true);
    expect(set.has('manchem')).toBe(true);
    // the ending list is what stops `manch-` being credited to `manchmal`
    expect(set.has('manchmal')).toBe(false);
  });

  test('a multi-word headword contributes each of its tokens', () => {
    const set = parseWortliste(manifest);
    expect(set.has('hause')).toBe(true);
  });
});

describe('reducing an article to the German the learner reads', () => {
  const body = [
    '---',
    'id: beispiel',
    'level: A1',
    '---',
    '',
    "import SentenceRail from '../../../src/components/visuals/SentenceRail.astro';",
    '',
    '## Kurz gesagt',
    '',
    '<Bilingual>',
    '<En>An English explanation naming Bahnsteig.</En>',
    '<Ru>Русское объяснение, называющее Gleis.</Ru>',
    '<Uk>Українське пояснення, що називає Fahrkarte.</Uk>',
    '<De>Eine deutsche Erklärung über Verspätung.</De>',
    '</Bilingual>',
    '',
    '### Zug und Ankunft',
    '',
    '<SentenceRail view="main" />',
    '',
    '| Wort | Beispiel |',
    '| --- | --- |',
    '| Zug | Der Zug kommt. |',
    '',
    '> **Der Zug wartet.**',
  ].join('\n');

  test('all four halves are stripped, not only En and Ru', () => {
    // coverage.ts strips two, because its question is "does the course teach
    // this word". Here a word used inside ANY half is talked about rather than
    // read as content German — and that is as true of <De> as of <En>.
    // Each of these four occurs in exactly one half and nowhere else.
    const german = tokens(articleGerman(body));
    for (const inside of ['bahnsteig', 'gleis', 'fahrkarte', 'verspätung']) {
      expect(german).not.toContain(inside);
    }
    // …while the German outside the halves survives all four strips.
    expect(german).toContain('wartet');
  });

  test('frontmatter, import lines and the `##` skeleton are not input', () => {
    const german = tokens(articleGerman(body));
    expect(german).not.toContain('astro'); // the import path
    expect(german).not.toContain('id');
    expect(german).not.toContain('gesagt'); // `## Kurz gesagt`, in all 46 articles
    expect(german).not.toContain('main'); // the component's attribute value
  });

  test('a `###` subsection heading and a table are German the learner reads', () => {
    const german = tokens(articleGerman(body));
    expect(german).toContain('ankunft'); // in the ### heading
    expect(german).toContain('beispiel'); // a table header cell
  });

  test('sentence lines drop the table and the headings, and keep the examples', () => {
    expect(articleSentenceLines(body)).toEqual(['Der Zug wartet.']);
  });
});

describe('glosses', () => {
  test('a gloss is reduced to its German half, in three-part and four-part form', () => {
    expect(reduceGlosses('Die [[Anfahrt::call-out::выезд]] kostet 25 Euro.')).toBe(
      'Die Anfahrt kostet 25 Euro.',
    );
    expect(reduceGlosses('[[fällig::due::подлежит оплате::підлягає оплаті]] am 17. Mai')).toBe(
      'fällig am 17. Mai',
    );
  });
});

describe('sentence shape', () => {
  test('an abbreviation is not a sentence boundary', () => {
    expect(splitSentences('Wir zahlen bar, z. B. im Laden. Das geht immer.')).toEqual([
      'Wir zahlen bar, z. B. im Laden.',
      'Das geht immer.',
    ]);
    expect(splitSentences('Das heißt, d. h. genauer, es fehlt eine Zeile.')).toHaveLength(1);
  });

  test('an ordinal date is not a sentence boundary either', () => {
    // The readings are full of these: `ausgestellt am 3. Mai`, `vom 20. April`.
    expect(splitSentences('Die Rechnung ist vom 3. Mai. Sie kam gestern.')).toEqual([
      'Die Rechnung ist vom 3. Mai.',
      'Sie kam gestern.',
    ]);
  });

  test('mean and max are over the sentences, not the lines', () => {
    const stats = sentenceStats(['Ich komme aus Polen. Ich wohne jetzt in Hamburg und lerne Deutsch.']);
    expect(stats.sentences).toBe(2);
    expect(stats.maxWords).toBe(8);
    expect(stats.meanWords).toBe(6);
  });

  test('a marker-free line still counts as a sentence with no markers', () => {
    expect(sentenceStats(['Der Zug kommt.']).nebensatzPerSentence).toBe(0);
  });
});

describe('Nebensatz markers — a proxy, not a parse', () => {
  test('a listed subordinator counts once per occurrence', () => {
    expect(nebensatzMarkers('Ich weiß, dass er kommt, weil er frei hat.')).toBe(2);
  });

  test('a comma directly before a definite article is read as a relative clause', () => {
    expect(nebensatzMarkers('Das ist der Mann, der neben mir wohnt.')).toBe(1);
    // no comma, no heuristic — `der` opening the sentence must not count
    expect(nebensatzMarkers('Der Mann wohnt neben mir.')).toBe(0);
  });

  test('the relative heuristic does not double-count a listed pronoun', () => {
    // `, deren` is on the subordinator list; the `,\s*der` heuristic must not
    // fire on it as well.
    expect(nebensatzMarkers('Die Firma, deren Rechnung falsch war, hat angerufen.')).toBe(1);
  });
});

describe('grammar terminology', () => {
  test('a German term counts through its plural but not through a lookalike', () => {
    expect(isGrammarTerm('Verb')).toBe(true);
    expect(isGrammarTerm('Verben')).toBe(true);
    expect(isGrammarTerm('Endungen')).toBe(true);
    expect(isGrammarTerm('Nebensätze')).toBe(true);
    // the whole reason the suffix list is closed rather than a prefix rule
    expect(isGrammarTerm('Verbindung')).toBe(false);
    expect(isGrammarTerm('verboten')).toBe(false);
  });

  test('a Cyrillic term is a stem and counts through its inflection', () => {
    // An exact-match rule reported the RU and UK halves as term-free, and a
    // statistic that only works for one of four halves is worse than none.
    expect(isGrammarTerm('падеж')).toBe(true);
    expect(isGrammarTerm('падежом')).toBe(true);
    expect(isGrammarTerm('глаголы')).toBe(true);
    expect(isGrammarTerm('прикметника')).toBe(true);
    expect(isGrammarTerm('человек')).toBe(false);
  });

  test('density is per 100 words of the half, markup excluded', () => {
    // 9 words, 3 of them terms (Dativ, Endung, Plural) — the emphasis and the
    // backticks are markup and count as neither.
    const stats = terminologyDensity('Der **Dativ** hat eine eigene Endung im `Plural` hier');
    expect(stats.words).toBe(9);
    expect(stats.terms).toBe(3);
    expect(stats.per100).toBeCloseTo((3 / 9) * 100, 5);
  });

  test('an empty half has no density rather than a division by zero', () => {
    expect(terminologyDensity('').per100).toBe(0);
  });

  test('the lexicon carries all four languages', () => {
    expect(GRAMMAR_TERMS).toContain('akkusativ');
    expect(GRAMMAR_TERMS).toContain('participle');
    expect(GRAMMAR_TERMS).toContain('падеж');
    expect(GRAMMAR_TERMS).toContain('дієслов');
  });
});

describe('German-bearing item fields', () => {
  test('a translate item contributes its answer, never its source prompt', () => {
    expect(
      itemGerman({
        type: 'translate',
        prompt_en: 'The invoice is wrong.',
        prompt_ru: 'Счёт неверный.',
        answer: 'Die Rechnung stimmt nicht.',
        accept: ['Die Rechnung ist falsch.'],
      }),
    ).toEqual(['Die Rechnung stimmt nicht.', 'Die Rechnung ist falsch.']);
  });

  test('a match right that is a meaning record is not German', () => {
    expect(
      itemGerman({
        type: 'match',
        pairs: [
          { left: 'die Anfahrt', right: { en: 'call-out journey', ru: 'выезд' } },
          { left: 'der Preis', right: 'die Kosten' },
        ],
      }),
    ).toEqual(['die Anfahrt', 'der Preis', 'die Kosten']);
  });

  test('an audio item contributes its spoken turns', () => {
    expect(
      itemGerman({
        type: 'audio-comprehension',
        question: 'Was fehlt?',
        options: ['Die Anfahrt', 'Das Material'],
        source: { kind: 'tts', turns: [{ speaker: 'A', text: 'Zeile drei stimmt nicht.' }] },
      }),
    ).toEqual(['Was fehlt?', 'Die Anfahrt', 'Das Material', 'Zeile drei stimmt nicht.']);
  });
});

describe('median', () => {
  test('odd and even lengths, and nothing at all', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBe(0);
  });
});
