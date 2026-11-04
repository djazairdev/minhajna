// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A directorate exam's totals on the teacher's phone (#602, answers 634 and
// 635, R-3.3-35, R-7.10-02, R-7.10-13), on the made-up exams and shares of
// exam-totals.ts: the page shows the directorate's teachers, classes and
// schools in the subject and grade, and the share of the classes that reached
// each item of the plan in a table, an item fewer than 3 schools reached said
// as held back and one no class reached at 0, with the teacher's own classes
// under it; it reads them again when the world's date moves; it says when the
// totals are not added up yet or hidden under the floors; a problem reading
// them is said, in the live region too, and read again on asking; and an exam
// not on the list, before its figures day, or weeks that do not read each say
// so, and a world with no school shows nothing more. Every school, teacher and
// share is made up.

import { addDays } from '@minhajna/core';
import { Platform } from 'react-native';
import { CLASS, figureFor, items, mockExam, pack, putShares, ROOM } from '../jest/exam-totals';
import { alerts, press, said, show, texts, unmount, update } from '../jest/threshold-page';
import { server } from '../jest/timetable-send';
import type { Send } from '../src/demo/world-session';
import { leaveWorldNetwork } from '../src/network/world-network';
import { problemOf } from '../src/school/school-join-session';
import ar from '../src/text/ar.json';
import { ExamTotals } from '../src/threshold/ExamTotals';
import * as teacherRooms from '../src/threshold/teacher-rooms';
import { roomId } from '../src/threshold/threshold-text';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const words = ar.demo.examTotals;

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});

afterEach(async () => {
  await unmount();
  jest.restoreAllMocks();
  leaveWorldNetwork();
  server.reset();
});

/** How many times the page asked for the totals. */
const asked = () => server.seen.filter((one) => one.path.includes('/totals/')).length;

test('the page shows the directorate’s figures for the subject and grade, and the teacher’s own classes', async () => {
  const { id, date, page } = await mockExam();
  putShares(id, date, 4, (at) => ({ [items[0]]: 3, ...(at < 2 && { [items[1]]: 2 }) }));
  await show(<ExamTotals {...page} said={words.title} room={ROOM} />);
  const counts = words.counts.replace('{{teachers}}', '8').replace('{{classes}}', '12').replace('{{schools}}', '4');
  expect(texts()).toEqual(expect.arrayContaining([counts, words.notes.noCut, words.notes.floors]));
  expect([0, 1, 3].map((at) => figureFor(pack.items[at].title))).toEqual(['100', ar.chart.heldBack, '0']);
  const mine = texts().filter((line) => line.includes(CLASS));
  expect(mine).toHaveLength(1);
  expect(mine[0]).toContain(pack.items[1].title);
  const before = asked();
  const moved = { ...page.world, date: addDays(date, 1) };
  await update(<ExamTotals {...page} world={moved} said={words.title} room={ROOM} />);
  expect([before, asked()]).toEqual([1, 2]);
  expect(texts()).toContain(counts);
});

test('the page says the totals are not added up yet, or hidden under the floors', async () => {
  const { id, date, page } = await mockExam();
  await show(<ExamTotals {...page} said={words.title} room={ROOM} />);
  expect(texts()).toContain(words.notYet);
  await unmount();
  putShares(id, date, 2, () => ({ [items[0]]: 3 }));
  await show(<ExamTotals {...page} said={words.title} room={ROOM} />);
  expect(texts()).toContain(words.hidden);
  expect(texts().some((line) => line.startsWith(words.counts.split('{{')[0]))).toBe(false);
});

test('a problem reading the totals is said and read again on asking', async () => {
  const { id, date, page } = await mockExam();
  putShares(id, date, 4, () => ({ [items[0]]: 3 }));
  let fails = 1;
  const send: Send = (request) =>
    request.path.includes('/totals/') && fails-- > 0
      ? Promise.resolve({ status: 500, body: {}, retryAfter: null })
      : server.send(request);
  await show(<ExamTotals {...page} send={send} said={words.title} room={ROOM} />);
  const key = problemOf(Object.assign(new Error('made up'), { code: 'E_WORLD_SERVER' }));
  const problem = key.split('.').reduce<unknown>((at, part) => (at as Record<string, unknown>)[part], ar);
  expect([alerts(), said('examTotals')]).toEqual([[problem], [problem]]);
  const reads = jest.spyOn(teacherRooms, 'readTeacherExams');
  await press('examTotals-again');
  expect([alerts(), reads.mock.calls.length]).toEqual([[], 0]);
  expect(figureFor(pack.items[0].title)).toBe('100');
});

test('not on the list, before its figures day or weeks not read say so; no school shows nothing', async () => {
  const early = await mockExam(1);
  await show(<ExamTotals {...early.page} said={words.title} room={ROOM} />);
  expect(texts()).toContain(words.gone);
  await unmount();
  const other = roomId({ exam: 'mock', subject: 'arabic', grade: '4am' });
  await show(
    <ExamTotals {...early.page} world={{ ...early.page.world, date: addDays(early.date, 1) }} said="" room={other} />,
  );
  expect(texts()).toContain(words.gone);
  expect(server.seen.some((one) => one.path.includes('/totals/'))).toBe(false);
  await unmount();
  await show(<ExamTotals {...early.page} school={null} said="" room={ROOM} />);
  const shown = texts().filter((line) => line === words.gone || line === words.ownFailed || line.includes(CLASS));
  expect([shown, texts().some((line) => line.startsWith(words.days.split('{{')[0]))]).toEqual([[], false]);
  await unmount();
  jest.spyOn(teacherRooms, 'readTeacherExams').mockResolvedValue({ rooms: [], weeks: null });
  await show(<ExamTotals {...early.page} said="" room={ROOM} />);
  expect(texts()).toContain(words.ownFailed);
});
