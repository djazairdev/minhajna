// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The linter's settings (docs/contributing/engineering.md#code-style).
// Prettier decides the layout, so these rules look for mistakes, not style.

import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';
import noCommentsInFunctions from './tools/eslint/no-comments-in-functions.js';

export default defineConfig(
  // The server's Prisma client is generated at build time, and not ours to lint.
  globalIgnores(['**/dist/', '**/coverage/', 'apps/server/src/generated/']),

  // ESLint's and typescript-eslint's recommended rules, with type
  // information. Among them: no unused variable or import, and no promise
  // misused or left unawaited.
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    plugins: { minhajna: { rules: { 'no-comments-in-functions': noCommentsInFunctions } } },
    linterOptions: {
      // A comment that turns a rule off must still be needed.
      reportUnusedDisableDirectives: 'error',
      reportUnusedInlineConfigs: 'error',
    },
    languageOptions: {
      parserOptions: {
        // Each file is checked with the types of its nearest tsconfig.json.
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // A write left unawaited can lose a teacher's work without a word: it
      // may not finish, and its error is never seen. Only node:test's own
      // functions may be left unawaited, since node:test awaits them itself.
      '@typescript-eslint/no-floating-promises': [
        'error',
        { allowForKnownSafeCalls: [{ from: 'package', name: ['describe', 'it', 'test'], package: 'node:test' }] },
      ],
      // A promise returned unawaited from inside try escapes its catch and
      // finally.
      '@typescript-eslint/return-await': ['error', 'error-handling-correctness-only'],
      // A file a newcomer can read in one sitting. Every line counts, blank
      // lines and comments included; a longer file is split by what it does
      // (docs/contributing/engineering.md#code-style).
      'max-lines': ['error', { max: 300, skipBlankLines: false, skipComments: false }],
      // Comments sit at the head of a file, a function or a declaration,
      // and say what and why, never how (docs/contributing/engineering.md#comments).
      'minhajna/no-comments-in-functions': 'error',
      'no-inline-comments': 'error',
      'line-comment-position': ['error', { position: 'above' }],
      'no-warning-comments': ['error', { terms: ['todo', 'fixme', 'xxx', 'hack'], location: 'start' }],
    },
  },

  // The settings files are plain JavaScript, outside any tsconfig.json.
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },

  // The apps' tool settings, such as Metro's and Jest's, are CommonJS
  // modules that Node.js loads.
  {
    files: ['apps/*/*.config.js'],
    languageOptions: { sourceType: 'commonjs', globals: { __dirname: 'readonly' } },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },

  // The infrastructure's scripts, such as Weblate's set-up, run in Node.js.
  {
    files: ['infra/**/*.js'],
    languageOptions: {
      globals: { console: 'readonly', fetch: 'readonly', process: 'readonly', setTimeout: 'readonly', URL: 'readonly' },
    },
  },

  // React's rules of hooks, for the apps' components.
  {
    files: ['apps/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
  },
);
