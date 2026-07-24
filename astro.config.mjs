// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';
import { progressWriter } from './src/integrations/progress-writer';

// Astro prefixes redirect *sources* with the base but emits destinations
// literally, so subpath deployments (GitHub Pages) need the prefix here.
const base = process.env.BASE_PATH ?? '/';
/** @param {string} path */
const withBase = (path) => (base === '/' ? path : base.replace(/\/$/, '') + path);

export default defineConfig({
  // SITE_URL/BASE_PATH are set by the GitHub Pages workflow; local dev and
  // plain builds keep the site at the root.
  site: process.env.SITE_URL ?? 'https://deutsch-atlas.local',
  base,
  // Static meta-refresh redirect pages — work on GitHub Pages and in the
  // Tauri shell. /vocab/<id> deck detail pages stay at their old URLs.
  redirects: {
    '/ueben': withBase('/ueben/wiederholen'),
    '/review': withBase('/ueben/wiederholen'),
    '/training': withBase('/ueben/training'),
    '/vocab': withBase('/ueben/wortschatz'),
  },
  // Astro 7 changed the default to 'jsx', which strips the indentation after a
  // line-ending expression instead of collapsing it to a space — that silently
  // welded "{grammarA1.late}\n из них" into "5из них" on /about. Prose is the
  // product here, so keep the HTML-aware compression the articles were written
  // against rather than chasing every wrap point with {' '}.
  compressHTML: true,
  integrations: [mdx(), react(), progressWriter()],
  vite: {
    plugins: [tailwindcss()],
  },
});
