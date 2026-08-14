// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      'dist/',
      '**/.astro/',
      'node_modules/',
      'src-tauri/', // Rust shell + Tauri-generated artifacts
      'progress/',
      'docs/',
      '.claude/', // local settings + agent worktrees (each carries a full repo copy)
      '.agents/',
      'tools/listening-studio/.venv/',
      'tools/listening-studio/.mypy_cache/',
      'tools/listening-studio/.ruff_cache/',
      'tools/listening-studio/**/__pycache__/',
      'ds-bundle/', // generated claude.ai/design bundle (compiled React + previews)
      '.ds-sync/', // staged design-sync converter scripts + their node_modules
      // Flat-config `dist/` anchors at the repo root, so a nested build output —
      // the Listening Studio frontend's — was being linted as source. It is
      // gitignored, so this only ever bit a local run.
      '**/dist/',
    ],
  },

  js.configs.recommended,
  tseslint.configs.recommended,
  astro.configs['flat/recommended'],

  // React islands (React 19 automatic JSX runtime — no react-in-jsx-scope).
  {
    files: ['**/*.tsx'],
    extends: [react.configs.flat.recommended, react.configs.flat['jsx-runtime']],
    settings: { react: { version: 'detect' } },
    rules: {
      // TypeScript props interfaces make runtime prop-types redundant.
      'react/prop-types': 'off',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
  },

  // Browser code: React islands, client libs, and <script> blocks in .astro files.
  {
    files: ['src/**'],
    languageOptions: { globals: globals.browser },
  },
  // Node/Bun context: dev scripts, the Astro dev-middleware integration, config files.
  {
    files: ['scripts/**', 'src/integrations/**', '*.{js,mjs,ts}', '.design-sync/*.mjs'],
    languageOptions: { globals: globals.node },
  },
  // The service-worker source is a template, not a module: it is never imported, and
  // `src/integrations/pwa.ts` copies it into dist/ with its placeholders filled. It runs in
  // the ServiceWorkerGlobalScope, so it needs those globals rather than Node's — and the
  // override must come after the integrations block above, which would otherwise win.
  {
    files: ['src/integrations/service-worker.js'],
    languageOptions: { globals: { ...globals.serviceworker, console: 'readonly' } },
  },

  {
    rules: {
      // Intentionally unused values are named with a leading underscore.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // The IPA validator (packages/schema/src/index.ts) deliberately lists combining marks as
      // standalone character-class members; written as \u escapes they aren't misleading.
      'no-misleading-character-class': ['error', { allowEscape: true }],
    },
  },
);
