// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CALENDAR_UPDATE_FORMAT,
  makeContext,
  parseCalendarUpdate,
  teacherChanges,
  updateImpact,
  type CalendarUpdate,
} from '../src/index.ts';
import { cemEvents, d, openBook, reference } from './fixtures.ts';

const ref = { ...reference, calendarRelease: '2026.3' };
const closure = (id: string, zone: string, day: string) => ({
  id,
  layer: 'zone',
  zone,
  from: day,
  to: day,
  effect: 'closure',
  name: { en: 'Example closure' },
  source: 'Example notice, not an official announcement',
  confidence: 'announced',
});

const update = (fields: object): CalendarUpdate => {
  const read = parseCalendarUpdate(
    {
      format: CALENDAR_UPDATE_FORMAT,
      version: { major: 1, minor: 0 },
      country: 'dz',
      year: '2026-2027',
      release: '2026.4',
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

test("lists the changes that touch the teacher's schools and counts the others", async () => {
  const book = await openBook(cemEvents());
  const context = makeContext(ref, book.state);
  const one = update({
    entries: [closure('mine', '16', '2026-10-14'), closure('elsewhere', '31', '2026-10-14')],
    removed: ['storm-elsewhere', 'storm'],
  });
  const { mine, others } = teacherChanges(context, one);
  assert.deepEqual(
    mine.map((change) => `${change.kind} ${change.entry.id}`),
    ['added mine', 'removed storm'],
  );
  assert.equal(others, 2);
  const grade = update({
    entries: [{ ...closure('fourth-year', '16', '2026-10-14'), levels: ['cem'], grades: ['4am'] }],
  });
  assert.deepEqual(teacherChanges(context, grade), { mine: [], others: 1 });
  const first = update({
    entries: [{ ...closure('first-year', '16', '2026-10-14'), levels: ['cem'], grades: ['1am'] }],
  });
  assert.equal(teacherChanges(context, first).mine.length, 1);
});

test('previews the sessions an update takes, without applying it', async () => {
  const book = await openBook(cemEvents());
  const context = makeContext(ref, book.state);
  const school = book.state.schools.get('s-cem')!;
  const day = ['2026-10-14', '2026-10-15', '2026-10-18', '2026-10-19'].find(
    (one) => context.calendar.info(d(one), school).schoolDay,
  )!;
  const impact = updateImpact(context, update({ entries: [closure('mine', '16', day)] }), d('2026-10-13'));
  assert.ok(impact.changes.length > 0);
  assert.ok(impact.changes.every((change) => change.after?.calendar === 'closure' && change.before?.calendar === null));
  const mine = update({ entries: [closure('mine', '16', day)] });
  assert.deepEqual(updateImpact(context, mine, d(day), true).changes, impact.changes);
  assert.deepEqual(updateImpact(context, mine, d('2026-10-20'), true), {
    asOf: d('2026-10-20'),
    changes: [],
    recorded: 0,
    courses: [],
  });
  assert.equal(book.state.calendarUpdates.length, 0);
  const elsewhere = updateImpact(context, update({ entries: [closure('far', '31', day)] }), d('2026-10-13'));
  assert.deepEqual(elsewhere.changes, []);
  const nothing = updateImpact(context, update({ removed: ['no-such-entry'] }), d('2026-10-13'));
  assert.deepEqual(nothing, { asOf: d('2026-10-13'), changes: [], recorded: 0, courses: [] });
});
