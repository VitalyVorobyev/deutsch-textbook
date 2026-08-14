/**
 * A cloze gap must not be a ruler for its own answer — `src/components/exercises/Cloze.tsx`.
 *
 * The width was `answers[0].length + 2`, so `Es gibt hier {{einen}} Supermarkt.` drew a 7ch
 * box and of *einen / eine / ein* only one fits. The item stopped asking which accusative
 * form `der Supermarkt` takes and started asking which candidate is five letters long, while
 * still charging the answer as measured mastery. Corpus-wide, 893 authored gaps rendered
 * between 4ch and 16ch, tracking the answer exactly.
 *
 * Fixtures are inline and state every field the assertions read, so re-authoring the real
 * items can never turn this red for a reason unrelated to the rule. Re-measure the corpus
 * distribution that chose the resting width with:
 *
 *   bun -e 'import {parse} from "yaml"; import {readFileSync} from "fs"; import {Glob} from "bun";
 *   import {parseCloze} from "./packages/grading/src/cloze"; const lens=[];
 *   for await (const f of new Glob("content/exercises/**\/*.yaml").scan(".")) {
 *     let d; try{d=parse(readFileSync(f,"utf8"));}catch{continue;}
 *     for(const it of (d?.items||[])) if(it.type==="cloze"&&it.text)
 *       for(const p of parseCloze(it.text)) if(p.type==="gap") lens.push(p.answers[0].length); }
 *   lens.sort((a,b)=>a-b);
 *   console.log(lens.length, "gaps; median", lens[lens.length>>1], "max", lens.at(-1),
 *     "; <=6:", (100*lens.filter(l=>l<=6).length/lens.length).toFixed(0)+"%")'
 */
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Cloze, GAP_REST_CH, gapWidthCh } from '../src/components/exercises/Cloze';
import { clozeItemSchema } from '@da/schema';

afterEach(cleanup);

const item = (text: string) =>
  clozeItemSchema.parse({
    id: 'gap-width-fixture',
    type: 'cloze',
    text,
    instruction: { en: 'Fill the gap.', ru: 'Вставьте.' },
  });

const widths = (text: string): string[] => {
  render(
    <Cloze item={item(text)} lang="en" onResult={mock(() => {})} locked={false}
      onNext={mock(() => {})} nextLabel="Weiter →" />,
  );
  return screen.getAllByRole('textbox').map((el) => (el as HTMLInputElement).style.width);
};

describe('a gap reveals nothing about the answer it hides', () => {
  test('answers of every authored length render at one width', () => {
    // 1 and 14 characters are the real corpus extremes; einen/eine/ein is the item the
    // learner reported. Under the old rule these were 4ch, 16ch, 7ch, 6ch and 5ch.
    const lengths = ['a', 'aufgestandene', 'einen', 'eine', 'ein', 'der', 'Nachrichten'];
    const rendered = lengths.map((answer) => widths(`Es gibt hier {{${answer}}} Supermarkt.`)[0]);
    expect(new Set(rendered).size).toBe(1);
    expect(rendered[0]).toBe(`${GAP_REST_CH}ch`);
  });

  test('several gaps in one sentence are indistinguishable from each other', () => {
    // `a2/wohnen-umzug` shape: a 3-character and a 7-character answer side by side.
    expect(widths('Tobias stellt {{den}} Schrank {{auf den}} Tisch.'))
      .toEqual([`${GAP_REST_CH}ch`, `${GAP_REST_CH}ch`]);
  });

  test('the box grows with what the learner types, not with the answer', () => {
    render(
      <Cloze item={item('Ich bin heute früh {{aufgestanden}}.')} lang="en"
        onResult={mock(() => {})} locked={false} onNext={mock(() => {})} nextLabel="Weiter →" />,
    );
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.style.width).toBe(`${GAP_REST_CH}ch`);

    // Still resting while the typed text fits — no reflow for the common case.
    fireEvent.change(input, { target: { value: 'aufge' } });
    expect(input.style.width).toBe(`${GAP_REST_CH}ch`);

    // Past that it widens, so a long form stays visible instead of scrolling out of sight.
    fireEvent.change(input, { target: { value: 'aufgestanden' } });
    expect(input.style.width).toBe('14ch');
  });
});

describe('gapWidthCh', () => {
  test('is a function of the typed text alone', () => {
    expect(gapWidthCh('')).toBe(GAP_REST_CH);
    expect(gapWidthCh('ein')).toBe(GAP_REST_CH);
    expect(gapWidthCh('aufgestanden')).toBe(14);
  });
});
