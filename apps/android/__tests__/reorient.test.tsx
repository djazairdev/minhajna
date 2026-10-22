// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reshaping classes after reorientation (#231, Reorient, answer 391): the
// screen starts on the day it is opened with the class's level, each old class
// becoming a new class of its name; it previews each new class and where the
// pupils go, applies the reshaping in one step and says so; a pupil sent to a
// class the teacher does not teach leaves only; a reshaping that does not hold
// is refused with its reason; applying asks first; an old class whose history
// no new class takes says so; the row shows only in a lycée class's settings;
// an archived class reads as such; and every text in each language. Made-up
// classes only.

import { parseDay } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { createRef } from 'react';
import {
  Alert,
  Text,
  type AlertButton,
  type PressableProps,
  type TextInputProps,
  type ViewInstance,
} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withData, type TestData } from '../jest/app-data';
import { withReshape } from '../jest/reorient-lycee';
import { ClassPage } from '../src/classes/ClassPage';
import { ClassesTab } from '../src/classes/ClassesTab';
import { Reorient } from '../src/reorient/Reorient';
import { catalogues, type Language } from '../src/text/i18n';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const root = () => tree!.root;
const onDone = jest.fn();

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  onDone.mockReset();
});

async function mount(data: TestData, element: React.ReactElement, today = '2026-10-08') {
  await ReactTestRenderer.act(() => tree?.unmount());
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">{withData(data, element, today)}</LocaleDirContext.Provider>,
    );
  });
  await settle();
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
const press = async (id: string) => {
  await ReactTestRenderer.act(() => {
    const node = root().findAll(
      (one) => one.props.testID === id && typeof (one.props as PressableProps).onPress === 'function',
    )[0];
    if (node === undefined) throw new Error(`No ${id}`);
    (node.props as PressableProps).onPress?.({} as never);
  });
  await settle();
};
const type = async (id: string, value: string) => {
  await ReactTestRenderer.act(() => {
    root()
      .findAll((node) => node.props.testID === id && typeof node.props.onChangeText === 'function')
      .map((node) => node.props as TextInputProps)[0]
      ?.onChangeText?.(value);
  });
};
const disabled = (id: string) =>
  (root().findAll((node) => node.props.testID === id)[0]?.props as { disabled?: boolean }).disabled;
const reshape = (data: TestData, today?: string) => mount(data, <Reorient classId="k-a" onDone={onDone} />, today);
const alert = () => jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
const apply = async () => {
  const spy = alert();
  await press('reorient-apply');
  const buttons = spy.mock.calls.at(-1)?.[2] as AlertButton[];
  spy.mockRestore();
  await ReactTestRenderer.act(() => {
    buttons.at(-1)?.onPress?.();
  });
  await settle();
};
const iso = (value: string) => `\u2068${value}\u2069`;

test('starts on 8 October with the level, previews the new classes and applies in one step', async () => {
  const data = await withReshape();
  await reshape(data);
  const lines = shown();
  expect(lines).toEqual(
    expect.arrayContaining([
      `تُطبَّق ابتداءً من اليوم، ${iso('08/10/2026')}: افتحها يوم تصلك قوائم الأقسام الجديدة.`,
      `${iso('2 ع ت 1')} الجديد · 6 تلاميذ`,
      `تلاميذه: 6 من ${iso('2 ع ت 1')} القديم.`,
      `يتابع دفتر نصوص ${iso('2 ع ت 1')} القديم، بسطر «أُعيد تشكيل القسم يوم ${iso('08/10/2026')}».`,
      `6 إلى ${iso('2 ع ت 1')}`,
      `5 إلى ${iso('2 ع ت 2')}`,
      `صفحات دفتر النصوص حتى ${iso('07/10/2026')}، بتواقيعها، كما هي.`,
    ]),
  );
  expect(lines.some((line) => line.startsWith('موقع المخطط: «'))).toBe(true);
  expect(accessibilityProblems(root())).toEqual([]);
  const spy = alert();
  await press('reorient-apply');
  expect(spy).toHaveBeenCalledWith(
    text.reorient.apply,
    `تُؤرشف ${iso('2 ع ت 1')} و${iso('2 ع ت 2')} ابتداءً من ${iso('08/10/2026')}، ويغادرها 11 تلميذاً ` +
      'إلى أقسامهم الجديدة. ولا يُتراجع عن إعادة التشكيل دفعة واحدة بعد تطبيقها.',
    expect.any(Array),
  );
  spy.mockRestore();
  expect(data.book.state.classes.get('k-a')?.archivedFrom).toBeUndefined();
  await apply();
  const { state } = data.book;
  expect(state.classes.get('k-a')?.archivedFrom).toBe('2026-10-08');
  expect(state.classes.get('k-b')?.archivedFrom).toBe('2026-10-08');
  const made = [...state.classes.values()].filter((one) => one.archivedFrom === undefined && one.grade === '2as');
  expect(made.map((one) => one.name).sort()).toEqual(['2 ع ت 1', '2 ع ت 2']);
  const course = [...state.courses.values()].find((one) => one.continues?.courseId === 'c-k-a');
  expect(course?.continues).toEqual({ courseId: 'c-k-a', from: '2026-10-08' });
  expect([...state.pupils.values()].filter((one) => one.classId === course?.classId)).toHaveLength(6);
  expect(shown()).toContain(`طُبّقت إعادة التشكيل ابتداءً من ${iso('08/10/2026')}. ويبقى ما قبلها في السجل.`);
  await press('reorient-back');
  expect(onDone).toHaveBeenCalledTimes(1);
});

test('sends a pupil to a class the teacher does not teach, and a second class starts with no sessions', async () => {
  const data = await withReshape();
  await reshape(data);
  await press('reorient-edit-k-a');
  await press('reorient-pupil-p-k-a-1-none');
  await press('reorient-add');
  await type('reorient-name-2', '2 ر 1');
  expect(shown()).toEqual(
    expect.arrayContaining([
      `5 إلى ${iso('2 ع ت 1')} · 1 إلى قسم لا أدرّسه`,
      `${iso('2 ر 1')} الجديد · لا تلميذ`,
      text.reorient.second,
    ]),
  );
  await press('reorient-pupil-p-k-a-2-2');
  await apply();
  const { state } = data.book;
  const gone = state.pupils.get('p-k-a-1');
  expect(gone?.movements).toEqual([{ day: '2026-10-08', kind: 'out', reason: 'class-change', confirmed: true }]);
  const named = (name: string) => [...state.classes.values()].find((one) => one.name === name && !one.archivedFrom);
  const third = named('2 ر 1')!;
  expect([...state.pupils.values()].filter((one) => one.classId === third.id).map((one) => one.name)).toEqual([
    state.pupils.get('p-k-a-2')?.name,
  ]);
  const version = state.timetables.at(-1)!;
  expect(version.from).toBe('2026-10-08');
  const courseOf = (classId: string) => [...state.courses.values()].find((one) => one.classId === classId)?.id;
  expect(version.version.entries.filter((one) => one.courseId === courseOf(third.id))).toEqual([]);
  expect(version.version.entries.filter((one) => one.courseId === courseOf(named('2 ع ت 1')!.id))).toHaveLength(2);
});

test('refuses a reshaping that does not hold, with its reason', async () => {
  const data = await withReshape();
  await reshape(data);
  await type('reorient-name-1', ' ');
  expect(shown()).toContain(text.reorient.refused['no-name']);
  expect(disabled('reorient-apply')).toBe(true);
  await type('reorient-name-1', '2 ع ت 1');
  expect(shown()).toContain(text.reorient.refused['same-name']);
  await type('reorient-name-1', '2 ع ت 2');
  expect(disabled('reorient-apply')).toBe(false);
  await press('reorient-olds-k-b');
  const spy = alert();
  await press('reorient-apply');
  expect(spy.mock.calls.at(-1)?.[1]).toBe(
    `يُؤرشف ${iso('2 ع ت 1')} ابتداءً من ${iso('08/10/2026')}، ويغادره 6 تلاميذ إلى أقسامهم الجديدة. ` +
      'ولا يُتراجع عن إعادة التشكيل دفعة واحدة بعد تطبيقها.',
  );
  spy.mockRestore();
  await press('reorient-olds-k-a');
  expect(shown()).toContain(text.reorient.refused.none);
  await data.book.record(parseDay('2026-10-06'), {
    kind: 'test.set',
    test: {
      id: 't-1',
      courseId: 'c-k-a',
      day: parseDay('2026-10-11'),
      slot: { half: 'morning', index: 1 },
      groupId: 'k-a-w',
      title: 'Test',
    },
  });
  await reshape(data);
  expect(shown()).toContain(text.reorient.refused.test);
  expect(disabled('reorient-apply')).toBe(true);
});

test('offers the reshaping in a lycée class’s settings only, and shows an archived class as such', async () => {
  const data = await withReshape();
  const page = (courseId: string) => (
    <ClassPage
      courseId={courseId}
      settings
      onSettings={jest.fn()}
      settingsOpener={createRef<ViewInstance>()}
      onCourse={jest.fn()}
      onRoll={jest.fn()}
      onBook={jest.fn()}
      onPlan={jest.fn()}
      onHomework={jest.fn()}
      onExtra={jest.fn()}
      onSupervised={jest.fn()}
      onMove={jest.fn()}
      onSeats={jest.fn()}
      onRules={jest.fn()}
      onReorient={onDone}
    />
  );
  await mount(data, page('c-k-a'));
  await press('class-settings-reorient');
  expect(onDone).toHaveBeenCalledTimes(1);
  await mount(data, <Reorient classId="k-a" onDone={onDone} />);
  await apply();
  await mount(data, page('c-k-a'), '2026-10-11');
  expect(root().findAll((node) => node.props.testID === 'class-settings-reorient')).toHaveLength(0);
  expect(root().findAll((node) => node.props.testID === 'class-move')).toHaveLength(0);
  expect(root().findAll((node) => node.props.testID === 'class-settings-move')).toHaveLength(0);
  expect(shown()).toContain(`أُعيد تشكيل هذا القسم: مؤرشف منذ ${iso('08/10/2026')}، يُقرأ ويُطبع ولا تُضاف إليه حصص.`);
  await mount(data, <ClassesTab onClass={jest.fn()} onBook={jest.fn()} onWeek={jest.fn()} />, '2026-10-11');
  const lines = shown();
  const archived = lines.indexOf(`مؤرشف منذ ${iso('08/10')} · يُقرأ ويُطبع`);
  expect(archived).toBeGreaterThan(lines.lastIndexOf(text.classes.onPlan));
});

test.each(['en', 'fr'] as Language[])('has every reorientation text in %s', (language) => {
  const keys = (value: object, at = ''): string[] =>
    Object.entries(value).flatMap(([key, one]) =>
      typeof one === 'object' && one !== null ? keys(one as object, `${at}${key}.`) : [`${at}${key}`],
    );
  expect(keys(catalogues[language].reorient).sort()).toEqual(keys(text.reorient).sort());
  expect(catalogues[language].classes.archived).toBeDefined();
  expect(catalogues[language].classPage.archived).toBeDefined();
});

test('says when an old class’s history goes to no new class', async () => {
  const data = await withReshape();
  await reshape(data);
  expect(root().findAll((node) => node.props.testID === 'reorient-untaken-k-b')).toHaveLength(0);
  await press('reorient-remove-1');
  expect(root().findAll((node) => node.props.testID === 'reorient-untaken-k-b').length).toBeGreaterThan(0);
  expect(shown()).toEqual(expect.arrayContaining([text.reorient.untaken, '5 إلى قسم لا أدرّسه']));
});
