// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «إضافة حصص» (#219, Calendar-add-sessions): opened from the screen for a
// session outside the timetable; a make-up day on Thursday's timetable adds
// plan sessions that Today shows under the day's mark; a support day adds
// none to the plan, and its rows count on the page; a slot already taught
// is refused; a closure sets the weekday; «تراجع» takes the day back with
// the history kept; a second tap waits. Made-up records only.

import { addedSessions, parseDay, sessionsBetween } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { openTestData, withData, type TestData } from '../jest/app-data';
import { withDay } from '../jest/today-day';
import { AddSessions } from '../src/extra/AddSessions';
import { ExtraSession } from '../src/extra/ExtraSession';
import { coreContext } from '../src/storage/core-context';
import text from '../src/text/ar.json';
import { Today } from '../src/today/Today';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer | undefined;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
});

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

async function mount(data: TestData, element: React.ReactElement, day = '2026-10-15') {
  await ReactTestRenderer.act(() => tree?.unmount());
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">{withData(data, element, day)}</LocaleDirContext.Provider>,
    );
    await settle();
  });
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

const exists = (testID: string) => tree!.root.findAll((node) => node.props.testID === testID).length > 0;

const props = (testID: string) => tree!.root.findByProps({ testID }).props as Record<string, unknown>;

async function press(testID: string) {
  await ReactTestRenderer.act(async () => {
    (control(testID).props as PressableProps).onPress?.({} as never);
    await settle();
  });
}

async function choose(group: string, value: string | string[]) {
  await ReactTestRenderer.act(async () => {
    (props(group) as { onSelect: (value: string | string[]) => void }).onSelect(value);
    await settle();
  });
}

const context = (data: TestData) => coreContext({ ...data, state: data.book.state });

test('the screen for a session outside the timetable opens it', async () => {
  const onAddDay = jest.fn();
  await mount(await withDay(), <ExtraSession onAddDay={onAddDay} />);
  await press('extra-add-day');
  expect(onAddDay).toHaveBeenCalledTimes(1);
});

test("a make-up day on Thursday's timetable adds plan sessions, and Today shows them under the day's mark", async () => {
  const data = await withDay();
  await mount(data, <AddSessions />);
  expect(tree!.root.findByProps({ testID: 'add-day' }).props.children).toContain('16');
  expect(exists('add-none')).toBe(true);
  await choose('add-follows', '4');
  expect(props('add-sessions').selected).toEqual(['c-1/m1/k-1-w/every', 'c-1/m2/k-1-w/every', 'c-2/m3/k-2-w/every']);
  expect(texts()).toContain(text.addSessions.makeUpLine);
  expect(texts()).toContain(text.addSessions.spare);
  expect(texts()).toContain('\u20684م1\u2069: ينقص 4 حصص ← ينقص حصتان');
  expect(texts().some((line) => line.includes('4م2\u2069:'))).toBe(false);
  expect(texts().some((line) => line.includes('3 حصص') && line.includes('الخميس'))).toBe(true);
  await press('add-save');
  await ReactTestRenderer.act(settle);
  const [entry] = data.book.state.calendar;
  expect(entry).toEqual(
    expect.objectContaining({
      effect: 'adds-sessions',
      adds: 'make-up',
      follows: 4,
      from: '2026-10-16',
      source: text.addSessions.sourceDefault,
    }),
  );
  expect(entry?.name).toEqual(expect.objectContaining({ ar: text.addSessions.names['make-up'] }));
  const added = sessionsBetween(context(data), parseDay('2026-10-16'), parseDay('2026-10-16'));
  expect(added.map((session) => [session.key, session.calendar])).toEqual([
    ['c-1/2026-10-16/m1/k-1-w', null],
    ['c-1/2026-10-16/m2/k-1-w', null],
    ['c-2/2026-10-16/m3/k-2-w', null],
  ]);
  expect(texts()).toContain(text.addSessions.saved);
  expect(exists('add-clash')).toBe(false);
  expect(props('add-sessions').selected).toEqual([]);

  await mount(
    data,
    <Today onHelp={jest.fn()} onExtra={jest.fn()} onDetails={jest.fn()} onRoll={jest.fn()} />,
    '2026-10-16',
  );
  expect(texts()).toContain(text.daymark.makeUp.replace('{{weekday}}', 'الخميس'));
  expect(texts()).toContain(text.addSessions.names['make-up']);
});

test('a support day stays off the plan', async () => {
  const data = await withDay();
  await mount(data, <AddSessions />);
  await choose('add-kind', 'support');
  await choose('add-follows', '4');
  expect(texts()).toContain(text.addSessions.supportLine);
  expect(exists('add-spare')).toBe(false);
  await press('add-save');
  await ReactTestRenderer.act(settle);
  const day = parseDay('2026-10-16');
  expect(sessionsBetween(context(data), day, day)).toEqual([]);
  expect(addedSessions(context(data), day, day, ['support']).length).toBe(3);
});

test('support-day rows count in the number of a session outside the timetable', async () => {
  const data = await withDay();
  await mount(data, <AddSessions />);
  await choose('add-kind', 'support');
  await press('extra-day-2026-10-14');
  await choose('add-follows', '4');
  expect(exists('add-untimed')).toBe(false);
  await press('add-save');
  await ReactTestRenderer.act(settle);
  await mount(data, <ExtraSession courseId="c-1" />);
  expect(tree!.root.findByProps({ testID: 'extra-preview' }).props.accessibilityLabel).toContain(
    `${text.extra.number} 3،`,
  );
});

test('refuses a slot already taught that day, no session, or no source', async () => {
  const data = await withDay();
  await mount(data, <AddSessions />);
  await press('extra-day-2026-10-15');
  await choose('add-follows', '4');
  expect(props('add-sessions').selected).toEqual([]);
  await press('add-save');
  expect(exists('add-choose')).toBe(true);
  await choose('add-sessions', ['c-1/m1/k-1-w/every']);
  expect(exists('add-clash')).toBe(true);
  expect(exists('add-changes')).toBe(false);
  await press('add-save');
  await ReactTestRenderer.act(async () => {
    (props('add-source') as { onChangeText: (value: string) => void }).onChangeText(' ');
    await settle();
  });
  await press('extra-day-2026-10-14');
  await choose('add-sessions', ['c-1/m1/k-1-w/every']);
  await press('add-save');
  expect(exists('add-choose')).toBe(true);
  expect(data.book.state.calendar).toEqual([]);
});

test('a closure before the day sets the weekday it follows', async () => {
  const data = await withDay();
  await data.book.record(parseDay('2026-10-15'), {
    kind: 'calendar.set',
    entry: {
      id: 'cl-1',
      layer: 'school',
      schoolId: 's-1',
      from: parseDay('2026-10-15'),
      to: parseDay('2026-10-15'),
      effect: 'closure',
      name: { ar: 'غلق المؤسسة' },
      source: 'إعلان',
      confidence: 'announced',
    },
  });
  await mount(data, <AddSessions />);
  expect(props('add-replaces').selected).toBe('cl-1');
  expect(props('add-follows').selected).toBe('4');
  expect(props('add-sessions').selected).toEqual(['c-1/m1/k-1-w/every', 'c-1/m2/k-1-w/every', 'c-2/m3/k-2-w/every']);
  expect(texts().some((line) => line.includes('غلق المؤسسة'))).toBe(true);
  await press('add-save');
  await ReactTestRenderer.act(settle);
  expect(data.book.state.calendar.find((entry) => entry.effect === 'adds-sessions')?.replaces).toBe('cl-1');
  await choose('add-kind', 'support');
  expect(exists('add-replaces')).toBe(false);
});

test('undo takes the day back with the history kept, and a second tap waits', async () => {
  const data = await withDay();
  const before = data.book.entries.length;
  await mount(data, <AddSessions />);
  await choose('add-follows', '4');
  await ReactTestRenderer.act(async () => {
    const save = (control('add-save').props as PressableProps).onPress;
    save?.({} as never);
    save?.({} as never);
    await settle();
  });
  await ReactTestRenderer.act(settle);
  expect(data.book.entries.length).toBe(before + 1);
  await ReactTestRenderer.act(async () => {
    const undo = tree!.root.findAll(
      (node) => node.props.accessibilityLabel === text.addSessions.undo && typeof node.props.onPress === 'function',
    )[0];
    (undo.props as PressableProps).onPress?.({} as never);
    (undo.props as PressableProps).onPress?.({} as never);
    await settle();
  });
  await ReactTestRenderer.act(settle);
  expect(data.book.state.calendar).toEqual([]);
  expect(data.book.entries.length).toBe(before + 2);
  const day = parseDay('2026-10-16');
  expect(sessionsBetween(context(data), day, day)).toEqual([]);
});

test('without a class, it says what comes first', async () => {
  await mount(await openTestData(), <AddSessions />);
  expect(texts()).toContain(text.addSessions.noClass);
});
