// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// D-Exchange (#592, answer 620), against the jest demo server: on a PC the
// drawing kit is handed the map, its eight boxes laid out as the design draws
// them and eleven links, the grant's and the absences' dashed, the absences'
// faint while not sent, and the legend and the lines between the school and
// outside counted; the boxes and lines written out, the devices with the
// school's teacher count, the school's space in the panel first and each item
// chosen showing its own rows; the marks' last row naming the stand-in's latest
// receipt, or that none is received; the absences switch off at first, turning
// on kept in the world's store, opening the absences line's panel, the absences
// line, the map, the count and the interoperability system's facts then naming
// absences, and turning off again; without the school key the switch waits and
// says why; a problem reading receipts shown with a way to read again; on a
// phone no map and no legend; and the page opening from the director's
// workspace, with its link to the keys page. Every world, school, pupil and
// mark here is made up.

import {
  absencesChanges,
  directorSchool,
  latestHeld,
  seedNationalWorld,
  type DemoSchool,
  type SchoolCalendar,
} from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Platform, Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { FakeStorage } from '../jest/fake-storage';
import { FakeWorld } from '../jest/fake-world';
import { server, setting } from '../jest/timetable-send';
import { nodeKit } from '../jest/world-server';
import { DemoRoot } from '../src/demo/DemoRoot';
import type { Send } from '../src/demo/world-session';
import { PUBLIC_KEY_BYTES } from '../src/director/school-desk';
import { SchoolExchange } from '../src/director/SchoolExchange';
import { Drawing, type DrawingKit, type MapSpec } from '../src/drawing/drawing-kit';
import { appreciationList } from '../src/marks/appreciation-rules';
import { assessmentData } from '../src/marks/marks-rules';
import { leaveWorldNetwork } from '../src/network/world-network';
import { bundledReference, readReference } from '../src/reference';
import { sendTermMarks, termSheet } from '../src/school/term-send-session';
import { openRecordBook } from '../src/storage/history';
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
const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{\{(\w+)\}\}/gu, (_, name: string) => String(values[name]));

async function act(step: () => void = () => undefined) {
  for (let turn = 0; turn < 40; turn += 1)
    await ReactTestRenderer.act(async () => {
      if (turn === 0) step();
      await settle();
    });
}
const press = (testID: string) =>
  act(() => (tree!.root.findAllByProps({ testID })[0].props as PressableProps).onPress?.({} as never));
const toggle = () =>
  act(() => {
    const node = tree!.root.findAll(
      (one) => one.props.testID === 'exchange-absences' && typeof one.props.onValueChange === 'function',
    )[0];
    (node.props as { onValueChange: (value: boolean) => void }).onValueChange(!node.props.value);
  });

/** A world whose director's device holds the school key, its school, and a teacher joined. */
async function exchangeWorld() {
  const { id, here, joined, device } = await setting();
  const { zones = [], workingDays } = read.profile;
  const school: DemoSchool = directorSchool(seedNationalWorld(id, zones, workingDays, read.packs))!;
  return { id, here, joined, device, school };
}

async function render(
  world: Parameters<typeof SchoolExchange>[0]['world'],
  school: DemoSchool,
  send: Send = server.send,
  drawing: DrawingKit | null = kit,
) {
  await act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        <Drawing.Provider value={drawing}>
          <SchoolExchange world={world} school={school} send={send} dayText={(day) => `day ${day}`} />
        </Drawing.Provider>
      </LocaleDirContext.Provider>,
    );
  });
}

test('maps what enters and leaves the school, writes it out, and opens each item’s panel', async () => {
  const { here, school } = await exchangeWorld();
  await render(here, school);
  const spec = drawn.at(-1)!;
  expect([spec.label, spec.nodes.length, spec.links.length]).toEqual([words.map, 8, 11]);
  expect(spec.links.filter((one) => one.conditional === true).map((one) => [one.label, one.idle === true])).toEqual([
    [fill(words.onGrant, { line: words.line.grant }), false],
    [words.line.absences, true],
    [words.line.absences, true],
  ]);
  const at = (id: string) => spec.nodes.find((one) => one.id === id)!;
  expect(at('inspector').x < at('space').x && at('space').x < at('directorate').x).toBe(true);
  const down = ['devices', 'space', 'interop', 'sector', 'parents'].map((id) => at(id).y);
  expect(down).toEqual([...down].sort((a, b) => a - b));
  expect(new Set(down).size).toBe(5);
  expect(within('exchange-count')).toEqual([fill(words.count_few, { count: 4 })]);
  expect(tree!.root.findAllByProps({ testID: 'exchange-legend' }).length).toBeGreaterThan(0);
  const items = tree!.root.findAll(
    (node) => /^exchange-item-/u.test(String(node.props.testID)) && typeof node.props.onPress === 'function',
  );
  expect(new Set(items.map((node) => String(node.props.testID))).size).toBe(16);
  const form = new Intl.PluralRules('ar').select(school.teachers.length) as 'few' | 'many';
  const teachers = fill(words[`teachers_${form}`], { count: school.teachers.length });
  expect(within('exchange-item-devices')).toContain(fill(words.sub.devices, { teachers }));
  expect(within('exchange-panel')).toEqual(
    expect.arrayContaining([words.box.space, words.facts.space.a.v, words.facts.space.note]),
  );
  await press('exchange-item-marks');
  expect(within('exchange-panel')).toEqual(expect.arrayContaining([words.line.marks, words.facts.marks.c.vOff]));
  await press('exchange-item-notes');
  expect(within('exchange-panel')).toContain(words.facts.notes.note);
  expect(within('exchange-item-grant')).toContain(fill(words.onGrant, { line: words.line.grant }));
});

test('names the stand-in’s last receipt of marks', async () => {
  const { id, here, joined, school } = await exchangeWorld();
  const data = { assessment: assessmentData(read.profile)!, list: appreciationList(read.profile)! };
  const room = school.classes[0];
  const course = { class: room.name, subject: 'رياضيات', code: 'math' };
  const sheet = termSheet(id, school, course, 1, here.date, data);
  if (sheet.kind !== 'marks') throw new Error(sheet.kind);
  await sendTermMarks({ world: id }, joined, sheet.head, sheet.marks, nodeKit, server.send);
  await render(here, school);
  await press('exchange-item-marks');
  const term = ar.classPlan.term1;
  const day = `day ${here.date}`;
  expect(within('exchange-panel')).toContain(fill(words.facts.marks.c.v, { term, class: isolate(room.name), day }));
});

test('keeps the absences choice, off at first, in the world’s store, and names absences once on', async () => {
  const { here, school } = await exchangeWorld();
  await render(here, school);
  expect(within('exchange-choice')).toContain(words.absencesOff);
  await toggle();
  const chosen = fill(words.onChoice, { line: words.line.absences });
  expect(within('exchange-choice')).toContain(words.absencesOn);
  expect(within('exchange-item-absences')).toContain(chosen);
  expect(within('exchange-panel')).toEqual(expect.arrayContaining([chosen, words.facts.absences.note]));
  expect(drawn.at(-1)!.links.filter((one) => one.label === chosen && one.idle !== true)).toHaveLength(2);
  expect(within('exchange-count')).toEqual([fill(words.count_few, { count: 5 })]);
  await press('exchange-item-interop');
  expect(within('exchange-panel')).toContain(words.facts.interop.b.v);
  const space = latestHeld(here.book.entries, PUBLIC_KEY_BYTES)!.school;
  expect(absencesChanges(here.book.entries, space)).toEqual([{ day: here.date, send: true }]);
  await toggle();
  expect([within('exchange-choice').includes(words.absencesOff), within('exchange-panel')]).toEqual([
    true,
    expect.arrayContaining([fill(words.notSent, { line: words.line.absences }), words.facts.absencesOff.note]),
  ]);
  await press('exchange-item-interop');
  expect(within('exchange-panel')).toContain(words.facts.interop.b.vOff);
});

test('without the school key on this device, the choice waits and says why', async () => {
  const { id, here, school } = await exchangeWorld();
  const other = { world: id, date: here.date, book: await openRecordBook(new FakeStorage().asSpec()) };
  await render(other, school);
  const toggle = tree!.root.findAllByProps({ testID: 'exchange-absences' })[0];
  expect([toggle.props.disabled, within('exchange-choice').includes(words.noKey)]).toEqual([true, true]);
});

test('a problem reading the receipts is shown with a way to read again; a phone has no map', async () => {
  const { here, school } = await exchangeWorld();
  let down = true;
  const send: Send = (request) =>
    down ? Promise.resolve({ status: 503, body: null, retryAfter: null }) : server.send(request);
  await render(here, school, send);
  expect(within('school-exchange')).toContain(ar.demo.problem.other);
  down = false;
  await press('exchange-again');
  expect(within('school-exchange')).not.toContain(ar.demo.problem.other);
  await ReactTestRenderer.act(() => tree?.unmount());
  jest.replaceProperty(Platform, 'OS', 'android');
  drawn.length = 0;
  await render(here, school, server.send, null);
  expect([drawn.length, within('exchange-group-boxes').includes(words.box.space)]).toEqual([0, true]);
  expect(tree!.root.findAllByProps({ testID: 'exchange-legend' })).toHaveLength(0);
});

test('opens from the director’s workspace, and links to the keys page', async () => {
  const teacher = new FakeStorage();
  const calendar: SchoolCalendar = read.calendar;
  await act(() => {
    tree = ReactTestRenderer.create(
      <DemoRoot
        kit={nodeKit}
        calendar={calendar}
        profile={read.profile}
        storage={teacher.asSpec()}
        world={new FakeWorld(teacher).asSpec()}
        send={server.send}
        onBack={() => undefined}
        onLeft={() => undefined}
        reference={read}
      />,
    );
  });
  await press('demo-start-national');
  await press('world-role-director');
  await press('world-page-exchange');
  expect(within('school-exchange')).toContain(words.only);
  await press('exchange-keys');
  expect(tree!.root.findAllByProps({ testID: 'school-keys' }).length).toBeGreaterThan(0);
});
