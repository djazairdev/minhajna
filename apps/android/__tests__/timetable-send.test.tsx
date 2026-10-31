// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Publishing a version of the timetable from the director's timetable page
// (#577, #578, answers 605 and 606), against a made-up demo server: the card
// shows under the checks once a timetable is read; checking drafts the first
// version, with every teacher with a code new and the others named apart, and
// says how many are told; publishing sends the part, says how many were sent it
// and how many were told nothing, aloud in the page's hidden live region on a
// PC, and clears the draft; another reading clears what was said; a second
// version shows what changed from the first and how many others hear nothing,
// and, for one day, offers the school days and publishes a one-day part; a part
// that did not reach the server names its teacher with the problem met, and a
// name the staff list shares is named; the preparer's page has no sending; a
// director's device that holds no school key yet says to start it on the keys
// page; and the card's words read in every language. Every world, school and
// person is made up.

import {
  channelStream,
  directorSchool,
  readJoinCode,
  channelParts,
  type JoinCode,
  seedNationalWorld,
  type DemoSchool,
  type SchoolCalendar,
} from '@minhajna/core';
import { Platform, Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { calendarInput } from '../jest/calendar-input';
import { FakeStorage } from '../jest/fake-storage';
import { FakeWorld } from '../jest/fake-world';
import { DemoServer, nodeKit } from '../jest/world-server';
import { DemoRoot } from '../src/demo/DemoRoot';
import qr from '../src/native/NativeMinhajnaCalendarInput';
import { leaveWorldNetwork, worldNetworkOpen } from '../src/network/world-network';
import { bundledReference, readReference } from '../src/reference';
import { caKey, spaceBatches } from '../src/school/space-read';
import ar from '../src/text/ar.json';
import * as versionSession from '../src/timetable/version-session';
import { isolate } from '../src/week/grid-labels';
import type { SwitchProps } from '../src/components/Switch';
import { failed } from '../src/demo/world-session';
import en from '../src/text/en.json';
import fr from '../src/text/fr.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const read = readReference(bundledReference);
if (!read.ok) throw new Error('The bundled reference does not read');
const reference = read;
const calendar: SchoolCalendar = reference.calendar;
const server = new DemoServer();
const teacher = new FakeStorage();
let world = new FakeWorld(teacher);
let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const words = ar.ttSend;
const version = ar.ttVersion;

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  leaveWorldNetwork();
  server.reset();
  world = new FakeWorld(teacher);
  jest.restoreAllMocks();
  calendarInput.readTable.mockReset();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const texts = () =>
  tree!.root.findAllByType(Text).map((node) => [(node.props as TextProps).children].flat().map(String).join(''));
const shown = (testID: string) => tree!.root.findAllByProps({ testID }).length > 0;
const said = (testID: string) =>
  [(tree!.root.findByProps({ testID }).props as TextProps).children].flat().map(String).join('');

async function press(testID: string) {
  for (let turn = 0; turn < 40; turn += 1)
    await ReactTestRenderer.act(async () => {
      if (turn === 0) (tree!.root.findAllByProps({ testID })[0].props as PressableProps).onPress?.({} as never);
      await settle();
    });
}

/** A national world started on this PC, entered in a role; its seeded school. */
async function enter(role: 'preparer' | 'director'): Promise<DemoSchool> {
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <DemoRoot
        kit={nodeKit}
        calendar={calendar}
        profile={reference.profile}
        storage={teacher.asSpec()}
        world={world.asSpec()}
        send={server.send}
        onBack={() => undefined}
        onLeft={() => undefined}
        reference={reference}
      />,
    );
    await settle();
  });
  await press('demo-start-national');
  await press(`world-role-${role}`);
  const { zones = [], workingDays } = reference.profile;
  return directorSchool(seedNationalWorld(worldNetworkOpen()!, zones, workingDays, reference.packs))!;
}

const fet = (...teachers: readonly (string | readonly [string, string])[]) =>
  '"Activity Id","Day","Hour","Students Sets","Subject","Teachers","Activity Tags","Room","Comments"\n' +
  teachers
    .map((one, at) => {
      const [name, hour] = typeof one === 'string' ? [one, '08:00-09:00'] : one;
      return `"${at + 1}","Sunday","${hour}","4AM${at + 1}","math","${name}","","R${at + 1}",""\n`;
    })
    .join('');

async function openFile(file: string) {
  await press('tt-source-fet');
  calendarInput.readTable.mockResolvedValueOnce(file);
  await press('tt-open');
}

/** The parts a code's channel holds, by version and whether for one day. */
async function partsOn(code: JoinCode) {
  const batches = await spaceBatches(code.world, code.school, server.send);
  const ca = { key: await caKey(code.world, server.send), checker: nodeKit };
  const stream = batches.get(await channelStream(code, nodeKit.mac)) ?? [];
  const parts = await channelParts(code, stream, ca, null, nodeKit.cipher, nodeKit.mac);
  return parts.map((one) => [one.part.teacher, one.part.version, one.part.once]);
}

test('the director checks a version, sees its effect, and publishes it to the teachers it changes', async () => {
  const school = await enter('director');
  await press('world-page-keys');
  await press('keys-start-here');
  await press('world-page-codes');
  const qrRows = jest.spyOn(qr, 'qrRows');
  const [first, second] = school.teachers;
  await press(`issue-row-${first.id}`);
  await press('issue-new-code');
  const code = readJoinCode(qrRows.mock.calls.at(-1)![0])!;
  await press('world-page-timetable');
  expect(shown('tt-send')).toBe(false);
  await openFile(fet(first.name, second.name, 'مختلق غريب'));
  expect(texts()).toEqual(expect.arrayContaining([words.title, version.line]));
  expect(shown('tt-version')).toBe(false);
  await press('tt-send-check');
  const told = (count: number) => version.told.replace('{{teachers}}', String(count));
  expect(texts()).toEqual(
    expect.arrayContaining([version.title.replace('{{version}}', '1'), version.first, told(1), isolate(first.name)]),
  );
  expect(texts()).toEqual(expect.arrayContaining([words.noCode, isolate(second.name), isolate('مختلق غريب')]));
  expect(said('tt-send-said')).toBe(told(1));
  await press('tt-send-go');
  const sent = words.sent.replace('{{teachers}}', '1');
  expect(texts()).toEqual(expect.arrayContaining([sent, version.unchanged.replace('{{teachers}}', '0'), words.again]));
  expect(said('tt-send-said')).toBe(sent);
  expect(shown('tt-version')).toBe(false);
  expect(await partsOn(code)).toEqual([[first.name, 1, false]]);
  await openFile(fet([first.name, '09:00-10:00'], second.name));
  expect(shown('tt-send-sent')).toBe(false);
  await press('tt-send-check');
  expect(texts()).toEqual(
    expect.arrayContaining([version.title.replace('{{version}}', '2'), version.changed.replace('{{version}}', '1')]),
  );
  expect(tree!.root.findAllByProps({ testID: 'tt-version-change' }).length).toBeGreaterThan(0);
  expect(texts()).toContain(version.others.replace('{{teachers}}', '0'));
  await ReactTestRenderer.act(async () => {
    (tree!.root.findAllByProps({ testID: 'tt-send-once' })[0].props as SwitchProps).onValueChange(true);
    await settle();
  });
  expect(texts()).toContain(version.oneDay);
  const chips = tree!.root.findAll((node) => /^tt-send-day-\d/u.test(String(node.props.testID)) && !!node.type);
  const day = String(chips[1].props.testID).slice('tt-send-day-'.length);
  await press(`tt-send-day-${day}`);
  await press('tt-send-go');
  expect(await partsOn(code)).toEqual([
    [first.name, 1, false],
    [first.name, 2, true],
  ]);
});

test('a teacher whose part did not reach the server is named with the problem, as are shared names', async () => {
  const school = await enter('director');
  await press('world-page-timetable');
  await openFile(fet(school.teachers[0].name));
  const named = { noCode: [], notStaff: [], twoNames: ['Made-up Twin'], tooLong: [] };
  const draft = {
    desk: {} as never,
    version: 1,
    standing: null,
    sessions: [],
    changes: [],
    teachers: [],
    ...named,
    unkept: 0,
  };
  jest.spyOn(versionSession, 'draftVersion').mockResolvedValueOnce(draft);
  const problem = failed('Made-up offline', 'E_OFFLINE');
  const result = { sent: [], unchanged: [], failed: ['Made-up Teacher'], problem, ...named };
  jest.spyOn(versionSession, 'publishVersion').mockResolvedValueOnce(result);
  await press('tt-send-check');
  expect(texts()).toEqual(expect.arrayContaining([words.twoNames, '\u2068Made-up Twin\u2069']));
  await press('tt-send-go');
  expect(texts()).toEqual(
    expect.arrayContaining([
      words.sent.replace('{{teachers}}', '0'),
      words.failed,
      '\u2068Made-up Teacher\u2069',
      ar.demo.problem.offline,
    ]),
  );
  expect(said('tt-send-said')).toBe(`${words.sent.replace('{{teachers}}', '0')} ${ar.demo.problem.offline}`);
});

test('the preparer has no sending, and a director with no school key yet is told to start it', async () => {
  await enter('preparer');
  await press('world-page-timetable');
  await openFile(fet('مختلق'));
  expect(shown('timetable-import')).toBe(true);
  expect(shown('tt-send')).toBe(false);
  await ReactTestRenderer.act(() => tree?.unmount());
  leaveWorldNetwork();
  world = new FakeWorld(new FakeStorage());
  const school = await enter('director');
  await press('world-page-timetable');
  await openFile(fet(school.teachers[0].name));
  await press('tt-send-check');
  expect(texts()).toContain(ar.demo.issue.keysFirst);
  expect(shown('tt-version')).toBe(false);
});

test('the card’s words read in every language', () => {
  for (const one of [ar, en, fr]) {
    expect(Object.keys(one.ttSend).sort()).toEqual(Object.keys(ar.ttSend).sort());
    expect(Object.keys(one.ttVersion).sort()).toEqual(Object.keys(ar.ttVersion).sort());
    expect(one.ttSend.sent).toContain('{{teachers}}');
    for (const key of ['title', 'publish', 'changed', 'from'] as const)
      expect(one.ttVersion[key]).toContain('{{version}}');
    for (const key of ['moved', 'room', 'added', 'removed'] as const) expect(one.ttVersion[key]).toContain('{{what}}');
  }
});
