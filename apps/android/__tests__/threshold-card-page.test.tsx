// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The thresholds card on the dashboard page (#603, answer 637), against a
// made-up demo server: the rooms the page's reading opened are counted, all
// awaiting the setters on the figures day, and the card opens the thresholds; a
// failed reading of the rooms is not said; a slower answer is dropped when the
// world's date moves, the rooms read again on it; and a device with no key
// reads no room. The term is filled as a seeded school's is. Every world,
// school and teacher is made up.

import { addDays, worldExams, type Day, type DemoSchool } from '@minhajna/core';
import { Platform } from 'react-native';
import { FakeStorage } from '../jest/fake-storage';
import { filled, server } from '../jest/room-school';
import { act, alerts, press, show, texts, unmount, update } from '../jest/threshold-page';
import { calendar, reference } from '../jest/world-calendar';
import { nodeKit } from '../jest/world-server';
import { DashboardPage } from '../src/director/DashboardPage';
import { leaveWorldNetwork } from '../src/network/world-network';
import { openRecordBook } from '../src/storage/history';
import ar from '../src/text/ar.json';
import { i18n } from '../src/text/i18n';
import * as schoolRooms from '../src/threshold/school-rooms';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const board = ar.demo.dashboard;
const counts = board.thresholdCounts;
const exam = worldExams(calendar.year, calendar.entries).find((one) => one.setBy === 'school')!;
const isRoomsLine = (line: string) =>
  [board.thresholdRooms_zero, board.thresholdRooms_one, board.thresholdRooms_two].includes(line) ||
  [board.thresholdRooms_few, board.thresholdRooms_many].some((form) => line.endsWith(form.replace('{{count}}', '')));

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});

afterEach(async () => {
  await unmount();
  leaveWorldNetwork();
  server.reset();
  jest.restoreAllMocks();
});

const page = (world: Awaited<ReturnType<typeof filled>>['director'], school: DemoSchool, date: Day) => (
  <DashboardPage
    world={{ ...world, date }}
    school={school}
    reference={reference}
    trial={null}
    kit={nodeKit}
    send={server.send}
    dayText={String}
  />
);

test('counts the rooms the reading opened, says no failed reading, and drops a slower answer', async () => {
  const { school, director, desk } = await filled();
  const onPage = jest.fn();
  await show(
    <DashboardPage
      world={{ ...director, date: exam.figuresDay }}
      school={school}
      reference={reference}
      trial={null}
      kit={nodeKit}
      send={server.send}
      dayText={String}
      onPage={onPage}
    />,
  );
  const open = await schoolRooms.readSchoolRooms(
    { ...director, date: exam.figuresDay },
    desk,
    school,
    reference,
    nodeKit,
    server.send,
  );
  const ofExam = open.filter((one) => one.exam.id === exam.id);
  expect(ofExam.length).toBeGreaterThan(1);
  expect(texts()).toEqual(
    expect.arrayContaining([
      i18n.t('demo.dashboard.thresholdRooms', { count: ofExam.length }),
      i18n.t('demo.dashboard.thresholdCounts.signing', { count: ofExam.length }),
      counts.settled_zero,
      counts.none_zero,
      counts.director_zero,
      counts.lapsed_zero,
    ]),
  );
  await press('dashboard-threshold-open');
  expect(onPage).toHaveBeenCalledWith('thresholds');
  await unmount();
  const reading = jest.spyOn(schoolRooms, 'readSchoolRooms').mockRejectedValueOnce(new Error('made-up failure'));
  await show(page(director, school, exam.figuresDay));
  expect([reading.mock.calls.length, alerts(), texts().filter(isRoomsLine)]).toEqual([1, [], []]);
  await unmount();
  let late: (rooms: schoolRooms.SchoolRoom[]) => void = () => undefined;
  reading.mockImplementationOnce(() => new Promise((resolve) => (late = resolve)));
  reading.mockResolvedValueOnce([]);
  await show(page(director, school, exam.figuresDay));
  await update(page(director, school, addDays(exam.figuresDay, 1)));
  await act(() => late(ofExam));
  expect(texts()).toContain(board.thresholdRooms_zero);
  expect(texts()).not.toContain(counts.settled_zero);
}, 180_000);

test('a device with no key reads no room', async () => {
  const { school, director } = await filled();
  const reading = jest.spyOn(schoolRooms, 'readSchoolRooms');
  const bare = { ...director, book: await openRecordBook(new FakeStorage().asSpec()) };
  await show(page(bare, school, exam.figuresDay));
  expect([reading.mock.calls.length, alerts(), texts().filter(isRoomsLine)]).toEqual([0, [], []]);
  expect(texts()).toEqual(expect.arrayContaining([board.noKey, board.threshold]));
}, 180_000);
