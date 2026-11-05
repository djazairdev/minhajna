// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A plan-error report on the national space (#616, answer 770), with made-up
// words: it reads only as a report, is sealed at the one size with nothing in
// clear, and a batch that doesn't open costs only itself.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  openPackReports,
  packReportPlace,
  readPackReport,
  reportText,
  sealPackReport,
  type PackReport,
} from '../src/index.ts';
import { d } from './fixtures.ts';
import { cipher, mac } from './world-crypto.ts';

const report: PackReport = {
  id: 'dz.cem.3am.math.example',
  release: '2026.2',
  item: 'lesson',
  kind: 'page',
  note: 'Made-up note: the page is 26.',
  name: null,
  day: d('2026-10-01'),
};

describe('a plan-error report', () => {
  it('reads with a name only by choice, and never with more than it should hold', () => {
    assert.deepEqual(readPackReport(report), report);
    assert.deepEqual(readPackReport({ ...report, name: 'Made-up' }), { ...report, name: 'Made-up' });
    assert.equal(readPackReport({ ...report, name: ' ' }), null);
    assert.equal(readPackReport({ ...report, note: ' ' }), null);
    assert.equal(readPackReport({ ...report, note: 'x'.repeat(1001) }), null);
    assert.equal(readPackReport({ ...report, kind: 'official' }), null);
    assert.equal(readPackReport({ ...report, school: 'Made-up school' }), null);
    assert.equal(readPackReport({ ...report, id: 'not a pack' }), null);
    assert.equal(readPackReport({ ...report, note: `x${String.fromCodePoint(0x202e)}` }), null);
  });

  it('takes out of what is typed what a report may not hold', () => {
    assert.equal(reportText(` A${String.fromCodePoint(0x200f)}B `), 'AB');
  });

  it('travels at the one size, with nothing in clear, even at its longest', async () => {
    const place = await packReportPlace(new Uint8Array(32).fill(7), mac);
    const longest = { ...report, note: 'م'.repeat(1000), name: 'ن'.repeat(80) };
    const batches = await sealPackReport(place, longest, 0, cipher);
    assert.equal(
      batches.every((batch) => batch.bytes.length === 4124),
      true,
    );
    assert.equal(Buffer.concat(batches.map((one) => Buffer.from(one.bytes))).includes(Buffer.from(report.id)), false);
    assert.deepEqual(await openPackReports(place, batches, cipher), [longest]);
  });

  it('keeps those that read when one batch is damaged or another place sealed it', async () => {
    const place = await packReportPlace(new Uint8Array(32).fill(7), mac);
    const other = await packReportPlace(new Uint8Array(32).fill(8), mac);
    const first = await sealPackReport(place, report, 0, cipher);
    const stray = await sealPackReport(other, report, first.length, cipher);
    const last = await sealPackReport(place, { ...report, kind: 'title' }, first.length + stray.length, cipher);
    const read = await openPackReports(place, [...first, ...stray, ...last], cipher);
    assert.deepEqual(
      read.map((one) => one.kind),
      ['page', 'title'],
    );
    await assert.rejects(sealPackReport(place, { ...report, note: '' }, 0, cipher), RangeError);
  });
});
