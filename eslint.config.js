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
      '.astro/',
      'node_modules/',
      'src-tauri/', // Rust shell + Tauri-generated artifacts
      'progress/',
      'docs/',
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
    files: ['scripts/**', 'src/integrations/**', '*.{js,mjs,ts}'],
    languageOptions: { globals: globals.node },
  },

  {
    rules: {
      // Intentionally unused values are named with a leading underscore.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // The IPA validator (src/lib/schemas.ts) deliberately lists combining marks as
      // standalone character-class members; written as \u escapes they aren't misleading.
      'no-misleading-character-class': ['error', { allowEscape: true }],
    },
  },
);
