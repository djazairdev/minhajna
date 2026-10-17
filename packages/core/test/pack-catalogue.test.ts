// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The packs a class can pin (#30): pack IDs, releases in order, a grade and
// subject's packs with the ones that apply best first, and a later release
// of a pinned edition, which never moves the class by itself. Made-up packs.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  compareReleases,
  newerRelease,
  packsFor,
  parsePackId,
  pinOf,
  type PackStatus,
  type PlanPack,
} from '../src/index.ts';
import { mathPack } from './fixtures.ts';

const pack = (id: string, release: string, status: PackStatus): PlanPack => ({ ...mathPack, id, release, status });

describe('the pack catalogue', () => {
  it('reads a pack ID, with or without a stream', () => {
    assert.deepEqual(parsePackId('dz.cem.3am.math.igen-2022'), {
      country: 'dz',
      level: 'cem',
      grade: '3am',
      subject: 'math',
      edition: 'igen-2022',
    });
    assert.equal(parsePackId('dz.lycee.2as.math.se.2022')?.stream, 'se');
    assert.equal(parsePackId('dz.cem.math'), null);
  });

  it('orders releases by year, then by fix', () => {
    assert.deepEqual(['2027.1', '2026.10', '2026.2', '2026.1'].sort(compareReleases), [
      '2026.1',
      '2026.2',
      '2026.10',
      '2027.1',
    ]);
  });

  it("offers each edition's latest release for the grade and subject, what applies best first and a stale plan last", () => {
    const packs = [
      pack('dz.cem.1am.math.igen-2017', '2026.1', 'stale'),
      pack('dz.cem.1am.math.example', '2026.1', 'example'),
      pack('dz.cem.1am.math.igen-2022', '2026.1', 'latest-found'),
      pack('dz.cem.1am.math.igen-2022', '2026.2', 'latest-found'),
      pack('dz.cem.1am.math.district-16', '2026.1', 'community'),
      pack('dz.cem.2am.math.igen-2022', '2026.1', 'latest-found'),
      pack('dz.cem.1am.arabic.igen-2022', '2026.1', 'latest-found'),
    ];
    assert.deepEqual(
      packsFor(packs, '1am', 'math').map((found) => `${found.id} ${found.release}`),
      [
        'dz.cem.1am.math.igen-2022 2026.2',
        'dz.cem.1am.math.district-16 2026.1',
        'dz.cem.1am.math.example 2026.1',
        'dz.cem.1am.math.igen-2017 2026.1',
      ],
    );
    assert.deepEqual(packsFor(packs, '4am', 'math'), []);
  });

  it('finds a later release of a pinned edition, and none once the class is on the latest', () => {
    const first = pack('dz.cem.1am.math.igen-2022', '2026.1', 'latest-found');
    const fix = pack('dz.cem.1am.math.igen-2022', '2026.2', 'latest-found');
    const other = pack('dz.cem.1am.math.example', '2027.1', 'example');
    assert.deepEqual(pinOf(first), { id: 'dz.cem.1am.math.igen-2022', release: '2026.1' });
    assert.equal(newerRelease([first, fix, other], pinOf(first)), fix);
    assert.equal(newerRelease([first, fix, other], pinOf(fix)), null);
  });
});
