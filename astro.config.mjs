// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';
import { progressWriter } from './src/integrations/progress-writer';

export default defineConfig({
  // SITE_URL/BASE_PATH are set by the GitHub Pages workflow; local dev and
  // plain builds keep the site at the root.
  site: process.env.SITE_URL ?? 'https://deutsch-atlas.local',
  base: process.env.BASE_PATH ?? '/',
  integrations: [mdx(), react(), progressWriter()],
  vite: {
    plugins: [tailwindcss()],
  },
});
