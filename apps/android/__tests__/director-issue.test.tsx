// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// D-Issue in a national demo world (#570, answers 596 to 598), against a
// made-up demo server: once D-Keys started the school key on the director's PC
// (answer 601), the codes page holds it, lists the school in its directorate's
// space (#593), which D-Keys and a refresh put back when pointed elsewhere, and
// lists every seeded teacher in a table, by subject then name, none with a code
// yet, with the chips' counts and the lines under the table; a teacher's panel
// gives a new code, whose QR is the joining code of this world and school,
// waiting until its last valid day; cancelling it gives the next at once; the
// waiting chip shows the codes waiting and how many; printing one code or every
// code waiting prints the sheet, and a failed print is said; a security key
// instead shows its number and counts under its chip, which shows it alone, and
// replacing it gives another number; a teacher who joins on their code is read
// back on refresh; a busy server is said and keeps the rows; an expired code
// says its last day and a key joined its number. On a phone the teachers are
// lines and nothing prints, an issue the store did not keep and a code that
// cannot be worked out are said, and no QR shows. Every world, school and
// person is made up.

import {
  addDays,
  directorSchool,
  parseDay,
  readJoinCode,
  seedNationalWorld,
  type DemoSchool,
  type SchoolCalendar,
} from '@minhajna/core';
import { Platform, Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { FakeStorage } from '../jest/fake-storage';
import { FakeWorld } from '../jest/fake-world';
import { listedAs, schools } from '../jest/grant-world';
import { DemoServer, nodeKit } from '../jest/world-server';
import { DemoRoot } from '../src/demo/DemoRoot';
import { failed, startWorld } from '../src/demo/world-session';
import { personName } from '../src/director/dashboard-text';
import { IssueCodes } from '../src/director/IssueCodes';
import { listSchool } from '../src/director/school-listing';
import * as issueSession from '../src/director/issue-session';
import { statusText } from '../src/director/issue-text';
import { subjectName } from '../src/extra/extra-rules';
import qr from '../src/native/NativeMinhajnaCalendarInput';
import pdf from '../src/native/NativeMinhajnaPdf';
import { leaveWorldNetwork, worldNetworkOpen } from '../src/network/world-network';
import { bundledReference, readReference } from '../src/reference';
import { joinSchool } from '../src/school/school-join-session';
import { openRecordBook } from '../src/storage/history';
import text from '../src/text/ar.json';

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
let printHtml: jest.SpiedFunction<typeof pdf.printHtml>;
let qrRows: jest.SpiedFunction<typeof qr.qrRows>;
const words = text.demo.issue;

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
  printHtml = jest.spyOn(pdf, 'printHtml');
  qrRows = jest.spyOn(qr, 'qrRows');
});

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  leaveWorldNetwork();
  server.reset();
  world = new FakeWorld(teacher);
  jest.restoreAllMocks();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const texts = () =>
  tree!.root.findAllByType(Text).map((node) => [(node.props as TextProps).children].flat().map(String).join(''));
const has = (testID: string) => tree!.root.findAllByProps({ testID }).length > 0;
const rows = () => [
  ...new Set(
    tree!.root
      .findAll((node) => /^issue-row-/u.test(String(node.props.testID)) && !!node.type)
      .map((node) => String(node.props.testID).slice('issue-row-'.length)),
  ),
];
const codes = () => qrRows.mock.calls.map(([one]) => one);

async function press(testID: string) {
  for (let turn = 0; turn < 40; turn += 1)
    await ReactTestRenderer.act(async () => {
      if (turn === 0) (tree!.root.findAllByProps({ testID })[0].props as PressableProps).onPress?.({} as never);
      await settle();
    });
}

/** A national world started on this device, its director's codes page open. */
async function codesPage(): Promise<{ id: string; school: DemoSchool }> {
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
  await press('world-role-director');
  await press('world-page-keys');
  await press('keys-start-here');
  await press('world-page-codes');
  const id = worldNetworkOpen()!;
  const { zones = [], workingDays } = reference.profile;
  return { id, school: directorSchool(seedNationalWorld(id, zones, workingDays, reference.packs))! };
}

const nameOf = (school: DemoSchool, id: string) => personName(school.teachers.find((one) => one.id === id)!);

test('the codes page lists every teacher without a code, then gives, cancels and prints codes', async () => {
  const { id, school } = await codesPage();
  expect(has('issue-table')).toBe(true);
  const [space] = [...(await schools(id, school.directorateId, server.send)).listed.values()];
  expect(await listedAs(id, school, space, server.send)).toBe(space);
  await listSchool(id, school, 'another-made-up-space-id', nodeKit, server.send);
  await press('world-page-keys');
  expect(await listedAs(id, school, space, server.send)).toBe(space);
  await press('world-page-codes');
  await listSchool(id, school, 'another-made-up-space-id', nodeKit, server.send);
  await press('issue-refresh');
  expect(await listedAs(id, school, space, server.send)).toBe(space);
  const collator = new Intl.Collator('ar');
  const subject = (code: string) => subjectName(reference.profile, code);
  const ordered = [...school.teachers].sort(
    (one, other) =>
      collator.compare(subject(one.subject), subject(other.subject)) ||
      collator.compare(personName(one), personName(other)),
  );
  expect(rows()).toEqual(ordered.map((one) => one.id));
  const all = school.teachers.length;
  expect(texts()).toEqual(
    expect.arrayContaining([
      words.chip.all.replace('{{number}}', String(all)),
      words.chip.phone.replace('{{number}}', String(all)),
      words.chip.key.replace('{{number}}', '0'),
      words.order.replace('{{shown}}', String(all)).replace('{{all}}', String(all)),
      words.noPassword,
      words.noSignIn,
    ]),
  );
  expect(texts().filter((one) => one === words.status.none)).toHaveLength(all);
  expect(has('issue-print-waiting')).toBe(true);
  const [first, second] = rows();
  await press(`issue-row-${first}`);
  expect(texts()).toContain(nameOf(school, first));
  await press('issue-new-code');
  const [code] = codes();
  expect(readJoinCode(code)).toMatchObject({ world: id, issue: 1 });
  expect(has('issue-qr')).toBe(true);
  const waiting = words.status.waiting.split('{{day}}')[0];
  expect(texts().filter((one) => one.startsWith(waiting))).toHaveLength(1);
  await press('issue-cancel');
  expect(readJoinCode(codes().at(-1)!)).toMatchObject({ world: id, issue: 2 });
  expect(texts().filter((one) => one.startsWith(waiting))).toHaveLength(1);
  await press('issue-print-code');
  expect(printHtml).toHaveBeenCalledTimes(1);
  const [html, title] = printHtml.mock.calls[0];
  expect(html).toContain(nameOf(school, first));
  expect(html).toContain('<svg');
  expect(title).toBe(words.sheet.title);
  await press(`issue-row-${second}`);
  await press('issue-new-code');
  await press('issue-filter-waiting');
  expect(rows()).toEqual([first, second]);
  expect(texts()).toContain(words.order.replace('{{shown}}', '2').replace('{{all}}', String(all)));
  await press('issue-filter-all');
  await press('issue-print-waiting');
  const sheet = printHtml.mock.calls[1][0];
  for (const one of [first, second]) expect(sheet).toContain(nameOf(school, one));
  expect(sheet.split('<svg').length - 1).toBe(2);
  printHtml.mockRejectedValueOnce(new Error('made-up failure'));
  await press('issue-print-waiting');
  expect(texts()).toContain(text.demo.problem.other);
});

test('an expired code says its last day, and a key joined says its number', () => {
  const day = parseDay('2026-10-20');
  const issue = { school: 's', assignment: 'a', issue: 1, epoch: 0, access: 'phone' as const, keyNumber: null, day };
  const row = { teacher: {} as never, assignment: 'a', access: 'phone' as const, keyNumber: null, issue };
  const words = jest.fn((key: string, values?: object) => `${key} ${JSON.stringify(values ?? {})}`);
  statusText(words as never, { ...row, status: { kind: 'expired', until: addDays(day, 7) } }, String);
  expect(words).toHaveBeenLastCalledWith('demo.issue.status.expired', { until: '2026-10-27' });
  const keyed = { ...row, access: 'key' as const, keyNumber: '0042' };
  statusText(words as never, { ...keyed, status: { kind: 'joined', on: day } }, String);
  expect(words).toHaveBeenLastCalledWith('demo.issue.status.keyJoined', { day: '2026-10-20', number: '0042' });
});

test('a key instead counts under its chip, and a teacher who joins is read back on refresh', async () => {
  const { id, school } = await codesPage();
  const [first, second] = rows();
  await press(`issue-row-${first}`);
  await press('issue-key-instead');
  const keyLine = texts().find((one) => one.startsWith(words.status.keyWaiting.split('{{number}}')[0]));
  expect(keyLine).toMatch(/\d{4}/u);
  expect(has('issue-replace-key')).toBe(true);
  expect(texts()).toContain(words.chip.key.replace('{{number}}', '1'));
  await press('issue-replace-key');
  const replaced = texts().find((one) => one.startsWith(words.status.keyWaiting.split('{{number}}')[0]));
  expect(replaced).toMatch(/\d{4}/u);
  expect(replaced).not.toBe(keyLine);
  expect(texts()).toContain(words.chip.key.replace('{{number}}', '1'));
  await press('issue-filter-key');
  expect(rows()).toEqual([first]);
  await press('issue-filter-all');
  await press(`issue-row-${second}`);
  await press('issue-new-code');
  const code = codes().at(-1)!;
  const phone = {
    world: id,
    date: parseDay(server.worlds.get(id)!.date),
    book: await openRecordBook(new FakeStorage().asSpec()),
  };
  const joined = await joinSchool(phone, code, nodeKit, server.send);
  expect(joined.certificate.issued).toBe(phone.date);
  await press('issue-refresh');
  const joinedLine = words.status.joined.split('{{day}}')[0];
  expect(texts().filter((one) => one.startsWith(joinedLine))).toHaveLength(1);
  expect(has('issue-cancel')).toBe(false);
  expect(has('issue-new-code')).toBe(true);
  server.busy = true;
  await press('issue-refresh');
  expect(texts()).toContain(text.demo.problem.busy);
  expect(rows()).toHaveLength(school.teachers.length);
});

test('on a phone the teachers are lines and nothing prints', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const started = await startWorld('national', calendar, nodeKit, server.send);
  const id = started.keys.world;
  const { zones = [], workingDays } = reference.profile;
  const school = directorSchool(seedNationalWorld(id, zones, workingDays, reference.packs))!;
  const open = { world: id, date: started.date, book: await openRecordBook(new FakeStorage().asSpec()) };
  await issueSession.holdSchool(open, nodeKit, server.send);
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <IssueCodes
        world={open}
        school={school}
        profile={reference.profile}
        kit={nodeKit}
        send={server.send}
        dayText={String}
      />,
    );
    await settle();
  });
  for (let turn = 0; turn < 40; turn += 1)
    await ReactTestRenderer.act(async () => {
      await settle();
    });
  expect(has('issue-table')).toBe(false);
  expect(has('issue-print-waiting')).toBe(false);
  expect(rows()).toHaveLength(school.teachers.length);
  const [first] = rows();
  await press(`issue-row-${first}`);
  await press('issue-new-code');
  expect(has('issue-qr')).toBe(true);
  expect(has('issue-print-code')).toBe(false);
  jest.spyOn(open.book, 'record').mockRejectedValueOnce(new Error('made-up failure'));
  await press('issue-cancel');
  expect(texts()).toContain(text.demo.problem.other);
  const [, second] = rows();
  await press(`issue-row-${second}`);
  jest.spyOn(issueSession, 'codeText').mockRejectedValueOnce(failed('Made up', 'E_WORLD_KIT'));
  await press('issue-new-code');
  expect(texts()).toContain(text.demo.problem.device);
  expect(has('issue-qr')).toBe(false);
  expect(texts()).toContain(words.panel.until.replace('{{until}}', String(addDays(started.date, 7))));
});
