// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The school's exam thresholds in the director's workspace (#603, D-Threshold,
// answer 637), against a made-up demo server: with no room open it says so;
// once the rooms are open it lists the first grade's subjects, none settled,
// and opens the first, marked shown, with no decision before the deadline; once
// the deadline passed unsettled it says when the cut applies and will be
// published, and offers no cut alone, as nothing was proposed, which signs the
// decision, says it and shows the cut decided; after the exam it shows the cut
// as published, and neither of those lines; another grade chosen lists its own
// subjects, its first open; and a problem reading is said with a way to read
// again. The term is filled as a seeded school's is. Every world, school and
// teacher is made up.

import { addDays, worldExams, type Day } from '@minhajna/core';
import { Platform } from 'react-native';
import { filled, server } from '../jest/room-school';
import { alerts, controls, press, show, texts, unmount } from '../jest/threshold-page';
import { calendar, reference } from '../jest/world-calendar';
import { nodeKit } from '../jest/world-server';
import { DirectorThresholds } from '../src/director/DirectorThresholds';
import { subjectName } from '../src/extra/extra-rules';
import { leaveWorldNetwork } from '../src/network/world-network';
import ar from '../src/text/ar.json';
import { openRooms } from '../src/threshold/room-open';
import { readSchoolRooms } from '../src/threshold/school-rooms';
import { gradeName } from '../src/setup/names';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const words = ar.demo.schoolThreshold;
const page = ar.demo.threshold;
const exam = worldExams(calendar.year, calendar.entries).find((one) => one.setBy === 'school')!;

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});

afterEach(async () => {
  await unmount();
  leaveWorldNetwork();
  server.reset();
  jest.restoreAllMocks();
});

test('lists the rooms, decides a cut that fell to the director, and shows it after the exam', async () => {
  const { school, director, desk, records } = await filled();
  const at = (date: Day) => (
    <DirectorThresholds
      world={{ ...director, date }}
      school={school}
      reference={reference}
      kit={nodeKit}
      send={server.send}
      dayText={(day) => `day ${day}`}
    />
  );
  await show(at(exam.figuresDay));
  expect(texts()).toContain(words.none);
  await unmount();
  await openRooms({ ...director, date: exam.figuresDay }, desk, school, records, reference, nodeKit, server.send);
  await show(at(exam.figuresDay));
  const read = await readSchoolRooms(
    { ...director, date: exam.figuresDay },
    desk,
    school,
    reference,
    nodeKit,
    server.send,
  );
  const grades = [...new Set(read.map((one) => one.chart.grade))];
  const namesOf = (grade: string) =>
    read.filter((one) => one.chart.grade === grade).map((one) => subjectName(reference.profile, one.chart.subject));
  const listed = () => controls('schoolThreshold-open').map((one) => (one.props as { name: string }).name);
  const among = (grade: string) => {
    const [first, ...rest] = namesOf(grade);
    const headed = texts().some((line) => line.includes(gradeName(reference.profile, grade)) && line.includes(first));
    return headed && listed().length === rest.length && listed().every((one, at) => one.endsWith(rest[at]));
  };
  expect([texts().includes(words.shown), among(grades[0]), texts().includes(page.state.none)]).toEqual([
    true,
    true,
    true,
  ]);
  expect(controls('schoolThreshold-none')).toHaveLength(0);
  await unmount();
  const due = addDays(exam.signBy, 1);
  await show(at(due));
  expect([controls('schoolThreshold-adopt').length, controls('schoolThreshold-none').length]).toEqual([0, 1]);
  const lines = (key: 'applies' | 'publishes') => texts().some((line) => line.startsWith(words[key].split('{{')[0]));
  expect([lines('applies'), lines('publishes')]).toEqual([true, true]);
  await press('schoolThreshold-none');
  expect(texts()).toEqual(expect.arrayContaining([words.noneDone, page.state.directorNone]));
  expect(controls('schoolThreshold-none')).toHaveLength(0);
  await unmount();
  await show(at(addDays(exam.to, 1)));
  expect(texts()).toEqual(expect.arrayContaining([page.after.cut, page.after.directorNone]));
  expect([lines('applies'), lines('publishes')]).toEqual([false, false]);
  const other = grades.find((one) => one !== grades[0])!;
  const chip = () => controls(`schoolThreshold-grades-${other}`)[0].props as { selected: boolean };
  expect(chip().selected).toBe(false);
  await press(`schoolThreshold-grades-${other}`);
  expect([chip().selected, texts().includes(words.shown), among(other)]).toEqual([true, true, true]);
}, 180_000);

test('a problem reading is said, with a way to read again', async () => {
  const { school, director } = await filled();
  server.busy = true;
  await show(
    <DirectorThresholds
      world={{ ...director, date: exam.figuresDay }}
      school={school}
      reference={reference}
      kit={nodeKit}
      send={server.send}
      dayText={(day) => `day ${day}`}
    />,
  );
  expect(alerts()).toHaveLength(1);
  server.busy = false;
  await press('schoolThreshold-again');
  expect([alerts(), texts().includes(words.none)]).toEqual([[], true]);
}, 180_000);
