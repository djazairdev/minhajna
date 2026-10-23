// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What component entry reads (#239, answers 442 and 451): the months a term
// covers and a period, the term or a month cut to it; the list, read on the
// period's last day, on today while it runs, or on its first day before it
// starts, with a pupil who joined later; what each kind of component is set
// beside; and a pupil's homework in the period, due for their group and
// tapped on the session it came back in, a tap on another session left
// out. Made-up records only.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  captureSession,
  componentEvidence,
  componentList,
  componentPeriod,
  confirmSessions,
  homeworkEvidence,
  setCapture,
  joinPupil,
  sessionsBetween,
  termMonths,
  type SetupLine,
} from '../src/index.ts';
import { cemEvents, contextOf, d, openBook } from './fixtures.ts';

test('a term covers its months, and a month is cut to the term', async () => {
  const context = contextOf(await openBook(cemEvents()));
  assert.deepEqual(termMonths(context, 1), ['2026-09', '2026-10', '2026-11', '2026-12']);
  assert.deepEqual(termMonths(context, 4), []);
  assert.deepEqual(componentPeriod(context, 1), { from: d('2026-09-20'), to: d('2026-12-17') });
  assert.deepEqual(componentPeriod(context, 1, '2026-09'), { from: d('2026-09-20'), to: d('2026-09-30') });
  assert.deepEqual(componentPeriod(context, 1, '2026-12'), { from: d('2026-12-01'), to: d('2026-12-17') });
  assert.equal(componentPeriod(context, 1, '2027-01'), null);
  assert.equal(componentPeriod(context, 4), null);
});

test('the list is read on the period’s last day, on today while it runs, or on its first day', async () => {
  const book = await openBook(cemEvents());
  const joining = { id: 'p11', classId: 'k-1am2', name: 'Made-up Pupil', sex: 'f', reason: 'transfer' } as const;
  await book.record(d('2026-11-15'), joinPupil(contextOf(book), { ...joining, day: d('2026-11-15') }));
  const listed = (month: string, today: string) =>
    componentList(contextOf(book), 'c-math', componentPeriod(contextOf(book), 1, month)!, d(today)).length;
  assert.equal(listed('2026-10', '2026-11-20'), 10);
  assert.equal(listed('2026-11', '2026-11-10'), 10);
  assert.equal(listed('2026-11', '2026-11-20'), 11);
  assert.equal(listed('2026-12', '2026-11-20'), 11);
  assert.deepEqual(
    componentList(contextOf(book), 'c-none', { from: d('2026-10-01'), to: d('2026-10-31') }, d('2026-10-05')),
    [],
  );
});

test('each kind of component is set beside its own evidence, and a column beside none', () => {
  const line = (id: string, capture: string): SetupLine =>
    ({ kind: 'preset', id, name: { ar: id }, capture, points: 3, min: 1, max: 5 }) as SetupLine;
  const lines: SetupLine[] = [
    line('participation', 'session'),
    line('quizzes', 'session'),
    line('homework', 'homework'),
    line('notebook', 'periodic'),
    line('notebooks', 'periodic'),
    line('ability', 'periodic'),
    line('attendance', 'roll-call'),
    line('research', 'manual'),
    { kind: 'column', id: 'col-1', name: 'Made-up column', points: 2, min: 1, max: 10 },
  ];
  assert.deepEqual(lines.map(componentEvidence), [
    'participation',
    null,
    'homework',
    'notebook',
    'notebook',
    null,
    'attendance',
    null,
    null,
  ]);
});

test('a pupil’s homework is what was due for their group, tapped where it came back', async () => {
  const book = await openBook(cemEvents());
  const set = async (day: string, due: string) => {
    const [session] = sessionsBetween(contextOf(book), d(day), d(day), new Set(['c-math']));
    assert.ok(session);
    const details = { homework: { text: 'Made-up exercise', due: d(due) } };
    await book.record(d(day), confirmSessions(contextOf(book), [{ session, details }])[0]!);
  };
  await set('2026-09-21', '2026-09-23');
  await set('2026-09-22', '2026-09-28');
  await set('2026-09-24', '2026-10-04');
  const on = (day: string) => captureSession(contextOf(book), 'c-math', d(day))!;
  for (const [day, value] of [
    ['2026-09-23', 1],
    ['2026-09-28', 2],
    ['2026-09-30', 1],
  ] as const) {
    await book.record(d(day), setCapture(on(day), 'p01', 'homework', value));
  }
  const september = componentPeriod(contextOf(book), 1, '2026-09')!;
  const read = (pupilId: string, period = september, courseId = 'c-math') =>
    homeworkEvidence(contextOf(book), courseId, pupilId, period);
  assert.deepEqual(read('p01'), { set: 2, notDone: 1, helped: 1 });
  assert.deepEqual(read('p06'), { set: 1, notDone: 0, helped: 0 });
  assert.deepEqual(read('p01', componentPeriod(contextOf(book), 1)!), { set: 3, notDone: 1, helped: 1 });
  assert.deepEqual(read('p01', september, 'c-none'), { set: 0, notDone: 0, helped: 0 });
});
