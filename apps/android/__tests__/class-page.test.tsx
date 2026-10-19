// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The Class page (#279): its subject and pupils, the switch to the other class
// of the subject, today's session with its roll call, each record's row with
// its line and its screen, every homework due today whichever group it was set
// to, assessment shown for a later version, the month so far counted in half-
// days for the class and each pupil, with no roll call said as such whatever
// the rule for those not taken, an empty class, and the settings sheet (answer
// 256). The teacher has 4م1, with 45 made-up pupils, and 4م2 on Thursdays from
// 11 October 2026.

import { DEFAULT_COUNTING, confirmSessions, parseDay, todayView, type Day, type RecordEvent } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { createRef } from 'react';
import { Text, type PressableProps, type TextProps, type ViewInstance } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withData, type TestData } from '../jest/app-data';
import { unitKey, withPupils } from '../jest/roll-class';
import { withDay } from '../jest/today-day';
import { ClassPage, type ClassPageProps } from '../src/classes/ClassPage';
import { coreContext } from '../src/storage/core-context';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const DAY = '2026-10-15';
let tree: ReactTestRenderer.ReactTestRenderer | undefined;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const callbacks = () => ({
  onSettings: jest.fn(),
  onCourse: jest.fn(),
  onRoll: jest.fn(),
  onBook: jest.fn(),
  onPlan: jest.fn(),
  onHomework: jest.fn(),
  onExtra: jest.fn(),
  onSupervised: jest.fn(),
  onMove: jest.fn(),
  onSeats: jest.fn(),
  onRules: jest.fn(),
});

async function mount(data: TestData, props: Partial<ClassPageProps> = {}) {
  const all = { ...callbacks(), ...props };
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        {withData(
          data,
          <ClassPage courseId="c-1" settings={false} settingsOpener={createRef<ViewInstance>()} {...all} />,
          DAY,
        )}
      </LocaleDirContext.Provider>,
    );
    await settle();
  });
  return all;
}

const texts = () =>
  tree!.root.findAllByType(Text).map((node) =>
    [(node.props as TextProps).children as unknown]
      .flat()
      .filter((part) => typeof part === 'string' || typeof part === 'number')
      .join(''),
  );

const control = (testID: string) =>
  tree!.root.findAll(
    (node) => node.props.testID === testID && typeof (node.props as PressableProps).onPress === 'function',
  )[0];

async function press(testID: string) {
  await ReactTestRenderer.act(async () => {
    (control(testID)?.props as PressableProps).onPress?.({} as never);
    await settle();
  });
}

const rollCall = (slot: number, absent: string[], late: string[]) => ({
  kind: 'roll-call.taken' as const,
  rollCall: {
    unit: unitKey(slot),
    classId: 'k-1',
    groupId: 'k-1-w',
    day: DAY as Day,
    half: 'morning' as const,
    absent: absent.map((pupilId) => ({ pupilId, justified: false })),
    late,
  },
});

test('says the class, its session today and each record, with nothing taken yet', async () => {
  await mount(await withPupils());
  expect(texts()).toEqual(
    expect.arrayContaining([
      'اللغة العربية · 45 تلميذاً',
      '4م1',
      '4م2',
      `حصة اليوم ${'\u206708سا – 09سا\u2069'} · ${text.roll.none}`,
      text.classPage.bookNone,
      'أكتوبر: لا مناداة بعد',
      text.classPage.homeworkNone,
      text.classPage.extraLine,
      `${text.documents.supervised.page} · ${text.classPage.none}`,
      text.classPage.marksLater,
      text.classPage.pupils,
    ]),
  );
  expect(texts()).toContain('45');
  expect(control('class-marks')?.props.disabled).toBe(true);
  expect(control('class-roll')?.props.disabled).toBe(true);
  expect(accessibilityProblems(tree!.root)).toEqual([]);
});

test('says there is no pupil yet, with no strip for a roll call', async () => {
  await mount(await withDay());
  expect(texts().filter((line) => line === 'لا تلميذ')).toHaveLength(1);
  expect(tree!.root.findAllByProps({ testID: 'class-today' })).toEqual([]);
});

test('counts this month in half-days, for the class and each pupil', async () => {
  const data = await withPupils();
  await data.book.recordAll(parseDay(DAY), [rollCall(1, ['p-3', 'p-5'], ['p-4']), rollCall(2, ['p-3'], ['p-4'])]);
  await mount(data);
  const rate = Math.round(((45 - 2) / 45) * 1000) / 10;
  expect(texts()).toEqual(
    expect.arrayContaining([
      `أكتوبر: غيابان · تأخران · حضور \u2066${rate}%\u2069`,
      'غياب واحد',
      'تأخران',
      `حصة اليوم ${'\u206708سا – 09سا\u2069'} · المناداة محفوظة · غياب: 2 · تأخر: 1`,
    ]),
  );
});

test('counts only up to today, and says no roll call was taken when none was, whatever the rule', async () => {
  const data = await withPupils();
  await data.book.record(parseDay(DAY), { kind: 'counting.set', rules: { ...DEFAULT_COUNTING, untaken: 'present' } });
  await mount(data);
  expect(texts()).toContain('أكتوبر: لا مناداة بعد');
  await ReactTestRenderer.act(() => tree?.unmount());
  await data.book.recordAll(parseDay(DAY), [rollCall(1, ['p-3'], [])]);
  await mount(data);
  const rate = Math.round(((45 - 1) / 45) * 1000) / 10;
  expect(texts()).toContain(`أكتوبر: غياب واحد · لا تأخر · حضور \u2066${rate}%\u2069`);
});

test("shows all homework due today, a half group's too", async () => {
  const data = await withPupils();
  const context = coreContext({ ...data, state: data.book.state });
  const [first, second] = todayView(context, parseDay(DAY)).sessions;
  const homework = (text: string) => ({ homework: { text, due: parseDay(DAY) } });
  const events = confirmSessions(context, [
    { session: first.session, details: homework('التمرين 2') },
    { session: second.session, details: homework('أسئلة الفهم') },
  ]).map((event: RecordEvent) =>
    event.kind === 'session.recorded' && event.record.session.slot.index === 2
      ? { ...event, record: { ...event.record, session: { ...event.record.session, groupId: 'k-1-g1' } } }
      : event,
  );
  expect(
    events.filter((event) => event.kind === 'session.recorded').map((event) => event.record.session.groupId),
  ).toEqual(['k-1-w', 'k-1-g1']);
  await data.book.recordAll(parseDay(DAY), events);
  await mount(data);
  expect(texts().find((line) => line.includes('التمرين 2'))).toContain('أسئلة الفهم');
});

test('opens each record, switches class, and leaves the rows not built yet disabled', async () => {
  const data = await withPupils();
  const context = coreContext({ ...data, state: data.book.state });
  const [first] = todayView(context, parseDay(DAY)).sessions;
  await data.book.recordAll(parseDay(DAY), confirmSessions(context, [{ session: first.session }]));
  const props = await mount(data);
  expect(texts()).toContain('آخر حصة: الخميس 15 أكتوبر · الصفحة 01');
  for (const id of ['book', 'plan', 'homework', 'extra', 'supervised']) await press(`class-${id}`);
  await press('class-today-open');
  await press('class-move');
  expect(props.onBook).toHaveBeenCalledTimes(1);
  expect(props.onPlan).toHaveBeenCalledTimes(1);
  expect(props.onHomework).toHaveBeenCalledTimes(1);
  expect(props.onExtra).toHaveBeenCalledTimes(1);
  expect(props.onSupervised).toHaveBeenCalledTimes(1);
  expect(props.onRoll).toHaveBeenCalledWith(expect.objectContaining({ key: first.session.key }));
  expect(props.onMove).toHaveBeenCalledTimes(1);
  await ReactTestRenderer.act(async () => {
    (tree!.root.findByProps({ testID: 'class-switch' }).props as { onSelect: (value: string) => void }).onSelect('c-2');
    await settle();
  });
  expect(props.onCourse).toHaveBeenCalledWith('c-2');
  expect(control('class-pupil-p-1')).toBeUndefined();
});

test('the month row and each pupil open once their screens are given', async () => {
  const onMonth = jest.fn();
  const onPupil = jest.fn();
  await mount(await withPupils(), { onMonth, onPupil });
  await press('class-roll');
  await press('class-pupil-p-2');
  expect(onMonth).toHaveBeenCalledTimes(1);
  expect(onPupil).toHaveBeenCalledWith('p-2');
});

test('the settings sheet opens the seating plan, the counting rules and the moves, closing first', async () => {
  const props = await mount(await withPupils(), { settings: true });
  expect(tree!.root.findByProps({ testID: 'class-settings' }).props.visible).toBe(true);
  for (const id of ['seats', 'rules', 'move']) await press(`class-settings-${id}`);
  expect(props.onSettings).toHaveBeenCalledTimes(3);
  expect(props.onSettings).toHaveBeenCalledWith(false);
  for (const one of [props.onSeats, props.onRules, props.onMove]) expect(one).toHaveBeenCalledTimes(1);
});
