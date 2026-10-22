// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The Classes tab across schools (#232, PS-Classes, answers 394 and 397): a
// section per school in the order of its first class, «مدرسة الفتح ·
// فوجان», the heading counting the groups and the schools; a card for the
// merged week saying whether a clash is open, which opens the week; and a
// specialist told that each class's register counts only their sessions;
// archived classes are not counted.
// Made-up schools and classes only.

import { parseDay, type TimetableEntry } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withData, type TestData } from '../jest/app-data';
import { course, primaryClass, thursday, withSpecialist } from '../jest/specialist-classes';
import { ClassesTab } from '../src/classes/ClassesTab';
import { i18n, missingKeys, type Language } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const root = () => tree!.root;
const iso = (value: string) => `\u2068${value}\u2069`;
const onWeek = jest.fn();

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  onWeek.mockClear();
  await i18n.changeLanguage('ar');
});

async function show(data: TestData, language: Language = 'ar') {
  await i18n.changeLanguage(language);
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={language === 'ar' ? 'rtl' : 'ltr'}>
        {withData(
          data,
          <ClassesTab onClass={jest.fn()} onBook={jest.fn()} onWeek={onWeek} onDigest={jest.fn()} />,
          '2026-10-15',
        )}
      </LocaleDirContext.Provider>,
    );
  });
}

const byId = (id: string) => root().findAll((node) => node.props.testID === id)[0];
const words = (id: string) =>
  byId(id)
    ?.findAllByType(Text)
    .map((node) => [node.props.children as unknown].flat().join('')) ?? [];
const order = () =>
  root()
    .findAll((node) => typeof node.props.testID === 'string' && /^classes-(school-s-\d|f-\d)$/.test(node.props.testID))
    .map((node) => node.props.testID as string)
    .filter((id, index, all) => all.indexOf(id) === index);

test('a specialist in two schools sees a section per school, the merged week and the register', async () => {
  missingKeys.length = 0;
  await show(await withSpecialist());
  expect(order()).toEqual(['classes-school-s-1', 'classes-f-1', 'classes-f-2', 'classes-school-s-2', 'classes-f-3']);
  expect(words('classes-school-s-1')[0]).toBe(`${iso('مدرسة الفتح')} · فوجان`);
  expect(words('classes-school-s-2')[0]).toBe(`${iso('مدرسة الرياض')} · فوج واحد`);
  expect(words('classes-heading').some((line) => line.includes('3 أفواج · مؤسستان'))).toBe(true);
  expect(words('classes-week')).toEqual([
    'استعمال الزمن: مؤسستان',
    i18n.t('classes.weekNote', { clashes: 'لا تعارض في الأسبوع.' }),
  ]);
  expect(words('classes-register')).toEqual([i18n.t('classes.register')]);
  const press = byId('classes-week')?.props.onPress as (() => void) | undefined;
  await ReactTestRenderer.act(() => press?.());
  expect(onWeek).toHaveBeenCalledTimes(1);
  expect(accessibilityProblems(root())).toEqual([]);
  expect(missingKeys).toEqual([]);
});

test('the merged week’s card says a clash is open, in English', async () => {
  const clash: TimetableEntry = thursday('e-4', 'morning', 1, 'f-3', 'k-3');
  await show(await withSpecialist([], [clash]), 'en');
  expect(words('classes-week')).toEqual([
    'Timetable: 2 schools',
    i18n.t('classes.weekNote', { clashes: '1 clash in the week.' }),
  ]);
  expect(words('classes-school-s-1')[0]).toBe(`${iso('مدرسة الفتح')} · 2 groups`);
});

test('a class teacher keeps the half-day roll call, with no register card', async () => {
  await show(
    await withSpecialist([course('m-1', 'k-1', 'math'), course('m-2', 'k-2', 'math'), course('m-3', 'k-3', 'math')]),
  );
  expect(byId('classes-register')).toBeUndefined();
  expect(byId('classes-week')).toBeDefined();
});

test('an archived class is not counted among the groups', async () => {
  const archived = primaryClass('k-2', 's-1', '3ap', '3 ابتدائي ب');
  if (archived.kind !== 'class.set') throw new Error('Not a class');
  const event = { ...archived, schoolClass: { ...archived.schoolClass, archivedFrom: parseDay('2026-10-12') } };
  await show(await withSpecialist([event]));
  expect(words('classes-school-s-1')[0]).toBe(`${iso('مدرسة الفتح')} · فوج واحد`);
  expect(words('classes-heading').some((line) => line.includes('فوجان · مؤسستان'))).toBe(true);
});
