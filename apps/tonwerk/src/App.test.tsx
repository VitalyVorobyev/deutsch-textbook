import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from './App';
import { clearToken, getToken, setToken } from './auth';
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

describe('routing', () => {
  test('an unknown hash says so rather than rendering the overview under a broken link', () => {
    setToken('geheim');
    vi.stubGlobal('fetch', vi.fn(async () => antwort(registryFixture)));
    window.location.hash = '#/archiv';

    render(<App />);

    expect(screen.getByText('Diese Seite gibt es nicht')).toBeTruthy();
  });

  test('every section on the rail is a link now — nothing is listed as “Folgt”', () => {
    setToken('geheim');
    vi.stubGlobal('fetch', vi.fn(async () => antwort(registryFixture)));

    render(<App />);

    // The two that used to be disabled placeholders arrived in PR 9b. A heading over an empty
    // "coming" list says nothing, so the group went with them rather than staying as a label.
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
    vi.stubGlobal('fetch', vi.fn(async () => antwort({ detail: 'no scene project x' }, { status: 404 })));
    window.location.hash = '#/pruefung/ls-wohnen-01';

    render(<App />);

    expect(screen.getByRole('link', { name: 'Prüfung' }).getAttribute('aria-current')).toBe('page');
  });

  test('the Klangbibliothek is a real section now, and it is reachable', () => {
    setToken('geheim');
    vi.stubGlobal('fetch', vi.fn(async () => antwort([])));

    render(<App />);

    const weg = screen.getByRole('link', { name: 'Klangbibliothek' });
    expect(weg.getAttribute('href')).toBe('#/klangbibliothek');
  });

  test('the shortcuts are printed on the rail rather than hidden in a help page', () => {
    setToken('geheim');
    vi.stubGlobal('fetch', vi.fn(async () => antwort(registryFixture)));

    render(<App />);

    // Two for the editor, two for a queue. A legend that grew with the app rather than a help page
    // that had to be found.
    for (const taste of ['⌘/Strg + S', 'Leertaste', 'J / K', 'Enter']) {
      expect(screen.getByText(taste)).toBeTruthy();
    }
  });
});
