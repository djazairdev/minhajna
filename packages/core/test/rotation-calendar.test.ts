// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  confirmCourse,
  makeContext,
  pace,
  parseSchoolCalendar,
  pupilsFor,
  rollCallUnits,
  rotationCredits,
  rotationOn,
  termCheck,
  sessionsBetween,
  setCalendarEntry,
  takeRollCall,
  type RecordEvent,
} from '../src/index.ts';
import { cemEvents, contextOf, country, d, openBook, reference, year } from './fixtures.ts';
import { rotatingBook, rotation } from './rotation-fixtures.ts';

test('format 1 rejects rotation semantics rather than silently dropping them', () => {
  const file = (entry: unknown) => ({ format: 1, country: 'dz', release: '2026.1', year, entries: [entry] });
  assert.equal(parseSchoolCalendar(file(rotation), country).ok, false);
  assert.equal(parseSchoolCalendar(file({ ...rotation, effect: 'marker' }), country).ok, false);
});

test('A/B corrections change future group days but never a saved roll call, even when its alternating slot disappears', async () => {
  const book = await rotatingBook();
  const day = d('2026-09-22');
  const unit = rollCallUnits(contextOf(book), 'k-1am2', day, day)[0]!;
  await book.record(day, takeRollCall(contextOf(book), unit, { absent: [], late: [] }));
  const schoolClass = book.state.classes.get('k-1am2')!;
  await book.record(
    day,
    setCalendarEntry(contextOf(book), {
      ...rotation,
      id: 'reset',
      effect: 'week-b',
      rotation: undefined,
      from: rotation.from,
      to: rotation.from,
    } as unknown as typeof rotation),
  );
  assert.equal(rotationOn(contextOf(book), schoolClass, d('2026-09-21'))?.groupId, 'g-1');
  const kept = rollCallUnits(contextOf(book), schoolClass.id, day, day).find((one) => one.key === unit.key)!;
  assert.ok(kept);
  assert.equal(kept.groupId, unit.groupId);
  assert.equal(pupilsFor(contextOf(book), kept).length, 5);
});

test('calendar closures and exams do not invent group absences; private teacher time keeps group roll call', async () => {
  const book = await rotatingBook();
  const day = rotation.from;
  const { rotation: rule, ...plain } = rotation;
  assert.ok(rule);
  for (const effect of ['closure', 'exam'] as const) {
    const context = makeContext(reference, {
      ...book.state,
      calendar: [...book.state.calendar, { ...plain, id: 'blocked', effect, from: day, to: day }],
    });
    assert.equal(rollCallUnits(context, 'k-1am2', day, day).length, 0);
    assert.equal(sessionsBetween(context, day, day)[0]!.calendar, effect);
  }
  const context = makeContext(reference, {
    ...book.state,
    calendar: [
      ...book.state.calendar,
      {
        ...plain,
        id: 'training',
        layer: 'teacher',
        schoolId: undefined,
        effect: 'closure',
        from: day,
        to: day,
      } as unknown as typeof rotation,
    ],
  });
  const unit = rollCallUnits(context, 'k-1am2', day, day)[0]!;
  assert.equal(unit.groupId, 'g-1');
  assert.equal(pupilsFor(context, unit).length, 5);
});

test('a fixed half-group slot on its off-day is calendar cost, not a lesson or an absence', async () => {
  const events = cemEvents().map((event): RecordEvent =>
    event.kind !== 'timetable.set'
      ? event
      : {
          ...event,
          version: {
            ...event.version,
            entries: event.version.entries.map((one) => (one.id === 'e-sun' ? { ...one, groupId: 'g-2' } : one)),
          },
        },
  );
  const book = await openBook(events);
  await book.record(rotation.from, setCalendarEntry(contextOf(book), rotation));
  const first = sessionsBetween(contextOf(book), rotation.from, rotation.from)[0]!;
  assert.equal(first.calendar, 'rotation');
  assert.equal(rollCallUnits(contextOf(book), 'k-1am2', rotation.from, rotation.from).length, 0);
  assert.equal(pace(contextOf(book), 'c-math', rotation.from)!.lost.rotation, 1);
});

test('a late rotation does not relabel a previously recorded whole-class session', async () => {
  const book = await openBook(cemEvents());
  const first = sessionsBetween(contextOf(book), rotation.from, rotation.from)[0]!;
  const record = confirmCourse(contextOf(book), 'c-math', [{ sessionKey: first.key }], first.day)[0]!;
  await book.record(first.day, { kind: 'session.recorded', record });
  await book.record(first.day, setCalendarEntry(contextOf(book), rotation));
  const after = sessionsBetween(contextOf(book), first.day, first.day);
  assert.equal(after.length, 1);
  assert.equal(after[0]!.groupId, 'g-all');
  assert.equal(after[0]!.rotation, undefined);
});

test('missed teaching still produces delay after buffers; repeated sessions do not hide it', async () => {
  const book = await rotatingBook();
  const sessions = sessionsBetween(contextOf(book), rotation.from, rotation.to);
  const records = confirmCourse(
    contextOf(book),
    'c-math',
    sessions.map((one) => ({
      sessionKey: one.key,
      choice: { outcome: 'not-held' },
    })),
    rotation.to,
  );
  await book.recordAll(
    rotation.to,
    records.map((record) => ({ kind: 'session.recorded', record })),
  );
  const result = pace(contextOf(book), 'c-math', rotation.to)!;
  assert.equal(result.expected, 4);
  assert.equal(result.position, 0);
  assert.ok(result.delay > 0);
});

test('a partial group credit is not counted a second time after a whole-class session resumes', async () => {
  const book = await rotatingBook();
  const sessions = sessionsBetween(contextOf(book), rotation.from, rotation.to);
  const first = sessions.find((one) => one.groupId === 'g-1')!;
  const second = sessions.find((one) => one.groupId === 'g-2')!;
  const whole = { ...second, key: 'synthetic-whole', groupId: 'g-all' };
  const { rotation: rule, ...withoutRotation } = whole;
  assert.ok(rule);
  assert.equal(rotationCredits([first, withoutRotation, { ...second, day: d('2026-09-23') }]), 1);
  assert.equal(rotationCredits([first, { ...second, rotation: { ...second.rotation!, groups: ['g-2', 'g-1'] } }]), 1);
});

test('rotation follows profile week order, optional Saturday and explicit school resets', async () => {
  const book = await rotatingBook();
  const version = book.state.timetables[0]!.version;
  await book.record(rotation.from, { kind: 'timetable.set', version: { ...version, options: { saturday: true } } });
  const context = makeContext({ ...reference, country: { ...country, workingDays: [4, 2, 0, 3, 1] } }, book.state);
  const schoolClass = book.state.classes.get('k-1am2')!;
  assert.equal(rotationOn(context, schoolClass, d('2026-09-26'))!.groupId, 'g-2');
  assert.equal(rotationOn(context, schoolClass, d('2026-09-27'))!.groupId, 'g-1');
});

test('remaining capacity includes the second group completing work already recorded for the first', async () => {
  const book = await rotatingBook();
  const session = sessionsBetween(contextOf(book), rotation.from, rotation.from)[0]!;
  const record = confirmCourse(contextOf(book), 'c-math', [{ sessionKey: session.key }], session.day)[0]!;
  await book.record(session.day, { kind: 'session.recorded', record });
  const context = makeContext(
    {
      ...reference,
      calendar: [
        {
          ...rotation,
          id: 'early-exam',
          from: d('2026-09-22'),
          to: d('2026-09-24'),
          effect: 'exam',
          rotation: undefined,
          term: 1,
        } as unknown as typeof rotation,
      ],
    },
    book.state,
  );
  assert.equal(termCheck(context, 'c-math', d('2026-09-21'))!.gives, 1);
});

test('credits never pair a reading lesson for one group with writing for the other', async () => {
  const book = await rotatingBook();
  const sessions = sessionsBetween(contextOf(book), rotation.from, rotation.to);
  const first = sessions.find((one) => one.groupId === 'g-1')!;
  const second = sessions.find((one) => one.groupId === 'g-2')!;
  assert.equal(
    rotationCredits([
      { ...first, activity: 'reading' },
      { ...second, activity: 'writing' },
    ]),
    0,
  );
});
