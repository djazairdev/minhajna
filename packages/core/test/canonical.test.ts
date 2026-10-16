// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { canonicalJson } from '../src/index.ts';

describe('canonical JSON', () => {
  it('gives the same text whatever the order of fields', () => {
    assert.equal(canonicalJson({ b: 1, a: [true, null, 'x'] }), canonicalJson({ a: [true, null, 'x'], b: 1 }));
    assert.equal(canonicalJson({ a: 1, skipped: undefined }), '{"a":1}');
  });

  it('refuses values that JSON cannot carry exactly', () => {
    assert.throws(() => canonicalJson(Number.NaN), TypeError);
    assert.throws(() => canonicalJson([undefined]), TypeError);
    assert.throws(() => canonicalJson(new Date(0)), TypeError);
    assert.throws(() => canonicalJson(() => 1), TypeError);
  });
});
