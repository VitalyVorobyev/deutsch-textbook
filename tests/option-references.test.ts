/**
 * The rule that stops an explanation naming a shuffled option by its position.
 *
 * Two things are pinned here, and the second is the one that nearly shipped broken.
 *
 * **Precision.** Scanning every ordinal in the shuffled-option corpus returns 203 occurrences and
 * only ~100 are defects; the rest is ordinary grammar prose about verb position, floors, streets
 * and sentence slots. The "must not match" block below is that corpus, condensed. A false positive
 * here rejects correct teaching text, which is worse than the defect it hunts.
 *
 * **The Cyrillic trap.** The first draft wrote the Russian and Ukrainian patterns as `\b…\w*`,
 * copying the English one. JavaScript's `\w` is ASCII-only, so `\b` finds no boundary before `П`
 * and `\w*` consumes nothing after it: both patterns were syntactically valid, threw nothing, and
 * matched nothing — while the corpus held 68 Russian and Ukrainian instances. The validator ran
 * green against them. Every Cyrillic case below exists to keep that from coming back.
 */
import { describe, expect, test } from 'bun:test';
import { namesOptionByPosition, positionalReference } from '../src/lib/option-references';

describe('positional references to a shuffled option', () => {
  const flagged = [
    // English
    'The second option copies the English order.',
    'The first option puts two elements in front of the verb.',
    'the third option is a du-imperative',
    'The fourth option breaks both at once.',
    'The middle option is the neutral A2 order.',
    'in the pairs above, the last one is the odd one out',
    // Russian — nominative, and the prepositional the bug hid
    'Первый вариант — нейтральная бытовая модель.',
    'Во втором варианте подлежащее осталось перед глаголом.',
    'Третий вариант — совершенно правильный немецкий.',
    'Четвёртый вариант нарушает оба правила сразу.',
    'В первом ответе падеж выбран неверно.',
    // Ukrainian
    'Перший варіант — нейтральна побутова модель.',
    'У другому варіанті підмет залишився перед дієсловом.',
    'Третій варіант — цілком правильна німецька.',
    // German
    'Die zweite Option kopiert die Ordnung der Ausgangssprachen.',
    'Die dritte Variante lässt das zu fallen.',
    'In der letzten Antwort fehlt das Reflexivpronomen.',
    // The number after the noun. The ordinal patterns miss all of these, and the corpus held
    // 13 such fields across 5 items after the ordinal sweep had reported itself finished.
    'Option 2 gets the conjunction right and the word order wrong.',
    'so option 1 is the target',
    'Вариант 2 оставляет оба в настоящем.',
    'Варіант 3 не звучить зовсім.',
    'trinken kann nicht neben sollten stehen (Antwort 2).',
    'Option two turns a plan into a fact.',
  ];

  for (const text of flagged) {
    test(`flags: ${text.slice(0, 46)}`, () => {
      expect(namesOptionByPosition(text)).toBe(true);
      expect(positionalReference(text)).toBeTruthy();
    });
  }

  const allowed = [
    // Verb position — the single most common shape in the corpus, and never about options.
    'The conjugated verb sits in position 2 and the second verb goes to the very end.',
    'so schreiben comes second and the subject wir drops in behind it',
    'wann der Film beginnt. Verb-second after wann is the direct question.',
    'So arbeiten ends up second-to-last and muss closes the sentence.',
    'the order is fixed: the infinitive first, the conjugated one right at the wall',
    'Of the two objects the dative comes first.',
    // German content quoted inside an explanation.
    'Gehen Sie geradeaus und dann die erste Straße rechts.',
    'kein Aufzug means there is no lift, and vierter Stock is the fourth floor, not the first.',
    'eine Wohnung, die im dritten Stock liegt',
    // Sentences, lines and turns — positions in the German, not in the option list.
    'The second sentence sends you to the other one.',
    'Sitzplätze ohne Reservierung is ruled out in the very first line.',
    'the speaker says it twice, and the second time is the repetition Elif asked for',
    'The first time is corrected: nicht um 18:10.',
    // Grammar terminology that happens to carry an ordinal.
    'For first contact with an unknown professional, Könnten Sie is the safe opening.',
    'Das Verb steht an erster Stelle nur im Imperativ.',
    'Первый предлог требует Dativ, второй — Akkusativ.',
    'У німецькій третя особа однини має закінчення -t.',
    // "answer" and "choice" are verbs too, which is why the spelled-out rule takes neither.
    'You only need to answer one question about the recording.',
    'Sie müssen nur eine Frage beantworten.',
    // A digit that belongs to the German, a level, or a grammatical position — not to a list.
    'Das Verb steht auf Position 2, das Partizip am Ende.',
    'Der Kurs beginnt um 2 Uhr.',
  ];

  for (const text of allowed) {
    test(`allows: ${text.slice(0, 46)}`, () => {
      expect(namesOptionByPosition(text)).toBe(false);
    });
  }

  test('the Cyrillic patterns are alive at all', () => {
    // Guards the exact defect described in the file header: ASCII `\b`/`\w` silently matched
    // nothing in Russian and Ukrainian while the English and German patterns worked, so the
    // rule looked healthy and the corpus looked clean.
    expect(positionalReference('Второй вариант неверен в местоимении.')).toBe('Второй вариант');
    expect(positionalReference('Другий варіант хибний у займеннику.')).toBe('Другий варіант');
  });

  test('the report names the phrase, so the author can find it', () => {
    expect(positionalReference('The second option leaves muss in the middle.')).toBe('The second option');
    expect(positionalReference('Die zweite Option kopiert das.')).toBe('zweite Option');
    expect(positionalReference('nothing positional here')).toBeUndefined();
  });
});
