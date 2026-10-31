// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The director's cover page (#586, answer 614), on a made-up school whose
// standing version holds, on the world's Tuesday, 1م2 at 8 and 9 and 1م3 at 8:
// the day's sessions of the version in force, a later version from its first
// day and one for that day alone, with their free colleagues, the suggestion
// and the class's last; a marked session's teacher and someone covering at that
// time are no longer free, the log counts the colleague chosen, an arrangement
// in which nobody takes the session names nobody, and unmarking counts nothing;
// a colleague taking two sessions at once is to choose again on both; the page
// marks a session, says so, with the line on letting the pupils go, takes a
// colleague and lists it on the sheet and the log, and unmarks it, saying so; a
// cover not kept is said, and a day not read again after keeping is shown with
// a way to read it; a problem reading is said and read again, and without a
// version the page says so; and only the class's last session lets the pupils
// go, while between terms nothing is counted. Every school, class and teacher
// is made up.

import { parseDay, type DemoSchool } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Platform, Text, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { FIRST, MINE } from '../jest/term-weeks';
import { BELLS, school, sendParts, server, session, setting, STAFF } from '../jest/timetable-send';
import { nodeKit as kit } from '../jest/world-server';
import type { Send } from '../src/demo/world-session';
import { markCover, readCover } from '../src/director/cover-session';
import { SchoolCover } from '../src/director/SchoolCover';
import { leaveWorldNetwork } from '../src/network/world-network';
import ar from '../src/text/ar.json';
import { isolate } from '../src/week/grid-labels';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const words = ar.demo.cover;
const STAFFED = { ...school, teachers: STAFF } as unknown as DemoSchool;
const YEAR = MINE.calendar.year;
const [FIRST_T, SECOND_T, THIRD_T] = [STAFF[0].name, STAFF[1].name, STAFF[2].name];
let tree: ReactTestRenderer.ReactTestRenderer | undefined;

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  leaveWorldNetwork();
  server.reset();
  jest.restoreAllMocks();
});

/** A school whose standing version has, on the world's Tuesday, 1م2 at 8 and 9 and 1م3 at 8. */
async function tuesday() {
  const { id, here } = await setting();
  const sessions = [session(FIRST_T, 2, 480), session(SECOND_T, 2, 540), session(THIRD_T, 2, 480, '1م3')];
  await sendParts(here, school, sessions, BELLS);
  return { ...here, world: id, date: FIRST };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const texts = () =>
  tree!.root.findAllByType(Text).map((node) => [(node.props as TextProps).children].flat().map(String).join(''));
const hosts = (testID: string) =>
  tree!.root.findAll((node) => node.props.testID === testID && typeof node.type === 'string');

async function act(step: () => void = () => undefined) {
  for (let turn = 0; turn < 60; turn += 1)
    await ReactTestRenderer.act(async () => {
      if (turn === 0) step();
      await settle();
    });
}
const press = (testID: string, at = 0) =>
  act(() =>
    (
      tree!.root.findAll(
        (node) =>
          node.props.testID === testID && typeof node.props.onPress === 'function' && node.props.label !== undefined,
      )[at].props as { onPress: () => void }
    ).onPress(),
  );

function render(world: Awaited<ReturnType<typeof tuesday>>, send: Send = server.send) {
  return act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        <SchoolCover world={world} school={STAFFED} year={YEAR} kit={kit} send={send} dayText={(day) => `day ${day}`} />
      </LocaleDirContext.Provider>,
    );
  });
}

test('the day’s sessions come from the version in force, with the free colleagues and the class’s last', async () => {
  const world = await tuesday();
  const day = await readCover(world, STAFFED, YEAR, kit, server.send);
  expect(day.term?.number).toBe(2);
  expect(day.sessions.map((one) => [one.session.class, one.session.start, one.last])).toEqual([
    ['1م2', 480, false],
    ['1م2', 540, true],
    ['1م3', 480, true],
  ]);
  const free = (at: number) => day.sessions[at].free.map((one) => one.id);
  expect([free(0), day.sessions[0].suggested]).toEqual([
    ['teacher-2', 'teacher-4', 'teacher-5', 'teacher-6'],
    'teacher-2',
  ]);
  expect(free(1)).toEqual(['teacher-1', 'teacher-3', 'teacher-4', 'teacher-5', 'teacher-6']);
});

test('a marked session’s teacher covers none that day, nor someone already covering at that time', async () => {
  const world = await tuesday();
  const [eight] = (await readCover(world, STAFFED, YEAR, kit, server.send)).sessions;
  await markCover(
    world,
    (await readCover(world, STAFFED, YEAR, kit, server.send)).space,
    eight.id,
    'colleague',
    'teacher-2',
  );
  const day = await readCover(world, STAFFED, YEAR, kit, server.send);
  expect(day.sessions[0].cover).toMatchObject({ arrangement: 'colleague', by: 'teacher-2' });
  expect(day.sessions[1].free.map((one) => one.id)).toEqual(['teacher-3', 'teacher-4', 'teacher-5', 'teacher-6']);
  expect(day.sessions[2].free.map((one) => one.id)).toEqual(['teacher-4', 'teacher-5', 'teacher-6']);
  expect(day.log.map((one) => one.count)).toEqual([0, 1, 0, 0, 0, 0]);
  expect(day.sessions[1].suggested).toBe('teacher-3');
  await markCover(world, day.space, eight.id, 'merge', 'teacher-2');
  expect((await readCover(world, STAFFED, YEAR, kit, server.send)).sessions[0].cover).toMatchObject({ by: null });
  await markCover(world, day.space, eight.id, null);
  const after = await readCover(world, STAFFED, YEAR, kit, server.send);
  expect([after.sessions[0].cover, after.log.every((one) => one.count === 0)]).toEqual([null, true]);
});

test('the page marks a session, takes a colleague, and lists it on the sheet and the log', async () => {
  const world = await tuesday();
  await render(world);
  expect(texts()).toEqual(expect.arrayContaining([words.lead, words.sheetNone, words.sheetNever, words.makeups]));
  expect(hosts('cover-session')).toHaveLength(3);
  await press('cover-mark');
  expect(hosts('cover-marked')).toHaveLength(1);
  const eight = ['08:00–09:00', isolate('1م2'), isolate('رياضيات'), isolate('ق1')].join(' · ');
  expect(texts()).toEqual(expect.arrayContaining([words.markedSaid.replace('{{session}}', eight), words.release]));
  expect(texts()).toContain(
    words.sheetLine
      .replace('{{span}}', '08:00–09:00')
      .replace('{{class}}', isolate('1م2'))
      .replace('{{room}}', isolate('ق1'))
      .replace('{{arrangement}}', words.arrangements.supervision)
      .replace('{{who}}', words.toChoose),
  );
  await press('cover-arrangement-colleague');
  await press('cover-who-teacher-4');
  expect(texts()).toEqual(
    expect.arrayContaining([
      words.logLine.replace('{{name}}', isolate(STAFF[3].name)).replace('{{count}}', '1'),
      words.log.replace('{{term}}', words.terms['2']),
    ]),
  );
  expect(hosts('cover-arrangement-release')).toHaveLength(0);
  await press('cover-mark');
  expect([hosts('cover-marked').length, texts().includes(words.sheetNone)]).toEqual([0, true]);
  expect(texts()).toContain(words.unmarkedSaid.replace('{{session}}', eight));
});

test('a problem reading is said and read again, and without a published version the page says so', async () => {
  const { id, here } = await setting();
  let down = true;
  const send: Send = (request) =>
    down ? Promise.resolve({ status: 503, body: null, retryAfter: null }) : server.send(request);
  await render({ ...here, world: id, date: FIRST }, send);
  expect([texts().includes(ar.demo.problem.other), texts().includes(words.noVersion)]).toEqual([true, false]);
  down = false;
  await press('cover-again');
  expect([texts().includes(ar.demo.problem.other), texts().includes(words.noVersion)]).toEqual([false, true]);
});

test('only the class’s last session lets the pupils go, and between terms no cover is counted', async () => {
  const world = { ...(await tuesday()), date: parseDay('2026-12-29') };
  await render(world);
  expect(texts()).toEqual(expect.arrayContaining([words.noTerm, words.decides]));
  expect(hosts('cover-log-line')).toHaveLength(0);
  await press('cover-mark', 1);
  expect([hosts('cover-arrangement-release').length, texts().includes(words.lastOfDay)]).toEqual([1, true]);
  const who = tree!.root.findAll(
    (node) => String(node.props.testID).startsWith('cover-who-') && node.props.label !== undefined,
  );
  expect(who.slice(0, 2).map((node) => (node.props as { label: string }).label)).toEqual([
    words.nameSuggested.replace('{{name}}', STAFF[0].name),
    STAFF[2].name,
  ]);
  await press('cover-arrangement-release');
  expect(texts()).toContain(
    words.sheetLine
      .replace('{{span}}', '09:00–10:00')
      .replace('{{class}}', isolate('1م2'))
      .replace('{{room}}', isolate('ق1'))
      .replace('{{arrangement}}', words.arrangements.release)
      .replace('{{who}}', words.nobody),
  );
});

test('the day reads the version in force on it: a later one from its first day, one for that day alone', async () => {
  const world = await tuesday();
  const later = [session(FIRST_T, 2, 600)];
  await sendParts(world, school, later, BELLS, server.send, { from: parseDay('2027-01-10'), once: false });
  const starts = async (date: string) =>
    (await readCover({ ...world, date: parseDay(date) }, STAFFED, YEAR, kit, server.send)).sessions.map(
      (one) => one.session.start,
    );
  expect([await starts('2027-01-05'), await starts('2027-01-12')]).toEqual([[480, 540, 480], [600]]);
  await sendParts(world, school, [session(SECOND_T, 2, 660)], BELLS, server.send, { from: FIRST, once: true });
  expect([await starts('2027-01-05'), await starts('2027-01-12')]).toEqual([[660], [600]]);
});

test('a colleague taking two sessions at once is no longer free for either, and the sheet asks to choose', async () => {
  const world = await tuesday();
  const day = await readCover(world, STAFFED, YEAR, kit, server.send);
  await markCover(world, day.space, day.sessions[0].id, 'colleague', 'teacher-4');
  await markCover(world, day.space, day.sessions[2].id, 'study', 'teacher-4');
  const after = await readCover(world, STAFFED, YEAR, kit, server.send);
  expect([after.sessions[0].taken?.id, after.sessions[2].taken?.id, after.sessions[1].taken]).toEqual([
    'teacher-4',
    'teacher-4',
    null,
  ]);
  await render(world);
  expect(texts()).toContain(words.notFree.replace('{{name}}', STAFF[3].name));
  expect(
    hosts('cover-sheet-line').map((node) => [(node.props as TextProps).children].flat().map(String).join('')),
  ).toEqual([expect.stringContaining(words.toChoose), expect.stringContaining(words.toChoose)]);
});

test('a cover not kept is said, and a day not read again is shown with a way to read it', async () => {
  const world = await tuesday();
  let down = false;
  const send: Send = (request) =>
    down ? Promise.resolve({ status: 503, body: null, retryAfter: null }) : server.send(request);
  await render(world, send);
  jest.spyOn(world.book, 'record').mockRejectedValueOnce(new Error('full'));
  await press('cover-mark');
  expect([texts().includes(words.problem), hosts('cover-marked').length]).toEqual([true, 0]);
  leaveWorldNetwork();
  down = true;
  await press('cover-mark');
  expect(texts()).toEqual(expect.arrayContaining([ar.demo.problem.other, ar.demo.weekSign.again]));
});
