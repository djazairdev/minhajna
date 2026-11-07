// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a join keeps of the phone's own (answer 808): the teacher's session and
// half-group on a joined class, an archived class with its sessions, a pupil
// back before their leaving was confirmed, a leaving dated later or for a
// transfer, registration numbers that are not digits or that two pupils share,
// a school not recorded yet, and a version planned for a later day, which is
// counted. Made-up data only.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { joinPlan, type RecordEvent, type TeacherDelivery, type TimetableEntry } from '../src/index.ts';
import { chosen, class1, class2, delivery, pupil } from './directory-kit.ts';
import { d, openBook, year } from './fixtures.ts';

const C1 = 'dir.own-1.c.c1';
const plan = (state: Parameters<typeof joinPlan>[0]['state'], today: string, given = delivery, school = chosen) =>
  joinPlan({ state, year, today: d(today), delivery: given, school, packs: [], newId: () => `v-${today}` });
const weekOf = (events: readonly RecordEvent[]) =>
  (events.at(-1) as Extract<RecordEvent, { kind: 'timetable.set' }>).version;

async function joined() {
  const bookOf = await openBook([{ kind: 'school.set', school: chosen }]);
  await bookOf.recordAll(d('2026-10-15'), plan(bookOf.state, '2026-10-15').events);
  return bookOf;
}

test('keeps the teacher’s own session and a session moved to a half-group on a joined class', async () => {
  const bookOf = await joined();
  const schoolClass = bookOf.state.classes.get(C1)!;
  const half = { id: `${C1}.h1`, kind: 'half' as const, name: 'G1' };
  await bookOf.record(d('2026-10-16'), {
    kind: 'class.set',
    schoolClass: { ...schoolClass, groups: [...schoolClass.groups, half] },
  });
  const last = bookOf.state.timetables.at(-1)!.version;
  const own: TimetableEntry = { ...last.entries[0]!, id: 'e-lab', weekday: 3, weeks: 'A', groupId: half.id };
  const entries = [{ ...last.entries[0]!, groupId: half.id }, last.entries[1]!, own];
  await bookOf.record(d('2026-10-16'), { kind: 'timetable.set', version: { ...last, id: 'v-own', entries } });
  const moved = { ...delivery, sessions: [delivery.sessions[0]!, { ...delivery.sessions[1]!, weekday: 4 as const }] };
  const week = weekOf(plan(bookOf.state, '2026-10-20', moved).events);
  assert.deepEqual(
    week.entries.map((one) => [one.id, one.groupId]),
    [
      ['e-lab', half.id],
      ['dir.own-1.s.s1', half.id],
      ['dir.own-1.s.s2', 'dir.own-1.c.c2.w'],
    ],
  );
});

test('leaves an archived class and its sessions as they are', async () => {
  const bookOf = await joined();
  const schoolClass = bookOf.state.classes.get(C1)!;
  await bookOf.record(d('2026-10-16'), {
    kind: 'class.set',
    schoolClass: { ...schoolClass, archivedFrom: d('2026-10-16') },
  });
  const renamed = { ...delivery, classes: [{ ...class1, name: 'New name', pupils: [] }, class2] };
  const update = plan(bookOf.state, '2026-10-20', renamed);
  assert.deepEqual(update.events, []);
  assert.deepEqual(
    update.classes.map((one) => one.name),
    ['1AM2'],
  );
});

test('brings back a pupil whose leaving awaits confirmation, and keeps a confirmed leaving', async () => {
  const bookOf = await joined();
  const out = (pupilId: string, confirmed: boolean): RecordEvent => ({
    kind: 'pupil.moved',
    pupilId,
    movement: { day: d('2026-10-16'), kind: 'out', reason: 'class-change', ...(confirmed && { confirmed }) },
  });
  await bookOf.recordAll(d('2026-10-16'), [out(`${C1}.p.p1`, false), out(`${C1}.p.p2`, true)]);
  const update = plan(bookOf.state, '2026-10-20');
  assert.deepEqual(update.events, [
    {
      kind: 'pupil.moved',
      pupilId: `${C1}.p.p1`,
      movement: { day: d('2026-10-20'), kind: 'in', reason: 'class-change' },
    },
  ]);
  assert.deepEqual([update.arriving, update.stillListed], [1, 1]);
});

test('leaves a departure dated later, or for a transfer, as the teacher recorded it', async () => {
  const bookOf = await joined();
  await bookOf.recordAll(d('2026-10-16'), [
    { kind: 'pupil.moved', pupilId: `${C1}.p.p1`, movement: { day: d('2026-10-26'), kind: 'out', reason: 'other' } },
    { kind: 'pupil.moved', pupilId: `${C1}.p.p2`, movement: { day: d('2026-10-16'), kind: 'out', reason: 'transfer' } },
  ]);
  const first = plan(bookOf.state, '2026-10-20');
  assert.deepEqual([first.events, first.stillListed], [[], 2]);
  assert.deepEqual(plan(bookOf.state, '2026-10-21').events, []);
});

test('takes no registration number that is not digits or that two pupils share', async () => {
  const bookOf = await openBook([{ kind: 'school.set', school: chosen }]);
  const numbered: TeacherDelivery = {
    ...delivery,
    classes: [
      {
        ...class1,
        pupils: [
          { ...pupil('p1', 'A'), registration: 'X12' },
          { ...pupil('p2', 'B'), registration: '7' },
        ],
      },
      { ...class2, pupils: [{ ...pupil('p1', 'C'), registration: '7' }] },
    ],
  };
  const pupils = plan(bookOf.state, '2026-10-15', numbered).events.flatMap((event) =>
    event.kind === 'pupil.set' ? [event.pupil.registration ?? null] : [],
  );
  assert.deepEqual(pupils, [null, null, null]);
});

test('records a school the phone has not recorded yet, and counts a later version it replaces', async () => {
  const bookOf = await openBook([]);
  const fresh = { ...chosen, id: 'own-9', name: 'Made-up middle school' };
  assert.deepEqual(plan(bookOf.state, '2026-10-15', delivery, fresh).events[0], {
    kind: 'school.set',
    school: { ...fresh, subjects: ['math'] },
  });
  const planned = await joined();
  const later = planned.state.timetables.at(-1)!.version;
  await planned.record(d('2026-10-16'), {
    kind: 'timetable.set',
    version: { ...later, id: 'v-later', from: d('2026-11-15') },
  });
  const moved = { ...delivery, sessions: [{ ...delivery.sessions[0]!, weekday: 4 as const }] };
  const update = plan(planned.state, '2026-10-20', moved);
  assert.equal(update.replaced, 1);
  assert.equal(weekOf(update.events).from, d('2026-10-20'));
});
