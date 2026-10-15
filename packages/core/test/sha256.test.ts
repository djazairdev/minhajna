// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// These fixtures are shared data, not Node-specific test code. Platform suites
// can read the same JSON to verify their UTF-8 encoders and SHA-256 functions.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';

import vectors from './sha256-vectors.json' with { type: 'json' };
import { deps } from './support.ts';

describe('shared UTF-8 SHA-256 vectors', () => {
  it('covers padding boundaries and several message blocks with unique case names', () => {
    const lengths = new Set(vectors.map(({ utf8Bytes }) => utf8Bytes));
    for (const length of [0, 55, 56, 64, 300]) assert.ok(lengths.has(length));
    assert.equal(new Set(vectors.map(({ name }) => name)).size, vectors.length);
  });

  for (const { name, text, utf8Bytes, sha256 } of vectors) {
    it(`${name}: agrees with Node crypto and Web Crypto`, async () => {
      assert.equal(Buffer.byteLength(text, 'utf8'), utf8Bytes);
      assert.equal(Buffer.from(text, 'utf8').toString('utf8'), text);
      assert.match(sha256, /^[0-9a-f]{64}$/u);
      assert.equal(createHash('sha256').update(text, 'utf8').digest('hex'), sha256);
      assert.equal(await deps.digest(text), sha256);
    });
  }
});
