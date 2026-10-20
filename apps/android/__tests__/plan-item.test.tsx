// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// One plan item and the class's changes (#225, Plan-item, Plan-changes):
// what the item is; changing its sessions, then undoing it on the spot;
// leaving out or joining an essential item, which asks first; splitting,
// adding, moving; a split refused while an exam answer names the item; the
// class's changes, newest first, each taken back after a question; and
// every control named in each language and direction. Made-up data only.

import { changesFor, courseSetup, parseDay, queueItems } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Alert, Text, type AlertButton } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withData, type TestData } from '../jest/app-data';
import { withDay } from '../jest/today-day';
import { PlanChanges } from '../src/plan/PlanChanges';
import { PlanItem } from '../src/plan/PlanItem';
import { coreContext } from '../src/storage/core-context';
import { catalogues, i18n, type Language } from '../src/text/i18n';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const root = () => tree!.root;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  jest.restoreAllMocks();
  await i18n.changeLanguage('ar');
});

async function show(data: TestData, element: React.JSX.Element, direction: 'rtl' | 'ltr' = 'rtl') {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={direction}>{withData(data, element, '2026-10-15')}</LocaleDirContext.Provider>,
    );
  });
}
const rerender = async (data: TestData, element: React.JSX.Element) => {
  await ReactTestRenderer.act(() =>
    tree!.update(
      <LocaleDirContext.Provider value="rtl">{withData(data, element, '2026-10-15')}</LocaleDirContext.Provider>,
    ),
  );
};
const shown = () =>
  root()
    .findAllByType(Text)
    .map((node) =>
      [node.props.children as unknown]
        .flat()
        .filter((part) => typeof part === 'string' || typeof part === 'number')
        .join(''),
    );
const press = async (id: string) => {
  const target = root().findAll((node) => node.props.testID === id && typeof node.props.onPress === 'function')[0];
  await ReactTestRenderer.act(() => (target?.props.onPress as () => void)());
};
const type = async (id: string, value: string) => {
  const field = root().findAll((node) => node.props.testID === id && typeof node.props.onChangeText === 'function')[0];
  await ReactTestRenderer.act(() => (field?.props.onChangeText as (value: string) => void)(value));
};
const confirm = async (alert: jest.SpyInstance<void, Parameters<typeof Alert.alert>>) => {
  const buttons: readonly AlertButton[] = alert.mock.calls.at(-1)?.[2] ?? [];
  await ReactTestRenderer.act(() => {
    buttons.at(-1)?.onPress?.();
  });
};
const context = (data: TestData) => coreContext({ ...data, state: data.book.state });
const main = (data: TestData) => queueItems(courseSetup(context(data), 'c-1').pack!, 'main').map((item) => item.id);
const settle = () => ReactTestRenderer.act(() => new Promise((resolve) => setTimeout(resolve, 0)));

test('shows the item: kind, essential, sessions and unit, stages and its ID', async () => {
  await show(await withDay(), <PlanItem courseId="c-1" itemId="u1-3" />);
  expect(shown()).toEqual(
    expect.arrayContaining([
      'فهم المكتوب 1 (مثال)',
      text.planItem.kinds.lesson,
      text.planItem.essential,
      'حصتان · ⁨المقطع 1 (مثال)⁩',
      '1. ⁨تهيئة⁩',
      'dz.cem.4am.arabic.example · u1-3',
    ]),
  );
  expect(accessibilityProblems(root())).toEqual([]);
});

test('changes its sessions for this class, and undoes it on the spot', async () => {
  const data = await withDay();
  await show(data, <PlanItem courseId="c-1" itemId="u1-3" />);
  await press('item-budget');
  await press('item-budget-stepper-increase');
  await press('item-budget-save');
  await settle();
  expect(changesFor(data.book.state.decisions, 'c-1')).toEqual([
    expect.objectContaining({ kind: 'budget', sessions: 3 }),
  ]);
  await rerender(data, <PlanItem courseId="c-1" itemId="u1-3" />);
  const undo = root()
    .findByProps({ testID: 'item-changed' })
    .findAll(
      (node) => node.props.accessibilityLabel === text.planItem.undo && typeof node.props.onPress === 'function',
    )[0];
  await ReactTestRenderer.act(() => (undo?.props.onPress as () => void)());
  await settle();
  expect(changesFor(data.book.state.decisions, 'c-1')).toEqual([]);
  expect(data.book.state.decisions.size).toBe(2);
});

test('leaving out or joining an essential item asks first', async () => {
  const data = await withDay();
  const alert = jest.spyOn(Alert, 'alert');
  await show(data, <PlanItem courseId="c-1" itemId="u1-4" />);
  await press('item-skip');
  expect(alert).toHaveBeenCalledTimes(1);
  expect(changesFor(data.book.state.decisions, 'c-1')).toEqual([]);
  await confirm(alert);
  await settle();
  expect(changesFor(data.book.state.decisions, 'c-1')).toEqual([
    expect.objectContaining({ kind: 'skip', item: 'u1-4' }),
  ]);
  await rerender(data, <PlanItem courseId="c-1" itemId="u1-4" />);
  await press('item-join');
  await confirm(alert);
  await settle();
  expect(changesFor(data.book.state.decisions, 'c-1').at(-1)).toEqual(
    expect.objectContaining({ kind: 'join', items: ['u1-4', 'u1-5'] }),
  );
});

test('splits an item in two, adds one after an item, and moves one to the end', async () => {
  const data = await withDay();
  await show(data, <PlanItem courseId="c-1" itemId="u1-6" />);
  await press('item-add');
  await type('item-add-title', 'مراجعة للتجربة');
  await press('item-add-save');
  await settle();
  const added = main(data)[main(data).indexOf('u1-6') + 1];
  expect(added.startsWith('add~')).toBe(true);
  await rerender(data, <PlanItem courseId="c-1" itemId="u1-3" />);
  await press('item-split');
  await press('item-split-save');
  await settle();
  expect(main(data).filter((id) => id.startsWith('u1-3~'))).toHaveLength(2);
  await rerender(data, <PlanItem courseId="c-1" itemId="u1-3" />);
  expect(shown()).toContain(text.planItem.gone);
  await rerender(data, <PlanItem courseId="c-1" itemId="u1-1" />);
  await press('item-move');
  await press('item-to-end');
  await settle();
  expect(main(data).at(-1)).toBe('u1-1');
});

test('does not offer a split while an exam-window answer names the item', async () => {
  const data = await withDay();
  await data.book.record(parseDay('2026-10-15'), {
    kind: 'plan.decided',
    decision: { id: 'p1', courseId: 'c-1', kind: 'postpone', items: ['u1-5'], term: 1 },
  });
  await show(data, <PlanItem courseId="c-1" itemId="u1-5" />);
  expect(shown()).toContain(text.planItem.splitBlocked);
  expect(root().findAll((node) => node.props.testID === 'item-split')).toHaveLength(0);
});

test('lists the class’s changes newest first, and takes one back after asking', async () => {
  const data = await withDay();
  const alert = jest.spyOn(Alert, 'alert');
  await show(data, <PlanItem courseId="c-1" itemId="u1-2" />);
  await press('item-budget');
  await press('item-budget-stepper-increase');
  await press('item-budget-save');
  await settle();
  await rerender(data, <PlanItem courseId="c-1" itemId="u1-7" />);
  await press('item-move');
  await press('item-before-u1-1');
  await settle();
  await rerender(data, <PlanChanges courseId="c-1" />);
  const [moved, budget] = changesFor(data.book.state.decisions, 'c-1').reverse();
  expect(shown()).toEqual(
    expect.arrayContaining([
      'تغييران قائمان · الأحدث أولاً',
      '«⁨تقويم ومعالجة 1 (مثال)⁩» قبل «⁨الوضعية المشكلة الانطلاقية 1 (مثال)⁩»',
      '«⁨فهم المنطوق 1 (مثال)⁩»: حصتان',
      'يأخذ من الاحتياط: حصة واحدة',
    ]),
  );
  const order = root()
    .findAll((node) => typeof node.props.testID === 'string' && /^change-[^u]/.test(node.props.testID))
    .map((node) => node.props.testID as string);
  expect([...new Set(order)]).toEqual([`change-${moved.id}`, `change-${budget.id}`]);
  await press(`change-undo-${moved.id}`);
  expect(changesFor(data.book.state.decisions, 'c-1')).toHaveLength(2);
  await confirm(alert);
  await settle();
  expect(changesFor(data.book.state.decisions, 'c-1')).toEqual([budget]);
});

test.each(
  (Object.keys(catalogues) as Language[]).flatMap((language) =>
    (['rtl', 'ltr'] as const).map((direction) => [language, direction] as const),
  ),
)('names every control (%s, %s)', async (language, direction) => {
  await i18n.changeLanguage(language);
  const data = await withDay();
  await show(data, <PlanItem courseId="c-1" itemId="u1-3" />, direction);
  expect(accessibilityProblems(root())).toEqual([]);
  expect(shown()).toContain(catalogues[language].planItem.layerNote);
  await ReactTestRenderer.act(() => tree?.unmount());
  await show(data, <PlanChanges courseId="c-1" />, direction);
  expect(accessibilityProblems(root())).toEqual([]);
  expect(shown()).toContain(catalogues[language].planChanges.intro);
});
