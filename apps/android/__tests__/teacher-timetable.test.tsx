// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The teacher's timetable from the school (#579, answer 607), opened against a
// made-up demo server: before any part it says the timetable comes once the
// school publishes it; then the first version to come, with its first day and
// the teacher's sessions, and each version received with what it changes;
// confirming a receipt says so, aloud in the hidden live region on a PC, and
// shows the day it was confirmed, and a receipt put is said and shown even when
// reading again fails; a problem is said with a way to read again; the joined
// card opens each of its pages, and what stays and goes on leaving once the
// year's dates read; and the page's words read in every language. Every world,
// school and teacher is made up.

import type { Day, SchoolJoined } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Platform, Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { BELLS, school, sendParts, server, session, setting } from '../jest/timetable-send';
import { nodeKit as kit } from '../jest/world-server';
import { leaveWorldNetwork } from '../src/network/world-network';
import { SchoolJoinedCards } from '../src/school/SchoolJoined';
import ar from '../src/text/ar.json';
import en from '../src/text/en.json';
import fr from '../src/text/fr.json';
import { partFrom } from '../src/timetable/send-session';
import { TeacherTimetable } from '../src/timetable/TeacherTimetable';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const words = ar.demo.timetable;
let tree: ReactTestRenderer.ReactTestRenderer | undefined;

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  leaveWorldNetwork();
  server.reset();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const texts = () =>
  tree!.root.findAllByType(Text).map((node) => [(node.props as TextProps).children].flat().map(String).join(''));
const shown = (testID: string) =>
  tree!.root.findAll((node) => node.type === Text && node.props.testID === testID).length;
const has = (testID: string) => tree!.root.findAllByProps({ testID }).length > 0;
const dayText = (day: Day) => `day ${day}`;

async function act(step: () => void = () => undefined) {
  for (let turn = 0; turn < 40; turn += 1)
    await ReactTestRenderer.act(async () => {
      if (turn === 0) step();
      await settle();
    });
}
const press = (testID: string) =>
  act(() => (tree!.root.findAllByProps({ testID })[0].props as PressableProps).onPress?.({} as never));

async function render(world: { world: string; date: Day }, join: SchoolJoined, send = server.send) {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        <TeacherTimetable
          world={world}
          join={join}
          kit={kit}
          send={send}
          dayText={dayText}
          onClose={() => undefined}
          said={words.title}
        />
      </LocaleDirContext.Provider>,
    );
  });
  await act();
}

test('the teacher sees the version to come and each version received, and confirms its receipt', async () => {
  const { id, here, joined } = await setting();
  const world = { world: id, date: here.date };
  await render(world, joined);
  expect(texts()).toContain(words.none);
  await ReactTestRenderer.act(() => tree?.unmount());
  await sendParts(here, school, [session('بلعيد محمد', 1, 600), session('بلعيد محمد', 2, 540)], BELLS);
  await sendParts(here, school, [session('بلعيد محمد', 1, 540), session('بلعيد محمد', 2, 540)], BELLS);
  await render(world, joined);
  const sunday = dayText(partFrom(here.date));
  expect(texts()).toEqual(
    expect.arrayContaining([
      words.notYet.replace('{{version}}', '2').replace('{{day}}', sunday),
      words.from.replace('{{version}}', '2').replace('{{day}}', sunday),
      words.fromChanges.replace('{{day}}', sunday),
      words.hoursSame.replace('{{hours}}', ar.count.hours_two),
      words.whole.replace('{{sessions}}', '2'),
    ]),
  );
  expect(shown('teacher-session')).toBe(2);
  expect(shown('teacher-change')).toBe(1);
  expect([has('teacher-confirm'), shown('teacher-confirmed')]).toEqual([true, 0]);
  await press('teacher-confirm');
  const done = words.done.replace('{{version}}', '2');
  expect([(tree!.root.findByProps({ testID: 'teacher-said' }).props as TextProps).children]).toEqual([done]);
  expect(texts()).toContain(words.confirmed.replace('{{day}}', dayText(here.date)));
  expect([has('teacher-confirm'), shown('teacher-confirmed')]).toEqual([true, 1]);
});

test('a receipt put is said and shown even when reading again fails', async () => {
  const { id, here, joined } = await setting();
  await sendParts(here, school, [session('بلعيد محمد', 1, 600, '1م2')], BELLS);
  let put = false;
  const failing = async (request: Parameters<typeof server.send>[0]) => {
    if (put && request.method === 'GET') return { status: 503, body: null, retryAfter: null };
    const answer = await server.send(request);
    if (request.method === 'POST' && request.path.endsWith('/batches') && answer.status === 201) put = true;
    return answer;
  };
  await render({ world: id, date: here.date }, joined, failing);
  await press('teacher-confirm');
  const done = words.done.replace('{{version}}', '1');
  expect(texts()).toEqual(expect.arrayContaining([done, ar.demo.problem.other]));
  expect(has('teacher-again')).toBe(true);
});

test('a problem is said, with a way to read again', async () => {
  const { id, here, joined } = await setting();
  const offline = () => Promise.resolve({ status: 503, body: null, retryAfter: null });
  await render({ world: id, date: here.date }, joined, offline);
  expect(texts()).toContain(ar.demo.problem.other);
  expect(has('teacher-again')).toBe(true);
});

test('the joined card opens each of its pages, and what stays on leaving once the year’s dates read', async () => {
  const { joined } = await setting();
  const opened: [string, SchoolJoined][] = [];
  const cards = (canLeave: boolean) =>
    ReactTestRenderer.act(() => {
      tree?.unmount();
      tree = ReactTestRenderer.create(
        <LocaleDirContext.Provider value="rtl">
          <SchoolJoinedCards
            joins={[joined]}
            dayText={dayText}
            onOpen={(page) => (join) => opened.push([page, join])}
            canLeave={canLeave}
          />
        </LocaleDirContext.Provider>,
      );
    });
  await cards(false);
  expect(tree!.root.findAll((node) => node.props.testID === 'school-leave-open')).toEqual([]);
  const pages = ['week', 'digest', 'mine', 'handover', 'return', 'timetable', 'devices', 'help'];
  for (const page of pages) await press(`school-${page}`);
  await cards(true);
  await press('school-leave-open');
  expect(opened).toEqual([...pages, 'leave'].map((page) => [page, joined]));
  expect(texts()).toContain(ar.demo.weekSign.reminder);
});

test('the page’s words read in every language', () => {
  for (const one of [en, fr]) {
    expect(Object.keys(one.demo.timetable).sort()).toEqual(Object.keys(ar.demo.timetable).sort());
    for (const [key, value] of Object.entries(ar.demo.timetable)) {
      const places = (text: string) => (text.match(/\{\{\w+\}\}/gu) ?? []).sort();
      const theirs = one.demo.timetable[key as keyof typeof one.demo.timetable];
      expect([key, places(theirs)]).toEqual([key, places(value)]);
    }
  }
});
