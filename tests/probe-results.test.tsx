/**
 * ProbeResults.tsx gains an explicit line for the exhausted-and-failed family (R3,
 * docs/adrs/0010-probe-failure-remediation.md): every scheduled stage taken, at least
 * one of them wrong. `useUiLang` is pinned to 'de' (src/lib/hooks.ts), so the line
 * renders in German regardless of the `lang` (explanation-language) prop.
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render, screen } from '@testing-library/react';
import { ProbeResults } from '../src/components/progress/ProbeResults';
import type { ProbeFamily } from '../src/lib/probes';
import type { Attempt } from '../src/lib/store';

afterEach(cleanup);

const at = (day: number, hour: number) => new Date(2026, 5, day, hour).getTime();

const exhaustedFamily: ProbeFamily = {
  setId: 'a1/probe-akkusativ',
  topicId: 'akkusativ',
  outcomes: ['akk-objekt-bilden'],
  focus: 'akkusativ-artikel',
  armingItemKeys: ['a1/akkusativ::x'],
  items: [
    { id: 'variant-a', outcomes: ['akk-objekt-bilden'] },
    { id: 'variant-b', outcomes: ['akk-objekt-bilden'] },
    { id: 'variant-c', outcomes: ['akk-objekt-bilden'] },
  ],
};

const midLadderFamily: ProbeFamily = {
  setId: 'a1/probe-dativ',
  topicId: 'dativ',
  outcomes: ['dativ-objekt-bilden'],
  focus: 'dativ-artikel',
  armingItemKeys: ['a1/dativ::x'],
  items: [
    { id: 'variant-a', outcomes: ['dativ-objekt-bilden'] },
    { id: 'variant-b', outcomes: ['dativ-objekt-bilden'] },
    { id: 'variant-c', outcomes: ['dativ-objekt-bilden'] },
  ],
};

function attempt(over: Partial<Attempt> & { setId: string; itemId: string; ts: number; correct: boolean }): Attempt {
  return { itemType: 'translate', given: '', outcomes: [], ...over };
}

describe('ProbeResults exhausted-failed line', () => {
  test('shows the named state for a family with no rungs left and a failure among them', () => {
    const attempts: Attempt[] = [
      attempt({ setId: exhaustedFamily.setId, itemId: 'variant-a', correct: true, ts: at(1, 9) }),
      attempt({ setId: exhaustedFamily.setId, itemId: 'variant-b', correct: false, ts: at(8, 9) }),
      attempt({ setId: exhaustedFamily.setId, itemId: 'variant-c', correct: true, ts: at(22, 9) }),
    ];
    render(
      <ProbeResults
        families={[exhaustedFamily]}
        labels={{ [exhaustedFamily.setId]: 'Akkusativ' }}
        topicPaths={{ akkusativ: '/topics/a1/akkusativ' }}
        attempts={attempts}
        lang="en"
      />,
    );
    expect(screen.getByText('gemessen, nicht bestanden — braucht eine neue Probefamilie')).toBeDefined();
  });

  test('a family still mid-ladder (rungs remain) never shows the exhausted line', () => {
    const attempts: Attempt[] = [
      attempt({ setId: midLadderFamily.setId, itemId: 'variant-a', correct: false, ts: at(1, 9) }),
    ];
    render(
      <ProbeResults
        families={[midLadderFamily]}
        labels={{ [midLadderFamily.setId]: 'Dativ' }}
        topicPaths={{ dativ: '/topics/a1/dativ' }}
        attempts={attempts}
        lang="en"
      />,
    );
    expect(screen.queryByText('gemessen, nicht bestanden — braucht eine neue Probefamilie')).toBeNull();
  });

  test('a family with every stage passed never shows the exhausted line', () => {
    const attempts: Attempt[] = [
      attempt({ setId: exhaustedFamily.setId, itemId: 'variant-a', correct: true, ts: at(1, 9) }),
      attempt({ setId: exhaustedFamily.setId, itemId: 'variant-b', correct: true, ts: at(8, 9) }),
      attempt({ setId: exhaustedFamily.setId, itemId: 'variant-c', correct: true, ts: at(22, 9) }),
    ];
    render(
      <ProbeResults
        families={[exhaustedFamily]}
        labels={{ [exhaustedFamily.setId]: 'Akkusativ' }}
        topicPaths={{ akkusativ: '/topics/a1/akkusativ' }}
        attempts={attempts}
        lang="en"
      />,
    );
    expect(screen.queryByText('gemessen, nicht bestanden — braucht eine neue Probefamilie')).toBeNull();
  });
});
