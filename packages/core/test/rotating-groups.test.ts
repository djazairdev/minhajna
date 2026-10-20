// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assignRotationGroups,
  calendarImpact,
  cancelCalendarEntry,
  confirmCourse,
  current,
  makeContext,
  pace,
  planView,
  pupilsFor,
  rollCallUnits,
  rotationCredits,
  rotationOn,
  sessionsBetween,
  setCalendarEntry,
  takeRollCall,
  termCheck,
  type CalendarEntry,
  type RecordEvent,
} from '../src/index.ts';
import { cemEvents, contextOf, d, openBook, reference } from './fixtures.ts';
import { rotatingBook, rotation } from './rotation-fixtures.ts';

test('two working weeks alternate groups, keep physical slots and halve each queue separately', async () => {
  const book = await rotatingBook();
  const context = contextOf(book);
  const schoolClass = book.state.classes.get('k-1am2')!;
  const groups = [
    '2026-09-20',
    '2026-09-21',
    '2026-09-22',
    '2026-09-23',
    '2026-09-24',
    '2026-09-27',
    '2026-09-28',
    '2026-09-29',
    '2026-09-30',
    '2026-10-01',
  ].map((day) => rotationOn(context, schoolClass, d(day))?.groupId);
  assert.deepEqual(groups, ['g-1', 'g-2', 'g-1', 'g-2', 'g-1', 'g-2', 'g-1', 'g-2', 'g-1', 'g-2']);
  const sessions = sessionsBetween(context, rotation.from, rotation.to);
  assert.equal(sessions.length, 10);
  const lessons = sessions.filter((one) => one.sessionType === 'lesson');
  const td = sessions.filter((one) => one.sessionType === 'td');
  assert.equal(rotationCredits(lessons), 4);
  assert.equal(rotationCredits(td), 1);
  const plain = makeContext(reference, { ...book.state, calendar: [] });
  assert.equal(
    termCheck(plain, 'c-math', rotation.from)!.gives - termCheck(context, 'c-math', rotation.from)!.gives,
    4,
  );
  assert.equal(
    termCheck(plain, 'c-math', rotation.from)!.td.gives - termCheck(context, 'c-math', rotation.from)!.td.gives,
    1,
  );
  assert.ok(sessionsBetween(context, d('2026-10-04'), d('2026-10-04')).every((one) => one.groupId === 'g-all'));
});

test('one group starts an item; completion and projected date belong to the second group', async () => {
  const book = await rotatingBook();
  const first = sessionsBetween(contextOf(book), rotation.from, rotation.from)[0]!;
  await book.recordAll(
    first.day,
    confirmCourse(contextOf(book), 'c-math', [{ sessionKey: first.key }], first.day).map((record): RecordEvent => ({
      kind: 'session.recorded',
      record,
    })),
  );
  const row = planView(contextOf(book), 'c-math', first.day)!.main[0]!;
  assert.equal(row.status, 'started');
  assert.equal(row.onlyGroup, 'Group 1');
  assert.equal(row.next, d('2026-09-21'));
  assert.equal(row.completed, undefined);
  assert.equal(pace(contextOf(book), 'c-math', first.day)!.expected, 0);
  const second = sessionsBetween(contextOf(book), d('2026-09-21'), d('2026-09-21'))[0]!;
  await book.recordAll(
    second.day,
    confirmCourse(contextOf(book), 'c-math', [{ sessionKey: second.key }], second.day).map((record): RecordEvent => ({
      kind: 'session.recorded',
      record,
    })),
  );
  const finished = planView(contextOf(book), 'c-math', second.day)!.main[0]!;
  assert.equal(finished.status, 'done');
  assert.equal(finished.completed, second.day);
  assert.equal(finished.next, null);
});

test('repeated teaching is calendar cost, not delay; TD does not advance the main queue', async () => {
  const book = await rotatingBook();
  const sessions = sessionsBetween(contextOf(book), rotation.from, rotation.to).filter((one) => one.calendar === null);
  const records = confirmCourse(
    contextOf(book),
    'c-math',
    sessions.map((one) => ({ sessionKey: one.key })),
    rotation.to,
  );
  await book.recordAll(
    rotation.to,
    records.map((record) => ({ kind: 'session.recorded', record })),
  );
  const result = pace(contextOf(book), 'c-math', rotation.to)!;
  assert.equal(result.recorded, 8);
  assert.equal(result.expected, 4);
  assert.equal(result.position, 4);
  assert.equal(result.delay, 0);
  assert.equal(result.lost.rotation, 4);
  assert.equal(planView(contextOf(book), 'c-math', rotation.to)!.td[0]!.status, 'done');
});

test('roll call covers only the attending group, including half-day units', async () => {
  const book = await rotatingBook();
  for (const kind of ['session', 'half-day'] as const) {
    const schoolClass = book.state.classes.get('k-1am2')!;
    await book.record(rotation.from, { kind: 'class.set', schoolClass: { ...schoolClass, rollCallUnit: kind } });
    const unit = rollCallUnits(contextOf(book), schoolClass.id, rotation.from, rotation.from)[0]!;
    assert.equal(unit.groupId, 'g-1');
    assert.deepEqual(
      pupilsFor(contextOf(book), unit).map((one) => one.id),
      ['p01', 'p02', 'p03', 'p04', 'p05'],
    );
    assert.throws(() =>
      takeRollCall(contextOf(book), unit, { absent: [{ pupilId: 'p06', justified: false }], late: [] }),
    );
  }
});

test('changing or cancelling a rotation preserves recorded sessions without a duplicate proposal', async () => {
  const book = await rotatingBook();
  const first = sessionsBetween(contextOf(book), rotation.from, rotation.from)[0]!;
  const record = confirmCourse(contextOf(book), 'c-math', [{ sessionKey: first.key }], first.day)[0]!;
  await book.record(first.day, { kind: 'session.recorded', record });
  const reverse = { ...rotation, rotation: { ...rotation.rotation!, groups: ['g-2', 'g-1'] as const } };
  const event = setCalendarEntry(contextOf(book), reverse);
  const impact = calendarImpact(contextOf(book), event, first.day);
  assert.equal(impact.recorded, 1);
  assert.ok(!impact.changes.some((one) => (one.after ?? one.before)!.day === first.day));
  await book.record(first.day, event);
  await book.record(first.day, cancelCalendarEntry(contextOf(book), rotation.id));
  const after = sessionsBetween(contextOf(book), first.day, first.day);
  assert.equal(after.length, 1);
  assert.equal(after[0]!.key, first.key);
  assert.deepEqual(after[0]!.rotation, record.session.rotation);
  assert.deepEqual(current(book.state.sessions.get(first.key)), record);
});

test('a saved roll call fixes both its attending group and roster after a same-day move or withdrawal', async () => {
  const book = await rotatingBook();
  const unit = rollCallUnits(contextOf(book), 'k-1am2', rotation.from, rotation.from)[0]!;
  await book.record(rotation.from, takeRollCall(contextOf(book), unit, { absent: [], late: [] }));
  const pupil = book.state.pupils.get('p01')!;
  await book.record(rotation.from, { kind: 'pupil.set', pupil: { ...pupil, groups: ['g-2'] } });
  await book.record(rotation.from, cancelCalendarEntry(contextOf(book), rotation.id));
  const after = rollCallUnits(contextOf(book), 'k-1am2', rotation.from, rotation.from)[0]!;
  assert.equal(after.key, unit.key);
  assert.equal(after.groupId, unit.groupId);
  assert.ok(pupilsFor(contextOf(book), after).some((one) => one.id === pupil.id));
});

test('group preparation preserves other memberships, and activation rejects missing or ambiguous assignments', async () => {
  const book = await openBook(cemEvents());
  const schoolClass = book.state.classes.get('k-1am2')!;
  const halves = schoolClass.groups.filter((one) => one.kind === 'half') as unknown as Parameters<
    typeof assignRotationGroups
  >[2];
  const pupil = book.state.pupils.get('p01')!;
  await book.record(rotation.from, { kind: 'pupil.set', pupil: { ...pupil, groups: ['option-example'] } });
  assert.throws(() => setCalendarEntry(contextOf(book), rotation));
  const assignments = new Map(
    [...book.state.pupils.values()].map((one) => [one.id, one.id === pupil.id ? 'g-2' : one.groups[0]!]),
  );
  await book.recordAll(rotation.from, assignRotationGroups(contextOf(book), schoolClass.id, halves, assignments));
  assert.deepEqual(book.state.pupils.get(pupil.id)!.groups, ['option-example', 'g-2']);
  assert.doesNotThrow(() => setCalendarEntry(contextOf(book), rotation));
  assert.throws(() => assignRotationGroups(contextOf(book), schoolClass.id, halves, new Map()));
  await book.record(rotation.from, { kind: 'pupil.set', pupil: { ...pupil, groups: ['g-1', 'g-2'] } });
  assert.throws(() => setCalendarEntry(contextOf(book), rotation));
});

test('rotation validation rejects another layer, class, group pair, overlapping rule and altered entry kind', async () => {
  const book = await rotatingBook();
  const { rotation: rule, ...plain } = rotation;
  assert.ok(rule);
  const invalid: CalendarEntry[] = [
    { ...rotation, layer: 'teacher' },
    { ...rotation, half: 'morning' },
    { ...rotation, rotation: { classId: 'missing', groups: ['g-1', 'g-2'] } },
    { ...rotation, rotation: { classId: 'k-1am2', groups: ['g-1', 'g-1'] } },
    { ...rotation, id: 'overlap' },
    { ...plain, effect: 'marker' },
  ];
  for (const entry of invalid) assert.throws(() => setCalendarEntry(contextOf(book), entry));
});
