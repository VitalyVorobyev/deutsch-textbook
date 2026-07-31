/**
 * What a free-typed miss logs as its `focus`, at the component boundary.
 *
 * `evaluateFocusEvidence` is unit-tested in evidence.test.ts; this file pins the decision
 * the components make *with* that verdict, which is where the weakness signal is actually
 * produced. The rule has two halves and both are load-bearing:
 *
 *   - where an item authors `focus_evidence`, the predicates decide, and anything they do
 *     not call a failure is unknown (P12-5/P12-6 — an inserted `zu` or a mishearing must
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
import { focusForAttempt } from '../src/lib/evidence';
import { listenItemSchema, translateItemSchema } from '../src/lib/schemas';

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
  render(<Translate item={item} lang="en" onResult={onResult} locked={false}
    onNext={mock(() => {})} nextLabel="Weiter →" />);
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
    // A lexical substitution gets the grammar right; charging it to the tag is the
    // false attribution P12-5 named.
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
    render(<Listen item={item} lang="en" onResult={onResult} locked={false}
      onNext={mock(() => {})} nextLabel="Weiter →" />);
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
