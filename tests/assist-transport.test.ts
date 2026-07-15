/**
 * The P7-3 transport seam (docs/assist-design.md): under Tauri, assist requests
 * route through tauri-plugin-http's fetch — the webview's origin rules cannot
 * reach http://localhost:11434 — and everywhere else through the global fetch,
 * resolved at call time so the other assist tests can keep swapping it.
 */
import { afterEach, beforeEach, expect, mock, test } from 'bun:test';
import { probeAssist, resetAssistForTests } from '../src/lib/assist';

const realFetch = globalThis.fetch;

const pluginFetch = mock(async () =>
  new Response(JSON.stringify({ models: [{ name: 'gemma4:e4b' }] }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  }));

// The mock module is only ever reached while __TAURI_INTERNALS__ exists, so
// removing the key in afterEach contains it to this file.
mock.module('@tauri-apps/plugin-http', () => ({ fetch: pluginFetch }));

beforeEach(() => {
  resetAssistForTests();
  pluginFetch.mockClear();
});

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  globalThis.fetch = realFetch;
  resetAssistForTests();
});

test('under Tauri the probe uses the plugin fetch and never touches the global fetch', async () => {
  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
  const globalFetch = mock(async () => {
    throw new Error('the webview fetch must not be used under Tauri');
  });
  globalThis.fetch = globalFetch as unknown as typeof fetch;

  const probe = await probeAssist();

  expect(probe).toEqual({ reachable: true, models: ['gemma4:e4b'] });
  expect(pluginFetch).toHaveBeenCalledTimes(1);
  expect(String(pluginFetch.mock.calls[0]![0])).toBe('http://localhost:11434/api/tags');
  expect(globalFetch).not.toHaveBeenCalled();
});

test('outside Tauri the probe keeps using the global fetch', async () => {
  const globalFetch = mock(async () =>
    new Response(JSON.stringify({ models: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
  globalThis.fetch = globalFetch as unknown as typeof fetch;

  const probe = await probeAssist();

  expect(probe).toEqual({ reachable: true, models: [] });
  expect(globalFetch).toHaveBeenCalledTimes(1);
  expect(pluginFetch).not.toHaveBeenCalled();
});
