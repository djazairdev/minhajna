// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Conflicts: two devices that change the same record differently before they
// sync give one conflict and a notice that counts it; the same change made on
// both, or changes to different records, give none. A pupil's mark or capture
// is one record per cell, and a class and subject's formula one record per
// course, and a descriptive observation or an appreciation one per pupil,
// course and term (#240, #241). Made-up records only.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MemoryStore,
  parseDay,
  RecordBook,
  setCapture,
  setAppreciation,
  setMark,
  setObservation,
  type CalendarUpdate,
  type Entry,
  type RecordEvent,
  type SessionRef,
} from '@minhajna/core';
import { conflictNotice, findConflicts, recordKey } from '../src/conflicts.ts';
import { demoYear, deps, twoDevices } from '../src/demo.ts';

const year = await demoYear('cem');
const devices = await twoDevices(year, parseDay('2026-10-14'));

test('names each entry by the record it changes', () => {
  const keys = year.entries.map(recordKey);
  assert.ok(keys.some((key) => key?.startsWith('roll-call/')));
  assert.ok(keys.some((key) => key?.startsWith('session/')));
  assert.ok(keys.some((key) => key?.startsWith('pupil/')));
  assert.ok(keys.includes('teacher'));
});

test('finds the one roll call both devices took differently', () => {
  const conflicts = findConflicts(devices.computer, devices.phone);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0]!.kind, 'roll-call.taken');
  assert.deepEqual(conflicts[0]!.mine, devices.computer[0]);
  assert.deepEqual(conflicts[0]!.theirs, devices.phone[0]);
  assert.deepEqual(
    findConflicts(devices.phone, devices.computer).map((one) => one.key),
    conflicts.map((one) => one.key),
  );
});

test('the notice counts the records waiting for a choice, by kind', () => {
  const notice = conflictNotice(findConflicts(devices.computer, devices.phone));
  assert.deepEqual(notice, { count: 1, kinds: { 'roll-call.taken': 1 } });
  assert.equal(conflictNotice([]), null);
});

test('no conflict when only one side changed, or both made the same change', () => {
  assert.deepEqual(findConflicts(devices.computer, []), []);
  assert.deepEqual(findConflicts(devices.computer.slice(1), devices.phone.slice(1)), []);
});

const recorded = async (...events: RecordEvent[]): Promise<Entry[]> => {
  const book = await RecordBook.open(new MemoryStore(), deps);
  for (const event of events) await book.record(parseDay('2026-11-08'), event);
  return [...book.entries];
};

test('a mark or a capture typed differently on two devices conflicts in its own cell only', async () => {
  const mark = (pupilId: string, value: number) =>
    setMark({ courseId: 'c-1', term: 1, target: { kind: 'test', testId: 't-1' }, pupilId }, value, 20);
  const session: SessionRef = {
    key: 'c-1/2026-11-08/m1/g-all',
    courseId: 'c-1',
    groupId: 'g-all',
    day: parseDay('2026-11-08'),
    slot: { half: 'morning', index: 1 },
  };
  const [mine, theirs, same] = await Promise.all([
    recorded(mark('p-1', 12), mark('p-2', 8), setCapture(session, 'p-1', 'participation', 2)),
    recorded(mark('p-1', 13), mark('p-3', 8), setCapture(session, 'p-1', 'participation', 3)),
    recorded(mark('p-1', 12), mark('p-2', 8), setCapture(session, 'p-1', 'participation', 2)),
  ]);
  assert.deepEqual(mine.map(recordKey), [
    'mark/c-1/1/test:t-1/p-1',
    'mark/c-1/1/test:t-1/p-2',
    'capture/c-1/2026-11-08/m1/g-all/p-1/participation',
  ]);
  assert.deepEqual(
    findConflicts(mine, theirs).map((conflict) => conflict.key),
    ['mark/c-1/1/test:t-1/p-1', 'capture/c-1/2026-11-08/m1/g-all/p-1/participation'],
  );
  assert.deepEqual(findConflicts(mine, same), []);
});

test('a formula chosen differently on two devices conflicts for that course only', async () => {
  const chosen = (courseId: string, formula: 'lycee' | 'lycee-oral'): RecordEvent => ({
    kind: 'formula.set',
    courseId,
    formula,
  });
  const [mine, theirs, same] = await Promise.all([
    recorded(chosen('c-1', 'lycee-oral'), chosen('c-2', 'lycee')),
    recorded(chosen('c-1', 'lycee'), chosen('c-3', 'lycee')),
    recorded(chosen('c-1', 'lycee-oral')),
  ]);
  assert.deepEqual(mine.map(recordKey), ['formula/c-1', 'formula/c-2']);
  assert.deepEqual(
    findConflicts(mine, theirs).map((conflict) => conflict.key),
    ['formula/c-1'],
  );
  assert.deepEqual(findConflicts(mine.slice(0, 1), same), []);
});

test('an observation chosen differently on two devices conflicts for that pupil only', async () => {
  const observe = (pupilId: string, value: 'acquired' | 'in-progress') =>
    setObservation({ courseId: 'c-1', term: 1, pupilId }, value);
  const [mine, theirs] = await Promise.all([
    recorded(observe('p-1', 'acquired'), observe('p-2', 'acquired')),
    recorded(observe('p-1', 'in-progress'), observe('p-2', 'acquired')),
  ]);
  assert.deepEqual(mine.map(recordKey), ['observation/c-1/1/p-1', 'observation/c-1/1/p-2']);
  assert.deepEqual(
    findConflicts(mine, theirs).map((conflict) => conflict.key),
    ['observation/c-1/1/p-1'],
  );
});

test('an appreciation chosen differently on two devices conflicts for that pupil only', async () => {
  const phrase = (id: string) => ({ id, band: 'fair', text: { ar: id } });
  const choose = (pupilId: string, id: string) =>
    setAppreciation({ courseId: 'c-1', term: 1, pupilId }, { release: '2026.1' }, phrase(id));
  const [mine, theirs] = await Promise.all([
    recorded(choose('p-1', 'fair-1'), choose('p-2', 'fair-1')),
    recorded(choose('p-1', 'fair-2'), choose('p-2', 'fair-1')),
  ]);
  assert.deepEqual(mine.map(recordKey), ['appreciation/c-1/1/p-1', 'appreciation/c-1/1/p-2']);
  assert.deepEqual(
    findConflicts(mine, theirs).map((conflict) => conflict.key),
    ['appreciation/c-1/1/p-1'],
  );
});

test('two different files of one calendar release conflict; the same file on both does not', async () => {
  const update: CalendarUpdate = {
    country: 'dz',
    year: '2026-2027',
    release: '2026.4',
    published: parseDay('2026-10-13'),
    entries: [],
    removed: ['example-entry'],
  };
  const applied = (file: string): RecordEvent => ({
    kind: 'calendar.updated',
    applied: { update, key: 'example-ministry', file },
  });
  const entries = async (event: RecordEvent) => {
    const book = await RecordBook.open(new MemoryStore(), deps);
    await book.record(parseDay('2026-10-14'), event);
    return book.entries;
  };
  const [one, same, other] = await Promise.all([
    entries(applied('example file')),
    entries(applied('example file')),
    entries(applied('another example file')),
  ]);
  assert.equal(recordKey(one[0]!), 'calendar-update/2026.4');
  assert.deepEqual(findConflicts(one, same), []);
  assert.deepEqual(
    findConflicts(one, other).map((conflict) => conflict.kind),
    ['calendar.updated'],
  );
});
