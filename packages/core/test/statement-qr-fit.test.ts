// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Whether a statement will fit one QR code, known before signing (#439,
// answer 486): a statement said to fit always fits once signed, whatever the
// signature's length, and the bound is never more than four characters short
// of the code's limit. Made-up statements only.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fitsInQr, progressStatement, signStatement, statementFitsInQr, utf8Length } from '../src/index.ts';
import { cemEvents, contextOf, d, openBook } from './fixtures.ts';
import { makeTestKey } from './signed-fixtures.ts';

const key = makeTestKey('example-teacher');

test('a statement said to fit one code fits once signed, around the limit', async () => {
  const statement = progressStatement(contextOf(await openBook(cemEvents())), 'c-math', d('2026-10-01'))!;
  let said = 0;
  for (let length = 1; length <= 360; length += 1) {
    const long = { ...statement, lastResource: { id: 'l1', title: '\u0645'.repeat(length), status: 'done' as const } };
    for (let round = 0; round < 3; round += 1) {
      const signed = await signStatement(long, key.trusted.spki, (text) => Promise.resolve(key.sign(text)));
      if (statementFitsInQr(long)) assert.ok(fitsInQr(signed), `title of ${length}`);
      else assert.ok(utf8Length(signed)! > 996 - 4, `title of ${length}`);
    }
    if (statementFitsInQr(long)) said = length;
  }
  assert.ok(said > 0 && said < 360);
});
