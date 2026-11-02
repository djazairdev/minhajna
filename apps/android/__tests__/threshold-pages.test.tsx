// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The teacher's threshold pages (#601, answer 633), on the made-up room of
// cut-room.ts: the exams list names the exam, its days, that no cut is proposed
// and the class's items reached and forecast, as the pack names them, and opens
// the exam's page on its room by a button named with the exam; with no room it
// says none has come; the exam's page shows the chart's table and the item
// every class reached, proposes a cut chosen from the plan, which settles it
// while the phone is the one setter, says it, with the day it was signed, then
// signs no cut, which leaves it to the director; a problem reading is shown,
// said, and read again once however quickly pressed twice; the joined pages
// open both, and a threshold page with no room shows nothing; and the pages'
// words read in every language. Every school, teacher and pack is made up.

import { addDays } from '@minhajna/core';
import type { ButtonProps } from '../src/components/Button';
import { Platform } from 'react-native';
import { openedRoom } from '../jest/cut-room';
import { server, setting, STAFF } from '../jest/timetable-send';
import { act, alerts, controls, press, props, quoted, said, show, texts, unmount } from '../jest/threshold-page';
import { leaveWorldNetwork } from '../src/network/world-network';
import { joinedPage } from '../src/school/JoinedPages';
import ar from '../src/text/ar.json';
import en from '../src/text/en.json';
import fr from '../src/text/fr.json';
import { ExamThreshold } from '../src/threshold/ExamThreshold';
import { ExamThresholds } from '../src/threshold/ExamThresholds';
import * as teacherRooms from '../src/threshold/teacher-rooms';
import { roomId } from '../src/threshold/threshold-text';
import { isolate } from '../src/week/grid-labels';

const [list, page] = [ar.demo.thresholds, ar.demo.threshold];
const ROOM = roomId({ exam: 'term-1', subject: 'math', grade: '1am' });

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

test('lists the room with its days, where its cut stands and each class, and opens it', async () => {
  const { id, date, joined, pack } = await openedRoom();
  const onRoom = jest.fn();
  await show(<ExamThresholds {...props({ world: id, date }, joined)} said={list.title} onRoom={onRoom} />);
  const [, reached, forecast] = pack.items.map((one) => quoted(one.title));
  expect(texts()).toEqual(
    expect.arrayContaining([
      list.days
        .replace('{{from}}', `day ${addDays(date, 7)}`)
        .replace('{{figures}}', `day ${date}`)
        .replace('{{signBy}}', `day ${addDays(date, 2)}`),
      page.state.none,
      list.classLine
        .replace('{{class}}', isolate('1م2'))
        .replace('{{reached}}', reached)
        .replace('{{forecast}}', forecast)
        .replace('{{day}}', `day ${addDays(date, 5)}`),
      list.notes.monthly,
      list.notes.never,
    ]),
  );
  const exam = page.termExam.replace('{{term}}', ar.demo.cover.terms[1]);
  expect(texts().some((one) => one.startsWith(exam))).toBe(true);
  expect((controls('thresholds-open')[0].props as ButtonProps).name).toContain(exam);
  await press('thresholds-open');
  expect(onRoom).toHaveBeenCalledWith(ROOM);
});

test('says so when no room is handed to the phone', async () => {
  const { id, here, joined } = await setting();
  await show(
    <ExamThresholds {...props({ world: id, date: here.date }, joined)} said={list.title} onRoom={jest.fn()} />,
  );
  expect(texts()).toContain(list.empty);
});

test('proposes a cut from the plan, which settles it, then signs no cut, which leaves it to the director', async () => {
  const { id, date, joined, pack } = await openedRoom();
  await show(<ExamThreshold {...props({ world: id, date }, joined)} said={page.title} room={ROOM} />);
  expect(texts()).toEqual(
    expect.arrayContaining([
      page.state.none,
      page.class,
      page.sameView,
      page.every.replace('{{item}}', quoted(pack.items[1].title)),
      page.roomNotes.monthly,
    ]),
  );
  await press('threshold-propose');
  expect(controls('threshold-item').length).toBe(pack.items.length);
  await press('threshold-item', 1);
  await press('threshold-propose-sign');
  const item = quoted(pack.items[1].title);
  const name = isolate(STAFF[0].name);
  expect(said('threshold')).toEqual([page.done.replace('{{item}}', item)]);
  expect(texts()).toEqual(
    expect.arrayContaining([
      page.state.settled.replace('{{item}}', item),
      page.setter.cut.replace('{{name}}', name).replace('{{item}}', item).replace('{{day}}', `day ${date}`),
    ]),
  );
  await press('threshold-none');
  expect(said('threshold')).toEqual([page.noneDone]);
  expect(texts()).toEqual(
    expect.arrayContaining([
      page.state.toDirector,
      page.setter.none.replace('{{name}}', name).replace('{{day}}', `day ${date}`),
    ]),
  );
});

test('a problem reading is shown, said, and read again once', async () => {
  const { id, date, joined } = await openedRoom();
  const reads = jest
    .spyOn(teacherRooms, 'readTeacherRooms')
    .mockRejectedValueOnce(Object.assign(new Error('made up'), { code: 'E_TIMETABLE_UNJOINED' }));
  await show(<ExamThresholds {...props({ world: id, date }, joined)} said={list.title} onRoom={jest.fn()} />);
  expect(alerts()).toEqual([ar.demo.timetable.notJoined]);
  expect(said('thresholds')).toEqual([ar.demo.timetable.notJoined]);
  const again = (controls('thresholds-again')[0].props as { onPress: () => void }).onPress;
  await act(() => {
    again();
    again();
  });
  expect(reads).toHaveBeenCalledTimes(2);
  expect([alerts().length, texts().includes(page.state.none)]).toEqual([0, true]);
});

test('the joined pages open the list and the exam on its room, and nothing without a room', async () => {
  const { id, date, joined } = await openedRoom();
  const onPage = jest.fn();
  const base = { ...props({ world: id, date }, joined), year: '2026-2027', dates: null, onJoin: () => undefined };
  await show(joinedPage({ page: 'thresholds', join: joined }, { ...base, said: list.title, onPage })!);
  await press('thresholds-open');
  expect(onPage).toHaveBeenCalledWith({ page: 'threshold', join: joined, room: ROOM, back: 'thresholds' });
  await unmount();
  const view = { page: 'threshold', join: joined, room: ROOM } as const;
  await show(joinedPage(view, { ...base, said: page.title, onPage })!);
  expect(texts()).toContain(page.state.none);
  const dates = { lastWorkingDay: date } as never;
  expect(joinedPage({ page: 'threshold', join: joined }, { ...base, dates, said: page.title, onPage })).toBeNull();
});

test('the pages’ words read in every language', () => {
  const keys = (one: object): string[] =>
    Object.entries(one).flatMap(([key, value]) =>
      typeof value === 'object' && value !== null ? keys(value as object).map((each) => `${key}.${each}`) : [key],
    );
  for (const catalogue of [fr, en]) {
    expect(keys(catalogue.demo.thresholds).sort()).toEqual(keys(list).sort());
    expect(keys(catalogue.demo.threshold).sort()).toEqual(keys(page).sort());
  }
});
