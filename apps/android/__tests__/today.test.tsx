// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Today (#32): the day's sessions in order with the plan's proposal in
// pencil on the focus card, one tap that records it, its undo leaving the
// history as it was apart from the two entries, a class with no pack, a day
// with no session, and every control named and 48dp. Made-up schools,
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
const onRoll = jest.fn();

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  await i18n.changeLanguage('ar');
  onHelp.mockReset();
});

async function show(data: TestData, direction: 'rtl' | 'ltr' = 'rtl', day = '2026-10-15') {
  await ReactTestRenderer.act(() => tree?.unmount());
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={direction}>
        {withData(data, <Today onHelp={onHelp} onDetails={onDetails} onRoll={onRoll} />, day)}
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
    (pressable(id)[0].props as PressableProps).onPress?.({} as never);
  });
  await settle();
};

test("lists the day's sessions in order, with the plan's proposal in pencil on the first", async () => {
  await show(await withDay());
  expect(shown()).toEqual([
    'الخميس',
    '15 أكتوبر 2026',
    'كل الحصص السابقة مؤكّدة · 3 حصص اليوم',
    '4م1',
    '⁧08:00 – 09:00⁩',
    'اللغة العربية',
    text.today.tag,
    'تقويم تشخيصي (مثال)',
    'الموضوع: ',
    '- الحصة 1 من 2',
    text.today.confirm,
    text.outcome.other,
    text.entry.open,
    '4م1',
    '⁧09:00 – 10:00⁩',
    'تابع: تقويم تشخيصي (مثال)',
    '4م2',
    '⁧10:00 – 11:00⁩',
    text.today.noProposal,
    text.today.confirmDay,
  ]);
  expect(pressable(`today-${key(1)}-confirm`).length).toBeGreaterThan(0);
  expect(pressable(`today-${key(2)}-confirm`)).toHaveLength(0);
  await press('today-help');
  expect(onHelp).toHaveBeenCalledTimes(1);
});

test('records the proposal in one tap, and its undo leaves the history as it was apart from the two entries', async () => {
  const data = await withDay();
  await show(data);
  const entries = data.book.entries.length;
  await press(`today-${key(1)}-confirm`);
  const recorded = current(data.book.state.sessions.get(key(1)));
  expect(recorded).toMatchObject({ outcome: 'done', coverage: [{ op: 'taught', item: 'd1', from: 0, to: 0 }] });
  expect(shown()).toEqual(
    expect.arrayContaining([
      'كل الحصص السابقة مؤكّدة · حصة مؤكّدة من 3 حصص اليوم',
      'تقويم تشخيصي (مثال)',
      text.today.recorded,
      text.today.snack,
    ]),
  );
  expect(pressable(`today-${key(2)}-confirm`).length).toBeGreaterThan(0);
  const before = data.book.state;
  await ReactTestRenderer.act(() => {
    (
      root().find(
        (node) => node.props.accessibilityLabel === text.today.undo && typeof node.props.onPress === 'function',
      ).props as PressableProps
    ).onPress?.({} as never);
  });
  await settle();
  expect(data.book.entries.length).toBe(entries + 2);
  expect(current(data.book.state.sessions.get(key(1)))).toBeNull();
  expect(data.book.state.sessions.get(key(1))?.[0]?.value).toEqual(recorded);
  expect(before.sessions.get(key(1))).toHaveLength(1);
  expect(shown()).toContain('كل الحصص السابقة مؤكّدة · 3 حصص اليوم');
  expect(shown()).not.toContain(text.today.snack);
  expect(pressable(`today-${key(1)}-confirm`).length).toBeGreaterThan(0);
});

test('says when no session is in the timetable today', async () => {
  await show(await withDay(), 'rtl', '2026-10-16');
  expect(shown().slice(0, 3)).toEqual(['الجمعة', '16 أكتوبر 2026', `3 حصص سابقة تنتظر التأكيد · ${text.today.none}`]);
});

test('states how many earlier sessions await confirmation, as a fact', async () => {
  await show(await withDay(), 'rtl', '2026-10-22');
  expect(shown()).toContain('3 حصص سابقة تنتظر التأكيد · 3 حصص اليوم');
});

test.each(
  (Object.keys(catalogues) as Language[]).flatMap((language) =>
    (['rtl', 'ltr'] as const).map((direction) => [language, direction] as const),
  ),
)('names every control, 48 dp each (%s, %s)', async (language, direction) => {
  await i18n.changeLanguage(language);
  const data = await withDay();
  await show(data, direction);
  expect(accessibilityProblems(root())).toEqual([]);
  expect(shown()).toContain(catalogues[language].today.confirm);
  await press(`today-${key(1)}-confirm`);
  expect(accessibilityProblems(root())).toEqual([]);
  expect(shown()).toContain(catalogues[language].today.snack);
});
