// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Proposing on the teacher's timetable from the school (#579, answer 607),
// against a made-up demo server: the teacher picks a session, a day and a free
// time, writes a note, leaves the room blank, which keeps it, and sends;
// sending is said, aloud in the hidden live region on a PC, the form empties,
// the session says a proposal of it is waiting, and the proposal shows waiting,
// then, read again, declined with the school's note; a session taught to
// several classes together is not offered, and the page says so; and the page's
// words read in every language. Every world, school and teacher is made up.

import type { Day, SchoolJoined, Weekday } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Platform, Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { BELLS, school, sendParts, server, session, setting } from '../jest/timetable-send';
import { nodeKit as kit } from '../jest/world-server';
import { leaveWorldNetwork } from '../src/network/world-network';
import ar from '../src/text/ar.json';
import en from '../src/text/en.json';
import fr from '../src/text/fr.json';
import { decideProposal, readProposals } from '../src/timetable/proposal-session';
import { partFrom } from '../src/timetable/send-session';
import { TeacherTimetable } from '../src/timetable/TeacherTimetable';
import { readTeacherChannel } from '../src/timetable/teacher-session';
import { isolate } from '../src/week/grid-labels';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const words = ar.demo.propose;
const DAYS: readonly Weekday[] = [0, 1, 2, 3, 4];
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
const write = (testID: string, value: string) =>
  act(() =>
    (tree!.root.findAllByProps({ testID })[0].props as { onChangeText: (one: string) => void }).onChangeText(value),
  );

async function render(world: { world: string; date: Day }, join: SchoolJoined) {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        <TeacherTimetable
          world={world}
          join={join}
          kit={kit}
          send={server.send}
          dayText={dayText}
          onClose={() => undefined}
          said={ar.demo.timetable.title}
          workingDays={DAYS}
        />
      </LocaleDirContext.Provider>,
    );
  });
  await act();
}

test('the teacher proposes a move, sees it waiting, then declined with the school’s note', async () => {
  const { id, here, joined } = await setting();
  const world = { world: id, date: here.date };
  const sessions = [session('بلعيد محمد', 1, 600), session('بلعيد محمد', 1, 480), session('بلعيد محمد', 2, 540)];
  await sendParts(here, school, sessions, BELLS);
  const { parts } = await readTeacherChannel(world, joined, kit, server.send);
  const moving = parts[0].part.sessions.find((one) => one.start === 600)!;
  await render(world, joined);
  expect([has('propose-day-2'), has('propose-send')]).toEqual([false, false]);
  await press(`propose-session-${moving.id}`);
  await press('propose-day-2');
  expect(texts()).toContain(`08:00–09:00 · ${words.longer}`);
  await press('propose-day-0');
  expect(texts()).toContain(`08:00–09:00 · ${words.newDay}`);
  await press('propose-day-2');
  await press('propose-slot-480');
  await write('propose-room', ' ');
  await write('propose-note', 'Made-up note');
  await press('propose-send');
  expect([(tree!.root.findByProps({ testID: 'teacher-said' }).props as TextProps).children]).toEqual([words.sent]);
  expect([has('propose-day-2'), has('propose-send')]).toEqual([false, false]);
  await press(`propose-session-${moving.id}`);
  expect(texts()).toContain(words.waitingAlready);
  expect(texts()).toEqual(
    expect.arrayContaining([words.waiting, words.yourNote.replace('{{note}}', isolate('Made-up note')), words.sent]),
  );
  const [waiting] = (await readProposals(here, school, kit, server.send)).waiting;
  expect([waiting.moved?.day, waiting.moved?.start, waiting.moved?.room]).toEqual([2, 480, 'ق1']);
  const choice = { accepted: false, note: 'Made-up reply', from: partFrom(here.date) };
  await decideProposal(here, school, waiting.id, choice, BELLS, kit, server.send);
  await ReactTestRenderer.act(() => tree?.unmount());
  await render(world, joined);
  expect(texts()).toEqual(
    expect.arrayContaining([words.declined, words.reply.replace('{{note}}', isolate('Made-up reply'))]),
  );
});

test('a session taught to several classes together is not offered', async () => {
  const { id, here, joined } = await setting();
  const together = [session('بلعيد محمد', 1, 600, '1م1'), session('بلعيد محمد', 1, 600, '1م2')];
  await sendParts(here, school, [...together, session('بلعيد محمد', 2, 540)], BELLS);
  await render({ world: id, date: here.date }, joined);
  expect(texts()).toContain(words.joint);
  const chips = tree!.root.findAll((node) => /^propose-session-\w+$/u.test(String(node.props.testID)));
  expect(new Set(chips.map((node) => (node.props as { testID: string }).testID)).size).toBe(1);
});

test('the proposing words read in every language', () => {
  for (const one of [en, fr]) {
    expect(Object.keys(one.demo.propose).sort()).toEqual(Object.keys(ar.demo.propose).sort());
    for (const [key, value] of Object.entries(ar.demo.propose)) {
      const places = (text: string) => (text.match(/\{\{\w+\}\}/gu) ?? []).sort();
      const theirs = one.demo.propose[key as keyof typeof one.demo.propose];
      expect([key, places(theirs)]).toEqual([key, places(value)]);
    }
  }
});
