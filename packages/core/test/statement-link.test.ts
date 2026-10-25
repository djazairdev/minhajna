// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A statement PDF's link (#438, answer 485): the signed text goes into the
// link as UTF-8 base64 and comes back byte for byte, Arabic and emoji
// included, at every padding; anything else, another scheme, malformed
// base64, bytes that are not UTF-8, or a size no statement file has, gives
// nothing. Made-up text only.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { linkedStatement, STATEMENT_BYTES, STATEMENT_LINK, statementLink } from '../src/index.ts';

test('a signed text goes into a link and comes back unchanged', () => {
  for (const text of ['{', '{"', '{"a', '{"t":"\u0628\u064a\u0627\u0646 4\u06451"}', 'x\u{1f600}y']) {
    const link = statementLink(text);
    assert.ok(link.startsWith(STATEMENT_LINK));
    assert.match(link.slice(STATEMENT_LINK.length), /^[A-Za-z0-9+/]+={0,2}$/);
    assert.equal(linkedStatement(link), text);
  }
  assert.equal(statementLink('{"a'), `${STATEMENT_LINK}eyJh`);
  assert.equal(statementLink('\u0628'), `${STATEMENT_LINK}2Kg=`);
});

test('a link to a statement of the largest size still opens', () => {
  const text = 'a'.repeat(STATEMENT_BYTES);
  assert.equal(linkedStatement(statementLink(text)), text);
});

test('text no statement file could be has no link', () => {
  for (const text of ['', '\ud800', 'a'.repeat(STATEMENT_BYTES + 1), '\u0628'.repeat(STATEMENT_BYTES / 2 + 1)])
    assert.throws(() => statementLink(text), TypeError);
});

test('anything that is not a well-formed link gives nothing', () => {
  for (const uri of [
    '',
    'https://example.org/eyJh',
    STATEMENT_LINK,
    `${STATEMENT_LINK}eyJ`,
    `${STATEMENT_LINK}ey=h`,
    `${STATEMENT_LINK}eyJh!`,
    `${STATEMENT_LINK}/w==`,
    `${STATEMENT_LINK}7aCA`,
    `${STATEMENT_LINK}${'A'.repeat(Math.ceil(STATEMENT_BYTES / 3) * 4 + 4)}`,
  ])
    assert.equal(linkedStatement(uri), null, uri);
  assert.equal(linkedStatement(42 as unknown as string), null);
});
