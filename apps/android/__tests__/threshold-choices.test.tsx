// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The setter's choices on an exam's threshold page (#601, answer 633), on the
// made-up room of cut-room.ts, its state set by hand where a second setter
// would be needed: a cut proposed by another setter waits for this phone, with
// the day it was proposed, and signing it signs the same item; once settled the
// choice to sign it goes; a refused cut is shown and the room read again; a
// phone the chart does not name, or past the deadline, has no choice; the
// director's decisions, an exam no longer shared and a plan the reference does
// not hold are said; and going back from the plan's items forgets the one
// chosen. Every school, teacher and pack is made up.

import { addDays, type Day } from '@minhajna/core';
import { Platform } from 'react-native';
import { openedRoom } from '../jest/cut-room';
import { server } from '../jest/timetable-send';
import { alerts, controls, press, props, quoted, show, texts, unmount } from '../jest/threshold-page';
import { nodeKit as kit } from '../jest/world-server';
import { leaveWorldNetwork } from '../src/network/world-network';
import ar from '../src/text/ar.json';
import { ExamThreshold } from '../src/threshold/ExamThreshold';
import * as teacherRooms from '../src/threshold/teacher-rooms';
import { roomId } from '../src/threshold/threshold-text';
import { isolate } from '../src/week/grid-labels';

const page = ar.demo.threshold;
const ROOM = roomId({ exam: 'term-2', subject: 'math', grade: '1am' });
const OTHER = { assignment: 'made-up-assignment', name: 'أستاذ مختلق', key: 'made-up-key' };

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});

afterEach(async () => {
  await unmount();
  leaveWorldNetwork();
  server.reset();
  jest.restoreAllMocks();
});

/** The room as read, with its state replaced and another setter named after the phone. */
async function stated(state: (date: Day, items: readonly string[]) => Partial<teacherRooms.TeacherRoom['state']>) {
  const { id, date, joined, items, pack } = await openedRoom();
  const [room] = await teacherRooms.readTeacherRooms({ world: id, date }, joined, kit, server.send);
  const chart = { ...room.chart, setters: [...room.chart.setters, OTHER] };
  const made = { ...room, chart, state: { ...room.state, ...state(date, items) } };
  const reads = jest.spyOn(teacherRooms, 'readTeacherExams').mockResolvedValue({ rooms: [made], weeks: null });
  return { world: { world: id, date }, joined, items, pack, room: made, reads };
}

test('signs a cut another setter proposed, with its day, and offers no such choice once settled', async () => {
  const { world, joined, items, pack, room, reads } = await stated((date, all) => ({
    signed: new Map([[OTHER.assignment, all[0]]]),
    days: new Map([[OTHER.assignment, date]]),
    proposed: { item: all[0], by: OTHER.assignment, day: date },
  }));
  const signs = jest.spyOn(teacherRooms, 'signCut').mockResolvedValue({} as never);
  await show(<ExamThreshold {...props(world, joined)} said={page.title} room={ROOM} />);
  const item = quoted(pack.items[0].title);
  expect(texts()).toContain(
    page.state.awaiting
      .replace('{{name}}', isolate(OTHER.name))
      .replace('{{item}}', item)
      .replace('{{day}}', `day ${world.date}`),
  );
  await press('threshold-sign');
  expect(signs.mock.calls[0][3]).toBe(items[0]);
  const settled = { ...room.state, settled: { item: items[0], by: 'setters' as const } };
  reads.mockResolvedValue({ rooms: [{ ...room, state: settled }], weeks: null });
  await unmount();
  await show(<ExamThreshold {...props(world, joined)} said={page.title} room={ROOM} />);
  expect([texts().includes(page.state.settled.replace('{{item}}', item)), controls('threshold-sign').length]).toEqual([
    true,
    0,
  ]);
});

test('a refused cut is shown and the room read again', async () => {
  const { world, joined, reads } = await stated(() => ({}));
  jest.spyOn(teacherRooms, 'signCut').mockRejectedValue(Object.assign(new Error('made up'), { code: 'E_CUT_CLOSED' }));
  await show(<ExamThreshold {...props(world, joined)} said={page.title} room={ROOM} />);
  await press('threshold-none');
  expect(alerts()).toEqual([page.problem.closed]);
  expect(reads).toHaveBeenCalledTimes(2);
  expect(controls('threshold-none')[0].props.disabled).toBe(false);
});

test('a phone the chart does not name, or past the deadline, has no choice', async () => {
  const { world, joined, room, reads } = await stated(() => ({}));
  reads.mockResolvedValueOnce({ rooms: [{ ...room, mine: null }], weeks: null });
  await show(<ExamThreshold {...props(world, joined)} said={page.title} room={ROOM} />);
  expect([texts().includes(page.notSetter), controls('threshold-propose').length]).toEqual([true, 0]);
  await unmount();
  const late = { ...world, date: addDays(world.date, 3) };
  await show(<ExamThreshold {...props(late, joined)} said={page.title} room={ROOM} />);
  expect([texts().includes(page.closed), controls('threshold-none').length]).toEqual([true, 0]);
});

test('says the director’s decisions, an exam no longer shared, and items by their place without the pack', async () => {
  const { world, joined, pack, room, reads } = await stated((_, all) => ({
    settled: { item: all[1], by: 'director' },
    director: true,
  }));
  await show(<ExamThreshold {...props(world, joined)} said={page.title} room={ROOM} />);
  const item = quoted(pack.items[1].title);
  expect([texts().includes(page.state.director.replace('{{item}}', item)), texts().includes(page.closed)]).toEqual([
    true,
    true,
  ]);
  await unmount();
  reads.mockResolvedValue({
    rooms: [{ ...room, state: { ...room.state, settled: { item: null, by: 'director' } } }],
    weeks: null,
  });
  await show(<ExamThreshold {...props(world, joined)} reference={undefined} said={page.title} room={ROOM} />);
  expect(texts()).toEqual(
    expect.arrayContaining([
      page.state.directorNone,
      page.every.replace('{{item}}', quoted(page.itemAt.replace('{{n}}', '2'))),
    ]),
  );
  await unmount();
  await show(<ExamThreshold {...props(world, joined)} said={page.title} room="made-up-room" />);
  expect(texts()).toContain(page.gone);
});

test('going back from the plan’s items forgets the one chosen', async () => {
  const { world, joined } = await stated(() => ({}));
  await show(<ExamThreshold {...props(world, joined)} said={page.title} room={ROOM} />);
  await press('threshold-propose');
  await press('threshold-item', 2);
  expect(controls('threshold-item')[2].props.selected).toBe(true);
  await press('threshold-pick-back');
  await press('threshold-propose');
  expect(controls('threshold-item').some((one) => one.props.selected === true)).toBe(false);
  expect(controls('threshold-propose-sign')[0].props.disabled).toBe(true);
});
