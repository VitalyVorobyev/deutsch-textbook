import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ApiContext } from '../useEngine';
import {
  sceneDetailFixture,
  scenesFixture,
  stubApi,
  warteschlangeFixture,
} from '../test/fixtures';
import { Freigabe } from './Freigabe';
import { Pruefung } from './Pruefung';
import type { Api } from '../api';
import type { ReactNode } from 'react';

/**
 * The one screen in Tonwerk that writes a claim about published material.
 *
 * These specs are about the *discipline*, not the layout: that the queue orders by waiting time,
 * that the script is not on screen while the master is being heard, that the checklist cannot be
 * reached or completed by accident, and that the signature names the sha of what was played. Every
 * one of those is invisible when it breaks — the page still renders, and the manifest it produces
 * simply stops meaning what it says.
 */

function mount(node: ReactNode, api: Api) {
  return render(<ApiContext.Provider value={api}>{node}</ApiContext.Provider>);
}

beforeEach(() => {
  // The reviewer's name is remembered across scenes on purpose, which means it also leaks across
  // specs: an approval in one test prefilled the decline field in the next, and the assertion
  // about a decline by nobody passed a name instead. A spec states its own inputs.
  window.localStorage.clear();
  window.location.hash = '#/pruefung';
});

describe('the queue', () => {
  test('lists only what waits for a human, oldest first', async () => {
    mount(
      <Pruefung />,
      stubApi({ scenes: async () => [...warteschlangeFixture, ...scenesFixture] as never }),
    );

    await screen.findByText('Wartet auf einen Menschen');
    const zeilen = screen.getAllByRole('row').slice(1);
    // `ls-wohnen-01` (approved) and `a1-erste-schritte` (draft) are not waiting on anybody.
    expect(zeilen).toHaveLength(3);
    expect(zeilen[0]?.textContent).toContain('ls-frueh-02');
    expect(zeilen[2]?.textContent).toContain('ls-spaet-01');
  });

  test('a failed check is drawn as itself, not as a take waiting for a signature', async () => {
    mount(<Pruefung />, stubApi({ scenes: async () => warteschlangeFixture as never }));

    await screen.findByText('Wartet auf einen Menschen');
    // Both are `automatically_checked`; only the verdict tells them apart, and a queue that
    // conflated them would send the reviewer through twenty pointless listens.
    expect(screen.getAllByText('wartet auf Freigabe')).toHaveLength(2);
    expect(screen.getByText('Prüfung fehlgeschlagen')).toBeTruthy();
  });

  test('the empty state states what it means, rather than shrugging', async () => {
    mount(<Pruefung />, stubApi({ scenes: async () => scenesFixture as never }));

    await screen.findByText(/Nichts wartet auf einen Menschen/);
  });

  test('j and k walk the queue and Enter opens the selected review', async () => {
    mount(<Pruefung />, stubApi({ scenes: async () => warteschlangeFixture as never }));

    const bereich = await screen.findByRole('grid', { name: /Freigabe warten/ });
    // Nothing chosen yet resolves to the head of the queue: the row that has waited longest.
    await waitFor(() => expect(bereich.getAttribute('aria-activedescendant')).toBe('zeile-ls-frueh-02'));

    fireEvent.keyDown(bereich, { key: 'j' });
    await waitFor(() =>
      expect(bereich.getAttribute('aria-activedescendant')).toBe('zeile-ls-durchgefallen-03'),
    );
    fireEvent.keyDown(bereich, { key: 'k' });
    await waitFor(() => expect(bereich.getAttribute('aria-activedescendant')).toBe('zeile-ls-frueh-02'));

    fireEvent.keyDown(bereich, { key: 'Enter' });
    await waitFor(() => expect(window.location.hash).toBe('#/pruefung/ls-frueh-02'));
  });
});

/** A scene sitting exactly where a review starts: measured, passed, unsigned. */
const wartend = {
  ...sceneDetailFixture,
  stage: 'automatically_checked',
  approval: null,
};

describe('the Freigabe flow', () => {
  test('the listen stage shows the master and keeps the script behind a disclosure', async () => {
    mount(<Freigabe slug="ls-wohnen-01" />, stubApi({ scene: async () => wartend as never }));

    await screen.findByRole('heading', { name: 'Master' });
    // The reason is on the summary, not inside: a reason you only see after opening arrives after
    // the damage. And the disclosure is closed, so the utterance is not on screen.
    const schleier = screen.getByText('Skript anzeigen (nach dem Hören)').closest('details');
    expect(schleier?.open).toBe(false);
    expect(screen.getByText(/Beim Mitlesen hört man Wörter/)).toBeTruthy();

    // Neither the report nor the checklist is reachable yet.
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.getByText(/Verschlossen, bis das Hören bestätigt ist/)).toBeTruthy();
  });

  test('the checklist appears only after the reviewer says they have listened', async () => {
    mount(<Freigabe slug="ls-wohnen-01" />, stubApi({ scene: async () => wartend as never }));

    fireEvent.click(await screen.findByRole('button', { name: /Gehört/ }));

    await waitFor(() => expect(screen.getAllByRole('switch').length).toBeGreaterThan(0));
    expect(screen.getByText('Prüfbericht')).toBeTruthy();
  });

  test('only the points this scene can answer are asked, and none is pre-ticked', async () => {
    mount(<Freigabe slug="ls-wohnen-01" />, stubApi({ scene: async () => wartend as never }));
    fireEvent.click(await screen.findByRole('button', { name: /Gehört/ }));

    const schalter = await screen.findAllByRole('switch');
    // The fixture has an ambience bed and an exercise, so all eight apply.
    expect(schalter).toHaveLength(8);
    expect(schalter.every((knopf) => knopf.getAttribute('aria-checked') === 'false')).toBe(true);
    // There is deliberately no way to confirm all of them at once.
    expect(screen.queryByRole('button', { name: /alle/i })).toBeNull();
  });

  test('a scene with no sound and no exercise is not asked about either', async () => {
    const nurSprache = {
      ...wartend,
      exercise: null,
      document: {
        valid: true,
        scene: {
          ...wartend.document.scene,
          timeline: wartend.document.scene.timeline.filter((entry) => entry.type === 'speech'),
        },
      },
    };
    mount(<Freigabe slug="ls-wohnen-01" />, stubApi({ scene: async () => nurSprache as never }));
    fireEvent.click(await screen.findByRole('button', { name: /Gehört/ }));

    const schalter = await screen.findAllByRole('switch');
    expect(schalter).toHaveLength(6);
    expect(screen.getByText(/Eine Bestätigung über etwas, das es nicht gibt/)).toBeTruthy();
  });

  test('Freigeben stays refused until every point and the name are given', async () => {
    mount(<Freigabe slug="ls-wohnen-01" />, stubApi({ scene: async () => wartend as never }));
    fireEvent.click(await screen.findByRole('button', { name: /Gehört/ }));

    const knopf = screen.getByRole('button', { name: 'Freigeben' });
    expect(knopf.hasAttribute('disabled')).toBe(true);

    for (const schalter of await screen.findAllByRole('switch')) fireEvent.click(schalter);
    fireEvent.change(screen.getByRole('textbox', { name: /Name der freigebenden Person/ }), {
      target: { value: '  ' },
    });
    // Everything certified, nobody certifying it: the name is the provenance record.
    expect(screen.getByRole('button', { name: 'Freigeben' }).hasAttribute('disabled')).toBe(true);

    fireEvent.change(screen.getByRole('textbox', { name: /Name der freigebenden Person/ }), {
      target: { value: 'Vitaly Vorobyev' },
    });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Freigeben' }).hasAttribute('disabled')).toBe(false),
    );
  });

  test('the approval names the sha of the render that was on screen', async () => {
    const approveScene = vi.fn(async () => ({
      slug: 'ls-wohnen-01',
      revision: 4,
      stage: 'human_approved',
      approval: {
        status: 'complete',
        editor: 'Vitaly Vorobyev',
        reviewed_at: '2026-08-21T10:00:00+00:00',
        checklist: ['accent'],
        audio_sha256: 'deadbeef1234',
        variant: 'natural',
      },
    }));
    mount(
      <Freigabe slug="ls-wohnen-01" />,
      stubApi({ scene: async () => wartend as never, approveScene: approveScene as never }),
    );
    fireEvent.click(await screen.findByRole('button', { name: /Gehört/ }));
    for (const schalter of await screen.findAllByRole('switch')) fireEvent.click(schalter);
    fireEvent.change(screen.getByRole('textbox', { name: /Name der freigebenden Person/ }), {
      target: { value: 'Vitaly Vorobyev' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Freigeben' }));

    await waitFor(() => expect(approveScene).toHaveBeenCalledTimes(1));
    const [slug, submission] = approveScene.mock.calls[0] as unknown as [string, {
      master_sha256: string;
      variant: string;
      checklist: string[];
      editor: string;
    }];
    expect(slug).toBe('ls-wohnen-01');
    // Read off the render row this page played — not fetched again at submit time, which would be
    // a digest of whatever is on disk now rather than of what was heard.
    expect(submission.master_sha256).toBe('deadbeef1234');
    // And the variant the stored report ran on, so the report and the audio describe one thing.
    expect(submission.variant).toBe('natural');
    expect(submission.checklist).toHaveLength(8);
    expect(submission.editor).toBe('Vitaly Vorobyev');

    // The record, in the reviewer's own name, replaces the controls.
    await screen.findByText('Freigegeben');
    expect(screen.getAllByText('Vitaly Vorobyev').length).toBeGreaterThan(0);
  });

  test('a 409 from a re-render says re-listen rather than offering to try again', async () => {
    const { EngineError } = await import('../api');
    mount(
      <Freigabe slug="ls-wohnen-01" />,
      stubApi({
        scene: async () => wartend as never,
        approveScene: () =>
          Promise.reject(
            new EngineError(
              409,
              'the master of ls-wohnen-01 natural is 99ff… , not the deadbeef1234 this approval names — re-listen to the current render before approving it',
            ),
          ),
      }),
    );
    fireEvent.click(await screen.findByRole('button', { name: /Gehört/ }));
    for (const schalter of await screen.findAllByRole('switch')) fireEvent.click(schalter);
    fireEvent.change(screen.getByRole('textbox', { name: /Name der freigebenden Person/ }), {
      target: { value: 'Vitaly Vorobyev' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Freigeben' }));

    const alarm = await screen.findByRole('alert');
    expect(alarm.textContent).toContain('Der Master hat sich geändert');
    expect(within(alarm).getByRole('button', { name: /Neu laden/ })).toBeTruthy();
    // Nothing was recorded, so the page is still a review rather than a receipt.
    expect(screen.queryByText('Freigegeben')).toBeNull();
  });

  test('a failed automatic check refuses the signature and still allows a refusal', async () => {
    const durchgefallen = {
      ...wartend,
      qa: { ...wartend.qa, passed: false },
    };
    mount(<Freigabe slug="ls-wohnen-01" />, stubApi({ scene: async () => durchgefallen as never }));

    const alarm = await screen.findByRole('alert');
    expect(alarm.textContent).toContain('Die automatische Prüfung ist durchgefallen');
    expect(screen.getByRole('button', { name: 'Freigeben' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Ablehnen' }).hasAttribute('disabled')).toBe(false);
  });

  test('a decline carries a reason and the reason has to be one', async () => {
    const declineScene = vi.fn(async () => ({
      slug: 'ls-wohnen-01',
      revision: 4,
      stage: 'draft',
      decline: {
        status: 'declined',
        editor: 'Vitaly',
        reviewed_at: '2026-08-21T10:00:00+00:00',
        reason: 'Jonas drifts into another voice on line 2.',
        scene_sha256: 'abc1234def5678',
      },
    }));
    mount(
      <Freigabe slug="ls-wohnen-01" />,
      stubApi({ scene: async () => wartend as never, declineScene: declineScene as never }),
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Ablehnen' }));
    const senden = await screen.findByRole('button', { name: 'Ablehnung senden' });
    expect(senden.hasAttribute('disabled')).toBe(true);

    fireEvent.change(screen.getByRole('textbox', { name: /^Grund/ }), {
      target: { value: 'Jonas drifts into another voice on line 2.' },
    });
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Ablehnung senden' }).hasAttribute('disabled'),
      ).toBe(false),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Ablehnung senden' }));

    await waitFor(() => expect(declineScene).toHaveBeenCalledTimes(1));
    expect(declineScene.mock.calls[0]).toEqual([
      'ls-wohnen-01',
      'Jonas drifts into another voice on line 2.',
      undefined,
    ]);
    await screen.findByText('Abgelehnt');
  });

  test('an already-signed revision shows the record and offers no second signature', async () => {
    mount(
      <Freigabe slug="ls-wohnen-01" />,
      stubApi({ scene: async () => sceneDetailFixture as never }),
    );

    await screen.findByText('Freigegeben');
    expect(screen.getByRole('button', { name: 'Freigeben' }).hasAttribute('disabled')).toBe(true);
    const alarm = await screen.findByRole('alert');
    expect(alarm.textContent).toContain('bereits');
  });
});
