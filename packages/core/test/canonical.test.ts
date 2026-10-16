// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Synthetic text only. The legacy stringifier reproduces pre-ES2019 raw lone
// surrogates without altering literal backslash escapes or valid UTF-16 pairs.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';

import { canonicalJson, HistoryLog, MemoryStore, parseDay, type HistoryDeps } from '../src/index.ts';
import { deps as webCryptoDeps } from './support.ts';

const stringify = JSON.stringify;

function legacyStringify(value: unknown): string | undefined {
  if (typeof value !== 'string') return stringify(value);
  const quoted = Array.from(value, (character) => {
    const code = character.charCodeAt(0);
    if (character.length === 1 && code >= 0xd800 && code <= 0xdfff) return character;
    return stringify(character).slice(1, -1);
  }).join('');
  return `"${quoted}"`;
}

function deterministicDeps(): HistoryDeps {
  let seed = 0;
  return {
    digest: (text) => Promise.resolve(createHash('sha256').update(text, 'utf8').digest('hex')),
    random: (length) => new Uint8Array(length).fill(++seed),
  };
}

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

describe('canonical string encoding', () => {
  it('matches well-formed JSON.stringify for every single UTF-16 code unit', () => {
    for (let code = 0; code <= 0xffff; code++) {
      const value = String.fromCharCode(code);
      assert.equal(canonicalJson(value), stringify(value), code.toString(16));
    }
  });

  it('keeps valid surrogate pairs, ordinary escapes and literal Unicode escapes unchanged', () => {
    for (const value of [
      'منهاجنا',
      'école',
      '\ud800\udc00',
      '\udbff\udfff',
      'Séance 😀',
      '\\ud800',
      '\\udfff',
      '\u0000\b\t\n\f\r"\\',
      '\u2028\u2029',
    ]) {
      assert.equal(canonicalJson(value), stringify(value));
      assert.equal(canonicalJson({ [value]: value }), `{${stringify(value)}:${stringify(value)}}`);
    }
  });

  it('escapes every lone high and low surrogate even with a legacy stringifier', (context) => {
    context.mock.method(JSON, 'stringify', legacyStringify);
    for (let code = 0xd800; code <= 0xdfff; code++) {
      const value = String.fromCharCode(code);
      const quoted = `"\\u${code.toString(16)}"`;
      assert.equal(canonicalJson(value), quoted);
      assert.equal(canonicalJson({ [value]: value }), `{${quoted}:${quoted}}`);
    }
  });

  it('handles adjacent lone surrogates, nested keys and values without changing pairs', (context) => {
    context.mock.method(JSON, 'stringify', legacyStringify);
    for (const value of [
      '\ud800x',
      'x\udc00',
      '\ud800\ud800',
      '\udc00\udc00',
      '\udc00\ud800',
      '\ud800😀\udfff',
      '\ud800\ud800\udc00\udc00',
      '\\ud800',
      '\u0000\b\t\n\f\r"\\',
    ]) {
      const quoted = stringify(value);
      const nested = { [value]: [value, { [value]: value }] };
      assert.equal(canonicalJson(nested), `{${quoted}:[${quoted},{${quoted}:${quoted}}]}`);
      assert.deepEqual(JSON.parse(canonicalJson(nested)), nested);
    }
  });

  it('keeps distinct lone surrogates distinct from replacement characters and literal escapes', (context) => {
    context.mock.method(JSON, 'stringify', legacyStringify);
    const outputs = ['\ud800', '\ud801', '\udfff', '\ufffd', '?', '\\ud800'].map(canonicalJson);
    assert.equal(new Set(outputs).size, outputs.length);
  });
});

describe('history encoding compatibility', () => {
  it('preserves the pre-change hashes and reopens a legacy-engine history with Web Crypto', async (context) => {
    context.mock.method(JSON, 'stringify', legacyStringify);
    const store = new MemoryStore();
    const log = await HistoryLog.open(store, deterministicDeps());
    const day = parseDay('2026-10-15');
    await log.append(day, 'lesson-record', 'encoding.checked', { text: 'العربية — français 😀' });
    await log.append(day, 'lesson-record', 'encoding.\ud800', { '\udfff': '\ud800' });
    assert.deepEqual(
      log.entries.map(({ digest, hash }) => ({ digest, hash })),
      [
        {
          digest: 'a13f6d10cc14819d9cf5859f6db18a455186251c3cc380390e8323732744988f',
          hash: '0a644318fb9b21fb1459dac5b6aa36920e9d2b9e5b0fa329a164d8838d53cbe0',
        },
        {
          digest: 'e2b2bd2dcbced4e23453d0b743997d213f614d23cca343c30f57a0d92b2365e0',
          hash: '7da0030b6741b5f8bc2a85391fb6ec74b50a46d0f4b2fcdb906ca2f76fadc6b9',
        },
      ],
    );
    context.mock.restoreAll();
    const reopened = await HistoryLog.open(store, webCryptoDeps);
    assert.deepEqual(reopened.entries, log.entries);
  });
});
