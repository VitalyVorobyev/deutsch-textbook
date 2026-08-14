import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { corpus } from './plugin/corpus';

export default defineConfig({
  // Browser audits run beside long-lived local Vite sessions. An isolated cache keeps two
  // dependency optimizers from waiting on or replacing the same `deps_temp_*` directory.
  cacheDir: process.env.REDAKTION_VITE_CACHE_DIR || 'node_modules/.vite',
  // The knowledge base is at the repo root, two levels up; `corpus()` reads it directly and
  // `server.fs.allow` lets Vite serve the workspace packages' raw TypeScript.
  server: { port: 4330, open: process.env.BROWSER !== 'none', fs: { allow: ['../..'] } },
  plugins: [react(), tailwindcss(), corpus()],
});
