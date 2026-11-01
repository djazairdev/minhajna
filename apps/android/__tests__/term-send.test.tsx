// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Term-send (#591, answer 619), against the jest server's stand-in: a chip for
// each course, the first chosen; that the world makes the marks up; the checks
// with the parts, the formula's ID and release and the list's count; the first
// three pupils by name with their marks and how many more follow; the
// comparison; signing, which shows the stand-in's receipt and says it, again
// saying it was received already, and opened anew the receipt read back; each
// course sent while the page is open keeping its own receipt; an absent pupil's
// row saying so, and a missing mark crossing the check out; a class with no
// list and a subject the country does not know, with nothing to sign; no
// timetable, no term and no school's data each said; a problem reading shown
// with a way to read again, and announced on Android; a refusal said in its own
// words; and the joined card's way in and back (the words are
// term-send-words.test.ts's). Every pupil, mark, school and world here is made
// up.

import {
  directorSchool,
  parseDay,
  seedNationalWorld,
  type DemoSchool,
  type Day,
  type SchoolJoined,
} from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { AccessibilityInfo, Platform, Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { MINE, SUBJECTS, TEACHER } from '../jest/term-weeks';
import { BELLS, school as staff, sendParts, server, session, setting } from '../jest/timetable-send';
import { nodeKit as kit } from '../jest/world-server';
import type { Send } from '../src/demo/world-session';
import { leaveWorldNetwork } from '../src/network/world-network';
import { bundledReference, readReference } from '../src/reference';
import { useJoinView } from '../src/school/join-view';
import { termSheet } from '../src/school/term-send-session';
import { TermSend } from '../src/school/TermSend';
import { TermSendMarks } from '../src/school/TermSendMarks';
import ar from '../src/text/ar.json';
import { appreciationList } from '../src/marks/appreciation-rules';
import { assessmentData } from '../src/marks/marks-rules';
import { isolate } from '../src/week/grid-labels';
import type { MineCalendar } from '../src/week/school-mine-session';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const words = ar.demo.termSend;
const result = readReference(bundledReference);
if (!result.ok) throw new Error('The bundled reference does not read');
const read = result;
const TERM2 = parseDay('2027-01-12');
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
const said = () => String(tree!.root.findByProps({ testID: 'term-send-said' }).props.children);
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
const chips = () => [
  ...new Set(
    tree!.root
      .findAll((node) => String(node.props.testID).startsWith('term-send-course-') && typeof node.type === 'string')
      .map((node) => String(node.props.testID)),
  ),
];

/** A world on a day, its school, and a timetable naming two of its classes, a class it lacks and an unknown subject. */
async function termWorld(date: Day = TERM2, parts = true) {
  const { id, here, joined } = await setting();
  const { zones = [], workingDays } = read.profile;
  const school: DemoSchool = directorSchool(seedNationalWorld(id, zones, workingDays, read.packs))!;
  const [first, second] = school.classes;
  const sessions = [
    session(TEACHER, 0, 480, first.name),
    session(TEACHER, 0, 540, second.name),
    session(TEACHER, 1, 540, '9AM9'),
    { ...session(TEACHER, 2, 480, first.name), subject: 'مادة مختلقة' },
  ];
  if (parts) await sendParts(here, staff, sessions, BELLS);
  server.worlds.get(id)!.date = date;
  return { world: { world: id, date }, school, joined, first: first };
}

async function render(
  world: { world: string; date: Day },
  join: SchoolJoined,
  school: DemoSchool | null,
  mine: MineCalendar | null = MINE,
  send: Send = server.send,
) {
  await act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        <TermSend
          world={world}
          join={join}
          kit={kit}
          send={send}
          dayText={(day) => `day ${day}`}
          onClose={() => undefined}
          said={words.title}
          subjects={SUBJECTS}
          mine={mine ?? undefined}
          school={school}
        />
      </LocaleDirContext.Provider>,
    );
  });
}

test('shows the first course’s made-up marks, checked and compared, and signs and sends them', async () => {
  const { world, school, joined, first } = await termWorld();
  await render(world, joined, school);
  const count = first.pupils.length;
  const shown = texts();
  expect(chips()).toHaveLength(4);
  expect(shown).toEqual(
    expect.arrayContaining([
      words.madeUp,
      fill(words.complete, { parts: 'التقويم والفرض والاختبار', done: count, total: count }),
      fill(words.list, { pupils: fill(words.pupils_many, { count }) }),
      fill(words.matches, { matched: count, total: count }),
      fill(words.others_many, { count: count - 3 }),
      words.sign,
      words.filesLine,
      words.foot,
    ]),
  );
  expect(shown.some((one) => one.startsWith('المعدلات بالصيغة الرسمية') && one.includes('cem'))).toBe(true);
  const [pupil] = first.pupils;
  const row = tree!.root.findByProps({ testID: `term-send-row-${pupil.registration}` });
  expect(String(row.props.accessibilityLabel)).toContain(pupil.name);
  expect(tree!.root.findAll((node) => /^term-send-row-/u.test(String(node.props.testID))).length).toBeGreaterThan(0);
  expect(has('term-send-receipt')).toBe(0);
  await press('term-send-go');
  const line = fill(words.receivedLine, {
    received: `day ${TERM2}`,
    pupils: fill(words.pupils_many, { count }),
    signed: `day ${TERM2}`,
  });
  expect([has('term-send-receipt'), texts().includes(line), texts().includes(words.standIn)]).toEqual([1, true, true]);
  expect(said()).toBe(fill(ar.demo.termSend.done, { class: isolate(first.name) }));
  expect(texts()).toContain(words.sendAgain);
  await press('term-send-go');
  expect([texts().includes(words.already), said()]).toEqual([true, words.already]);
  expect(server.relay.state.receipts(world.world)).toHaveLength(1);
  await ReactTestRenderer.act(() => tree?.unmount());
  await render(world, joined, school);
  expect([has('term-send-receipt'), texts().includes(line), texts().includes(words.already)]).toEqual([1, true, false]);
});

test('each course sent while the page is open keeps its own receipt', async () => {
  const { world, school, joined } = await termWorld();
  await render(world, joined, school);
  const [one, two] = chips();
  await press('term-send-go');
  await press(two);
  expect(has('term-send-receipt')).toBe(0);
  await press('term-send-go');
  await press(one);
  expect([has('term-send-receipt'), texts().includes(words.sendAgain), texts().includes(words.already)]).toEqual([
    1,
    true,
    false,
  ]);
  expect(server.relay.state.receipts(world.world)).toHaveLength(2);
});

test('an absent pupil’s row says so, and a missing mark crosses the check out', async () => {
  const { world, school } = await termWorld();
  const data = { assessment: assessmentData(read.profile)!, list: appreciationList(read.profile)! };
  const course = { class: school.classes[0].name, subject: 'رياضيات', code: 'math' };
  const sheet = termSheet(world.world, school, course, 2, world.date, data);
  if (sheet.kind !== 'marks') throw new Error(sheet.kind);
  const [first, ...rest] = sheet.marks.rows;
  const absent = { ...first, values: { T: 12, F: 11.5, E: 'absent' as const }, average: null };
  const rows = [absent, { ...rest[0], values: { T: 10, F: 9 } }, ...rest.slice(1)];
  await act(() => {
    tree = ReactTestRenderer.create(
      <TermSendMarks sheet={{ ...sheet, marks: { ...sheet.marks, rows } }} matches={{ matched: 1, total: 2 }} />,
    );
  });
  const label = (registration: string) =>
    String(tree!.root.findByProps({ testID: `term-send-row-${registration}` }).props.accessibilityLabel);
  expect(label(first.registration)).toContain(`${ar.marks.book.E} ${ar.marks.export.absent}`);
  expect(label(rest[0].registration)).toContain(`${ar.marks.book.E} —`);
  const spoken = tree!.root.findAll((node) => String(node.props.accessibilityLabel).startsWith(words.unchecked));
  expect([spoken.length > 0, texts().includes(words.mismatch)]).toEqual([true, true]);
});

test('a class with no list or an unknown subject has nothing to sign', async () => {
  const { world, school, joined } = await termWorld();
  await render(world, joined, school);
  const [, , noList, unknown] = chips();
  await press(noList);
  expect([texts().includes(fill(words.noList, { class: isolate('9AM9') })), has('term-send-go')]).toEqual([true, 0]);
  await press(unknown);
  expect([texts().includes(words.unknownSubject), has('term-send-go')]).toEqual([true, 0]);
});

test('without a timetable, a term or the school’s data, the page says so', async () => {
  const none = await termWorld(TERM2, false);
  await render(none.world, none.joined, none.school);
  expect([texts().includes(words.noTimetable), chips()]).toEqual([true, []]);
  await ReactTestRenderer.act(() => tree?.unmount());
  server.reset();
  leaveWorldNetwork();
  const early = await termWorld(parseDay('2026-09-10'));
  await render(early.world, early.joined, early.school);
  expect([texts().includes(words.noTerm), has('term-send-go')]).toEqual([true, 0]);
  await ReactTestRenderer.act(() => tree?.unmount());
  await render({ ...early.world, date: TERM2 }, early.joined, null);
  expect([texts().includes(words.noData), has('term-send-go')]).toEqual([true, 0]);
  await ReactTestRenderer.act(() => tree?.unmount());
  await render({ ...early.world, date: TERM2 }, early.joined, early.school, null);
  expect([texts().includes(words.noData), has('term-send-go')]).toEqual([true, 0]);
});

test('a problem reading is shown, read again and announced on Android; a refusal has its words', async () => {
  const { world, school, joined } = await termWorld();
  let down = true;
  const send: Send = (request) =>
    down ? Promise.resolve({ status: 503, body: null, retryAfter: null }) : server.send(request);
  await render(world, joined, school, MINE, send);
  expect([texts().includes(ar.demo.problem.other), chips()]).toEqual([true, []]);
  down = false;
  await press('term-send-again');
  expect([texts().includes(ar.demo.problem.other), chips().length]).toEqual([false, 4]);
  server.worlds.get(world.world)!.date = parseDay('2027-01-11');
  await press('term-send-go');
  expect([texts().includes(words.refused), has('term-send-receipt')]).toEqual([true, 0]);
  await ReactTestRenderer.act(() => tree?.unmount());
  jest.replaceProperty(Platform, 'OS', 'android');
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
  down = true;
  await render(world, joined, school, MINE, send);
  expect(announce).toHaveBeenLastCalledWith(ar.demo.problem.other);
});

test('opens from the joined card and goes back to School-join', async () => {
  const { joined } = await setting();
  let view: ReturnType<typeof useJoinView> | undefined;
  function Probe() {
    view = useJoinView(
      () => undefined,
      () => undefined,
    );
    return null;
  }
  await act(() => {
    tree = ReactTestRenderer.create(<Probe />);
  });
  await act(() => view!.open('termSend')(joined));
  expect(view!.page).toBe('termSend');
  await act(() => view!.leave());
  expect(view!.page).toBe('join');
});
