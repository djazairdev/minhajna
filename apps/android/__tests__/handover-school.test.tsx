// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The substitute's classes taken over (#587, answer 615), on the made-up term
// of term-weeks.ts with a second teacher joined and appointed in place of the
// first: the handover reads with each class's last signed week, or none, its
// range closed by a school's four working days; the page says in whose place,
// the decision and the first day, the classes, the plan pack, pupil list and
// access lines and what never arrives, and signs the receipt once however
// quickly pressed twice, which the director's list shows and which is refused a
// second time; a receipt kept while reading again fails is said, then shown
// once read again; a channel another device joined first, or no device joined,
// is refused in the catalogue's words; School-join opens the page on a joined
// card and its way back returns there; a handover cut short waits for the rest,
// its receipt refused, as is one for a handover not on the channel; with none
// the page says so, a problem reading is shown and read again; and the page's
// words read in every language. Every school, class and teacher is made up.

import { readJoinCode, type DemoSchool, type SchoolJoined, type Weekday } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Platform, Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { FakeStorage } from '../jest/fake-storage';
import { joinNew, SECOND, signedTerm } from '../jest/term-weeks';
import { BELLS, school, server, STAFF } from '../jest/timetable-send';
import { nodeKit as kit } from '../jest/world-server';
import { assignmentsOf, codeText, holdSchool, issueFor } from '../src/director/issue-session';
import { appoint, readSubstitutes, sendHandover } from '../src/director/substitute-session';
import { leaveWorldNetwork } from '../src/network/world-network';
import { handedClasses, readHandovers, receiveHandover } from '../src/school/handover-session';
import { HandoverSchool } from '../src/school/HandoverSchool';
import { joinedPage } from '../src/school/JoinedPages';
import { openRecordBook } from '../src/storage/history';
import ar from '../src/text/ar.json';
import en from '../src/text/en.json';
import fr from '../src/text/fr.json';
import { isolate } from '../src/week/grid-labels';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const words = ar.demo.handover;
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

/** The made-up term, teacher-1 holding 1م2 and 1م3 with two signed weeks, and teacher-4 joined on a new code. */
async function staffed() {
  const { id, here } = await signedTerm();
  const device = async () => ({ world: id, date: here.date, book: await openRecordBook(new FakeStorage().asSpec()) });
  const substitute = await joinNew(id, here, device, 'teacher-4');
  return { world: { ...here, world: id, date: SECOND }, substitute };
}

/** The appointment of teacher-4 in place of teacher-1 for both classes, recorded on the director's device. */
async function appointed() {
  const found = await staffed();
  const { days } = await readSubstitutes(found.world, STAFFED, kit, server.send);
  const choice = { holder: 'teacher-1', substitute: 'teacher-4', decision: '2027/015', classes: ['1م2', '1م3'] };
  const { appointment } = await appoint(found.world, STAFFED, { ...choice, from: days[0] }, BELLS, kit, server.send);
  return { ...found, appointment };
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

function render(
  world: { world: string; date: string },
  join: SchoolJoined,
  send = server.send,
  days: readonly Weekday[] = [0, 1, 2, 3, 4],
) {
  return act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        <HandoverSchool
          world={world as never}
          join={join}
          kit={kit}
          send={send}
          dayText={(day) => `day ${day}`}
          onClose={() => undefined}
          said={words.title}
          workingDays={days}
        />
      </LocaleDirContext.Provider>,
    );
  });
}

test('the substitute reads the classes handed over with their last signed week and signs the receipt', async () => {
  const { world, substitute, appointment } = await appointed();
  const [read] = await readHandovers(world, substitute, kit, server.send);
  expect(handedClasses(read)).toEqual([
    { name: '1م2', last: '2027-01-10', whole: true },
    { name: '1م3', last: null, whole: true },
  ]);
  let receipts = 0;
  const counted: typeof server.send = (request) => {
    if (request.method === 'POST' && request.path.endsWith('/batches')) receipts += 1;
    return server.send(request);
  };
  await render(world, substitute, counted, [0, 1, 2, 3]);
  expect(texts()).toEqual(
    expect.arrayContaining([
      words.line
        .replace('{{holder}}', isolate(STAFF[0].name))
        .replace('{{decision}}', isolate('2027/015'))
        .replace('{{from}}', `day ${appointment.from}`),
      words.lastWeek
        .replace('{{class}}', isolate('1م2'))
        .replace('{{from}}', 'day 2027-01-10')
        .replace('{{to}}', 'day 2027-01-13'),
      words.timetable.replace('{{day}}', `day ${appointment.from}`),
      words.noWeek.replace('{{class}}', isolate('1م3')),
      words.plan,
      words.pupils,
      words.ends,
      words.addLead,
      words.nevers.notes,
      words.nevers.reasons,
      words.nevers.before,
    ]),
  );
  const add = (control('handover-add').props as PressableProps).onPress!;
  await act(() => {
    add({} as never);
    add({} as never);
  });
  expect(receipts).toBe(1);
  expect(texts()).toEqual(expect.arrayContaining([words.addedNow, words.added.replace('{{day}}', `day ${SECOND}`)]));
  const after = await readSubstitutes(world, STAFFED, kit, server.send);
  expect(after.appointments.map((one) => one.received)).toEqual([SECOND]);
  await expect(receiveHandover(world, substitute, appointment.id, kit, server.send)).rejects.toMatchObject({
    code: 'E_HANDOVER_RECEIVED',
  });
});

test('a handover not all there waits for the rest before its receipt', async () => {
  const { world, substitute } = await staffed();
  const appointment = {
    school: readJoinCode(substitute.code)!.school,
    id: 'f'.repeat(32),
    holder: 'teacher-1',
    substitute: 'teacher-4',
    decision: '2027/015',
    classes: ['1م2', '1م3'],
    from: (await readSubstitutes(world, STAFFED, kit, server.send)).days[0],
    version: 2,
    ended: null,
  };
  let puts = 0;
  const cut: typeof server.send = (request) =>
    request.method === 'POST' && request.path.endsWith('/batches') && (puts += 1) > 1
      ? Promise.resolve({ status: 503, body: null, retryAfter: null })
      : server.send(request);
  await expect(sendHandover(world, STAFFED, appointment, kit, cut)).rejects.toBeDefined();
  await render(world, substitute);
  expect(texts()).toEqual(expect.arrayContaining([words.partial, words.waitWhole]));
  expect((control('handover-add').props as { disabled?: boolean }).disabled).toBe(true);
  await expect(receiveHandover(world, substitute, appointment.id, kit, server.send)).rejects.toMatchObject({
    code: 'E_HANDOVER_PART',
  });
  await expect(receiveHandover(world, substitute, 'e'.repeat(32), kit, server.send)).rejects.toMatchObject({
    code: 'E_HANDOVER_UNKNOWN',
  });
});

test('with no handover the page says none, and a problem reading is shown and read again', async () => {
  const { world, substitute } = await staffed();
  let down = true;
  const send: typeof server.send = (request) =>
    down ? Promise.resolve({ status: 503, body: null, retryAfter: null }) : server.send(request);
  await render(world, substitute, send);
  const alerts = () => tree!.root.findAll((node) => node.props.accessibilityRole === 'alert' && node.type === Text);
  expect(alerts().map((node) => (node.props as TextProps).children)).toEqual([ar.demo.problem.other]);
  down = false;
  await press('handover-again');
  expect([alerts().length, texts().includes(words.none)]).toEqual([0, true]);
});

test('a receipt kept while reading again fails is said, and shown once read again', async () => {
  const { world, substitute } = await appointed();
  let down = false;
  const send: typeof server.send = async (request) => {
    if (down) return { status: 503, body: null, retryAfter: null };
    const answer = await server.send(request);
    if (request.method === 'POST' && answer.status === 201) down = true;
    return answer;
  };
  await render(world, substitute, send);
  await press('handover-add');
  expect(texts()).toEqual(expect.arrayContaining([words.addedNow, ar.demo.problem.other]));
  down = false;
  await press('handover-again');
  expect(texts()).toContain(words.added.replace('{{day}}', `day ${SECOND}`));
});

test('a channel another device joined first, or none joined, is refused in the catalogue’s words', async () => {
  const { world, substitute } = await staffed();
  await render(world, { ...substitute, device: 'f'.repeat(32) });
  expect(texts()).toContain(ar.demo.school.problem.taken);
  await ReactTestRenderer.act(() => tree?.unmount());
  const desk = await holdSchool(world, kit, server.send);
  const assignment = (await assignmentsOf(desk, STAFF, kit)).get('teacher-5')!;
  const { kept, desk: after } = await issueFor(world, desk, assignment, 'phone', kit, server.send);
  await render(world, { ...substitute, code: await codeText(world.world, after, kept) });
  expect(texts()).toContain(ar.demo.timetable.notJoined);
});

test('School-join opens the page on a joined card, and its way back returns there', async () => {
  const { world, substitute } = await staffed();
  const onClose = jest.fn();
  const props = { world, date: world.date, dayText: (day: string) => day, kit, send: server.send, year: '2026-2027' };
  const page = joinedPage(
    { page: 'handover', join: substitute },
    { ...props, said: words.title, dates: null, onClose, onJoin: () => undefined, onPage: () => undefined },
  );
  await act(() => {
    tree = ReactTestRenderer.create(<LocaleDirContext.Provider value="rtl">{page}</LocaleDirContext.Provider>);
  });
  expect(texts()).toContain(words.none);
  await press('handover-back');
  expect(onClose).toHaveBeenCalled();
});

test('the page’s words read in every language', () => {
  for (const catalogue of [ar, fr, en])
    expect([catalogue.demo.handover, catalogue.demo.handover.nevers].map((one) => Object.keys(one).sort())).toEqual(
      [words, words.nevers].map((one) => Object.keys(one).sort()),
    );
});
