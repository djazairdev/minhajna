// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Today-backlog (#35): the earlier sessions still awaiting confirmation, a
// week at a time by day, all confirmed in one tap but for the ones left out,
// which keep «نتيجة أخرى» and «تفاصيل الحصة»; the undo; a class with no pack
// left out already; and every control named and 48dp. Made-up schools,
// classes and timetables only.

import { current } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Text, type PressableProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withData, type TestData } from '../jest/app-data';
import { key, withDay } from '../jest/today-day';
import { catalogues, i18n, type Language } from '../src/text/i18n';
import text from '../src/text/ar.json';
import { Today } from '../src/today/Today';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const root = () => tree!.root;
const onHelp = jest.fn();
const onDetails = jest.fn();

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  await i18n.changeLanguage('ar');
  onDetails.mockReset();
});

async function show(data: TestData, direction: 'rtl' | 'ltr' = 'rtl', day = '2026-10-22') {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={direction}>
        {withData(data, <Today onHelp={onHelp} onDetails={onDetails} onRoll={jest.fn()} />, day)}
      </LocaleDirContext.Provider>,
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
const pressable = (id: string) =>
  root().findAll((node) => node.props.testID === id && typeof (node.props as PressableProps).onPress === 'function');
const press = async (id: string) => {
  await ReactTestRenderer.act(() => {
    (pressable(id)[0]?.props as PressableProps).onPress?.({} as never);
  });
  await settle();
};
const state = (id: string) =>
  root().findAll((node) => node.props.testID === id && node.props.accessibilityState !== undefined)[0]?.props
    .accessibilityState as { checked?: boolean; disabled?: boolean } | undefined;
const checked = (id: string) => state(id)?.checked === true;
const disabled = (id: string) => state(id)?.disabled === true;
const noPack = key(3, 'c-2', 'k-2-w');

test('lists the earlier week by day, every session with a proposal checked, and records nothing', async () => {
  const data = await withDay();
  await show(data);
  expect(shown()).toEqual(
    expect.arrayContaining([
      'الخميس 15 أكتوبر 2026',
      '⁧08:00 – 09:00⁩ · 4م1 · تقويم تشخيصي (مثال)',
      `⁧10:00 – 11:00⁩ · 4م2 · ${text.today.noProposal}`,
      'تأكيد حصتين كما هو مقترح',
      text.backlog.hint,
    ]),
  );
  expect(shown()).not.toContain(text.backlog.later);
  expect(checked(`backlog-${key(1)}`)).toBe(true);
  expect(checked(`backlog-${key(2)}`)).toBe(true);
  expect(checked(`backlog-${noPack}`)).toBe(false);
  expect(disabled(`backlog-${noPack}`)).toBe(true);
  expect(pressable(`backlog-${noPack}-details`)).not.toHaveLength(0);
  expect(pressable(`backlog-${noPack}-other`)).toHaveLength(0);
  expect(accessibilityProblems(root())).toEqual([]);
  expect(current(data.book.state.sessions.get(key(1)))).toBeNull();
});

test('confirms the rest at once, keeps the one left out, and undoes it all', async () => {
  const data = await withDay();
  await show(data);
  await press(`backlog-${key(1)}`);
  expect(checked(`backlog-${key(1)}`)).toBe(false);
  expect(shown()).toContain('تأكيد حصة واحدة كما هو مقترح');
  expect(pressable(`backlog-${key(1)}-other`)).not.toHaveLength(0);
  await press('backlog-confirm');
  expect(current(data.book.state.sessions.get(key(1)))).toBeNull();
  expect(current(data.book.state.sessions.get(key(2)))).toMatchObject({
    outcome: 'done',
    coverage: [{ op: 'taught', item: 'd1', from: 0, to: 1 }],
  });
  expect(shown()).toContain(text.backlog.snack_one);
  expect(checked(`backlog-${key(1)}`)).toBe(false);
  expect(pressable(`backlog-${key(2)}`)).toHaveLength(0);
  await ReactTestRenderer.act(() => {
    (
      root().find(
        (node) => node.props.accessibilityLabel === text.today.undo && typeof node.props.onPress === 'function',
      ).props as PressableProps
    ).onPress?.({} as never);
  });
  await settle();
  expect(current(data.book.state.sessions.get(key(2)))).toBeNull();
  expect(pressable(`backlog-${key(2)}`)).not.toHaveLength(0);
});

test('a session left out records its other outcome, or its details with the day it was taught', async () => {
  const data = await withDay();
  await show(data);
  await press(`backlog-${key(1)}`);
  await press(`backlog-${key(1)}-other`);
  expect(
    root().findAll((node) => node.props.testID === 'outcome-sheet' && node.props.visible === true),
  ).not.toHaveLength(0);
  await press(`backlog-${key(1)}-details`);
  expect(onDetails).toHaveBeenCalledWith(expect.objectContaining({ key: key(1), day: '2026-10-15' }));
});

test('says when later weeks wait too', async () => {
  await show(await withDay(), 'rtl', '2026-10-23');
  expect(shown()).toEqual(expect.arrayContaining(['الخميس 15 أكتوبر 2026', text.backlog.later]));
  expect(shown()).not.toContain('الخميس 22 أكتوبر 2026');
});

test.each(
  (Object.keys(catalogues) as Language[]).flatMap((language) =>
    (['rtl', 'ltr'] as const).map((direction) => [language, direction] as const),
  ),
)('names every control, 48 dp each (%s, %s)', async (language, direction) => {
  await i18n.changeLanguage(language);
  await show(await withDay(), direction);
  await press(`backlog-${key(1)}`);
  expect(accessibilityProblems(root())).toEqual([]);
  expect(shown()).toContain(catalogues[language].backlog.hint);
});
