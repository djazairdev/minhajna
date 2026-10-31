// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The end of a substitution on both phones (#588, answer 616), on the made-up
// term of term-weeks.ts with teacher-4 appointed in place of teacher-1 from
// 2027-01-17, their week of 1م2 signed, and the appointment ended on
// 2027-01-24: the holder reads the classes back, 1م2 with the substitute's one
// week and its span and 1م3 with none, the page saying which classes came back
// from which day, whose appointment ended, the weeks as signed, the plan pack,
// pupil list and timetable lines and what never arrives, named after the
// substitute; the substitute's card says the appointment ended, what stops,
// what stays and what reached the holder, the classes' rows, the receipt and
// the access line gone; a class whose return has not all arrived says the
// school sends it again, never that no week was signed; two weeks signed are
// counted in the language's plural forms; with none back the page says so, a
// problem reading is shown, said in the live region and read again once however
// quickly pressed twice; the joined page opens it and its way back returns
// there; and the pages' words read in every language. Every school, class and
// teacher is made up.

import { parseDay, type DemoSchool, type SchoolJoined } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import type { ReactElement } from 'react';
import { Platform, Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { FakeStorage } from '../jest/fake-storage';
import { joinNew, SECOND, sign, signedTerm } from '../jest/term-weeks';
import { BELLS, school, server, STAFF } from '../jest/timetable-send';
import { nodeKit as kit } from '../jest/world-server';
import { endSubstitution, sendReturn } from '../src/director/substitute-end';
import { appoint, readSubstitutes } from '../src/director/substitute-session';
import { leaveWorldNetwork } from '../src/network/world-network';
import { HandoverSchool } from '../src/school/HandoverSchool';
import { joinedPage } from '../src/school/JoinedPages';
import * as returnSession from '../src/school/return-session';
import { readReturns, returnedClasses } from '../src/school/return-session';
import { ReturnSchool } from '../src/school/ReturnSchool';
import { openRecordBook } from '../src/storage/history';
import ar from '../src/text/ar.json';
import en from '../src/text/en.json';
import fr from '../src/text/fr.json';
import { isolate } from '../src/week/grid-labels';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const words = ar.demo.return;
const STAFFED = { ...school, teachers: STAFF } as unknown as DemoSchool;
const BACK = parseDay('2027-01-24');
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

/** Teacher-4 appointed in place of teacher-1 for both classes from 2027-01-17, with their week of 1م2 signed. */
async function appointed() {
  const { id, here, joined: holder } = await signedTerm();
  const device = async () => ({ world: id, date: here.date, book: await openRecordBook(new FakeStorage().asSpec()) });
  const substitute = await joinNew(id, here, device, 'teacher-4');
  const world = { ...here, world: id, date: SECOND };
  const { days } = await readSubstitutes(world, STAFFED, kit, server.send);
  const choice = { holder: 'teacher-1', substitute: 'teacher-4', decision: '2027/015', classes: ['1م2', '1م3'] };
  const { appointment } = await appoint(world, STAFFED, { ...choice, from: days[0] }, BELLS, kit, server.send);
  await sign({ world: id, date: parseDay('2027-01-19') }, substitute, { 0: 'held', 1: 'not-held' });
  return { world, holder, substitute, appointment };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const texts = () =>
  tree!.root.findAllByType(Text).map((node) => [(node.props as TextProps).children].flat().map(String).join(''));
async function act(step: () => void = () => undefined) {
  for (let turn = 0; turn < 80; turn += 1)
    await ReactTestRenderer.act(async () => {
      if (turn === 0) step();
      await settle();
    });
}
const control = (testID: string) =>
  tree!.root.findAll((node) => node.props.testID === testID && node.props.label !== undefined)[0];
const press = (testID: string) => act(() => (control(testID).props as PressableProps).onPress?.({} as never));
const show = (page: ReactElement) =>
  act(() => {
    tree = ReactTestRenderer.create(<LocaleDirContext.Provider value="rtl">{page}</LocaleDirContext.Provider>);
  });
const shown = (world: { world: string; date: string }, join: SchoolJoined, send = server.send) => ({
  world: world as never,
  join,
  kit,
  send,
  dayText: (day: string) => `day ${day}`,
  onClose: () => undefined,
  said: words.title,
});

test('the holder reads the classes back with the weeks the substitute signed, as signed', async () => {
  const { world, holder, appointment } = await appointed();
  await endSubstitution(world, STAFFED, appointment.id, BACK, BELLS, kit, server.send);
  const [read] = await readReturns(world, holder, kit, server.send);
  expect(returnedClasses(read, [0, 1, 2, 3, 4])).toEqual([
    { name: '1م2', count: 1, from: '2027-01-17', to: '2027-01-21', whole: true },
    { name: '1م3', count: 0, from: null, to: null, whole: true },
  ]);
  await show(<ReturnSchool {...shown(world, holder)} />);
  const substitute = isolate(STAFF[3].name);
  expect(texts()).toEqual(
    expect.arrayContaining([
      words.head.replace('{{classes}}', ['1م2', '1م3'].map(isolate).join(' · ')).replace('{{day}}', `day ${BACK}`),
      words.line.replace('{{substitute}}', substitute).replace('{{decision}}', isolate('2027/015')),
      words.weeks
        .replace('{{class}}', isolate('1م2'))
        .replace('{{from}}', 'day 2027-01-17')
        .replace('{{to}}', 'day 2027-01-21')
        .replace('{{weeks}}', words.weekCount_one)
        .replace('{{substitute}}', substitute),
      words.noWeeks.replace('{{class}}', isolate('1م3')),
      words.asSigned,
      words.plan,
      words.pupils,
      words.timetable.replace('{{day}}', `day ${BACK}`),
      words.nevers.notes.replace('{{name}}', substitute),
      words.nevers.reasons,
      words.nevers.before.replace('{{name}}', substitute),
    ]),
  );
});

test('the substitute’s card says it ended, what stops and stays, and what reached the holder', async () => {
  const { world, substitute, appointment } = await appointed();
  await endSubstitution(world, STAFFED, appointment.id, BACK, BELLS, kit, server.send);
  await show(<HandoverSchool {...shown(world, substitute)} said={ar.demo.handover.title} />);
  const ended = ar.demo.handover;
  expect(texts()).toEqual(
    expect.arrayContaining([
      ended.ended.replace('{{day}}', `day ${BACK}`),
      ended.stop.nothing,
      ended.stop.keys,
      ended.stay.record,
      ended.stay.notes,
      ended.reachedLine,
    ]),
  );
  expect([control('handover-add'), texts().includes(ended.ends)]).toEqual([undefined, false]);
  expect(tree!.root.findAll((node) => node.props.testID === 'handover-class')).toEqual([]);
});

test('a return not all there says the school sends it again', async () => {
  const { world, holder, appointment } = await appointed();
  const ended = { ...appointment, ended: BACK };
  await world.book.record(world.date, { kind: 'school.substitution', substitution: ended });
  let puts = 0;
  const cut: typeof server.send = (request) =>
    request.method === 'POST' && request.path.endsWith('/batches') && (puts += 1) > 2
      ? Promise.resolve({ status: 503, body: null, retryAfter: null })
      : server.send(request);
  await expect(sendReturn(world, STAFFED, ended, kit, cut)).rejects.toBeDefined();
  await show(<ReturnSchool {...shown(world, holder)} />);
  expect([
    texts().includes(words.partial.replace('{{class}}', isolate('1م3'))),
    texts().includes(words.noWeeks.replace('{{class}}', isolate('1م3'))),
  ]).toEqual([true, false]);
});

test('with none back the page says so, and a problem reading is shown and read again', async () => {
  const { world, holder } = await appointed();
  let down = true;
  const send: typeof server.send = (request) =>
    down ? Promise.resolve({ status: 503, body: null, retryAfter: null }) : server.send(request);
  await show(<ReturnSchool {...shown(world, holder, send)} />);
  const alerts = () => tree!.root.findAll((node) => node.props.accessibilityRole === 'alert' && node.type === Text);
  expect(alerts().map((node) => (node.props as TextProps).children)).toEqual([ar.demo.problem.other]);
  const said = tree!.root.findAll((node) => node.props.testID === 'return-said' && node.type === Text);
  expect(said.map((node) => (node.props as TextProps).children)).toEqual([ar.demo.problem.other]);
  down = false;
  const reads = jest.spyOn(returnSession, 'readReturns');
  const again = (control('return-again').props as PressableProps).onPress!;
  await act(() => {
    again({} as never);
    again({} as never);
  });
  expect(reads).toHaveBeenCalledTimes(1);
  expect([alerts().length, texts().includes(words.none)]).toEqual([0, true]);
});

test('the joined page opens it, and its way back returns there', async () => {
  const { world, holder } = await appointed();
  const onClose = jest.fn();
  const props = { world, date: world.date, dayText: (day: string) => day, kit, send: server.send, year: '2026-2027' };
  await show(
    joinedPage(
      { page: 'return', join: holder },
      { ...props, said: words.title, dates: null, onClose, onJoin: () => undefined, onPage: () => undefined },
    )!,
  );
  expect(texts()).toContain(words.none);
  await press('return-back');
  expect(onClose).toHaveBeenCalled();
});

test('two weeks signed in the substitution are counted in the language’s plural forms', async () => {
  const { world, holder, substitute, appointment } = await appointed();
  await sign({ world: world.world, date: parseDay('2027-01-26') }, substitute, { 0: 'held' });
  await endSubstitution(world, STAFFED, appointment.id, parseDay('2027-01-31'), BELLS, kit, server.send);
  await show(<ReturnSchool {...shown(world, holder)} />);
  expect(texts()).toContain(
    words.weeks
      .replace('{{class}}', isolate('1م2'))
      .replace('{{from}}', 'day 2027-01-17')
      .replace('{{to}}', 'day 2027-01-28')
      .replace('{{weeks}}', words.weekCount_two)
      .replace('{{substitute}}', isolate(STAFF[3].name)),
  );
});

test('the pages’ words read in every language', () => {
  const keys = (one: object) => Object.keys(one).sort();
  const forms = (one: object) => keys(one).filter((key) => !key.startsWith('weekCount_'));
  for (const catalogue of [fr, en]) {
    expect(forms(catalogue.demo.return)).toEqual(forms(words));
    expect(keys(catalogue.demo.return.nevers)).toEqual(keys(words.nevers));
    for (const part of ['stop', 'stay'] as const)
      expect(keys(catalogue.demo.handover[part])).toEqual(keys(ar.demo.handover[part]));
  }
});
