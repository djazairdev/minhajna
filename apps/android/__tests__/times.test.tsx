// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Settings-times (#29): today's times and when Ramadan's start, each slot's
// time from the template, a time set to match the school's bell and set
// back, Ramadan's times, and a school with no template. Made-up schools.

import { parseDay, type RecordEvent } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { StyleSheet, Text, TextInput } from 'react-native';
import type { PressableProps, TextInputProps, TextProps } from 'react-native';
import ReactTestRenderer, { type ReactTestInstance } from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { openTestData, withData, type TestData } from '../jest/app-data';
import { catalogues, i18n, type Language } from '../src/text/i18n';
import text from '../src/text/ar.json';
import { Times } from '../src/times/Times';
import { readClock, readSpan } from '../src/times/times-rules';

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

const school = (id: string, name: string, level: string): RecordEvent => ({
  kind: 'school.set',
  school: { id, name, levels: [level], subjects: ['arabic'], zone: '16' },
});

async function withSchools(...events: RecordEvent[]): Promise<TestData> {
  const data = await openTestData();
  await data.book.recordAll(
    parseDay('2026-10-04'),
    events.length > 0 ? events : [school('s-1', 'متوسطة النجاح', 'cem')],
  );
  return data;
}

async function render(data: TestData, day = '2026-10-04', direction: 'rtl' | 'ltr' = 'rtl') {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={direction}>{withData(data, <Times />, day)}</LocaleDirContext.Provider>,
    );
  });
}

const settle = () => ReactTestRenderer.act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
const control = (id: string): ReactTestInstance =>
  root().find((node) => node.props.testID === id && typeof node.props.onPress === 'function');
const exists = (id: string) => root().findAll((node) => node.props.testID === id).length > 0;
const label = (id: string) => String(control(id).props.accessibilityLabel);
const shown = () =>
  root()
    .findAllByType(Text)
    .map((node) => [node.props.children as unknown].flat().join(''));

async function press(id: string) {
  await ReactTestRenderer.act(() => {
    (control(id).props as PressableProps).onPress?.({} as never);
  });
}

async function type(id: string, value: string) {
  await ReactTestRenderer.act(() => {
    (
      root()
        .find((node) => node.props.testID === id)
        .findByType(TextInput).props as TextInputProps
    ).onChangeText?.(value);
  });
}

test('reads a time as typed, and a span that ends after it starts', () => {
  expect(['8:15', '08.15', '8h15', ' 13:05 ', '24:00', '8:5', 'huit'].map(readClock)).toEqual([
    '08:15',
    '08:15',
    '08:15',
    '13:05',
    null,
    null,
    null,
  ]);
  expect(readSpan('8:00', '8:45')).toEqual({ from: '08:00', to: '08:45' });
  expect(readSpan('09:00', '08:00')).toBeNull();
});

test("shows today's usual times, when Ramadan's are expected, and each slot's time from the template", async () => {
  await render(await withSchools());
  expect(shown()).toEqual(
    expect.arrayContaining([
      'اليوم، الأحد 04/10/2026',
      text.times.usualNow,
      text.times.ramadanExpected.replace('{{date}}', 'الإثنين 8 فيفري 2027'),
      '⁨التعليم المتوسط⁩',
      `⁨${text.times.single}⁩`,
      text.times.template.replace('{{level}}', 'التعليم المتوسط'),
      '\u206708:00 – 09:00\u2069',
    ]),
  );
  expect(label('time-m1')).toBe('الحصة 1 صباحاً: من 08:00 إلى 09:00');
  expect(label('time-a4')).toBe('الحصة 4 مساءً: من 16:00 إلى 17:00');
  expect(exists('time-m5')).toBe(false);
});

test("sets a slot's time to match the school's bell, saves it on the school, and sets it back", async () => {
  const data = await withSchools();
  await render(data);
  await press('time-m1');
  expect(shown()).toContain(`الحصة 1 صباحاً · ${text.times.usualNow}`);
  expect(exists('time-reset')).toBe(false);
  await type('time-from', '8:15');
  await type('time-to', '9.10');
  await press('time-save');
  await settle();
  expect(data.book.state.schools.get('s-1')?.bells).toEqual({
    usual: [{ half: 'morning', index: 1, from: '08:15', to: '09:10' }],
  });
  expect(label('time-m1')).toBe('الحصة 1 صباحاً: من 08:15 إلى 09:10، وقت المؤسسة');
  expect(shown()).toContain(text.times.bySchool);
  await press('time-m1');
  await press('time-reset');
  await settle();
  expect(data.book.state.schools.get('s-1')).not.toHaveProperty('bells');
  expect(label('time-m1')).toBe('الحصة 1 صباحاً: من 08:00 إلى 09:00');
});

test('keeps nothing from a time that is not one, and says how to write it under the wrong field', async () => {
  const data = await withSchools();
  await render(data);
  await press('time-m2');
  await type('time-from', '10:00');
  await type('time-to', '9:30');
  await press('time-save');
  const errors = root()
    .findAllByType(Text)
    .filter((node) => node.props.children === text.times.invalid);
  expect(errors).toHaveLength(1);
  await press('time-close');
  await settle();
  expect(data.book.state.schools.get('s-1')).not.toHaveProperty('bells');
});

test("shows Ramadan's times, each session keeping its start, and opens on them in Ramadan", async () => {
  const data = await withSchools();
  await render(data);
  await press('times-hours-ramadan');
  expect(label('time-m2')).toBe('الحصة 2 صباحاً: من 09:00 إلى 09:45');
  await ReactTestRenderer.act(() => tree?.unmount());
  await render(data, '2027-02-10');
  expect(shown()).toEqual(
    expect.arrayContaining([text.times.ramadanNow, text.times.ramadanToday.replace('{{date}}', 'الإثنين 8 مارس 2027')]),
  );
  expect(label('time-m1')).toBe('الحصة 1 صباحاً: من 08:00 إلى 08:45');
});

test('offers each school, and says when a level has no template or Ramadan length yet', async () => {
  const data = await withSchools(school('s-1', 'متوسطة النجاح', 'cem'), school('s-2', 'مدرسة الأمل', 'primary'));
  await render(data);
  await press('times-school-s-2');
  expect(label('time-m1')).toBe(text.times.rowEmpty.replace('{{slot}}', 'الحصة 1 صباحاً'));
  expect(shown()).toEqual(expect.arrayContaining([text.times.noTemplate, text.times.noRamadan]));
});

test('keeps no fixed text height or line limit, so text at 200% wraps', async () => {
  await render(await withSchools());
  for (const node of root().findAllByType(Text)) {
    const props = node.props as TextProps;
    expect(props.numberOfLines).toBeUndefined();
    expect(StyleSheet.flatten(props.style) ?? {}).not.toHaveProperty('height');
  }
});

test.each(
  (Object.keys(catalogues) as Language[]).flatMap((language) =>
    (['rtl', 'ltr'] as const).map((direction) => [language, direction] as const),
  ),
)('names every slot and choice, 48 dp each (%s, %s)', async (language, direction) => {
  await i18n.changeLanguage(language);
  await render(await withSchools(), '2026-10-04', direction);
  expect(accessibilityProblems(root())).toEqual([]);
  await press('time-a1');
  expect(accessibilityProblems(root())).toEqual([]);
  expect(shown()).toContain(catalogues[language].times.from);
});
