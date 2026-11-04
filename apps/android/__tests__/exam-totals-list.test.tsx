// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The way to a directorate exam's totals (#602, answers 634 and 635,
// R-3.3-35, R-7.10-13), on the made-up exams of exam-totals.ts: the reader
// keeps a subject's grades, a hidden grade as null, and refuses one that does
// not read; the exams list offers the totals on the mock exam's card once the
// world's date reaches its figures day, and never on the BEM's; the joined
// pages open them from the list and show nothing without an exam; and their
// words read in every language with the same placeholders. Every school,
// teacher and share is made up.

import { addDays } from '@minhajna/core';
import { Platform } from 'react-native';
import { mockExam, OWN, putShares, items, ROOM } from '../jest/exam-totals';
import { controls, press, show, texts, unmount } from '../jest/threshold-page';
import { server } from '../jest/timetable-send';
import { readTotals } from '../src/directorate/totals-read';
import { leaveWorldNetwork } from '../src/network/world-network';
import { joinedPage } from '../src/school/JoinedPages';
import ar from '../src/text/ar.json';
import en from '../src/text/en.json';
import fr from '../src/text/fr.json';
import { gradeShown } from '../src/threshold/exam-totals';
import { ExamThresholds } from '../src/threshold/ExamThresholds';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const list = ar.demo.thresholds;

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});

afterEach(async () => {
  await unmount();
  jest.restoreAllMocks();
  leaveWorldNetwork();
  server.reset();
});

/** A subject's figure as the server gives one, with nothing hidden, and its grades. */
const figureOf = (grades: unknown) => ({
  teachers: 8,
  schools: 4,
  vacantPosts: 0,
  hoursWithoutTeacher: 0,
  classes: 12,
  cover: 0,
  closed: 0,
  reached: 1,
  runLong: 0,
  grades,
});

/** A send answering one directorate's figures with the grades given. */
const answering = (grades: unknown) => () =>
  Promise.resolve({
    status: 200,
    body: { directorates: [{ id: OWN, all: null, subjects: { math: figureOf(grades) } }] },
  });

test('the reader keeps a subject’s grades, a hidden one as null, and refuses one that does not read', async () => {
  const { id, date } = await mockExam();
  putShares(id, date, 4, () => ({ [items[0]]: 3 }));
  const figures = await readTotals(id, date, OWN, server.send);
  expect(gradeShown(figures, 'math', '4am')).toEqual({ teachers: 8, classes: 12, schools: 4, items: [[items[0], 12]] });
  expect(gradeShown(figures, 'math', '1am')).toBe('notYet');
  const hidden = await readTotals(id, date, OWN, answering({ '4am': null }) as never);
  expect([hidden?.subjects[0][1]?.grades, gradeShown(hidden, 'math', '4am')]).toEqual([[['4am', null]], 'hidden']);
  for (const bad of [{ '4am': 1 }, { '4am': { teachers: 5, classes: 3, schools: 3, items: { x: -1 } } }, []]) {
    await expect(readTotals(id, date, OWN, answering(bad) as never)).rejects.toMatchObject({ code: 'E_WORLD_SERVER' });
  }
});

test('the list offers the mock exam’s totals from its figures day by the world’s date, never the BEM’s', async () => {
  const { date, page } = await mockExam(1, true);
  const onTotals = jest.fn();
  await show(<ExamThresholds {...page} said="" onRoom={jest.fn()} onTotals={onTotals} />);
  expect(controls('thresholds-totals')).toHaveLength(0);
  expect(texts()).toEqual(expect.arrayContaining([list.shows.directorate, list.shows.national]));
  await unmount();
  const moved = { ...page, world: { ...page.world, date: addDays(date, 1) } };
  await show(<ExamThresholds {...moved} said="" onRoom={jest.fn()} onTotals={onTotals} />);
  expect(controls('thresholds-totals')).toHaveLength(1);
  expect(texts()).toEqual(expect.arrayContaining([list.shows.totals, list.shows.national]));
  expect(texts()).not.toContain(list.shows.directorate);
  await press('thresholds-totals');
  expect(onTotals).toHaveBeenCalledWith(ROOM);
});

test('the joined pages open the totals from the list, and nothing without an exam', async () => {
  const { page } = await mockExam();
  const onPage = jest.fn();
  const base = { ...page, year: '2026-2027', dates: null, onJoin: () => undefined, onPage };
  await show(joinedPage({ page: 'thresholds', join: page.join }, { ...base, said: '' })!);
  await press('thresholds-totals');
  expect(onPage).toHaveBeenCalledWith({ page: 'examTotals', join: page.join, room: ROOM, back: 'thresholds' });
  await unmount();
  await show(joinedPage({ page: 'examTotals', join: page.join, room: ROOM }, { ...base, said: '' })!);
  expect(texts()).toContain(ar.demo.examTotals.notYet);
  expect(joinedPage({ page: 'examTotals', join: page.join }, { ...base, said: '' })).toBeNull();
});

test('the totals’ words read in every language, with the same placeholders', () => {
  const entries = (one: object, at = ''): string[] =>
    Object.entries(one).flatMap(([key, value]: [string, unknown]) =>
      typeof value === 'object' && value !== null
        ? entries(value, `${at}${key}.`)
        : [`${at}${key} ${(String(value).match(/\{\{\w+\}\}/gu) ?? []).sort().join(' ')}`],
    );
  const shape = (catalogue: typeof en) =>
    entries({
      ...catalogue.demo.examTotals,
      shown: catalogue.demo.thresholds.shows.totals,
      way: catalogue.demo.thresholds.totals,
    }).sort();
  for (const catalogue of [fr, ar]) expect(shape(catalogue as typeof en)).toEqual(shape(en));
});
