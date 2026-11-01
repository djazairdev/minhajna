// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The end of a substitution from the director's device (#588, answer 616), on
// the made-up term of term-weeks.ts with teacher-4 appointed in place of
// teacher-1 from 2027-01-17 and their week of 1م2 signed: ending on 2027-01-24
// publishes the version that gives the holder the classes again from that day,
// ends the handover on the substitute's channel and puts on the holder's the
// return with the substitute's week of the substitution, never the week of the
// return day, which the list shows; a subject the substitute teaches in one of
// the classes, and its week, stays theirs; ending again after the end could not
// be kept publishes no second version; ending on the first day, on a day not
// offered, an appointment not kept or one already ended is refused, and so is
// ending while a second substitute appointed in the first's place teaches a
// course it passed, which keeps nothing and which the page says in its own
// words; a return cut short after the end shows as not all back and is sent
// again whole, without a second end; the page's button ends the appointment on
// the day chosen and says so; and a return to a holder who has not joined is
// refused, the page saying so in place of a way to send it. Every school, class
// and teacher is made up.

import {
  channelHandovers,
  channelReturns,
  channelStream,
  keptVersions,
  parseDay,
  readJoinCode,
  readJoined,
  type DemoSchool,
  type SchoolJoined,
  type Subject,
} from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Platform, Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { FakeStorage } from '../jest/fake-storage';
import { SCHOOL } from '../jest/grant-world';
import { DAYS, joinNew, SECOND, sign, signedTerm, SUBJECTS, TEACHER } from '../jest/term-weeks';
import { BELLS, channel, school, sendParts, server, session, STAFF } from '../jest/timetable-send';
import { nodeKit as kit } from '../jest/world-server';
import { endSubstitution, sendReturn } from '../src/director/substitute-end';
import { appoint, readSubstitutes } from '../src/director/substitute-session';
import { SchoolSubstitute } from '../src/director/SchoolSubstitute';
import { leaveWorldNetwork } from '../src/network/world-network';
import { caKey, spaceBatches } from '../src/school/space-read';
import { openRecordBook } from '../src/storage/history';
import ar from '../src/text/ar.json';
import { readSignChannel, signTheWeek, weekRecord, weeksToSign, weekStart } from '../src/week/week-sign-session';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const words = ar.demo.substitute;
const STAFFED = { ...school, ...SCHOOL, teachers: STAFF } as unknown as DemoSchool;
const BACK = parseDay('2027-01-24');
const HISTORY: Subject = { code: 'history', name: { ar: 'تاريخ', fr: 'Histoire', en: 'History' }, levels: ['cem'] };
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

/**
 * Teacher-4 appointed in place of teacher-1 for both classes from 2027-01-17,
 * and their week of 1م2 signed; with `own`, teacher-4 also teaches history in
 * 1م2 and signs that week too.
 */
async function appointed(own = false) {
  const { id, here, joined: holder } = await signedTerm();
  const device = async () => ({ world: id, date: here.date, book: await openRecordBook(new FakeStorage().asSpec()) });
  const substitute = await joinNew(id, here, device, 'teacher-4');
  const world = { ...here, world: id, date: SECOND };
  const theirs = [0, 1, 2].map((day) => session(TEACHER, day as 0 | 1 | 2, 480));
  const history = { ...session(STAFF[3].name, 2, 600), subject: HISTORY.name.ar };
  if (own) await sendParts(here, school, [...theirs, session(TEACHER, 0, 540, '1م3'), history], BELLS);
  const { days } = await readSubstitutes(world, STAFFED, kit, server.send);
  const choice = { holder: 'teacher-1', substitute: 'teacher-4', decision: '2027/015', classes: ['1م2', '1م3'] };
  const { appointment } = await appoint(world, STAFFED, { ...choice, from: days[0] }, BELLS, kit, server.send);
  const signing = { world: id, date: parseDay('2027-01-19') };
  await sign(signing, substitute, { 0: 'held', 1: 'not-held' });
  if (own) {
    const { parts } = await readSignChannel(signing, substitute, kit, server.send);
    const week = weeksToSign(parts, signing.date, DAYS, [...SUBJECTS, HISTORY]).find((one) => one.code === 'history')!;
    const slots = new Map([['2\n600\n660\n\nboth', 'held' as const]]);
    const first = weekStart(signing.date, DAYS);
    const record = await weekRecord(readJoinCode(substitute.code)!.school, week, first, slots, kit.mac);
    await signTheWeek(signing, substitute, record, kit, server.send);
  }
  return { id, world, holder, substitute, appointment };
}

/** What a joined device reads on its own channel. */
async function read(join: SchoolJoined) {
  const code = readJoinCode(join.code)!;
  const batches = (await spaceBatches(code.world, code.school, server.send)).get(await channelStream(code, kit.mac));
  const ca = { key: await caKey(code.world, server.send), checker: kit };
  const joined = await readJoined(code, batches ?? [], ca, kit.cipher, kit.mac);
  return {
    returns: await channelReturns(code, batches ?? [], ca, joined, kit.cipher, kit.mac),
    handovers: await channelHandovers(code, batches ?? [], ca, joined, kit.cipher, kit.mac),
    latest: (await channel(code)).latest,
  };
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

function render(world: Awaited<ReturnType<typeof appointed>>['world']) {
  return act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        <SchoolSubstitute
          world={world}
          school={STAFFED}
          bells={BELLS}
          kit={kit}
          send={server.send}
          dayText={(day) => `day ${day}`}
          subjectName={(code) => code}
          workingDays={[0, 1, 2, 3, 4]}
        />
      </LocaleDirContext.Provider>,
    );
  });
}

test('ending gives the classes back in a version, ends the handover and returns the substitute’s weeks', async () => {
  const { id, world, holder, substitute, appointment } = await appointed();
  await sign({ world: id, date: parseDay('2027-01-26') }, substitute, { 0: 'held' });
  await endSubstitution(world, STAFFED, appointment.id, BACK, BELLS, kit, server.send);
  const back = await read(holder);
  expect(back.latest?.part.from).toBe(BACK);
  expect(back.latest?.part.sessions.map((one) => one.class).sort()).toEqual(['1م2', '1م2', '1م2', '1م3']);
  expect(back.returns.map((one) => [one.signed.value.until, one.complete])).toEqual([[BACK, ['1م2', '1م3']]]);
  expect(back.returns[0].weeks.map((one) => [one.week.class, one.week.week])).toEqual([['1م2', '2027-01-17']]);
  expect(back.returns[0].weeks[0].signed.certificate.subject).toBe(substitute.device);
  const away = await read(substitute);
  expect(away.handovers.map((one) => one.ended)).toEqual([BACK]);
  expect(away.latest?.part.sessions.filter((one) => ['1م2', '1م3'].includes(one.class))).toEqual([]);
  const after = await readSubstitutes(world, STAFFED, kit, server.send);
  expect(after.appointments.map((one) => [one.ended, one.returned])).toEqual([[BACK, true]]);
});

test('refuses ending an appointment twice, on a day not offered, or one not kept', async () => {
  const { world, appointment } = await appointed();
  for (const [id, day] of [
    [appointment.id, appointment.from],
    [appointment.id, parseDay('2027-01-25')],
    ['f'.repeat(32), BACK],
  ] as const)
    await expect(endSubstitution(world, STAFFED, id, day, BELLS, kit, server.send)).rejects.toMatchObject({
      code: 'E_SUBSTITUTE_END',
    });
  await endSubstitution(world, STAFFED, appointment.id, BACK, BELLS, kit, server.send);
  await expect(
    endSubstitution(world, STAFFED, appointment.id, parseDay('2027-01-31'), BELLS, kit, server.send),
  ).rejects.toMatchObject({ code: 'E_SUBSTITUTE_END' });
});

test('refuses ending while a second substitute teaches a course the appointment passed', async () => {
  const { id, world, appointment } = await appointed();
  const device = async () => ({ world: id, date: world.date, book: await openRecordBook(new FakeStorage().asSpec()) });
  await joinNew(id, world, device, 'teacher-2');
  const { days } = await readSubstitutes(world, STAFFED, kit, server.send);
  const choice = {
    holder: 'teacher-4',
    substitute: 'teacher-2',
    decision: '2027/016',
    classes: ['1م2'],
    from: days[0],
  };
  await appoint(world, STAFFED, choice, BELLS, kit, server.send);
  const versions = keptVersions(world.book.entries, appointment.school).length;
  await expect(endSubstitution(world, STAFFED, appointment.id, BACK, BELLS, kit, server.send)).rejects.toMatchObject({
    code: 'E_SUBSTITUTE_TAUGHT',
  });
  const kept = (await readSubstitutes(world, STAFFED, kit, server.send)).appointments;
  expect([keptVersions(world.book.entries, appointment.school).length, kept[0].ended]).toEqual([versions, null]);
  await render(world);
  await press('substitute-end');
  expect(texts()).toContain(words.taught);
});

test('a return cut short shows as not all back, and is sent again whole', async () => {
  const { world, holder, substitute, appointment } = await appointed();
  const ended = { ...appointment, ended: BACK };
  await world.book.record(world.date, { kind: 'school.substitution', substitution: ended });
  let puts = 0;
  const cut: typeof server.send = (request) =>
    request.method === 'POST' && request.path.endsWith('/batches') && (puts += 1) > 2
      ? Promise.resolve({ status: 503, body: null, retryAfter: null })
      : server.send(request);
  await expect(sendReturn(world, STAFFED, ended, kit, cut)).rejects.toBeDefined();
  expect([(await read(holder)).returns[0].complete, (await read(substitute)).handovers[0].ended]).toEqual([
    ['1م2'],
    BACK,
  ]);
  await render(world);
  expect(texts()).toEqual(expect.arrayContaining([words.ended.replace('{{day}}', `day ${BACK}`), words.notReturned]));
  const posts = () => server.seen.filter((one) => one.method === 'POST' && one.path.endsWith('/batches')).length;
  const before = posts();
  await press('substitute-return');
  expect(texts()).toEqual(expect.arrayContaining([words.returnResent, words.returned]));
  expect([(await read(holder)).returns[0].complete, posts() - before]).toEqual([['1م2', '1م3'], 2]);
});

test('the page’s end button ends the appointment and says so', async () => {
  const { world } = await appointed();
  await render(world);
  expect(texts()).toContain(words.untilDay);
  await press(`substitute-until-${BACK}`);
  await press('substitute-end');
  expect(texts()).toEqual(
    expect.arrayContaining([words.endedSaid, words.ended.replace('{{day}}', `day ${BACK}`), words.returned]),
  );
});

test('sending a return to a holder who has not joined says so', async () => {
  const { world, appointment } = await appointed();
  const ended = { ...appointment, id: 'e'.repeat(32), holder: 'teacher-5', ended: BACK };
  await world.book.record(world.date, { kind: 'school.substitution', substitution: ended });
  await expect(sendReturn(world, STAFFED, ended, kit, server.send)).rejects.toMatchObject({
    code: 'E_HOLDER_NOT_JOINED',
  });
  await render(world);
  expect([texts().includes(words.holderNotJoined), control('substitute-return')]).toEqual([true, undefined]);
});

test('ending gives back only the courses passed, never the substitute’s own subject in a class', async () => {
  const { world, holder, substitute, appointment } = await appointed(true);
  await endSubstitution(world, STAFFED, appointment.id, BACK, BELLS, kit, server.send);
  const subjects = (sessions: readonly { class: string; subject: string }[] = []) =>
    sessions.filter((one) => one.class === '1م2').map((one) => one.subject);
  const [back, away] = [await read(holder), await read(substitute)];
  expect(subjects(back.latest?.part.sessions)).toEqual(['رياضيات', 'رياضيات', 'رياضيات']);
  expect(subjects(away.latest?.part.sessions)).toEqual([HISTORY.name.ar]);
  expect(back.returns[0].weeks.map((one) => [one.week.class, one.week.subject])).toEqual([['1م2', 'رياضيات']]);
});

test('ending again after the end was not kept publishes no second version', async () => {
  const { world, appointment } = await appointed();
  const record = world.book.record.bind(world.book);
  let refused = false;
  jest.spyOn(world.book, 'record').mockImplementation((date, event) => {
    if (event.kind !== 'school.substitution' || refused) return record(date, event);
    refused = true;
    return Promise.reject(new Error('The store is full'));
  });
  await expect(endSubstitution(world, STAFFED, appointment.id, BACK, BELLS, kit, server.send)).rejects.toThrow();
  const versions = keptVersions(world.book.entries, appointment.school).length;
  const { sent } = await endSubstitution(world, STAFFED, appointment.id, BACK, BELLS, kit, server.send);
  expect([sent, keptVersions(world.book.entries, appointment.school).length]).toEqual([null, versions]);
});
