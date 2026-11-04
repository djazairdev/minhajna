// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The thresholds first on the director's dashboard (#603, answer 637): before
// the figures day it names the coming exam and its days and says what each
// teacher sees, with no count; from the figures day it counts that exam's rooms
// by where their cuts stand, leaving out another exam's, and with its rooms not
// read it gives its days alone; a room of an exam moved later is counted before
// the exam's new figures day; an exam this school does not sit is passed over;
// and with no school exam left it says no day is announced. Every world, school
// and setter is made up.

import { addDays, directorSchool, seedNationalWorld, worldExams, type Day, type WorldExam } from '@minhajna/core';
import { Platform } from 'react-native';
import { madeUpRoom } from '../jest/made-up-room';
import { controls, liveRegion, press, show, texts, unmount } from '../jest/threshold-page';
import { calendar, reference } from '../jest/world-calendar';
import { ThresholdCard } from '../src/director/ThresholdCard';
import ar from '../src/text/ar.json';
import { i18n } from '../src/text/i18n';
import { examGroups } from '../src/threshold/exam-charts';
import type { SchoolRoom } from '../src/threshold/school-rooms';
import { examName } from '../src/threshold/threshold-text';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const board = ar.demo.dashboard;
const counts = board.thresholdCounts;
const { zones = [], workingDays } = reference.profile;
const school = directorSchool(seedNationalWorld('a'.repeat(32), zones, workingDays, reference.packs))!;
const exams = worldExams(calendar.year, calendar.entries)
  .filter((one) => one.setBy === 'school' && examGroups(one, school).length > 0)
  .sort((a, b) => (a.from < b.from ? -1 : 1));
const [earlier, latest] = exams;
const dayText = (day: Day) => `day ${day}`;

const card = (date: Day, rooms: readonly SchoolRoom[] | null, onOpen?: () => void) => (
  <ThresholdCard date={date} school={school} reference={reference} rooms={rooms} dayText={dayText} onOpen={onOpen} />
);

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});

afterEach(async () => {
  await unmount();
  jest.restoreAllMocks();
});

test('before the figures day it names the exam, its days and what each teacher sees, and opens the page', async () => {
  const onOpen = jest.fn();
  await show(card(addDays(earlier.figuresDay, -1), [madeUpRoom(latest, 'math')], onOpen));
  const shown = texts();
  expect(shown).toContain(board.thresholdFigures.replace('{{figures}}', dayText(earlier.figuresDay)));
  expect(shown).toContain(board.thresholdTeachers);
  expect(shown).toContain(
    i18n.t('demo.dashboard.thresholdExam', { exam: examName(i18n.t, earlier.id), from: dayText(earlier.from) }),
  );
  expect(shown).not.toContain(counts.settled_zero);
  expect(shown).not.toContain(board.thresholdRooms_zero);
  await press('dashboard-threshold-open');
  expect(onOpen).toHaveBeenCalledTimes(1);
  await unmount();
  await show(card(addDays(earlier.figuresDay, -1), null));
  expect(controls('dashboard-threshold-open')).toHaveLength(0);
});

test('from the figures day it counts the exam’s rooms by where their cuts stand, and no other exam’s', async () => {
  const date = addDays(latest.signBy, 1);
  const room = madeUpRoom(latest, 'math');
  const settled = { ...room, state: { ...room.state, settled: { item: room.chart.items[1], by: 'setters' as const } } };
  const signing = { ...room, state: { ...room.state, director: false } };
  const lapsed = { ...room, chart: { ...room.chart, from: date } };
  const none = { ...room, state: { ...room.state, settled: { item: null, by: 'director' as const } } };
  await show(card(date, [madeUpRoom(earlier, 'math'), settled, none, signing, signing, room, lapsed]));
  expect(liveRegion('dashboard-threshold-counts')).toBe('polite');
  const shown = texts();
  expect(shown).toEqual(
    expect.arrayContaining([
      board.thresholdRooms_few.replace('{{count}}', '6'),
      counts.none_one,
      counts.settled_one,
      counts.signing_two,
      counts.director_one,
      counts.lapsed_one,
    ]),
  );
  expect(shown).not.toContain(board.thresholdTeachers);
});

test('with no school exam left it says no day is announced', async () => {
  const last = exams.at(-1)!;
  await show(card(addDays(last.to, 1), []));
  expect(texts()).toEqual(expect.arrayContaining([board.threshold, board.noThreshold]));
});

test('with its rooms not read it gives the exam’s days alone', async () => {
  const date = addDays(latest.signBy, 1);
  await show(card(date, null));
  const shown = texts();
  expect(shown).toContain(board.thresholdFigures.replace('{{figures}}', dayText(latest.figuresDay)));
  expect(shown.filter((line) => line === counts.settled_zero || line === board.thresholdRooms_zero)).toEqual([]);
  expect(shown).not.toContain(board.thresholdTeachers);
});

test('a room of an exam moved later is counted before its new figures day', async () => {
  const entries = calendar.entries.map((one) =>
    one.from === earlier.from && one.to === earlier.to
      ? { ...one, from: addDays(one.from, 14), to: addDays(one.to, 14) }
      : one,
  );
  const later = { calendar: { ...calendar, entries } };
  const date = addDays(earlier.figuresDay, 1);
  const moved = worldExams(calendar.year, entries).find((one) => one.id === earlier.id)!;
  expect(moved.figuresDay > date).toBe(true);
  await show(
    <ThresholdCard
      date={date}
      school={school}
      reference={later}
      rooms={[{ ...madeUpRoom(earlier, 'math'), exam: moved }]}
      dayText={dayText}
    />,
  );
  expect(texts()).toEqual(expect.arrayContaining([board.thresholdRooms_one, counts.director_one]));
  expect(texts()).not.toContain(board.thresholdTeachers);
});

test('an exam this school does not sit is passed over', async () => {
  const all = worldExams(calendar.year, calendar.entries).filter((one) => one.setBy === 'school');
  const stranger = all.find((one) => examGroups(one, school).length === 0)!;
  const next = exams.find((one) => one.to >= stranger.to)!;
  expect(next.from).not.toBe(stranger.from);
  await show(card(stranger.to, null));
  const named = (exam: WorldExam) => texts().some((line) => line.includes(dayText(exam.from)));
  expect([named(next), named(stranger)]).toEqual([true, false]);
});
