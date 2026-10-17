// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Setup's fourth step (#28, Setup-5-Week): the week drawn so far, or a line
// saying it is not drawn yet, the way to draw it, and the note that the
// school's timetable comes later. Made-up schools and classes only.

import { formatDay, parseDay } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { StyleSheet, Text } from 'react-native';
import type { PressableProps, TextProps } from 'react-native';
import ReactTestRenderer, { type ReactTestInstance } from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { openTestData, withData, type TestData } from '../jest/app-data';
import { Week } from '../src/setup/Week';
import { catalogues, i18n, type Language } from '../src/text/i18n';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const root = () => tree!.root;
const onDraw = jest.fn();
const onNext = jest.fn();
const day = parseDay('2026-10-15');

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  await i18n.changeLanguage('ar');
  onDraw.mockReset();
  onNext.mockReset();
});

async function withWeek(): Promise<TestData> {
  const data = await openTestData();
  await data.book.recordAll(day, [
    {
      kind: 'school.set',
      school: { id: 's-1', name: 'متوسطة النجاح', levels: ['cem'], subjects: ['arabic'], zone: '16' },
    },
    {
      kind: 'class.set',
      schoolClass: {
        id: 'k-1',
        schoolId: 's-1',
        level: 'cem',
        grade: '4am',
        name: '4م1',
        groups: [{ id: 'g-1', kind: 'whole', name: '4م1' }],
      },
    },
    { kind: 'course.set', course: { id: 'c-1', classId: 'k-1', subject: 'arabic', year: '2026-2027', pack: null } },
    {
      kind: 'timetable.set',
      version: {
        id: 'v-1',
        from: data.year.from,
        source: 'hand',
        entries: [0, 1, 2].map((weekday) => ({
          id: `e-${weekday}`,
          weekday: weekday as 0 | 1 | 2,
          slot: { half: 'morning' as const, index: 1 },
          courseId: 'c-1',
          groupId: 'g-1',
          weeks: 'every' as const,
          sessionType: 'lesson',
        })),
        blocks: [{ weekday: 3, half: 'afternoon', index: 1, label: text.week.ownTime }],
      },
    },
  ]);
  return data;
}

async function render(data: TestData, direction: 'rtl' | 'ltr' = 'rtl') {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={direction}>
        {withData(data, <Week onDraw={onDraw} onNext={onNext} />)}
      </LocaleDirContext.Provider>,
    );
  });
}

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

test('says the week is not drawn yet, offers to draw it, and leads on either way', async () => {
  await render(await openTestData());
  expect(shown()).toEqual(
    expect.arrayContaining([
      text.week.heading,
      text.week.intro,
      text.week.noWeek,
      text.week.draw,
      text.week.packageLater,
    ]),
  );
  expect(exists('week-card')).toBe(false);
  await press('week-draw');
  expect(onDraw).toHaveBeenCalledTimes(1);
  await press('week-next');
  expect(onNext).toHaveBeenCalledTimes(1);
});

test('shows the week drawn, the day it starts and its sessions a week, read cell by cell', async () => {
  const data = await withWeek();
  await render(data);
  expect(shown()).toEqual(
    expect.arrayContaining([
      text.week.drawn,
      `${text.week.from.replace('{{date}}', formatDay(data.year.from))} · ${text.week.perWeek.replace('{{sessions}}', '3 حصص')}`,
      text.week.edit,
    ]),
  );
  const cells = root().findAll((node) => node.props.accessible === true && typeof node.props.onPress !== 'function', {
    deep: false,
  });
  expect(cells.map((node) => String(node.props.accessibilityLabel))).toEqual(
    expect.arrayContaining(['الأحد، الحصة 1 صباحاً: 4م1', `الأربعاء، الحصة 1 مساءً: ${text.week.ownTime}`]),
  );
});

test('keeps no fixed text height or line limit, so text at 200% wraps', async () => {
  await render(await withWeek());
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
)('names every control and cell, 48 dp each (%s, %s)', async (language, direction) => {
  await i18n.changeLanguage(language);
  await render(await withWeek(), direction);
  expect(accessibilityProblems(root())).toEqual([]);
  expect(shown()).toContain(catalogues[language].week.heading);
});
