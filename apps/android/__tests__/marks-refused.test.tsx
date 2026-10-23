// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A refused presets file (#238, PRD §5.9): the Class page's row and the hub
// say the setups could not be read, the hub shows no formula and its setup
// row is disabled, while «مواعيد الفروض» still opens. Made-up records only.

import { LocaleDirContext } from '@react-navigation/native';
import { createRef } from 'react';
import { Text, type PressableProps, type TextProps, type ViewInstance } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { withData } from '../jest/app-data';
import { withDay } from '../jest/today-day';
import { ClassPage } from '../src/classes/ClassPage';
import { Marks } from '../src/marks/Marks';
import text from '../src/text/ar.json';

jest.mock('@minhajna/data/dz/assessment.json', () => ({ format: 2 }));
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer | undefined;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
});

async function mount(element: React.ReactElement) {
  const data = await withDay();
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">{withData(data, element)}</LocaleDirContext.Provider>,
    );
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
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

test('the Class page’s row says the setups could not be read', async () => {
  const noop = () => undefined;
  await mount(
    <ClassPage
      courseId="c-1"
      settings={false}
      settingsOpener={createRef<ViewInstance>()}
      onSettings={noop}
      onCourse={noop}
      onRoll={noop}
      onBook={noop}
      onPlan={noop}
      onHomework={noop}
      onExtra={noop}
      onSupervised={noop}
      onMove={noop}
      onSeats={noop}
      onRules={noop}
      onReorient={noop}
      onMarks={noop}
    />,
  );
  expect(texts()).toContain(text.marks.unavailable);
});

test('the hub shows no formula, its setup row disabled, and still opens the tests', async () => {
  const onTests = jest.fn();
  await mount(
    <Marks
      courseId="c-1"
      onTerm={jest.fn()}
      onSetup={jest.fn()}
      onTests={onTests}
      onCapture={jest.fn()}
      onComponents={jest.fn()}
      onBook={jest.fn()}
      onEntry={jest.fn()}
      onPart={jest.fn()}
      onObservations={jest.fn()}
      onAppreciations={jest.fn()}
      onExport={jest.fn()}
      onFix={jest.fn()}
    />,
  );
  expect(texts()).toContain(text.marks.unavailable);
  expect(texts()).not.toContain(text.marks.formulaTitle);
  expect(control('marks-setup')?.props.disabled).toBe(true);
  await ReactTestRenderer.act(async () => {
    (control('marks-tests')?.props as PressableProps).onPress?.({} as never);
    await Promise.resolve();
  });
  expect(onTests).toHaveBeenCalledTimes(1);
});
