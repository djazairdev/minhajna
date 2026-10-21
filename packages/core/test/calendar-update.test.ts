// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  appliedUpdateHolds,
  applyCalendarUpdate,
  CALENDAR_UPDATE_FORMAT,
  laterUpdates,
  makeContext,
  openSigned,
  parseCalendarUpdate,
  recordsForRoute,
  updateChanges,
  updatedCalendar,
  updateStatus,
  type AppliedUpdate,
  type CalendarUpdate,
} from '../src/index.ts';
import { cemEvents, d, openBook, reference } from './fixtures.ts';
import { makeTestKey, nodeVerifier, signedFile } from './signed-fixtures.ts';

const ref = { ...reference, calendarRelease: '2026.3' };
const source = 'Example notice, not an official announcement';

/** A made-up update: the term 1 exams moved a week later and an expected holiday added, the spring holidays out. */
const payload = (release = '2026.4', changes: Record<string, unknown> = {}) => ({
  format: CALENDAR_UPDATE_FORMAT,
  version: { major: 1, minor: 0 },
  country: 'dz',
  year: '2026-2027',
  release,
  published: '2026-11-02',
  entries: [
    {
      id: 'exams-1',
      layer: 'national',
      from: '2026-12-13',
      to: '2026-12-17',
      effect: 'exam',
      levels: ['cem'],
      term: 1,
      name: { en: 'Term 1 exams' },
      source,
      confidence: 'announced',
      moved: { from: '2026-12-06', to: '2026-12-10', reason: 'Example reason' },
    },
    {
      id: 'example-holiday',
      layer: 'national',
      from: '2027-03-01',
      to: '2027-03-01',
      effect: 'no-school',
      name: { en: 'Example holiday' },
      source,
      confidence: 'expected',
      lunar: true,
    },
  ],
  removed: ['spring'],
  ...changes,
});

const read = (value: unknown = payload()): CalendarUpdate => {
  const result = parseCalendarUpdate(value, ref.country, ref.year);
  if (!result.ok) throw new Error(JSON.stringify(result.problems));
  return result.value;
};
const problems = (value: unknown) => {
  const result = parseCalendarUpdate(value, ref.country, ref.year);
  return result.ok ? [] : result.problems.map((one) => `${one.path} ${one.problem}`);
};
const applied = (update: CalendarUpdate): AppliedUpdate => ({ update, key: 'example-ministry', file: '{}' });

test('reads an update, with the dates an entry had before it moved', () => {
  const update = read();
  assert.equal(update.release, '2026.4');
  assert.equal(update.published, d('2026-11-02'));
  assert.deepEqual(update.removed, ['spring']);
  assert.deepEqual(update.entries[0]?.moved, { from: d('2026-12-06'), to: d('2026-12-10'), reason: 'Example reason' });
  assert.equal(update.entries[1]?.lunar, true);
});

test('refuses an update for another country or year, or one that changes nothing', () => {
  assert.deepEqual(problems(payload('2026.4', { country: 'tn' })), ['country unknown-reference']);
  assert.deepEqual(problems(payload('2026.4', { year: '2027-2028' })), ['year unknown-reference']);
  assert.deepEqual(problems(payload('2026.4', { entries: [], removed: [] })), ['entries required']);
  assert.deepEqual(problems(payload('2026.4', { version: { major: 2, minor: 0 } })), ['version invalid']);
  assert.deepEqual(problems(payload('2026.4', { format: 'minhajna.calendar-entry' })), [' invalid']);
  assert.deepEqual(problems(payload('soon')), ['release invalid']);
  assert.deepEqual(problems(payload('2026.4', { published: undefined })), ['published required']);
});

test('refuses school entries, entries outside the year, repeated IDs and bad removals', () => {
  const [exams, holiday] = payload().entries;
  const school = { ...holiday, id: 'example-school', layer: 'school', schoolId: 's-cem' };
  assert.ok(problems(payload('2026.4', { entries: [school] })).includes('entries[0].layer invalid'));
  const late = { ...holiday, from: '2027-07-01', to: '2027-07-01' };
  assert.deepEqual(problems(payload('2026.4', { entries: [late] })), ['entries[0].from invalid']);
  assert.deepEqual(problems(payload('2026.4', { entries: [exams, exams] })), ['entries[1].id duplicate']);
  assert.deepEqual(problems(payload('2026.4', { removed: ['exams-1'] })), ['removed.0 invalid']);
  assert.deepEqual(problems(payload('2026.4', { removed: [1, 'Not An ID'] })), [
    'removed.0 invalid',
    'removed.1 invalid',
  ]);
  assert.deepEqual(problems(payload('2026.4', { removed: 'spring' })), ['removed invalid']);
  const moved = { ...exams, moved: { from: '2026-12-06', to: '2026-12-10', reason: '' } };
  assert.ok(problems(payload('2026.4', { entries: [moved] })).length > 0);
});

test('lays updates over the built-in calendar in the order of their releases', () => {
  const first = read();
  const second = read(
    payload('2026.10', { entries: [{ ...payload().entries[1], confidence: 'announced', lunar: undefined }] }),
  );
  const old = read(payload('2026.3', { removed: ['autumn'] }));
  const list = [applied(second), applied(old), applied(first)];
  assert.deepEqual(
    laterUpdates('2026.3', list).map((one) => one.update.release),
    ['2026.4', '2026.10'],
  );
  const entries = updatedCalendar(ref.calendar, '2026.3', list);
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  assert.equal(byId.has('spring'), false);
  assert.equal(byId.has('autumn'), true);
  assert.equal(byId.get('exams-1')?.from, d('2026-12-13'));
  assert.equal(byId.get('example-holiday')?.confidence, 'announced');
  assert.equal(byId.get('example-holiday')?.lunar, undefined);
  assert.equal(entries.length, ref.calendar.length);
  assert.deepEqual(updatedCalendar(ref.calendar, '2026.10', list), [...ref.calendar]);
});

test('a signed update is checked, previewed, applied once and travels with the records', async () => {
  const key = makeTestKey();
  const file = signedFile(key, payload());
  const opened = await openSigned(file, [key.trusted], nodeVerifier);
  assert.ok(opened.ok);
  const update = read(opened.payload);
  const book = await openBook(cemEvents());
  const context = makeContext(ref, book.state);
  assert.equal(updateStatus(context, update), 'new');
  assert.equal(updateStatus(makeContext(reference, book.state), update), 'new');
  assert.equal(updateStatus(context, read(payload('2026.3'))), 'held');
  assert.equal(updateStatus(context, read(payload('2025.9'))), 'older');
  const changes = updateChanges(context, update);
  assert.deepEqual(
    changes.map((one) => `${one.kind} ${one.entry.id}`),
    ['changed exams-1', 'added example-holiday', 'removed spring'],
  );
  assert.equal(changes[0]?.before?.from, d('2026-12-06'));
  const school = book.state.schools.get('s-cem')!;
  assert.equal(context.calendar.info(d('2026-12-07'), school).exam?.id, 'exams-1');
  await book.record(d('2026-11-03'), applyCalendarUpdate(context, update, key.trusted.id, file));
  const after = makeContext(ref, book.state);
  assert.equal(after.calendar.info(d('2026-12-07'), school).exam, null);
  assert.equal(after.calendar.info(d('2026-12-14'), school).exam?.id, 'exams-1');
  assert.equal(after.calendar.info(d('2027-03-22'), school).schoolDay, true);
  assert.equal(after.calendar.info(d('2027-03-01'), school).schoolDay, false);
  assert.equal(after.ref.calendarRelease, '2026.3');
  assert.equal(updateStatus(after, update), 'held');
  assert.deepEqual(updateChanges(after, update), []);
  assert.throws(() => applyCalendarUpdate(after, update, key.trusted.id, file), RangeError);
  const outbound = recordsForRoute(book.state, 'handover');
  assert.deepEqual(
    outbound.filter((one) => one.kind === 'calendar.updated'),
    [{ kind: 'calendar.updated', applied: { update, key: key.trusted.id, file } }],
  );
  const holds = (one: AppliedUpdate) => appliedUpdateHolds(one, [key.trusted], nodeVerifier, ref.country, ref.year);
  const applied = after.state.calendarUpdates[0]!;
  assert.equal(await holds(applied), true);
  assert.equal(await holds({ ...applied, update: { ...update, removed: [] } }), false);
  assert.equal(await holds({ ...applied, key: 'example-other' }), false);
  assert.equal(await holds({ ...applied, file: file.replace('2026.4', '2026.5') }), false);
});

test('a missed update still applies under the later ones, and the built-in release is never laid again', async () => {
  const book = await openBook(cemEvents());
  const school = book.state.schools.get('s-cem')!;
  const late = read(payload('2026.5', { entries: [{ ...payload().entries[0], from: '2026-12-14' }], removed: [] }));
  await book.record(d('2026-11-03'), applyCalendarUpdate(makeContext(ref, book.state), late, 'example-ministry', '{}'));
  const missed = read();
  const context = makeContext(ref, book.state);
  assert.equal(updateStatus(context, missed), 'new');
  assert.deepEqual(
    updateChanges(context, missed).map((one) => `${one.kind} ${one.entry.id}`),
    ['added example-holiday', 'removed spring'],
  );
  await book.record(d('2026-11-04'), applyCalendarUpdate(context, missed, 'example-ministry', '{}'));
  const after = makeContext(ref, book.state);
  assert.equal(after.calendar.info(d('2026-12-14'), school).exam?.from, d('2026-12-14'));
  assert.equal(after.calendar.info(d('2027-03-22'), school).schoolDay, true);
  assert.deepEqual(after.ref.updatedIds, ['example-holiday', 'exams-1', 'spring']);
  const rebuilt = makeContext({ ...ref, calendarRelease: '2026.4' }, book.state);
  assert.equal(rebuilt.calendar.info(d('2027-03-22'), school).schoolDay, false);
  assert.equal(rebuilt.calendar.info(d('2026-12-14'), school).exam?.from, d('2026-12-14'));
  assert.equal(updateStatus(rebuilt, missed), 'held');
  assert.equal(updateStatus(rebuilt, read(payload('2026.2'))), 'older');
});
