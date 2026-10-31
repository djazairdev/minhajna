// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Sending each teacher their part from the director's timetable page (#577,
// answer 605), against a made-up demo server: the card shows under the checks
// once a timetable is read, saying from which day the parts apply; sending says
// how many teachers were sent their part, aloud in the page's hidden live
// region on a PC, and names apart the teacher with no code yet and the one not
// in the staff list, each name isolated, and the teacher's channel holds the
// part; another timetable read clears what was said; a part that did not reach
// the server names its teacher with the problem met, and a name the staff list
// shares is named; the preparer's page has no sending, nor does a page with
// nothing read; a director's device that holds no school key yet says to start
// it on the keys page; and the card's words read in every language. Every
// world, school and person is made up.

import {
  channelStream,
  directorSchool,
  readJoinCode,
  readPart,
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
import * as sendSession from '../src/timetable/send-session';
import { isolate } from '../src/week/grid-labels';
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

const fet = (...teachers: readonly string[]) =>
  '"Activity Id","Day","Hour","Students Sets","Subject","Teachers","Activity Tags","Room","Comments"\n' +
  teachers
    .map((one, at) => `"${at + 1}","Sunday","08:00-09:00","4AM${at + 1}","math","${one}","","R${at + 1}",""\n`)
    .join('');

async function openFile(file: string) {
  await press('tt-source-fet');
  calendarInput.readTable.mockResolvedValueOnce(file);
  await press('tt-open');
}

test('the director sends each teacher their part, and is told who was sent it and who was not', async () => {
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
  expect(shown('tt-send')).toBe(true);
  expect(texts()).toContain(words.title);
  expect(texts().some((one) => one.startsWith(words.line.split('{{day}}')[0]))).toBe(true);
  await press('tt-send-go');
  const sent = words.sent.replace('{{teachers}}', '1');
  expect(texts()).toEqual(
    expect.arrayContaining([
      sent,
      words.noCode,
      isolate(second.name),
      words.notStaff,
      isolate('مختلق غريب'),
      words.again,
    ]),
  );
  expect(shown('tt-send-too-long')).toBe(false);
  expect(said('tt-send-said')).toBe(sent);
  const batches = await spaceBatches(code.world, code.school, server.send);
  const ca = { key: await caKey(code.world, server.send), checker: nodeKit };
  const stream = batches.get(await channelStream(code, nodeKit.mac)) ?? [];
  const part = await readPart(code, stream, ca, null, nodeKit.cipher, nodeKit.mac);
  expect(part?.part).toMatchObject({ teacher: first.name, version: 1 });
  await openFile(fet(second.name));
  expect(shown('tt-send-sent')).toBe(false);
  expect(shown('tt-send-go')).toBe(true);
});

test('a teacher whose part did not reach the server is named with the problem, as are shared names', async () => {
  const school = await enter('director');
  await press('world-page-timetable');
  await openFile(fet(school.teachers[0].name));
  const problem = failed('Made-up offline', 'E_OFFLINE');
  jest.spyOn(sendSession, 'sendParts').mockResolvedValueOnce({
    sent: [],
    noCode: [],
    notStaff: [],
    twoNames: ['Made-up Twin'],
    tooLong: [],
    failed: ['Made-up Teacher'],
    problem,
  });
  await press('tt-send-go');
  expect(texts()).toEqual(
    expect.arrayContaining([
      words.sent.replace('{{teachers}}', '0'),
      words.twoNames,
      '\u2068Made-up Twin\u2069',
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
  await press('tt-send-go');
  expect(texts()).toContain(ar.demo.issue.keysFirst);
  expect(shown('tt-send-sent')).toBe(false);
});

test('the card’s words read in every language', () => {
  for (const one of [ar, en, fr]) {
    expect(Object.keys(one.ttSend).sort()).toEqual(Object.keys(ar.ttSend).sort());
    expect(one.ttSend.line).toContain('{{day}}');
    expect(one.ttSend.sent).toContain('{{teachers}}');
  }
});
