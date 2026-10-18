/**
 * What a free-typed miss logs as its `focus`, at the component boundary.
 *
 * `evaluateFocusEvidence` is unit-tested in evidence.test.ts; this file pins the decision
 * the components make *with* that verdict, which is where the weakness signal is actually
 * produced. The rule has two halves and both are load-bearing:
 *
 *   - where an item authors `focus_evidence`, the predicates decide, and anything they do
 *     not call a failure is unknown (an inserted `zu` or a mishearing must
 *     not be charged to the item's grammar tag);
 *   - where an item authors none, attribution stays exactly as it was — `key_tokens` for
 *     `translate`, `dictationSlip` for `listen`.
 *
 * The second half is the one measured against the corpus. Letting predicates *replace*
 * attribution everywhere drops the tag on 145 of the learner's 291 wrong free-typed
 * attempts and takes `weakFocuses` from 7 to 1, with error rates falling to zero at an
 * unchanged denominator (`um-am-zeit` 21% → 1%, n = 30 both ways). A focus reading 0% on a
 * confusion the learner fails 41% of the time is a false entry of the opposite sign, not
 * the honest gap the disclaimer exists to create.
 *
 * Reproduce: replay `progress/vitaly`'s newest snapshot through `weakFocuses` with each
 * rule; the counts above come from that replay.
 */
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Listen } from '../src/components/exercises/Listen';
import { Translate } from '../src/components/exercises/Translate';
import { Cloze } from '../src/components/exercises/Cloze';
import { Order } from '../src/components/exercises/Order';
import { TableFill } from '../src/components/exercises/TableFill';
import { focusForAttempt } from '../src/lib/evidence';
import {
  clozeItemSchema,
  listenItemSchema,
  orderItemSchema,
  tableItemSchema,
  translateItemSchema,
} from '@da/schema';

afterEach(cleanup);

const PREDICATES = {
  retained: ['\\b(willst|möchtest) du mitkommen\\b', '\\bmusst du arbeiten$'],
  failed: ['\\bzu mitkommen\\b', '\\bmitzukommen\\b', '\\bzu arbeiten$'],
};

const translateItem = (focus_evidence?: typeof PREDICATES) =>
  translateItemSchema.parse({
    id: 'modal-ohne-zu',
    type: 'translate',
    focus: 'zu-infinitiv',
    ...(focus_evidence ? { focus_evidence } : {}),
    prompt_en: 'Do you want to come along, or do you have to work?',
    prompt_ru: 'Ты хочешь пойти с нами или тебе нужно работать?',
    answer: 'Willst du mitkommen, oder musst du arbeiten?',
    key_tokens: ['mitkommen', 'arbeiten'],
  });

/** Answer the rendered item and return the `focus` the attempt would carry. */
function answer(item: ReturnType<typeof translateItem>, typed: string) {
  cleanup(); // several answers per test — each needs its own mount
  const onResult = mock(() => {});
  render(
    <Translate
      item={item}
      lang="en"
      onResult={onResult}
      locked={false}
      onNext={mock(() => {})}
      nextLabel="Weiter →"
    />,
  );
  fireEvent.change(screen.getByRole('textbox'), { target: { value: typed } });
  fireEvent.click(screen.getByRole('button', { name: /prüfen|check/i }));
  const result = (onResult.mock.calls[0] as unknown[])[0] as { focus?: string | null };
  return focusForAttempt(item, result);
}

describe('free-typed focus attribution', () => {
  test('predicates decide where an item authors them', () => {
    const item = translateItem(PREDICATES);
    // The inserted `zu` is the confusion the drill exists to catch — and `key_tokens` is
    // blind to it, because attribution fires on a token that diverges, not one added.
    expect(answer(item, 'Willst du zu mitkommen, oder musst du arbeiten?')).toBe('zu-infinitiv');
    // A lexical substitution gets the grammar right; charging it to the tag would be
    // a false attribution.
    expect(answer(item, 'Willst du kommen, oder musst du arbeiten?')).toBeUndefined();
  });

  test('an item with no predicates keeps key_tokens attribution rather than going silent', () => {
    const item = translateItem();
    // `mitkommen` is pinned and diverged, so the tag is still evidence about zu-infinitiv.
    expect(answer(item, 'Willst du mitzukommen, oder musst du arbeiten?')).toBe('zu-infinitiv');
    // Both pins survive and the word order is what broke — nothing the tag grades diverged,
    // so the miss is disclaimed, exactly as before this PR.
    expect(answer(item, 'Willst du mitkommen, oder du musst arbeiten?')).toBeUndefined();
  });

  test('a correct answer keeps the tag under either rule', () => {
    const typed = 'Willst du mitkommen, oder musst du arbeiten?';
    expect(answer(translateItem(PREDICATES), typed)).toBe('zu-infinitiv');
    expect(answer(translateItem(), typed)).toBe('zu-infinitiv');
  });
});

describe('dictation focus attribution', () => {
  const listenItem = (focus_evidence?: { retained: string[]; failed: string[] }) =>
    listenItemSchema.parse({
      id: 'diktat',
      type: 'listen',
      focus: 'verb-endungen',
      text: 'Meine Schwester spricht drei Sprachen.',
      ...(focus_evidence ? { focus_evidence } : {}),
    });

  function hear(item: ReturnType<typeof listenItem>, typed: string) {
    cleanup();
    const onResult = mock(() => {});
    render(
      <Listen
        item={item}
        lang="en"
        onResult={onResult}
        locked={false}
        onNext={mock(() => {})}
        nextLabel="Weiter →"
      />,
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: typed } });
    fireEvent.click(screen.getByRole('button', { name: /prüfen|check/i }));
    const result = (onResult.mock.calls[0] as unknown[])[0] as { focus?: string | null };
    return focusForAttempt(item, result);
  }

  const predicates = {
    retained: ['\\bSchwester spricht\\b'],
    failed: ['\\bSchwester (spreche|sprechen|sprecht)\\b'],
  };

  test('predicates separate a wrong ending from a mishearing', () => {
    const item = listenItem(predicates);
    expect(hear(item, 'Meine Schwester sprechen drei Sprachen.')).toBe('verb-endungen');
    // The ending was reproduced; the noun was misheard. Not evidence about verb endings.
    expect(hear(item, 'Meine Schwester spricht drei Sachen.')).toBeUndefined();
  });

  test('without predicates a mishearing still falls back to dictationSlip, not to silence', () => {
    const item = listenItem();
    // More than one edit from the target, so `dictationSlip` does not excuse it: today's
    // behaviour, kept deliberately until predicates are authored for A2/B1 dictations.
    expect(hear(item, 'Meine Schwester spricht vier Sprachen.')).toBe('verb-endungen');
  });
});

describe('an authored failed predicate beats the dictation slip', () => {
  // Both of this item's own errors are one letter off the target and outside the closed class,
  // so `dictationSlip` calls each a typo. `adjektiv-nomen` is the capital and the -es.
  const neuesItem = (focus_evidence?: {
    retained: string[];
    failed: string[];
    case_sensitive?: boolean;
  }) =>
    listenItemSchema.parse({
      id: 'hoeren-diktat-neues',
      type: 'listen',
      focus: 'adjektiv-nomen',
      text: 'Als Verkäufer habe ich immer etwas Neues gelernt.',
      ...(focus_evidence ? { focus_evidence } : {}),
    });
  const PREDICATES = {
    case_sensitive: true,
    failed: ['\\betwas neu', '\\betwas Neu(e[mnr]?)?\\b'],
    retained: ['\\betwas Neues\\b'],
  };

  function hear(item: ReturnType<typeof neuesItem>, typed: string) {
    cleanup();
    const onResult = mock(() => {});
    render(
      <Listen
        item={item}
        lang="en"
        onResult={onResult}
        locked={false}
        onNext={mock(() => {})}
        nextLabel="Weiter →"
      />,
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: typed } });
    fireEvent.click(screen.getByRole('button', { name: /prüfen|check/i }));
    const result = (onResult.mock.calls[0] as unknown[])[0] as {
      focus?: string | null;
      correct: boolean;
    };
    return { correct: result.correct, focus: focusForAttempt(item, result) };
  }

  test('a slip the predicate names is logged against the tag', () => {
    const item = neuesItem(PREDICATES);
    expect(hear(item, 'Als Verkäufer habe ich immer etwas neues gelernt.')).toEqual({
      correct: false,
      focus: 'adjektiv-nomen',
    });
    expect(hear(item, 'Als Verkäufer habe ich immer etwas Neue gelernt.')).toEqual({
      correct: false,
      focus: 'adjektiv-nomen',
    });
  });

  test('a slip elsewhere stays disclaimed, and the target keeps its tag', () => {
    const item = neuesItem(PREDICATES);
    expect(hear(item, 'Als Verkaufer habe ich immer etwas Neues gelernt.')).toEqual({
      correct: false,
      focus: undefined,
    });
    expect(hear(item, 'Als Verkäufer habe ich immer etwas Neues gelernt.')).toEqual({
      correct: true,
      focus: 'adjektiv-nomen',
    });
  });

  test('without predicates the same slip is still forgiven — the override is opt-in', () => {
    expect(hear(neuesItem(), 'Als Verkäufer habe ich immer etwas neues gelernt.')).toEqual({
      correct: false,
      focus: undefined,
    });
  });
});

/**
 * The islands with no `key_tokens` — cloze, order, table — charged every miss to the item's tag,
 * and `focus_evidence` was accepted by the schema and silently ignored there. Now the predicates
 * decide where an item authors them, read against the sentence the learner built; where it does
 * not, every miss keeps the tag, because nearly every gap is the confusion itself.
 */
describe('island focus attribution', () => {
  function submit(ui: (onResult: ReturnType<typeof mock>) => React.ReactElement, typed: string[]) {
    cleanup();
    const onResult = mock(() => {});
    render(ui(onResult));
    const inputs = screen.queryAllByRole('textbox');
    typed.forEach((value, n) => fireEvent.change(inputs[n]!, { target: { value } }));
    fireEvent.click(screen.getByRole('button', { name: /prüfen|check/i }));
    return (onResult.mock.calls[0] as unknown[])[0] as {
      correct: boolean;
      focus?: string | null;
      focusEvidence?: string;
    };
  }

  const clozeItem = (focus_evidence?: { retained: string[]; failed: string[] }) =>
    clozeItemSchema.parse({
      id: 'cloze-falls-platz',
      type: 'cloze',
      focus: 'falls-wenn',
      text: '{{Falls|Wenn}} ein Platz frei {{wird}}, rufen wir Sie an.',
      ...(focus_evidence ? { focus_evidence } : {}),
    });
  const clozeFocus = (item: ReturnType<typeof clozeItem>, typed: string[]) => {
    const result = submit(
      (onResult) => (
        <Cloze
          item={item}
          lang="en"
          onResult={onResult}
          locked={false}
          onNext={mock(() => {})}
          nextLabel="Weiter →"
        />
      ),
      typed,
    );
    return { correct: result.correct, focus: focusForAttempt(item, result) };
  };
  const PREDICATES = { retained: ['^(falls|wenn)\\b'], failed: ['^(ob|als|wann|dass)\\b'] };

  test('a lower-case conjunction at the sentence head is correct', () => {
    expect(clozeFocus(clozeItem(), ['falls', 'wird'])).toEqual({
      correct: true,
      focus: 'falls-wenn',
    });
  });

  test('predicates decide: the wrong conjunction is charged, a slip in another gap is not', () => {
    const item = clozeItem(PREDICATES);
    expect(clozeFocus(item, ['Ob', 'wird'])).toEqual({ correct: false, focus: 'falls-wenn' });
    expect(clozeFocus(item, ['Falls', 'wirt'])).toEqual({ correct: false, focus: undefined });
  });

  test('without predicates every miss keeps the tag, as before', () => {
    expect(clozeFocus(clozeItem(), ['Falls', 'wirt'])).toEqual({
      correct: false,
      focus: 'falls-wenn',
    });
  });

  test('an order item reads its predicates off the assembled sentence', () => {
    const item = orderItemSchema.parse({
      id: 'order-trotz',
      type: 'order',
      focus: 'praeposition-genitiv',
      words: ['Trotz', 'des', 'Regens', 'gehen', 'wir', 'spazieren.'],
      focus_evidence: { retained: ['\\btrotz des regens\\b'], failed: ['\\btrotz (der|dem|den) '] },
    });
    // With one chip of each word there is no wrong genitive to build: a misordered sentence is a
    // word-order miss, and the genitive survived it.
    cleanup();
    const onResult = mock(() => {});
    render(
      <Order
        item={item}
        lang="en"
        onResult={onResult}
        locked={false}
        onNext={mock(() => {})}
        nextLabel="Weiter →"
      />,
    );
    for (const word of ['wir', 'gehen', 'Trotz', 'des', 'Regens', 'spazieren.'])
      fireEvent.click(screen.getByRole('button', { name: word }));
    fireEvent.click(screen.getByRole('button', { name: /prüfen|check/i }));
    const result = (onResult.mock.calls[0] as unknown[])[0] as {
      correct: boolean;
      focus?: string | null;
    };
    expect(result.correct).toBe(false);
    expect(focusForAttempt(item, result)).toBeUndefined();
  });

  test('a table item reads its predicates off the asked cells', () => {
    const item = tableItemSchema.parse({
      id: 'table-indirekt',
      type: 'table',
      focus: 'indirekte-rede',
      columns: ['direkt', 'indirekt'],
      rows: [
        {
          label: 'kommen',
          cells: [{ answer: '„Kommst du mit?“', given: true }, { answer: 'ob du mitkommst' }],
        },
      ],
      focus_evidence: { retained: ['^ob\\b'], failed: ['^(dass|wenn)\\b'] },
    });
    const table = (typed: string[]) => {
      const result = submit(
        (onResult) => (
          <TableFill
            item={item}
            lang="en"
            onResult={onResult}
            locked={false}
            onNext={mock(() => {})}
            nextLabel="Weiter →"
          />
        ),
        typed,
      );
      return focusForAttempt(item, result);
    };
    expect(table(['dass du mitkommst'])).toBe('indirekte-rede');
    // The lost prefix the B1.16 pass found charged to the tag: the opener was right.
    expect(table(['ob du kommst'])).toBeUndefined();
  });
});
