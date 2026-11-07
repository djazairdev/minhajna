// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What joining a school reads and keeps (answer 808): the joining code as
// typed, the delivery the server answers, and the code kept in the device
// layer, the last one for each school, until it is dropped. Made-up data only.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { joiningCodes, keepJoiningCode, layerOf, readJoiningCode, readTeacherDelivery } from '../src/index.ts';
import { isDeviceEvent } from '../src/device-events.ts';
import { class1, class2, delivery, pupil } from './directory-kit.ts';
import { d, openBook } from './fixtures.ts';

const problem = (value: unknown) => {
  const read = readTeacherDelivery(value);
  return typeof read === 'string' ? read : '';
};

test('reads a joining code however it is typed, and refuses what cannot be one', () => {
  assert.equal(readJoiningCode('7k2m-9q4r-x8zt-3hn6'), '7K2M9Q4RX8ZT3HN6');
  assert.equal(readJoiningCode(' 7K2M 9Q4R X8ZT 3HN6 '), '7K2M9Q4RX8ZT3HN6');
  assert.equal(readJoiningCode('7K2M-9Q4R-X8ZT-3HNI'), null);
  assert.equal(readJoiningCode('7K2M-9Q4R-X8ZT'), null);
});

test('reads a delivery back, with or without its school, and refuses one that does not hold together', () => {
  assert.deepEqual(readTeacherDelivery(JSON.parse(JSON.stringify(delivery))), delivery);
  assert.deepEqual(readTeacherDelivery({ ...delivery, school: null }), { ...delivery, school: null });
  assert.match(problem({ ...delivery, teacher: null }), /teacher/);
  assert.match(problem({ ...delivery, sessions: [{ ...delivery.sessions[0], classId: 'c9' }] }), /names no class/);
  assert.match(problem({ ...delivery, classes: [class1, class1] }), /class appears twice/);
  const pupils = [pupil('p1', 'A'), pupil('p1', 'B')];
  assert.match(problem({ ...delivery, classes: [{ ...class1, pupils }, class2] }), /pupil appears twice/);
  const late = { ...delivery.sessions[0], slot: { half: 'morning', index: 9 } };
  assert.match(problem({ ...delivery, sessions: [late] }), /last slot/);
  assert.match(problem({ ...delivery, sessions: Array.from({ length: 6001 }, () => late) }), /too large/);
  assert.match(problem({ ...delivery, format: 2 }), /format/);
});

test('keeps the joining code in the device layer, the last one for each school, and drops it', async () => {
  const event = keepJoiningCode('own-1', '7k2m-9q4r-x8zt-3hn6');
  assert.deepEqual(event.joined, { school: 'own-1', code: '7K2M9Q4RX8ZT3HN6' });
  assert.equal(isDeviceEvent(event), true);
  assert.equal(layerOf(event), 'device');
  assert.throws(() => keepJoiningCode('own-1', 'bad'), RangeError);
  const bookOf = await openBook([
    event,
    keepJoiningCode('own-1', 'ABCDEFGHJKMNPQRS'),
    keepJoiningCode('own-2', event.joined.code),
  ]);
  assert.deepEqual(
    [...joiningCodes(bookOf.entries)],
    [
      ['own-1', 'ABCDEFGHJKMNPQRS'],
      ['own-2', '7K2M9Q4RX8ZT3HN6'],
    ],
  );
  await bookOf.record(d('2026-10-15'), keepJoiningCode('own-2', null));
  assert.deepEqual([...joiningCodes(bookOf.entries)], [['own-1', 'ABCDEFGHJKMNPQRS']]);
});
