// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The counting rules (#39, Roll-rules): the defaults, each change recorded
// at once, the day counting starts chosen from the year's first day and the
// start of each week, the rules stated rather than set, the unit for CEM,
// the way back to the first values, the links from the roll call and the
// correction, and every text in each language. Made-up classes only.

import { DEFAULT_COUNTING, parseDay, rollCallUnits, takeRollCall } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Text, type PressableProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withData, type TestData } from '../jest/app-data';
import { unitKey, withPupils } from '../jest/roll-class';
import { key } from '../jest/today-day';
import { Correct } from '../src/roll/Correct';
import { Roll } from '../src/roll/Roll';
import { countingStarts } from '../src/roll/roll-rules';
import { RollRules } from '../src/roll/RollRules';
import { coreContext } from '../src/storage/core-context';
import { catalogues, i18n, type Language } from '../src/text/i18n';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const root = () => tree!.root;
const onRules = jest.fn();
const sunday = '2026-10-18';

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  await i18n.changeLanguage('ar');
  onRules.mockReset();
});

async function mount(data: TestData, element: React.ReactElement) {
  await ReactTestRenderer.act(() => tree?.unmount());
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">{withData(data, element, sunday)}</LocaleDirContext.Provider>,
    );
  });
}

const settle = () => ReactTestRenderer.act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
const shown = () =>
  root()
    .findAllByType(Text)
    .map((node) =>
      [node.props.children as unknown]
        .flat()
        .filter((part) => typeof part === 'string' || typeof part === 'number')
        .join(''),
    );
const pressables = (id: string) =>
  root().findAll((node) => node.props.testID === id && typeof (node.props as PressableProps).onPress === 'function');
const press = async (id: string) => {
  await ReactTestRenderer.act(() => {
    (pressables(id)[0]?.props as PressableProps).onPress?.({} as never);
  });
  await settle();
};
const states = (id: string) =>
  root().findAll((node) => node.props.testID === id && node.props.accessibilityState !== undefined)[0]?.props
    .accessibilityState as { checked?: boolean; disabled?: boolean; selected?: boolean } | undefined;

test('starts counting from the first day of the year, then from the start of each week', async () => {
  const { profile, year } = await withPupils();
  expect(countingStarts(profile, year, parseDay(sunday))).toEqual([
    '2026-09-21',
    '2026-09-27',
    '2026-10-04',
    '2026-10-11',
    '2026-10-18',
  ]);
});

test('shows the defaults, stating the rules that are not settings, and the unit for CEM', async () => {
  await mount(await withPupils(), <RollRules />);
  expect(shown()).toEqual(
    expect.arrayContaining([
      text.rules.scope,
      text.rules.intro,
      'الإثنين 21 سبتمبر 2026 · الدخول المدرسي',
      text.rules.holidays,
      text.rules.never,
      text.rules.singleShift,
      text.rules.halfDay,
      text.rules.unitSession,
      text.rules.unitSessionNote,
    ]),
  );
  expect(shown()).not.toContain(text.rules.unitHalf);
  expect(states('rules-seminars')?.checked).toBe(false);
  expect(states('rules-not-held')?.checked).toBe(false);
  expect(states('rules-reset')?.disabled).toBe(true);
  expect(accessibilityProblems(root())).toEqual([]);
});

test('records each change at once, and goes back to the first values', async () => {
  const data = await withPupils();
  await mount(data, <RollRules />);
  await press('rules-seminars');
  expect(data.book.state.counting).toEqual({ ...DEFAULT_COUNTING, seminars: 'counted' });
  await press('rules-not-held');
  expect(data.book.state.counting).toEqual({ ...DEFAULT_COUNTING, seminars: 'counted', notHeld: 'counted' });
  expect(states('rules-not-held')?.checked).toBe(true);
  await press('rules-start-change');
  expect(states('rules-start-2026-09-21')?.selected).toBe(true);
  await press('rules-start-2026-10-04');
  expect(data.book.state.counting?.from).toBe('2026-10-04');
  expect(shown()).toContain('الأحد 4 أكتوبر 2026');
  expect(states('rules-reset')?.disabled).toBe(false);
  await press('rules-reset');
  expect(data.book.state.counting).toEqual(DEFAULT_COUNTING);
  expect(states('rules-reset')?.disabled).toBe(true);
  expect(shown()).toContain('الإثنين 21 سبتمبر 2026 · الدخول المدرسي');
});

test('opens from the roll call and from the correction', async () => {
  const data = await withPupils();
  const context = coreContext({ ...data, state: data.book.state });
  const unit = rollCallUnits(context, 'k-1', parseDay('2026-10-15'), parseDay('2026-10-15'))[0];
  await data.book.record(
    parseDay('2026-10-15'),
    takeRollCall(context, unit, { absent: [{ pupilId: 'p-1', justified: false }], late: [] }),
  );
  await mount(data, <Roll sessionKey={key(1)} day={parseDay('2026-10-15')} onDone={jest.fn()} onRules={onRules} />);
  expect(shown()).toContain(text.rules.open);
  await press('roll-rules');
  expect(onRules).toHaveBeenCalledTimes(1);
  await mount(
    data,
    <Correct unitKey={unitKey(1)} day={parseDay('2026-10-15')} pupilId="p-1" onDone={jest.fn()} onRules={onRules} />,
  );
  await press('correct-present');
  await press('correct-rules');
  expect(onRules).toHaveBeenCalledTimes(2);
});

test.each(['en', 'fr'] satisfies Language[])('has every rules text in %s', (language) => {
  expect(Object.keys(catalogues[language].rules).sort()).toEqual(Object.keys(text.rules).sort());
});
