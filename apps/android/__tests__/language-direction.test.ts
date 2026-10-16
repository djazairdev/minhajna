// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/// <reference types="node" />

// The native side derives the layout's direction from the kept language
// (InterfaceLanguage.kt). Its list of left-to-right languages must match the
// catalogues', or a language would open in the other's direction.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LANGUAGES } from '../src/text/i18n';

const source = readFileSync(
  join(__dirname, '../android/app/src/main/java/dz/minhajna/preview/language/InterfaceLanguage.kt'),
  'utf8',
);

test('derives the same direction as the catalogues for every language', () => {
  const declared = /LEFT_TO_RIGHT = setOf\(([^)]*)\)/.exec(source)?.[1];
  expect(declared).toBeDefined();
  const native = [...(declared ?? '').matchAll(/"([a-z]{2,3})"/g)].map(([, code]) => code).sort();
  const catalogues = Object.entries(LANGUAGES)
    .filter(([, { rightToLeft }]) => !rightToLeft)
    .map(([code]) => code)
    .sort();
  expect(native).toEqual(catalogues);
});
