// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The hub's entry rows (#239, answer 444): each of the term's tests with its
// day and how many of its pupils are done, and «الاختبار» with its window's
// first day, each opening its entry; a term with no test saying so and opening
// «مواعيد الفروض»; a subject with no term exam showing no exam row; and an
// archived class's rows shown but disabled, capture's and the components' too.
// Made-up records only.

import { parseDay } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withData, type TestData } from '../jest/app-data';
import { withTest } from '../jest/marks-class';
import { course, primaryClass } from '../jest/specialist-classes';
import { Marks, type MarksProps } from '../src/marks/Marks';
import text from '../src/text/ar.json';

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

async function mount(data: TestData, props: Partial<MarksProps> = {}) {
  const all = {
    courseId: 'c-1',
    onTerm: jest.fn(),
    onSetup: jest.fn(),
    onTests: jest.fn(),
    onCapture: jest.fn(),
    onComponents: jest.fn(),
    onBook: jest.fn(),
    onEntry: jest.fn(),
    onPart: jest.fn(),
    onObservations: jest.fn(),
    ...props,
  };
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">{withData(data, <Marks {...all} />)}</LocaleDirContext.Provider>,
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

test('each test of the term and the exam has its row, with how many are done', async () => {
  const data = await withTest();
  await data.book.record(parseDay('2026-11-08'), {
    kind: 'mark.set',
    mark: { courseId: 'c-1', term: 1, target: { kind: 'test', testId: 't-1' }, pupilId: 'p-2', value: 'absent' },
  });
  const onEntry = jest.fn();
  await mount(data, { onEntry });
  expect(texts()).toEqual(
    expect.arrayContaining([
      'الفرض الأول',
      'الأحد 8 نوفمبر · 1 من 3',
      text.marks.entry.exam,
      'الأحد 6 ديسمبر · 0 من 3',
    ]),
  );
  expect(texts()).not.toContain(text.marks.entry.noTests);
  await press('marks-test-t-1');
  await press('marks-exam');
  expect(onEntry.mock.calls).toEqual([[1, 't-1'], [1]]);
  expect(accessibilityProblems(tree!.root)).toEqual([]);
});

test('a term with no test says so and opens the schedule', async () => {
  const props = await mount(await withTest(), { term: 2 });
  expect(texts()).toEqual(
    expect.arrayContaining([text.marks.entry.noTests, text.tests.openLine, 'الثلاثاء 2 مارس · 0 من 3']),
  );
  await press('marks-no-tests');
  expect(props.onTests).toHaveBeenCalledTimes(1);
});

test('a subject with no term exam has no exam row', async () => {
  const data = await withTest();
  await data.book.recordAll(parseDay('2026-10-15'), [
    primaryClass('p-1', 's-1', '5ap', '5 ابتدائي أ'),
    course('p-music', 'p-1', 'music'),
  ]);
  await mount(data, { courseId: 'p-music' });
  expect(texts()).toContain(text.marks.entry.noTests);
  expect(control('marks-exam')).toBeUndefined();
});

test('an archived class shows its rows but takes no new marks', async () => {
  const data = await withTest();
  const room = data.book.state.classes.get('k-1')!;
  await data.book.record(parseDay('2026-10-15'), {
    kind: 'class.set',
    schoolClass: { ...room, archivedFrom: parseDay('2026-10-16') },
  });
  await mount(data);
  expect(control('marks-test-t-1')?.props.disabled).toBe(true);
  expect(control('marks-exam')?.props.disabled).toBe(true);
  expect(texts()).toContain('حصة اليوم · 08:00 – 09:00');
  expect(control('marks-capture')?.props.disabled).toBe(true);
  expect(control('marks-components')?.props.disabled).toBe(true);
});
