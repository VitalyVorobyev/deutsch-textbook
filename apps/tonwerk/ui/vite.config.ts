/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Dev server, proxy and test runner in one file.
 *
 * **The proxy is not a convenience.** Tonwerk sends a bearer token, and the engine answers a
 * bearer request without an `Access-Control-Allow-Origin` header — it is a local tool that was
 * never meant to be called cross-origin. Proxying `/api` through Vite makes every request
 * same-origin, so the token travels on an ordinary `fetch` with no preflight and no CORS
 * configuration on the Python side. It also means one string names the engine (`ENGINE`), and the
 * app itself never contains a host or a port.
 *
 * **Tests run here rather than in `bun test`.** The repository's own suite is `bun test tests/`,
 * scoped to the root `tests/` directory, and this package's specs live under `src/` — so the two
 * cannot collect each other's files by accident. Vitest is what a Vite app's component tests want
 * anyway: the same resolver, the same plugin pipeline, the same CSS handling.
 */
const ENGINE = process.env.TONWERK_ENGINE ?? 'http://127.0.0.1:8765';

export default defineConfig({
  server: {
    port: 4340,
    open: process.env.BROWSER !== 'none',
    proxy: {
      // `ws: false` and no rewrite: the engine's paths are already `/api/...`, and audio is
      // served as plain HTTP responses that the fetch layer turns into blob URLs.
      '/api': { target: ENGINE, changeOrigin: false },
      '/health': { target: ENGINE, changeOrigin: false },
    },
  },
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: false,
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
  },
});
