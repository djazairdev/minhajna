// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Setup's third step (#27, Setup-4-Classes): adding classes, and each class's
// size and whether its list is ready, and the demo class. Made-up schools and
// pupils only.

import { parseDay, type School } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { StyleSheet, Text, TextInput } from 'react-native';
import type { PressableProps, TextInputProps, TextProps } from 'react-native';
import ReactTestRenderer, { type ReactTestInstance } from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { openTestData, withData, type TestData } from '../jest/app-data';
import { Classes } from '../src/setup/Classes';
import { catalogues, i18n, type Language } from '../src/text/i18n';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const root = () => tree!.root;
const onType = jest.fn();
const onNext = jest.fn();
const day = parseDay('2026-10-15');

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  await i18n.changeLanguage('ar');
  onType.mockReset();
  onNext.mockReset();
});

const schools: School[] = [
  { id: 's-1', name: 'متوسطة النجاح', levels: ['cem'], subjects: ['arabic'], zone: '16' },
  { id: 's-2', name: 'ابتدائية الأمل', levels: ['primary'], subjects: ['english'], zone: '16' },
];

async function withSchools(count = 1): Promise<TestData> {
  const data = await openTestData();
  for (const school of schools.slice(0, count)) await data.book.record(day, { kind: 'school.set', school });
  return data;
}

async function render(data: TestData, direction: 'rtl' | 'ltr' = 'rtl') {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={direction}>
        {withData(data, <Classes onType={onType} onNext={onNext} />)}
      </LocaleDirContext.Provider>,
    );
  });
}

const settle = () => ReactTestRenderer.act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

function control(id: string): ReactTestInstance {
  return root().find((node) => node.props.testID === id && typeof node.props.onPress === 'function');
}

async function press(id: string) {
  await ReactTestRenderer.act(() => {
    (control(id).props as PressableProps).onPress?.({} as never);
  });
}

async function typeName(value: string) {
  await ReactTestRenderer.act(() => {
    (
      root()
        .find((node) => node.props.testID === 'class-name')
        .findByType(TextInput).props as TextInputProps
    ).onChangeText?.(value);
  });
}

const shown = () =>
  root()
    .findAllByType(Text)
    .map((node) => [node.props.children as unknown].flat().join(''));
const exists = (id: string) => root().findAll((node) => node.props.testID === id).length > 0;
const chips = (group: string) =>
  root()
    .findAll((node) => typeof node.props.testID === 'string' && node.props.testID.startsWith(`${group}-`), {
      deep: false,
    })
    .map((node) => String(node.props.testID).slice(group.length + 1));

async function addClass(grade: string, name: string) {
  await press('add-class-open');
  await press(`class-grade-${grade}`);
  await typeName(name);
  await press('class-add');
  await settle();
}

test('starts with no class, the note on kept columns, and a way on', async () => {
  await render(await withSchools());
  expect(shown()).toEqual(
    expect.arrayContaining([text.setup.classesHeading, text.setup.classesIntro, text.setup.columnsNote]),
  );
  expect(exists('add-class')).toBe(false);
  await press('classes-next');
  expect(onNext).toHaveBeenCalledTimes(1);
});

test('adds a class of a grade the school teaches, saved with its whole-class group', async () => {
  const data = await withSchools();
  await render(data);
  await press('add-class-open');
  expect(exists('class-school-s-1')).toBe(false);
  expect(chips('class-grade')).toEqual(['1am', '2am', '3am', '4am']);
  expect(control('class-add').props).toMatchObject({ disabled: true });
  await press('class-grade-4am');
  await typeName(' 4م3 ');
  expect(control('class-add').props).toMatchObject({ disabled: false });
  await press('class-add');
  await settle();
  const [added] = [...data.book.state.classes.values()];
  expect(added).toMatchObject({ schoolId: 's-1', level: 'cem', grade: '4am', name: '4م3' });
  expect(added?.groups).toEqual([{ id: expect.any(String) as string, kind: 'whole', name: '4م3' }]);
  expect(exists('add-class')).toBe(false);
  expect(shown()).toEqual(expect.arrayContaining(['4م3', text.setup.listMissing, text.setup.typeList]));
  await press(`type-${added.id}`);
  expect(onType).toHaveBeenCalledWith(added);
});

test('asks for the school when there are several, and offers its own grades', async () => {
  await render(await withSchools(2));
  await press('add-class-open');
  expect(chips('class-school')).toEqual(['s-1', 's-2']);
  await press('class-grade-2am');
  await press('class-school-s-2');
  expect(chips('class-grade')).toEqual(['1ap', '2ap', '3ap', '4ap', '5ap']);
  expect(control('class-add').props).toMatchObject({ disabled: true });
  await press('class-cancel');
  expect(exists('add-class')).toBe(false);
});

test('shows a class with pupils as ready, with its size, and opens its list', async () => {
  const data = await withSchools();
  await render(data);
  await addClass('1am', '1م2');
  const [added] = [...data.book.state.classes.values()];
  for (const [id, name] of [
    ['p-1', 'بوزيد ياسين'],
    ['p-2', 'شريف مريم'],
    ['p-3', 'حداد أنس'],
  ]) {
    await data.book.record(day, {
      kind: 'pupil.set',
      pupil: { id: id, classId: added.id, name: name, sex: 'm', groups: [], movements: [] },
    });
  }
  await ReactTestRenderer.act(() => tree?.unmount());
  await render(await openTestData(data.storage));
  expect(control(`class-${added.id}`).props.accessibilityLabel).toBe('1م2، 3 تلاميذ، القائمة جاهزة');
  expect(exists(`type-${added.id}`)).toBe(false);
  await press(`class-${added.id}`);
  expect(onType).toHaveBeenCalledTimes(1);
});

test('adds the demo class once: 45 made-up pupils, in the class the teacher names', async () => {
  const data = await withSchools();
  await render(data);
  await press('add-demo-open');
  expect(shown()).toContain(
    text.setup.demoNote.replace('{{pupils}}', text.setup.pupils_many.replace('{{count}}', '45')),
  );
  await press('class-grade-1am');
  await press('class-add');
  await settle();
  const [demo] = [...data.book.state.classes.values()];
  expect(demo).toMatchObject({ grade: '1am', name: text.setup.demoName, demo: true });
  const pupils = [...data.book.state.pupils.values()];
  expect(pupils).toHaveLength(45);
  expect(pupils.every((pupil) => pupil.classId === demo.id && pupil.registration?.startsWith('99'))).toBe(true);
  expect(control(`class-${demo.id}`).props.accessibilityLabel).toBe(
    `${text.setup.demoName}، ${text.setup.pupils_many.replace('{{count}}', '45')}، ${text.setup.listReady}`,
  );
  expect(exists('add-demo-open')).toBe(false);
  expect(exists('add-class-open')).toBe(true);
});

test('adds no pupils to a class added the usual way', async () => {
  const data = await withSchools();
  await render(data);
  await addClass('2am', '2م1');
  expect(data.book.state.pupils.size).toBe(0);
  expect([...data.book.state.classes.values()][0]).not.toHaveProperty('demo');
  expect(exists('add-demo-open')).toBe(true);
});

test('keeps no fixed text height or line limit, so text at 200% wraps', async () => {
  await render(await withSchools(2));
  await press('add-class-open');
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
)('names every control, 48 dp each, with a class and the form open (%s, %s)', async (language, direction) => {
  await i18n.changeLanguage(language);
  await render(await withSchools(2), direction);
  await addClass('3am', '3م1');
  expect(accessibilityProblems(root())).toEqual([]);
  await press('add-demo-open');
  expect(accessibilityProblems(root())).toEqual([]);
  expect(shown()).toContain(catalogues[language].setup.classesHeading);
});
