// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Setup-6-Plan and Setup-6b-Packs (#30): each grade and subject with its
// pack or none yet, pinning the example pack to classes, free entry for one
// class, a grade with no pack, the built-in calendar, and every control named
// and 48dp. Made-up schools, classes and packs only.

import { PACK_STATUSES, parseDay, type RecordEvent } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Text } from 'react-native';
import type { PressableProps } from 'react-native';
import ReactTestRenderer, { type ReactTestInstance } from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { openTestData, withData, type TestData } from '../jest/app-data';
import { Packs } from '../src/plan/Packs';
import { Plan } from '../src/setup/Plan';
import { catalogues, i18n, type Language } from '../src/text/i18n';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const root = () => tree!.root;
const onChange = jest.fn();
const onFinish = jest.fn();
const onDone = jest.fn();
const example = { id: 'dz.cem.4am.arabic.example', release: '2026.1' };

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  await i18n.changeLanguage('ar');
  for (const mock of [onChange, onFinish, onDone]) mock.mockReset();
});

const schoolClass = (id: string, name: string, grade: string): RecordEvent => ({
  kind: 'class.set',
  schoolClass: { id, schoolId: 's-1', level: 'cem', grade, name, groups: [{ id: `${id}-w`, kind: 'whole', name }] },
});

async function withClasses(): Promise<TestData> {
  const data = await openTestData();
  await data.book.recordAll(parseDay('2026-10-15'), [
    {
      kind: 'school.set',
      school: { id: 's-1', name: 'متوسطة النجاح', levels: ['cem'], subjects: ['arabic'], zone: '16' },
    },
    schoolClass('k-1', '4م1', '4am'),
    schoolClass('k-2', '4م2', '4am'),
    schoolClass('k-3', '1م1', '1am'),
    { kind: 'course.set', course: { id: 'c-1', classId: 'k-1', subject: 'arabic', year: '2026-2027', pack: null } },
  ]);
  return data;
}

async function show(data: TestData, screen: 'plan' | 'packs', direction: 'rtl' | 'ltr' = 'rtl') {
  await ReactTestRenderer.act(() => tree?.unmount());
  const shown =
    screen === 'plan' ? (
      <Plan onChange={onChange} onFinish={onFinish} />
    ) : (
      <Packs grade="4am" subject="arabic" onDone={onDone} />
    );
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={direction}>{withData(data, shown)}</LocaleDirContext.Provider>,
    );
  });
}

const settle = () => ReactTestRenderer.act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
const control = (id: string): ReactTestInstance =>
  root().find((node) => node.props.testID === id && typeof node.props.onPress === 'function');
const exists = (id: string) =>
  root().findAll((node) => node.props.testID === id && typeof node.props.onPress === 'function').length > 0;
const shown = () =>
  root()
    .findAllByType(Text)
    .map((node) => [node.props.children as unknown].flat().join(''));
const pins = (data: TestData) =>
  [...data.book.state.courses.values()].map((course) => [course.classId, course.pack?.release ?? null]);

async function press(id: string) {
  await ReactTestRenderer.act(() => {
    (control(id).props as PressableProps).onPress?.({} as never);
  });
}

test('lists each grade and subject with no pack pinned yet, the built-in calendar, and finishes setup', async () => {
  await show(await withClasses(), 'plan');
  expect(shown()).toEqual(
    expect.arrayContaining([
      text.plan.heading,
      'اللغة العربية · السنة الرابعة متوسط',
      text.plan.notPinned,
      '⁨4م1⁩ · دون حزمة',
      'اللغة العربية · السنة الأولى متوسط',
      text.plan.noPacksYet,
      'الرزنامة الوطنية \u20682026-2027\u2069',
      text.plan.bundled,
    ]),
  );
  expect(exists('plan-change-4am/arabic')).toBe(true);
  expect(exists('plan-change-1am/arabic')).toBe(false);
  await press('plan-change-4am/arabic');
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ grade: '4am', subject: 'arabic' }));
  await press('plan-finish');
  expect(onFinish).toHaveBeenCalledTimes(1);
});

test("pins the example pack to the grade's classes, keeping a course already made, and shows it on the plan", async () => {
  const data = await withClasses();
  await show(data, 'packs');
  expect(
    root().findAll(
      (node) =>
        node.props.testID === `pack-${example.id}` &&
        node.props.accessibilityRole === 'radio' &&
        (node.props as PressableProps).accessibilityState?.checked === true,
    ),
  ).not.toHaveLength(0);
  expect(shown()).toEqual(expect.arrayContaining(PACK_STATUSES.map((status) => text.plan.meaning[status])));
  await press('pack-pin');
  await settle();
  expect(onDone).toHaveBeenCalledTimes(1);
  expect(data.book.state.courses.get('c-1')?.pack).toEqual(example);
  expect(pins(data)).toEqual([
    ['k-1', '2026.1'],
    ['k-2', '2026.1'],
  ]);
  await show(data, 'plan');
  expect(shown()).toEqual(
    expect.arrayContaining([
      text.plan.status.example,
      'التوقيت: حصص لكل عنصر · الإصدار 2026.1',
      text.plan.meaning.example,
      '⁨4م2⁩ · 2026.1',
      text.plan.change,
    ]),
  );
});

test('pins free entry to one class only, and pins nothing until a class is chosen', async () => {
  const data = await withClasses();
  await show(data, 'packs');
  await press('pack-none');
  await press('pack-classes-k-1');
  await press('pack-classes-k-2');
  await press('pack-pin');
  expect(shown()).toContain(text.plan.noClass);
  expect(onDone).not.toHaveBeenCalled();
  await press('pack-classes-k-2');
  await press('pack-pin');
  await settle();
  expect(pins(data)).toEqual([
    ['k-1', null],
    ['k-2', null],
  ]);
  expect(data.book.state.courses.size).toBe(2);
});

test.each(
  (Object.keys(catalogues) as Language[]).flatMap((language) =>
    (['rtl', 'ltr'] as const).map((direction) => [language, direction] as const),
  ),
)('names every control, 48 dp each (%s, %s)', async (language, direction) => {
  await i18n.changeLanguage(language);
  const data = await withClasses();
  await show(data, 'plan', direction);
  expect(accessibilityProblems(root())).toEqual([]);
  expect(shown()).toContain(catalogues[language].plan.heading);
  await show(data, 'packs', direction);
  expect(accessibilityProblems(root())).toEqual([]);
  expect(shown()).toContain(catalogues[language].plan.statuses);
});
