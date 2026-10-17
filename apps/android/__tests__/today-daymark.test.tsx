// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Today on a holiday or in an exam week (#36): the day's name on the board,
// the sessions the calendar took counted apart and never as delay, the
// plan's pause in an exam week, the next session the calendar leaves, and
// every control named and 48dp. Made-up schools, classes and timetables
// only; the calendar is the bundled 2026-2027 one.

import { LocaleDirContext } from '@react-navigation/native';
import { Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withData, type TestData } from '../jest/app-data';
import { withDay } from '../jest/today-day';
import { catalogues, i18n, type Language } from '../src/text/i18n';
import text from '../src/text/ar.json';
import { Today } from '../src/today/Today';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const root = () => tree!.root;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  await i18n.changeLanguage('ar');
});

async function show(data: TestData, day: string, direction: 'rtl' | 'ltr' = 'rtl') {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={direction}>
        {withData(data, <Today onHelp={jest.fn()} onDetails={jest.fn()} onRoll={jest.fn()} />, day)}
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
        .filter((part) => typeof part === 'string' || typeof part === 'number')
        .join(''),
    );
const has = (id: string) => root().findAll((node) => node.props.testID === id).length > 0;
const cards = () =>
  new Set(
    root()
      .findAll((node) => typeof node.props.testID === 'string')
      .map((node) => node.props.testID as string)
      .filter((id) => /^today-c-\d+\/[\d-]+\/m\d+\/k-\d+-w$/.test(id)),
  ).size;

test('a holiday shows its name, counts the sessions it took apart, and gives the next session', async () => {
  await show(await withDay(), '2026-10-29');
  expect(shown()).toEqual(
    expect.arrayContaining([
      '6 حصص سابقة تنتظر التأكيد',
      'عطلة الخريف',
      text.daymark.holidayNational,
      '3 حصص لم تُعقد بسبب الرزنامة',
      text.daymark.lostNote,
      text.daymark.next,
      '4م1 · ⁧08:00 – 09:00⁩ · الخميس 5 نوفمبر',
    ]),
  );
  expect(cards()).toBe(0);
  expect(accessibilityProblems(root())).toEqual([]);
});

test('an exam week pauses the plan, counts no session as lost, and gives the next session', async () => {
  await show(await withDay(), '2026-12-10');
  expect(shown()).toEqual(
    expect.arrayContaining([
      'اختبارات الفصل الأول',
      '6 ديسمبر – 10 ديسمبر · اليوم 5 من 5',
      text.daymark.paused,
      text.daymark.pausedNote,
      '4م1 · ⁧08:00 – 09:00⁩ · الخميس 17 ديسمبر',
    ]),
  );
  expect(has('day-lost')).toBe(false);
  expect(cards()).toBe(0);
});

test('a holiday week with no session takes none, and says when teaching starts again', async () => {
  await show(await withDay(), '2026-12-24');
  expect(shown()).toEqual(expect.arrayContaining(['عطلة الشتاء', text.daymark.next]));
  expect(has('day-lost')).toBe(false);
  expect(shown().some((line) => line.endsWith('الخميس 7 جانفي'))).toBe(true);
});

test('an ordinary day has no mark', async () => {
  await show(await withDay(), '2026-10-15');
  expect(has('day-mark')).toBe(false);
  expect(has('day-next')).toBe(false);
  expect(cards()).toBe(3);
});

test.each(
  (Object.keys(catalogues) as Language[]).flatMap((language) =>
    (['rtl', 'ltr'] as const).map((direction) => [language, direction] as const),
  ),
)('names every part, 48 dp each (%s, %s)', async (language, direction) => {
  await i18n.changeLanguage(language);
  await show(await withDay(), '2026-10-29', direction);
  expect(accessibilityProblems(root())).toEqual([]);
  expect(shown()).toContain(catalogues[language].daymark.lostNote);
});
