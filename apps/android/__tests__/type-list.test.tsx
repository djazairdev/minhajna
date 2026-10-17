// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Typing a class list (#27, Setup-4c-Type): each pupil saved when added, the
// list sorted, corrections and removals, and no limit on its size. Made-up
// pupils only.

import { parseDay } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { StyleSheet, Text, TextInput } from 'react-native';
import type { PressableProps, TextInputProps, TextProps } from 'react-native';
import ReactTestRenderer, { type ReactTestInstance } from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { openTestData, withData, type TestData } from '../jest/app-data';
import { TypeList } from '../src/setup/TypeList';
import { catalogues, i18n, type Language } from '../src/text/i18n';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const root = () => tree!.root;
const onDone = jest.fn();
const day = parseDay('2026-10-15');

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  await i18n.changeLanguage('ar');
  onDone.mockReset();
});

async function withClass(): Promise<TestData> {
  const data = await openTestData();
  await data.book.record(day, {
    kind: 'school.set',
    school: { id: 's-1', name: 'متوسطة النجاح', levels: ['cem'], subjects: ['arabic'], zone: '16' },
  });
  await data.book.record(day, {
    kind: 'class.set',
    schoolClass: {
      id: 'c-1',
      schoolId: 's-1',
      level: 'cem',
      grade: '4am',
      name: '4م3',
      groups: [{ id: 'g-1', kind: 'whole', name: '4م3' }],
    },
  });
  return data;
}

async function render(data: TestData, direction: 'rtl' | 'ltr' = 'rtl') {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={direction}>
        {withData(data, <TypeList classId="c-1" onDone={onDone} />)}
      </LocaleDirContext.Provider>,
    );
  });
}

const settle = () => ReactTestRenderer.act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
const control = (id: string): ReactTestInstance =>
  root().find((node) => node.props.testID === id && typeof node.props.onPress === 'function');
const input = (id: string) =>
  root()
    .find((node) => node.props.testID === id)
    .findByType(TextInput).props as TextInputProps;
const shown = () =>
  root()
    .findAllByType(Text)
    .map((node) => [node.props.children as unknown].flat().join(''));
const exists = (id: string) => root().findAll((node) => node.props.testID === id).length > 0;
const pupils = (data: TestData) => [...data.book.state.pupils.values()];
const rows = () =>
  root()
    .findAll((node) => /^pupil-(?!name|sex|registration|keep|remove|cancel)/.test(String(node.props.testID)), {
      deep: false,
    })
    .map((node) => String(node.props.accessibilityLabel));

async function press(id: string) {
  await ReactTestRenderer.act(() => {
    (control(id).props as PressableProps).onPress?.({} as never);
  });
}

async function type(id: string, value: string) {
  await ReactTestRenderer.act(() => {
    input(id).onChangeText?.(value);
  });
}

async function addPupil(name: string, sex: 'm' | 'f', registration = '') {
  await type('pupil-name', name);
  await press(`pupil-sex-${sex}`);
  await type('pupil-registration', registration);
  await press('pupil-keep');
  await settle();
}

test('says to type made-up names only, and waits for a name', async () => {
  await render(await withClass());
  expect(shown()).toEqual(
    expect.arrayContaining([text.setup.typeIntro, text.setup.trialBadge, text.setup.madeUpOnly, text.setup.typed_zero]),
  );
  expect(control('pupil-keep').props).toMatchObject({ disabled: true });
});

test('saves each pupil when added, sorted alphabetically, with or without a registration number', async () => {
  const data = await withClass();
  await render(data);
  await addPupil('شريف مريم', 'f', '2210450127');
  await addPupil('حداد أنس', 'm');
  await addPupil('بوزيد ياسين', 'm', '22104-50113');
  expect(pupils(data)).toHaveLength(3);
  expect(pupils(data).find((pupil) => pupil.name === 'حداد أنس')).not.toHaveProperty('registration');
  expect(rows()).toEqual([
    '1. بوزيد ياسين. 2210450113. ذكر',
    `2. حداد أنس. ${text.setup.noRegistration}. ذكر`,
    '3. شريف مريم. 2210450127. أنثى',
  ]);
  expect(shown()).toContain(text.setup.typed_few.replace('{{count}}', '3'));
  expect(input('pupil-name').value).toBe('');
});

test('refuses a registration number another pupil of the class already has', async () => {
  const data = await withClass();
  await render(data);
  await addPupil('شريف مريم', 'f', '2210450127');
  await type('pupil-name', 'حداد أنس');
  await type('pupil-registration', '2210450127');
  expect(shown()).toContain(text.setup.registrationTaken);
  expect(control('pupil-keep').props).toMatchObject({ disabled: true });
});

test('loads a pupil back to correct them, or to remove every version of them', async () => {
  const data = await withClass();
  await render(data);
  await addPupil('بوزيد ياسين', 'm');
  await addPupil('شريف مريم', 'f');
  const [first] = pupils(data).filter((pupil) => pupil.name === 'بوزيد ياسين');
  await press(`pupil-${first.id}`);
  expect(input('pupil-name').value).toBe('بوزيد ياسين');
  await type('pupil-registration', '2210450113');
  await press('pupil-keep');
  await settle();
  expect(data.book.state.pupils.get(first.id)?.registration).toBe('2210450113');
  expect(pupils(data)).toHaveLength(2);
  await press(`pupil-${first.id}`);
  await press('pupil-remove');
  await settle();
  expect(pupils(data).map((pupil) => pupil.name)).toEqual(['شريف مريم']);
  expect(JSON.stringify(data.storage.rows)).not.toContain('بوزيد ياسين');
  expect(exists('pupil-remove')).toBe(false);
});

test('takes a class of any size', async () => {
  const data = await withClass();
  for (let index = 0; index < 60; index++) {
    await data.book.record(day, {
      kind: 'pupil.set',
      pupil: { id: `p-${index}`, classId: 'c-1', name: `تلميذ ${index}`, sex: 'm', groups: [], movements: [] },
    });
  }
  await render(data);
  expect(rows()).toHaveLength(60);
  expect(shown()).toContain(text.setup.typed_many.replace('{{count}}', '60'));
  await addPupil('شريف مريم', 'f');
  expect(pupils(data)).toHaveLength(61);
  await press('list-save');
  expect(onDone).toHaveBeenCalledTimes(1);
});

test('keeps no fixed text height or line limit, so text at 200% wraps', async () => {
  const data = await withClass();
  await render(data);
  await addPupil('بوزيد ياسين', 'm');
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
)('names every field and row, 48 dp each, while correcting a pupil (%s, %s)', async (language, direction) => {
  await i18n.changeLanguage(language);
  const data = await withClass();
  await render(data, direction);
  await addPupil('بوزيد ياسين', 'm', '2210450113');
  await press(`pupil-${pupils(data)[0].id}`);
  expect(accessibilityProblems(root())).toEqual([]);
  expect(shown()).toContain(catalogues[language].setup.madeUpOnly);
});
