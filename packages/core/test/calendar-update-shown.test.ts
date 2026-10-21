// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  appliedUpdates,
  CALENDAR_UPDATE_FORMAT,
  entryUpdate,
  makeContext,
  parseCalendarUpdate,
  recordsForRoute,
  type CalendarUpdate,
  type RecordEvent,
} from '../src/index.ts';
import { cemEvents, d, openBook, reference } from './fixtures.ts';

const ref = { ...reference, calendarRelease: '2026.3' };
const holiday = (id: string, day: string) => ({
  id,
  layer: 'national',
  from: day,
  to: day,
  effect: 'no-school',
  name: { en: 'Example holiday' },
  source: 'Example notice, not an official announcement',
  confidence: 'announced',
});
const update = (release: string, fields: object): CalendarUpdate => {
  const read = parseCalendarUpdate(
    {
      format: CALENDAR_UPDATE_FORMAT,
      version: { major: 1, minor: 0 },
      country: 'dz',
      year: '2026-2027',
      release,
      published: '2026-10-13',
      entries: [],
      removed: [],
      ...fields,
    },
    ref.country,
    ref.year,
  );
  if (!read.ok) throw new Error(JSON.stringify(read.problems));
  return read.value;
};
const applied = (one: CalendarUpdate): RecordEvent => ({
  kind: 'calendar.updated',
  applied: { update: one, key: 'example-ministry', file: '{}' },
});

test('keeps the day each release was first applied, which no route carries', async () => {
  const book = await openBook(cemEvents());
  const first = update('2026.5', { entries: [holiday('example-a', '2026-11-26')] });
  await book.record(d('2026-10-14'), applied(first));
  await book.record(d('2026-10-16'), applied(update('2026.4', { entries: [holiday('example-b', '2026-11-25')] })));
  await book.record(d('2026-10-20'), applied(first));
  assert.deepEqual(
    [...book.state.calendarUpdatedOn],
    [
      ['2026.5', d('2026-10-14')],
      ['2026.4', d('2026-10-16')],
    ],
  );
  const sent = recordsForRoute(book.state, 'handover').filter((one) => one.kind === 'calendar.updated');
  assert.equal(sent.length, 2);
  for (const one of sent) {
    assert.deepEqual(Object.keys(one).sort(), ['applied', 'kind']);
    if (one.kind === 'calendar.updated') assert.deepEqual(Object.keys(one.applied).sort(), ['file', 'key', 'update']);
  }
});

test('names the update an entry comes from, the latest release that sets it', async () => {
  const book = await openBook(cemEvents());
  await book.recordAll(d('2026-10-14'), [
    applied(update('2026.5', { entries: [{ ...holiday('example-a', '2026-11-26'), source: 'Later' }] })),
    applied(update('2026.4', { entries: [holiday('example-a', '2026-11-25'), holiday('example-b', '2026-11-24')] })),
    applied(update('2026.2', { entries: [holiday('autumn', '2026-11-02')] })),
  ]);
  const context = makeContext(ref, book.state);
  assert.deepEqual(
    appliedUpdates(context).map((one) => one.update.release),
    ['2026.4', '2026.5'],
  );
  assert.equal(entryUpdate(context, 'example-a')?.update.release, '2026.5');
  assert.equal(entryUpdate(context, 'example-b')?.update.release, '2026.4');
  assert.equal(entryUpdate(context, 'autumn'), undefined);
  assert.equal(entryUpdate(context, 'winter'), undefined);
});
