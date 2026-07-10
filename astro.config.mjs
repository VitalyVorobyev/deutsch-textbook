// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';
import { progressWriter } from './src/integrations/progress-writer';

export default defineConfig({
  site: 'https://deutsch-atlas.local',
  integrations: [mdx(), react(), progressWriter()],
  vite: {
    plugins: [tailwindcss()],
  },
});
