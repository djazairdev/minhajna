// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A joint class at setup (#43, Setup-4d-Joint): two or three primary years in
// one class, then each pupil's year as the list is typed. Made-up schools and
// pupils only.

import { parseDay, type School } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import type { ReactElement } from 'react';
import { Text, TextInput } from 'react-native';
import type { PressableProps, TextInputProps } from 'react-native';
import ReactTestRenderer, { type ReactTestInstance } from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { openTestData, withData, type TestData } from '../jest/app-data';
import { Classes } from '../src/setup/Classes';
import { TypeList } from '../src/setup/TypeList';
import { i18n } from '../src/text/i18n';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const root = () => tree!.root;
const day = parseDay('2026-10-15');

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  await i18n.changeLanguage('ar');
});

const middle: School = { id: 's-1', name: 'متوسطة النجاح', levels: ['cem'], subjects: ['arabic'], zone: '16' };
const primary: School = { id: 's-2', name: 'ابتدائية الأمل', levels: ['primary'], subjects: ['arabic'], zone: '16' };

async function withSchools(...schools: School[]): Promise<TestData> {
  const data = await openTestData();
  for (const school of schools) await data.book.record(day, { kind: 'school.set', school });
  return data;
}

async function render(data: TestData, node: ReactElement) {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">{withData(data, node)}</LocaleDirContext.Provider>,
    );
  });
}

const settle = () => ReactTestRenderer.act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
const control = (id: string): ReactTestInstance =>
  root().find((node) => node.props.testID === id && typeof node.props.onPress === 'function');
const exists = (id: string) => root().findAll((node) => node.props.testID === id).length > 0;
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

async function addJoint(data: TestData, ...grades: string[]) {
  await render(data, <Classes onType={jest.fn()} onNext={jest.fn()} />);
  await press('add-joint-open');
  for (const grade of grades) await press(`joint-years-${grade}`);
  await type('joint-name', ' 4-5 أ ');
  await press('joint-add');
  await settle();
  return [...data.book.state.classes.values()][0];
}

test('offers a joint class only where a school teaches primary', async () => {
  await render(await withSchools(middle), <Classes onType={jest.fn()} onNext={jest.fn()} />);
  expect(exists('add-joint-open')).toBe(false);
  await ReactTestRenderer.act(() => tree?.unmount());
  await render(await withSchools(middle, primary), <Classes onType={jest.fn()} onNext={jest.fn()} />);
  await press('add-joint-open');
  expect(shown()).toEqual(expect.arrayContaining([text.joint.title, text.joint.sub, text.joint.levelsHint]));
  expect(exists('joint-school-s-1')).toBe(false);
  expect(accessibilityProblems(root())).toEqual([]);
});

test('adds two or three years, saved as the class’s years in order', async () => {
  const data = await withSchools(primary);
  await render(data, <Classes onType={jest.fn()} onNext={jest.fn()} />);
  await press('add-joint-open');
  await type('joint-name', '4-5 أ');
  await press('joint-years-5ap');
  expect(control('joint-add').props).toMatchObject({ disabled: true });
  await press('joint-years-4ap');
  expect(control('joint-add').props).toMatchObject({ disabled: false });
  await press('joint-years-3ap');
  await press('joint-years-2ap');
  expect(control('joint-add').props).toMatchObject({ disabled: true });
  await press('joint-cancel');
  expect(data.book.state.classes.size).toBe(0);

  const added = await addJoint(data, '5ap', '4ap');
  expect(added).toMatchObject({ schoolId: 's-2', level: 'primary', grade: '4ap', name: '4-5 أ' });
  expect(added.groups.map(({ kind, grade }) => [kind, grade])).toEqual([
    ['whole', undefined],
    ['level', '4ap'],
    ['level', '5ap'],
  ]);
  expect(shown().join('\n')).toContain(
    `${text.joint.title} · السنة الرابعة ابتدائي: ${text.setup.pupils_zero} · السنة الخامسة ابتدائي: ${text.setup.pupils_zero}`,
  );
});

test('asks each pupil’s year in a joint class, and counts each year', async () => {
  const data = await withSchools(primary);
  const joint = await addJoint(data, '4ap', '5ap');
  await ReactTestRenderer.act(() => tree?.unmount());
  await render(data, <TypeList classId={joint.id} onDone={jest.fn()} />);
  await type('pupil-name', 'سلمى حداد');
  expect(control('pupil-keep').props).toMatchObject({ disabled: true });
  await press('pupil-year-5ap');
  await press('pupil-keep');
  await settle();
  await type('pupil-name', 'أنس مزيان');
  await press('pupil-keep');
  await settle();
  const [five] = joint.groups.filter((group) => group.grade === '5ap');
  expect([...data.book.state.pupils.values()].map((pupil) => pupil.groups)).toEqual([[five?.id], [five?.id]]);
  expect(shown()).toContain(
    `السنة الرابعة ابتدائي: ${text.setup.pupils_zero} · السنة الخامسة ابتدائي: ${text.setup.pupils_two}`,
  );
  expect(accessibilityProblems(root())).toEqual([]);
});
