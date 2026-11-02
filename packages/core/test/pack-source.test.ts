// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// An empty local plan needs real source metadata, not a placeholder item.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parsePackSource, parsePlanPack } from '../src/index.ts';

const source = {
  id: 'dz.cem.3am.math.synthetic',
  release: '2026.1',
  status: 'community',
  licence: 'structure-only',
  language: 'ar',
  anchor: { kind: 'weeks' },
  provenance: {
    issuer: 'Synthetic issuer',
    edition: 'Synthetic edition',
    foundAt: 'https://example.invalid/synthetic-source',
    localPath: '/not-kept',
  },
  fileName: 'not-kept.pdf',
};

test('source metadata drops paths and unknown fields, and does not make an empty pack publishable', () => {
  const read = parsePackSource(source);
  assert.ok(read.ok);
  assert.equal(JSON.stringify(read.value).includes('not-kept'), false);
  assert.equal(parsePlanPack({ format: 1, ...read.value, items: [] }).ok, false);
  assert.equal(
    parsePlanPack({
      format: 1,
      ...read.value,
      items: [{ id: 'a', kind: 'lesson', title: 'Synthetic lesson', week: 1 }],
    }).ok,
    true,
  );
});

test('both the source form and pack reader refuse malformed metadata', () => {
  for (const change of [
    { id: 'bad' },
    { release: 'tomorrow' },
    { language: '' },
    { status: 'own' },
    { provenance: { issuer: 'Synthetic\u202eissuer', edition: 'Synthetic' } },
    { anchor: { kind: 'calendar' } },
  ]) {
    assert.equal(parsePackSource({ ...source, ...change }).ok, false);
    assert.equal(
      parsePlanPack({
        format: 1,
        ...source,
        ...change,
        items: [{ id: 'a', kind: 'lesson', title: 'Synthetic', week: 1 }],
      }).ok,
      false,
    );
  }
});
