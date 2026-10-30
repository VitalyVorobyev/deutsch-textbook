import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from './App';
import {
  clearToken,
  getToken,
  redeemLaunchCode,
  setToken,
  shellToken,
  takeLaunchCode,
} from './auth';
import { registryFixture } from './test/fixtures';

/**
 * The shell owns exactly one thing no view may duplicate: whether there is a usable session.
 *
 * Both directions are tested because both are silent when broken. Without the first, a fresh
 * checkout renders an empty table and looks like an engine with no data. Without the second, an
 * engine restart — which happens every session, since the token is minted per run and never written
 * to disk — leaves every screen quietly failing to load with no way back to the token field.
 */

function antwort(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

beforeEach(() => {
  clearToken();
  window.location.hash = '#/uebersicht';
});

describe('the session', () => {
  test('with no token, the app is the token screen and nothing else', () => {
    render(<App />);

    expect(screen.getByText('Mit der Engine verbinden')).toBeTruthy();
    expect(screen.getByLabelText('API-Token')).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Bereiche' })).toBeNull();
  });

  test('a token opens the shell and is kept for the next reload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => antwort(registryFixture)),
    );
    render(<App />);

    // `fireEvent.change` and not a direct `.value =`: React tracks a controlled input's value on the
    // node, so a raw assignment updates the DOM and never reaches the component.
    fireEvent.change(screen.getByLabelText('API-Token'), { target: { value: 'geheim-123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verbinden' }));

    await waitFor(() => expect(screen.getByRole('navigation', { name: 'Bereiche' })).toBeTruthy());
    expect(getToken()).toBe('geheim-123');
    expect(screen.getByRole('heading', { level: 1, name: 'Übersicht' })).toBeTruthy();
  });

  test('a 401 anywhere returns to the token screen carrying the engine’s reason', async () => {
    setToken('abgelaufen');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => antwort({ detail: 'Invalid bearer token' }, { status: 401 })),
    );

    render(<App />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Invalid bearer token');
    expect(alert.textContent).toContain('atlas-listening serve');
    expect(screen.getByLabelText('API-Token')).toBeTruthy();
    // The dead token is discarded, or the next reload would silently fail the same way with no
    // explanation on screen.
    expect(getToken()).toBe('');
  });
});

describe('signing in without a token screen', () => {
  test('a redeemed launch code opens the shell, and the token is kept for this tab only', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => antwort(registryFixture)),
    );
    render(<App anmeldung={Promise.resolve({ token: 'vom-startlink' })} />);

    // While the code is in flight the token field must not flash up.
    expect(screen.queryByLabelText('API-Token')).toBeNull();
    await waitFor(() => expect(screen.getByRole('navigation', { name: 'Bereiche' })).toBeTruthy());
    expect(getToken()).toBe('vom-startlink');
    expect(window.sessionStorage.getItem('tonwerk:token')).toBe('vom-startlink');
    expect(window.localStorage.getItem('tonwerk:token')).toBeNull();
  });

  test('a spent launch code lands on the token screen saying why', async () => {
    render(<App anmeldung={Promise.resolve({ grund: 'Der Startlink gilt nur einmal.' })} />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Der Startlink gilt nur einmal.');
    expect(screen.getByLabelText('API-Token')).toBeTruthy();
  });

  test('the code is traded at /api/session, and any refusal becomes a reason', async () => {
    const angenommen = vi.fn(async () => antwort({ token: 'echt' }));
    expect(await redeemLaunchCode('abc', angenommen)).toEqual({ token: 'echt' });
    expect(angenommen).toHaveBeenCalledWith(
      '/api/session',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ code: 'abc' }) }),
    );

    const verbraucht = vi.fn(async () =>
      antwort({ detail: 'Launch code already used' }, { status: 401 }),
    );
    const zweites = await redeemLaunchCode('abc', verbraucht);
    expect('grund' in zweites && zweites.grund).toContain('nur einmal');

    const offline = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect('grund' in (await redeemLaunchCode('abc', offline))).toBe(true);
  });

  test('the launch code is taken out of the address, and a route is not a code', () => {
    window.location.hash = '#code=Ab-9_z';
    expect(takeLaunchCode()).toBe('Ab-9_z');
    expect(window.location.hash).toBe('');

    window.location.hash = '#/uebersicht';
    expect(takeLaunchCode()).toBeNull();
    expect(window.location.hash).toBe('#/uebersicht');
  });

  test('the desktop shell’s token is read from the page it injected it into', () => {
    expect(shellToken()).toBeNull();
    window.__TONWERK_SESSION__ = { token: ' vom-shell ' };
    try {
      expect(shellToken()).toBe('vom-shell');
    } finally {
      delete window.__TONWERK_SESSION__;
    }
  });
});

describe('routing', () => {
  test('an unknown hash says so rather than rendering the overview under a broken link', () => {
    setToken('geheim');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => antwort(registryFixture)),
    );
    window.location.hash = '#/archiv';

    render(<App />);

    expect(screen.getByText('Diese Seite gibt es nicht')).toBeTruthy();
  });

  test('every section on the rail is a link now — nothing is listed as “Folgt”', () => {
    setToken('geheim');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => antwort(registryFixture)),
    );

    render(<App />);

    // A heading over an empty "coming" list says nothing, so there is no such group.
    expect(screen.queryByText('Folgt')).toBeNull();
    for (const [name, ziel] of [
      ['Lesetexte', '#/lesetexte'],
      ['Prüfung', '#/pruefung'],
    ] as const) {
      expect(screen.getByRole('link', { name }).getAttribute('href')).toBe(ziel);
    }
  });

  test('a Freigabe is a place inside Prüfung, so the rail keeps Prüfung lit', () => {
    setToken('geheim');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => antwort({ detail: 'no scene project x' }, { status: 404 })),
    );
    window.location.hash = '#/pruefung/ls-wohnen-01';

    render(<App />);

    expect(screen.getByRole('link', { name: 'Prüfung' }).getAttribute('aria-current')).toBe('page');
  });

  test('the Klangbibliothek is a real section now, and it is reachable', () => {
    setToken('geheim');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => antwort([])),
    );

    render(<App />);

    const weg = screen.getByRole('link', { name: 'Klangbibliothek' });
    expect(weg.getAttribute('href')).toBe('#/klangbibliothek');
  });

  test('the shortcuts are printed on the rail rather than hidden in a help page', () => {
    setToken('geheim');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => antwort(registryFixture)),
    );

    render(<App />);

    // Two for the editor, two for a queue. A legend that grew with the app rather than a help page
    // that had to be found.
    for (const taste of ['⌘/Strg + S', 'Leertaste', 'J / K', 'Enter']) {
      expect(screen.getByText(taste)).toBeTruthy();
    }
  });
});
