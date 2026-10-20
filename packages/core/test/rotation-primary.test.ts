// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assignRotationGroups,
  confirmCourse,
  countRollCalls,
  pace,
  pupilsFor,
  rollCallUnits,
  rotationRosterReady,
  sessionsBetween,
  setCalendarEntry,
  takeRollCall,
  type ClassGroup,
} from '../src/index.ts';
import { contextOf, d, openBook, primaryEvents } from './fixtures.ts';
import { rotatingBook, rotation } from './rotation-fixtures.ts';

test('week packs keep their week anchor while rotation repetitions reduce expected progress', async () => {
  const book = await openBook(primaryEvents());
  const halves: readonly [ClassGroup, ClassGroup] = [
    { id: 'h-1', kind: 'half', name: 'Example first group' },
    { id: 'h-2', kind: 'half', name: 'Example second group' },
  ];
  const assignments = new Map([...book.state.pupils.values()].map((one, index) => [one.id, index < 3 ? 'h-1' : 'h-2']));
  await book.recordAll(d('2026-09-19'), assignRotationGroups(contextOf(book), 'k-5apb', halves, assignments));
  await book.record(
    d('2026-09-19'),
    setCalendarEntry(contextOf(book), {
      ...rotation,
      schoolId: 's-pri',
      rotation: { classId: 'k-5apb', groups: ['h-1', 'h-2'] },
    }),
  );
  const from = rotation.from;
  const to = d('2026-09-24');
  const sessions = sessionsBetween(contextOf(book), from, to);
  await book.recordAll(
    to,
    confirmCourse(
      contextOf(book),
      'c-lang',
      sessions.map((one) => ({ sessionKey: one.key })),
      to,
    ).map((record) => ({ kind: 'session.recorded', record })),
  );
  const result = pace(contextOf(book), 'c-lang', to)!;
  assert.equal(result.delay, 0);
  assert.ok(result.expected <= result.position);
  assert.equal(result.weeksBehind, 0);
  const units = rollCallUnits(contextOf(book), 'k-5apb', from, from);
  assert.equal(units.length, 2);
  assert.ok(units.every((one) => one.groupId === 'h-1'));
});

test('off-duty pupils do not enter possible attendance or absence totals', async () => {
  const book = await rotatingBook();
  const unit = rollCallUnits(contextOf(book), 'k-1am2', rotation.from, rotation.from)[0]!;
  await book.record(
    rotation.from,
    takeRollCall(contextOf(book), unit, {
      absent: [{ pupilId: 'p01', justified: false }],
      late: [],
    }),
  );
  const counts = countRollCalls(contextOf(book), 'k-1am2', rotation.from, rotation.from);
  assert.equal(counts.pupils.length, 5);
  assert.ok(!counts.pupils.some((one) => one.pupilId === 'p06'));
  assert.equal(counts.pupils.find((one) => one.pupilId === 'p01')!.absent, 1);
});

test('new unassigned pupils block a new roll call but do not rewrite an already taken one', async () => {
  const book = await rotatingBook();
  const first = rollCallUnits(contextOf(book), 'k-1am2', rotation.from, rotation.from)[0]!;
  await book.record(rotation.from, takeRollCall(contextOf(book), first, { absent: [], late: [] }));
  const pupil = book.state.pupils.get('p01')!;
  await book.record(rotation.from, { kind: 'pupil.set', pupil: { ...pupil, id: 'new-example', groups: [] } });
  assert.equal(rotationRosterReady(contextOf(book), first), true);
  assert.equal(pupilsFor(contextOf(book), first).length, 5);
  const next = rollCallUnits(contextOf(book), 'k-1am2', d('2026-09-21'), d('2026-09-21'))[0]!;
  assert.equal(rotationRosterReady(contextOf(book), next), false);
  assert.throws(() => takeRollCall(contextOf(book), next, { absent: [], late: [] }));
});
