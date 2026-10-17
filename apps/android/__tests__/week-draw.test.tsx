// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Drawing the week by hand (#28, Week-draw): pens, taps, Saturday and the
// fifth morning slot, the totals, saving as one version, and a later week
// that starts the day it is drawn. Made-up schools and classes only.

import { formatDay, parseDay } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { StyleSheet, Text } from 'react-native';
import type { PressableProps, TextProps } from 'react-native';
import ReactTestRenderer, { type ReactTestInstance } from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { openTestData, withData, type TestData } from '../jest/app-data';
import { catalogues, i18n, type Language } from '../src/text/i18n';
import text from '../src/text/ar.json';
import { WeekDraw } from '../src/week/WeekDraw';

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

async function withClasses(): Promise<TestData> {
  const data = await openTestData();
  await data.book.record(day, {
    kind: 'school.set',
    school: { id: 's-1', name: 'متوسطة النجاح', levels: ['cem'], subjects: ['arabic'], zone: '16' },
  });
  for (const [id, name] of [
    ['k-1', '4م1'],
    ['k-2', '4م2'],
  ]) {
    await data.book.record(day, {
      kind: 'class.set',
      schoolClass: {
        id,
        schoolId: 's-1',
        level: 'cem',
        grade: '4am',
        name,
        groups: [{ id: `${id}-w`, kind: 'whole', name }],
      },
    });
  }
  return data;
}

async function render(data: TestData, direction: 'rtl' | 'ltr' = 'rtl', on = '2026-10-15') {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={direction}>
        {withData(data, <WeekDraw onDone={onDone} />, on)}
      </LocaleDirContext.Provider>,
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
const textOf = (id: string) =>
  shown()[
    root()
      .findAllByType(Text)
      .findIndex((node) => node.props.testID === id)
  ];
const label = (id: string) => String(control(id).props.accessibilityLabel);

async function press(id: string) {
  await ReactTestRenderer.act(() => {
    (control(id).props as PressableProps).onPress?.({} as never);
  });
}

async function save() {
  await press('week-save');
  await settle();
}

test('draws with the first class by default, saving one version from the start of the year', async () => {
  const data = await withClasses();
  await render(data);
  await press('draw-0-m1');
  await press('draw-1-m1');
  await press('pen-k-2');
  await press('draw-2-a1');
  expect(label('draw-0-m1')).toBe('الأحد، الحصة 1 صباحاً: 4م1');
  expect(textOf('week-tally')).toBe('\u20684م1\u2069: 2 · \u20684م2\u2069: 1 · المجموع: 3 حصص');
  expect(textOf('week-clashes')).toBe(text.week.noClash);
  await save();
  expect(onDone).toHaveBeenCalledTimes(1);
  const { timetables, courses } = data.book.state;
  expect(timetables).toHaveLength(1);
  expect(timetables[0].from).toBe(data.year.from);
  expect(timetables[0].version.entries).toHaveLength(3);
  expect([...courses.values()].map((course) => [course.classId, course.subject])).toEqual([
    ['k-1', 'arabic'],
    ['k-2', 'arabic'],
  ]);
  expect(shown()).toContain(text.week.saveNote.replace('{{date}}', formatDay(data.year.from)));
});

test('clears a slot with a second tap, draws own time, and erases', async () => {
  const data = await withClasses();
  await render(data);
  await press('draw-0-m1');
  await press('draw-0-m1');
  expect(label('draw-0-m1')).toBe(`الأحد، الحصة 1 صباحاً: ${text.week.empty}`);
  await press('pen-own');
  await press('draw-3-m2');
  expect(label('draw-3-m2')).toBe(`الأربعاء، الحصة 2 صباحاً: ${text.week.ownTime}`);
  await press('pen-erase');
  await press('draw-3-m2');
  await save();
  expect(data.book.state.timetables[0].version).toMatchObject({ entries: [], blocks: [] });
});

test('adds Saturday and a fifth morning slot, and keeps them while they hold a session', async () => {
  const data = await withClasses();
  await render(data);
  expect(exists('draw-6-m1')).toBe(false);
  await press('option-saturday');
  await press('option-fifthMorning');
  await press('draw-6-m5');
  const saturday = root().find(
    (node) => node.props.testID === 'option-saturday' && node.props.accessibilityRole === 'checkbox',
  );
  expect(saturday.props).toMatchObject({
    accessibilityState: { checked: true, disabled: true },
    accessibilityHint: text.week.optionLocked,
  });
  await save();
  expect(data.book.state.timetables[0].version.options).toEqual({ saturday: true, fifthMorning: true });
});

test('saves the changes once the taps pause, as one version', async () => {
  jest.useFakeTimers();
  try {
    const data = await withClasses();
    await render(data);
    await press('draw-0-m1');
    await press('draw-0-m2');
    await ReactTestRenderer.act(() => jest.advanceTimersByTime(700));
    await press('draw-0-m3');
    await ReactTestRenderer.act(() => jest.advanceTimersByTime(700));
    await ReactTestRenderer.act(async () => {
      jest.useRealTimers();
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
    expect(data.book.state.timetables).toHaveLength(1);
    expect(data.book.state.timetables[0].version.entries).toHaveLength(3);
  } finally {
    jest.useRealTimers();
  }
});

test('starts a changed week on the day it is drawn, keeping the first', async () => {
  const data = await withClasses();
  await render(data, 'rtl', '2026-10-01');
  await press('draw-0-m1');
  await save();
  await ReactTestRenderer.act(() => tree?.unmount());
  await render(data);
  expect(label('draw-0-m1')).toBe('الأحد، الحصة 1 صباحاً: 4م1');
  await press('draw-1-m1');
  await save();
  expect(data.book.state.timetables.map((timetable) => timetable.from)).toEqual([data.year.from, day]);
  expect(shown()).toContain(text.week.saveNote.replace('{{date}}', '15/10/2026'));
});

test('keeps no fixed text height or line limit, so text at 200% wraps', async () => {
  await render(await withClasses());
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
)('names every pen, option and slot, 48 dp each (%s, %s)', async (language, direction) => {
  await i18n.changeLanguage(language);
  const data = await withClasses();
  await render(data, direction);
  await press('draw-0-m1');
  await press('pen-own');
  await press('draw-1-a1');
  expect(accessibilityProblems(root())).toEqual([]);
  expect(shown()).toContain(catalogues[language].week.brushHint);
});
