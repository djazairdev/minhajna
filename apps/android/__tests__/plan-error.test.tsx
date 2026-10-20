// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reporting a plan error (#225, Plan-error, R-4.3-01 to R-4.3-03): the
// report shown as is, shared only once it has a note, with a name only when
// the teacher asks for credit and types it, and nothing about the class,
// school or pupils; a part of a split names the pack item; an added item
// has nothing to report; every control is named in each language and
// direction. Made-up data only.

import { parseDay } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Share, Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withData, type TestData } from '../jest/app-data';
import { withDay } from '../jest/today-day';
import { PlanError } from '../src/plan/PlanError';
import { changeEvent, type Draft } from '../src/plan/item-rules';
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

async function show(data: TestData, itemId: string, direction: 'rtl' | 'ltr' = 'rtl') {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={direction}>
        {withData(data, <PlanError courseId="c-1" itemId={itemId} />, '2026-10-15')}
      </LocaleDirContext.Provider>,
    );
  });
}
const shown = () =>
  root()
    .findAllByType(Text)
    .map((node) =>
      [node.props.children as unknown]
        .flat()
        .filter((part) => typeof part === 'string')
        .join(''),
    );
const control = (id: string) =>
  root().findAll((node) => node.props.testID === id && typeof node.props.onPress === 'function')[0];
const press = (id: string) => ReactTestRenderer.act(() => (control(id)?.props.onPress as () => void)());
const type = (id: string, value: string) =>
  ReactTestRenderer.act(() =>
    (
      root().findAll((node) => node.props.testID === id && typeof node.props.onChangeText === 'function')[0]?.props
        .onChangeText as (value: string) => void
    )(value),
  );
const disabled = (id: string) => {
  const node = root().findAll((one) => one.props.testID === id && one.props.accessibilityState !== undefined)[0];
  return (node?.props.accessibilityState as { disabled?: boolean } | undefined)?.disabled === true;
};

test('shows the report as is, and shares it once it has a note, with no class, school or name', async () => {
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction, activityType: undefined });
  await show(await withDay(), 'u1-3');
  expect(disabled('error-share')).toBe(true);
  expect(shown()).toContain(text.planError.needsNote);
  await press('error-kind-page');
  await type('error-note', 'النص في الصفحة 26 لا في الصفحة 24.');
  expect(disabled('error-share')).toBe(false);
  const lines = [
    text.planError.title,
    'العنصر: dz.cem.4am.arabic.example · u1-3',
    'الإصدار: 2026.1',
    'النوع: صفحة الكتاب',
    'الملاحظة: \u2068النص في الصفحة 26 لا في الصفحة 24.\u2069',
    'الاسم: لا يُرسل',
  ];
  expect(shown()).toEqual(expect.arrayContaining(lines));
  await press('error-share');
  expect(share).toHaveBeenCalledWith({ message: lines.join('\n'), title: text.planError.title });
  const message = share.mock.calls[0][0].message!;
  expect(message).not.toMatch(/4م1|متوسطة النجاح/);
  expect(accessibilityProblems(root())).toEqual([]);
});

test('adds a name only when the teacher asks for credit and types it, without bidi controls', async () => {
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction, activityType: undefined });
  await show(await withDay(), 'u1-3');
  await type('error-note', 'ملاحظة\u2069 للتجربة');
  await press('error-credit');
  expect(disabled('error-share')).toBe(true);
  expect(shown()).toContain(text.planError.needsName);
  await type('error-name', 'س.\u202e للتجربة');
  await press('error-share');
  expect(share.mock.calls[0][0].message).toContain('الملاحظة: \u2068ملاحظة للتجربة\u2069');
  expect(share.mock.calls[0][0].message).toContain('الاسم: \u2068س. للتجربة\u2069');
  await press('error-credit');
  expect(root().findAll((node) => node.props.testID === 'error-name')).toHaveLength(0);
  expect(shown()).toContain('الاسم: لا يُرسل');
});

test('names the pack item for a part of a split, and has nothing to report for an added item', async () => {
  const data = await withDay();
  const day = parseDay('2026-10-15');
  const record = async (draft: Draft, id: string) => {
    await data.book.record(day, changeEvent(coreContext({ ...data, state: data.book.state }), 'c-1', draft, id, day));
  };
  await record({ kind: 'split', item: 'u1-3', titles: ['أ', 'ب'] }, 's1');
  await record({ kind: 'add', title: 'مراجعة', sessions: 1, before: null }, 'a1');
  await show(data, 'u1-3~s1~2');
  expect(shown()).toContain('العنصر: dz.cem.4am.arabic.example · u1-3، الجزء 2');
  await ReactTestRenderer.act(() => tree?.unmount());
  await show(data, 'add~a1');
  expect(shown()).toEqual([text.planError.gone]);
});

test.each(
  (Object.keys(catalogues) as Language[]).flatMap((language) =>
    (['rtl', 'ltr'] as const).map((direction) => [language, direction] as const),
  ),
)('names every control (%s, %s)', async (language, direction) => {
  await i18n.changeLanguage(language);
  await show(await withDay(), 'u1-3', direction);
  await press('error-credit');
  expect(accessibilityProblems(root())).toEqual([]);
  expect(shown()).toContain(catalogues[language].planError.sendTo);
});
