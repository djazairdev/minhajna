// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The linter's settings (docs/contributing/engineering.md#code-style).
// Prettier decides the layout, so these rules look for mistakes, not style.

import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['**/dist/', '**/coverage/']),

  // ESLint's and typescript-eslint's recommended rules, with type
  // information. Among them: no unused variable or import, and no promise
  // misused or left unawaited.
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
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

  // React's rules of hooks, for the apps' components.
  {
    files: ['apps/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
  },
);
