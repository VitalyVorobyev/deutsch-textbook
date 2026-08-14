import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { corpus } from './plugin/corpus';

export default defineConfig({
  // The knowledge base is at the repo root, two levels up; `corpus()` reads it directly and
  // `server.fs.allow` lets Vite serve the workspace packages' raw TypeScript.
  server: { port: 4330, open: true, fs: { allow: ['../..'] } },
  plugins: [react(), tailwindcss(), corpus()],
});
