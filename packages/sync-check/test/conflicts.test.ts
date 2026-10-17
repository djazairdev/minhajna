// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Conflicts: two devices that change the same record differently before
// they sync give one conflict and a notice that counts it; the same
// change made on both, or changes to different records, give none.
// Made-up records only.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseDay } from '@minhajna/core';
import { conflictNotice, findConflicts, recordKey } from '../src/conflicts.ts';
import { demoYear, twoDevices } from '../src/demo.ts';

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
