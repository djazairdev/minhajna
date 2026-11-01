// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// More of D-Exchange (#592, answer 620), against the jest demo server: left
// to right the map is mirrored, the inspector and the directorate swapping
// sides and the lines between the same boxes standing the other way; the item
// chosen is the current one on a PC and the selected one on a phone; of two
// receipts of marks the latest is named; a choice not kept is said under the
// switch and changes nothing; two presses at once keep one choice; and My log
// lists turning absences on and off. Every world, school, pupil and mark here
// is made up.

import { directorSchool, seedNationalWorld, type DemoSchool } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Platform, Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { server, setting } from '../jest/timetable-send';
import { nodeKit } from '../jest/world-server';
import { Drawing, type DrawingKit, type MapSpec } from '../src/drawing/drawing-kit';
import { OwnLog } from '../src/director/OwnLog';
import { SchoolExchange, type SchoolExchangeProps } from '../src/director/SchoolExchange';
import { appreciationList } from '../src/marks/appreciation-rules';
import { assessmentData } from '../src/marks/marks-rules';
import { leaveWorldNetwork } from '../src/network/world-network';
import { bundledReference, readReference } from '../src/reference';
import { sendTermMarks, termSheet } from '../src/school/term-send-session';
import ar from '../src/text/ar.json';
import { isolate } from '../src/week/grid-labels';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const result = readReference(bundledReference);
if (!result.ok) throw new Error('The bundled reference does not read');
const read = result;
const words = ar.demo.exchange;
const drawn: MapSpec[] = [];
const kit: DrawingKit = {
  Chart: () => null,
  Map: ({ spec }) => {
    drawn.push(spec);
    return null;
  },
};
let tree: ReactTestRenderer.ReactTestRenderer | undefined;

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
  drawn.length = 0;
});

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  leaveWorldNetwork();
  server.reset();
  jest.restoreAllMocks();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const within = (testID: string) =>
  tree!.root
    .findAllByProps({ testID })[0]
    .findAllByType(Text)
    .map((node) => [(node.props as TextProps).children].flat().map(String).join(''));
const item = (id: string) =>
  tree!.root.findAll(
    (node) => node.props.testID === `exchange-item-${id}` && typeof node.props.onPress === 'function',
  )[0];
const choose = (...values: boolean[]) =>
  act(() => {
    const node = tree!.root.findAll(
      (one) => one.props.testID === 'exchange-absences' && typeof one.props.onValueChange === 'function',
    )[0];
    for (const value of values) (node.props as { onValueChange: (on: boolean) => void }).onValueChange(value);
  });

async function act(step: () => void = () => undefined) {
  for (let turn = 0; turn < 40; turn += 1)
    await ReactTestRenderer.act(async () => {
      if (turn === 0) step();
      await settle();
    });
}

async function exchangeWorld() {
  const { id, here, joined } = await setting();
  const { zones = [], workingDays } = read.profile;
  const school: DemoSchool = directorSchool(seedNationalWorld(id, zones, workingDays, read.packs))!;
  return { id, here, joined, school };
}

async function render(props: Omit<SchoolExchangeProps, 'dayText'>, direction: 'rtl' | 'ltr' = 'rtl') {
  await act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={direction}>
        <Drawing.Provider value={kit}>
          <SchoolExchange {...props} dayText={(day) => `day ${day}`} />
        </Drawing.Provider>
      </LocaleDirContext.Provider>,
    );
  });
}

test('left to right the map is mirrored, sides and lanes alike', async () => {
  const { here, school } = await exchangeWorld();
  await render({ world: here, school, send: server.send });
  const rtl = drawn.at(-1)!;
  await ReactTestRenderer.act(() => tree?.unmount());
  await render({ world: here, school, send: server.send }, 'ltr');
  const ltr = drawn.at(-1)!;
  const x = (spec: MapSpec, id: string) => spec.nodes.find((one) => one.id === id)!.x;
  expect([x(rtl, 'inspector') < x(rtl, 'directorate'), x(ltr, 'inspector') > x(ltr, 'directorate')]).toEqual([
    true,
    true,
  ]);
  for (const boxes of ['interop,space', 'devices,space']) {
    const lanes = (spec: MapSpec) =>
      spec.links.filter((one) => [one.from, one.to].sort().join() === boxes).map((one) => one.label);
    expect(lanes(ltr)).toEqual([...lanes(rtl)].reverse());
  }
});

test('the item chosen is the current one on a PC and the selected one on a phone', async () => {
  const { here, school } = await exchangeWorld();
  await render({ world: here, school, send: server.send });
  await act(() => (item('marks').props as PressableProps).onPress?.({} as never));
  expect([item('marks').props['aria-current'], item('space').props['aria-current']]).toEqual(['true', undefined]);
  await ReactTestRenderer.act(() => tree?.unmount());
  jest.replaceProperty(Platform, 'OS', 'android');
  await render({ world: here, school, send: server.send });
  expect([item('space').props.accessibilityState, item('marks').props.accessibilityState]).toEqual([
    { selected: true },
    { selected: false },
  ]);
});

test('of two receipts of marks, the latest is named', async () => {
  const { id, here, joined, school } = await exchangeWorld();
  const data = { assessment: assessmentData(read.profile)!, list: appreciationList(read.profile)! };
  for (const room of school.classes.slice(0, 2)) {
    const course = { class: room.name, subject: 'رياضيات', code: 'math' };
    const sheet = termSheet(id, school, course, 1, here.date, data);
    if (sheet.kind !== 'marks') throw new Error(sheet.kind);
    await sendTermMarks({ world: id }, joined, sheet.head, sheet.marks, nodeKit, server.send);
  }
  await render({ world: here, school, send: server.send });
  await act(() => (item('marks').props as PressableProps).onPress?.({} as never));
  const latest = { term: ar.classPlan.term1, class: isolate(school.classes[1].name), day: `day ${here.date}` };
  const named = words.facts.marks.c.v.replace(/\{\{(\w+)\}\}/gu, (_, name: keyof typeof latest) => latest[name]);
  expect(within('exchange-panel')).toContain(named);
});

test('a choice not kept is said under the switch; two presses at once keep one choice', async () => {
  const { here, school } = await exchangeWorld();
  const down = new Proxy(here.book, {
    get: (book, key) =>
      key === 'record' ? () => Promise.reject(new Error('made-up failure')) : (Reflect.get(book, key) as unknown),
  });
  await render({ world: { ...here, book: down }, school, send: server.send });
  await choose(true);
  expect([within('exchange-not-kept'), within('exchange-choice').includes(words.absencesOff)]).toEqual([
    [ar.demo.problem.other],
    true,
  ]);
  await ReactTestRenderer.act(() => tree?.unmount());
  await render({ world: here, school, send: server.send });
  const before = here.book.entries.length;
  await choose(true, true);
  expect([here.book.entries.length - before, tree!.root.findAllByProps({ testID: 'exchange-not-kept' })]).toEqual([
    1,
    [],
  ]);
});

test('My log lists turning absences on and off', async () => {
  const { here, school } = await exchangeWorld();
  await render({ world: here, school, send: server.send });
  await choose(true);
  await choose(false);
  await ReactTestRenderer.act(() => tree?.unmount());
  await act(() => {
    tree = ReactTestRenderer.create(
      <OwnLog world={here} school={school} role="director" kit={nodeKit} dayText={(day) => `day ${day}`} />,
    );
  });
  const rows = tree!.root
    .findAll((node) => /^own-log-row-/u.test(String(node.props.testID)) && node.type === Text)
    .map((node) => [(node.props as TextProps).children].flat().map(String).join(''));
  const { absencesOn, absencesOff } = ar.demo.ownLog.line;
  expect([rows.some((one) => one.includes(absencesOn)), rows.some((one) => one.includes(absencesOff))]).toEqual([
    true,
    true,
  ]);
});
