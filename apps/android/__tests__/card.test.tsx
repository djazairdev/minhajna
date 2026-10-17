// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Setup's second step, the teacher card (#26): the name is personal and kept
// in the device layer, the rank is printed, and the rest comes from step 1.
// Made-up teacher and schools only.

import { parseDay } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { StyleSheet, Text, TextInput } from 'react-native';
import type { PressableProps, TextInputProps, TextProps } from 'react-native';
import ReactTestRenderer, { type ReactTestInstance } from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { openTestData, withData, type TestData } from '../jest/app-data';
import { Card } from '../src/setup/Card';
import { TYPING_PAUSE } from '../src/setup/useDraft';
import { catalogues, i18n, type Language } from '../src/text/i18n';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const root = () => tree!.root;
const onNext = jest.fn();

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  await i18n.changeLanguage('ar');
  onNext.mockReset();
});

/** A history with two made-up schools from step 1. */
async function withSchools(): Promise<TestData> {
  const data = await openTestData();
  const day = parseDay('2026-10-15');
  await data.book.record(day, {
    kind: 'school.set',
    school: { id: 's-1', name: 'متوسطة النجاح', levels: ['cem'], subjects: ['arabic', 'islamic'], zone: '16' },
  });
  await data.book.record(day, {
    kind: 'school.set',
    school: { id: 's-2', name: 'متوسطة الأمل', levels: ['cem'], subjects: ['arabic'], zone: '16' },
  });
  return data;
}

async function render(data: TestData, direction: 'rtl' | 'ltr' = 'rtl') {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={direction}>
        {withData(data, <Card onNext={onNext} />)}
      </LocaleDirContext.Provider>,
    );
  });
}

const settle = (ms = 0) => ReactTestRenderer.act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));

const input = (id: string) =>
  root()
    .find((node) => node.props.testID === id)
    .findByType(TextInput).props as TextInputProps;

async function type(id: string, value: string) {
  await ReactTestRenderer.act(() => {
    input(id).onChangeText?.(value);
  });
}

async function leave(id: string) {
  await ReactTestRenderer.act(() => {
    input(id).onBlur?.({} as never);
  });
}

function control(id: string): ReactTestInstance {
  return root().find((node) => node.props.testID === id && typeof node.props.onPress === 'function');
}

async function press(id: string) {
  await ReactTestRenderer.act(() => {
    (control(id).props as PressableProps).onPress?.({} as never);
  });
}

const shown = () =>
  root()
    .findAllByType(Text)
    .map((node) => [node.props.children as unknown].flat().join(''));
const label = (id: string) =>
  String(root().find((node) => node.props.testID === id && node.props.accessible === true).props.accessibilityLabel);
const rows = (data: TestData, kind: string) => data.storage.rows.filter((row) => row.kind === kind);

test('shows the card, with the name marked personal and the rest from step 1', async () => {
  const data = await withSchools();
  await render(data);
  expect(shown()).toEqual(
    expect.arrayContaining([
      text.setup.cardHeading,
      text.setup.cardIntro,
      `${text.setup.name} (${text.setup.personal})`,
      text.setup.fromStepOne,
    ]),
  );
  expect(label('card-subjects')).toBe('المادة: اللغة العربية، التربية الإسلامية');
  expect(label('card-year')).toBe('السنة الدراسية: 2026-2027');
  expect(label('card-schools')).toBe('المؤسسة: متوسطة النجاح، متوسطة الأمل');
});

test('keeps the name in the device layer and the rank with the lesson record, once typing pauses', async () => {
  const data = await withSchools();
  await render(data);
  await type('card-name', '  بن يحيى سعاد ');
  await type('card-rank', 'أستاذ التعليم المتوسط');
  await settle();
  expect(rows(data, 'teacher.personal.set')).toEqual([]);
  await settle(TYPING_PAUSE + 50);
  await settle();
  expect(data.book.state.personal).toEqual({ name: 'بن يحيى سعاد' });
  expect(data.book.state.teacher).toEqual({ rank: 'أستاذ التعليم المتوسط' });
  expect(rows(data, 'teacher.personal.set').map((row) => row.layer)).toEqual(['device']);
  expect(rows(data, 'teacher.set').map((row) => row.layer)).toEqual(['lesson-record']);
});

test('saves on leaving a field, and an emptied name keeps no name', async () => {
  const data = await withSchools();
  await render(data);
  await type('card-name', 'بن يحيى سعاد');
  await leave('card-name');
  await settle();
  expect(data.book.state.personal).toEqual({ name: 'بن يحيى سعاد' });
  await type('card-name', ' ');
  await leave('card-name');
  await settle();
  expect(data.book.state.personal).toEqual({});
});

test('shows what was typed before when setup opens again', async () => {
  const data = await withSchools();
  await render(data);
  await type('card-name', 'بن يحيى سعاد');
  await type('card-rank', 'أستاذ التعليم المتوسط');
  await ReactTestRenderer.act(() => tree?.unmount());
  await settle();
  await render(await openTestData(data.storage));
  expect(input('card-name').value).toBe('بن يحيى سعاد');
  expect(input('card-rank').value).toBe('أستاذ التعليم المتوسط');
});

test.each(['card-next', 'card-later'])('%s leads on and saves what is still being typed', async (id) => {
  const data = await withSchools();
  await render(data);
  await type('card-rank', 'أستاذ التعليم المتوسط');
  await press(id);
  await settle();
  expect(onNext).toHaveBeenCalledTimes(1);
  expect(data.book.state.teacher).toEqual({ rank: 'أستاذ التعليم المتوسط' });
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
)('names every field and control, 48 dp each (%s, %s)', async (language, direction) => {
  await i18n.changeLanguage(language);
  await render(await withSchools(), direction);
  expect(accessibilityProblems(root())).toEqual([]);
  expect(shown()).toContain(catalogues[language].setup.cardHeading);
});
