// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The director's visa in a demo world (#585, answer 613), on the made-up term
// of term-weeks.ts: the director gives a visa on a week once, a second is
// refused, the correction takes its own, and the teacher's channel reads both;
// the week page lists the visa it gives and then keeps its button, unpressable,
// as given; a visa given meanwhile is said and the records read again; a
// corrected week offers the visa on the correction, a problem giving it is
// said, and before the week's first day none is offered or given; and the
// teacher's digest shows no visa card before any visa, then lists each visa
// given in the world's week, on that week or an earlier one, original or
// correction, with its week's dates and the line on what a world can prove, and
// leaves out a visa given before the world's week. Every school, class and
// teacher is made up.

import { correctWeek, type DemoSchool } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Platform, Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { DAYS, FIRST, SECOND, signedTerm, SUBJECTS } from '../jest/term-weeks';
import { school, server, STAFF } from '../jest/timetable-send';
import { nodeKit as kit } from '../jest/world-server';
import type { Send } from '../src/demo/world-session';
import { readRecords } from '../src/director/records-session';
import { SchoolRecords } from '../src/director/SchoolRecords';
import { giveVisa } from '../src/director/visa-session';
import { leaveWorldNetwork } from '../src/network/world-network';
import ar from '../src/text/ar.json';
import { isolate } from '../src/week/grid-labels';
import { WeekDigest } from '../src/week/WeekDigest';
import { readSignChannel, signTheWeek } from '../src/week/week-sign-session';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const words = ar.demo.records;
const STAFFED = { ...school, teachers: STAFF } as unknown as DemoSchool;
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

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const texts = () =>
  tree!.root.findAllByType(Text).map((node) => [(node.props as TextProps).children].flat().map(String).join(''));
const has = (testID: string) =>
  tree!.root.findAll((node) => node.props.testID === testID && typeof node.type === 'string').length;

async function act(step: () => void = () => undefined) {
  for (let turn = 0; turn < 60; turn += 1)
    await ReactTestRenderer.act(async () => {
      if (turn === 0) step();
      await settle();
    });
}
const press = (testID: string) =>
  act(() => (tree!.root.findAllByProps({ testID })[0].props as PressableProps).onPress?.({} as never));
const openWeek = () =>
  act(() =>
    (
      tree!.root.findAll((node) => node.props.testID === 'records-week' && node.props.label !== undefined)[0]
        .props as PressableProps
    ).onPress?.({} as never),
  );
const giveButton = () => {
  const found = tree!.root.findAll(
    (node) => node.props.testID === 'record-visa-give' && node.props.label !== undefined,
  );
  const props = found[0]?.props as { label: string; disabled?: boolean } | undefined;
  return props === undefined ? undefined : { label: props.label, disabled: props.disabled === true };
};
const visaLine = (version: string, day: string) =>
  words.visaLine.replace('{{version}}', version).replace('{{day}}', `day ${day}`);

test('the director gives a visa on a week once, then on its correction, and the teacher reads both', async () => {
  const { id, here, joined } = await signedTerm();
  const world = { ...here, world: id, date: SECOND };
  const week = async () => (await readRecords(world, school, kit, server.send))[0].courses[0].weeks[0];
  await giveVisa(world, await week(), kit, server.send);
  await expect(giveVisa(world, await week(), kit, server.send)).rejects.toMatchObject({ code: 'E_WEEK_VISAED' });
  const signed = (await week()).week;
  await signTheWeek(world, joined, correctWeek(signed, signed.sessions[2], 'held', 'other'), kit, server.send);
  await giveVisa(world, await week(), kit, server.send);
  expect((await week()).visas.map((one) => [one.value.version, one.value.day])).toEqual([
    [0, SECOND],
    [1, SECOND],
  ]);
  const { visas } = await readSignChannel(world, joined, kit, server.send);
  expect(visas.map((one) => one.value.version)).toEqual([0, 1]);
});

test('the week page gives the visa, lists it, and keeps its button, unpressable, once given', async () => {
  const { id, here } = await signedTerm();
  await act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        <SchoolRecords
          world={{ ...here, world: id, date: SECOND }}
          school={STAFFED}
          kit={kit}
          send={server.send}
          dayText={(day) => `day ${day}`}
        />
      </LocaleDirContext.Provider>,
    );
  });
  await openWeek();
  expect(texts()).toEqual(expect.arrayContaining([words.visa, words.visaLead, words.visaDemo]));
  expect([has('record-visa-line'), has('record-visa-give')]).toEqual([0, 1]);
  await press('record-visa-give');
  expect(texts()).toEqual(expect.arrayContaining([words.visaDone, visaLine(words.originalName, SECOND)]));
  expect(giveButton()).toEqual({ label: words.visaGiven, disabled: true });
});

test('a visa given meanwhile is said, and the records are read again', async () => {
  const { id, here } = await signedTerm();
  const world = { ...here, world: id, date: SECOND };
  await act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        <SchoolRecords world={world} school={STAFFED} kit={kit} send={server.send} dayText={(day) => `day ${day}`} />
      </LocaleDirContext.Provider>,
    );
  });
  await openWeek();
  await giveVisa(world, (await readRecords(world, school, kit, server.send))[0].courses[0].weeks[0], kit, server.send);
  await press('record-visa-give');
  expect(texts()).toEqual(expect.arrayContaining([words.visaAlready, visaLine(words.originalName, SECOND)]));
  expect(giveButton()?.disabled).toBe(true);
});

async function records(world: Parameters<typeof giveVisa>[0], send = server.send) {
  await act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        <SchoolRecords world={world} school={STAFFED} kit={kit} send={send} dayText={(day) => `day ${day}`} />
      </LocaleDirContext.Provider>,
    );
  });
  await openWeek();
}

test('a corrected week offers the visa on the correction, a problem is said, and none before the week', async () => {
  const { id, here, joined } = await signedTerm();
  const world = { ...here, world: id, date: SECOND };
  const signed = (await readRecords(world, school, kit, server.send))[0].courses[0].weeks[0].week;
  await signTheWeek(world, joined, correctWeek(signed, signed.sessions[2], 'held'), kit, server.send);
  let down = false;
  const send: Send = (request) =>
    down ? Promise.resolve({ status: 503, body: null, retryAfter: null }) : server.send(request);
  await records(world, send);
  expect(giveButton()).toEqual({ label: words.visaGiveFix, disabled: false });
  down = true;
  await press('record-visa-give');
  expect(texts()).toContain(ar.demo.problem.other);
  await ReactTestRenderer.act(() => tree?.unmount());
  down = false;
  await records({ ...world, date: FIRST });
  expect([texts().includes(words.visaEarly), giveButton()]).toEqual([true, undefined]);
  await expect(
    giveVisa(
      { ...world, date: FIRST },
      (await readRecords(world, school, kit, server.send))[0].courses[0].weeks[0],
      kit,
      server.send,
    ),
  ).rejects.toMatchObject({ code: 'E_VISA_EARLY' });
});

const digest = (world: Parameters<typeof giveVisa>[0], joined: Awaited<ReturnType<typeof signedTerm>>['joined']) =>
  act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        <WeekDigest
          world={world}
          join={joined}
          kit={kit}
          send={server.send}
          dayText={(day) => `day ${day}`}
          onClose={() => undefined}
          said={ar.demo.digest.title}
          workingDays={DAYS}
          subjects={SUBJECTS}
          onSign={() => undefined}
        />
      </LocaleDirContext.Provider>,
    );
  });

test('the teacher’s digest lists each visa given this week, on any week, as their access log', async () => {
  const { id, here, joined } = await signedTerm();
  const world = { ...here, world: id, date: SECOND };
  await digest(world, joined);
  expect(has('digest-visas')).toBe(0);
  await ReactTestRenderer.act(() => tree?.unmount());
  const [latest, earlier] = (await readRecords(world, school, kit, server.send))[0].courses[0].weeks;
  await giveVisa(world, earlier, kit, server.send);
  await signTheWeek(world, joined, correctWeek(latest.week, latest.week.sessions[2], 'held'), kit, server.send);
  await giveVisa(world, (await readRecords(world, school, kit, server.send))[0].courses[0].weeks[0], kit, server.send);
  await digest(world, joined);
  const read = ar.demo.digest;
  const line = (dates: string, version: string) =>
    read.visaLine
      .replace('{{course}}', isolate('1م2 · رياضيات'))
      .replace('{{dates}}', dates)
      .replace('{{version}}', version)
      .replace('{{day}}', `day ${SECOND}`);
  const dates = (from: string, to: string) =>
    ar.demo.weekSign.dates.replace('{{from}}', `day ${from}`).replace('{{to}}', `day ${to}`);
  expect(texts()).toEqual(
    expect.arrayContaining([
      read.visas,
      line(dates('2027-01-03', '2027-01-07'), read.visaOriginal),
      line(dates('2027-01-10', '2027-01-14'), read.visaFix.replace('{{number}}', '1')),
      read.visaDemo,
    ]),
  );
});

test('a visa given before the world’s week is left out of the teacher’s digest', async () => {
  const { id, here, joined } = await signedTerm();
  const early = { ...here, world: id, date: FIRST };
  const first = (await readRecords(early, school, kit, server.send))[0].courses[0].weeks.at(-1)!;
  await giveVisa(early, first, kit, server.send);
  expect((await readSignChannel(early, joined, kit, server.send)).visas).toHaveLength(1);
  await digest({ ...early, date: SECOND }, joined);
  expect(has('digest-visas')).toBe(0);
});
