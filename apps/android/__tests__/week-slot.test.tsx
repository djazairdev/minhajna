// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// One slot of the week (#28, Week-slot), opened from the drawing with the
// «تفاصيل الخانة» pen: half-groups in alternate weeks, a second subject with
// its own course, the teacher's own time with its kind, clashes, removing a
// slot, and closing without saving. Made-up schools and classes only.

import { parseDay } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Text, TextInput } from 'react-native';
import type { PressableProps, TextInputProps } from 'react-native';
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
const day = parseDay('2026-10-15');

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  await i18n.changeLanguage('ar');
});

async function withClass(): Promise<TestData> {
  const data = await openTestData();
  await data.book.record(day, {
    kind: 'school.set',
    school: { id: 's-1', name: 'متوسطة النجاح', levels: ['cem'], subjects: ['arabic', 'islamic'], zone: '16' },
  });
  await data.book.record(day, {
    kind: 'class.set',
    schoolClass: {
      id: 'k-1',
      schoolId: 's-1',
      level: 'cem',
      grade: '4am',
      name: '4م1',
      groups: [{ id: 'w', kind: 'whole', name: '4م1' }],
    },
  });
  return data;
}

async function render(data: TestData, direction: 'rtl' | 'ltr' = 'rtl') {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={direction}>
        {withData(data, <WeekDraw onDone={jest.fn()} />)}
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
const label = (id: string) => String(control(id).props.accessibilityLabel);

async function press(id: string) {
  await ReactTestRenderer.act(() => {
    (control(id).props as PressableProps).onPress?.({} as never);
  });
}

async function open(cell: string) {
  await press('pen-details');
  await press(`draw-${cell}`);
}

async function saved(data: TestData) {
  await press('week-save');
  await settle();
  return data.book.state.timetables[0].version;
}

test('takes two half-groups in alternate weeks, making the half-groups and saving one course', async () => {
  const data = await withClass();
  await render(data);
  await open('2-m2');
  expect(shown()).toContain('خانة الثلاثاء، الحصة 2 صباحاً');
  await press('slot-0-kind-class');
  expect(shown()).toContain(
    text.week.wholeSummary.replace('{{name}}', '\u20684م1\u2069').replace('{{weeks}}', text.week.everyWeek),
  );
  await press('slot-0-group-half-1');
  await press('slot-0-weeks-A');
  await press('slot-1-kind-class');
  await press('slot-1-group-half-2');
  await press('slot-save');
  expect(exists('slot-save')).toBe(false);
  expect(label('draw-2-m2')).toBe('الثلاثاء، الحصة 2 صباحاً: 4م1، الفوج 1، الأسبوع أ، 4م1، الفوج 2، الأسبوع ب');
  const version = await saved(data);
  const halves = data.book.state.classes.get('k-1')?.groups.filter((group) => group.kind === 'half') ?? [];
  expect(halves.map((group) => group.name)).toEqual(['الفوج 1', 'الفوج 2']);
  expect(version.entries.map((entry) => [entry.groupId, entry.weeks])).toEqual([
    [halves[0].id, 'A'],
    [halves[1].id, 'B'],
  ]);
  expect(data.book.state.courses.size).toBe(1);
});

test('gives a second subject of the same class its own course, and keeps a room', async () => {
  const data = await withClass();
  await render(data);
  await press('draw-0-m1');
  await open('1-m1');
  await press('slot-0-kind-class');
  expect(shown()).toContain(text.week.bivalentNote);
  await press('slot-0-subject-islamic');
  await ReactTestRenderer.act(() => {
    (
      root()
        .find((node) => node.props.testID === 'slot-0-room')
        .findByType(TextInput).props as TextInputProps
    ).onChangeText?.('12');
  });
  await press('slot-save');
  const version = await saved(data);
  const subjects = [...data.book.state.courses.values()].map((course) => course.subject).sort();
  expect(subjects).toEqual(['arabic', 'islamic']);
  expect(version.entries.find((entry) => entry.weekday === 1)?.room).toBe('12');
});

test("draws the teacher's own time with its kind over a half-day, warning of the session it covers", async () => {
  const data = await withClass();
  await render(data);
  await press('draw-3-m1');
  await open('3-m3');
  await press('slot-0-kind-own');
  await press('slot-0-own-pedagogical');
  await press('slot-0-half-day');
  expect(exists('slot-clash')).toBe(true);
  expect(shown()).toContain(
    text.week.clashAt.replace('{{slot}}', 'الحصة 1 صباحاً').replace('{{items}}', `4م1، ${text.week.kinds.pedagogical}`),
  );
  await press('slot-save');
  expect(shown()).toContain(text.week.clashes_one);
  const version = await saved(data);
  expect(version.blocks).toEqual([
    { weekday: 3, half: 'morning', kind: 'pedagogical', label: text.week.kinds.pedagogical },
  ]);
});

test('removes a slot, and keeps nothing when closed', async () => {
  const data = await withClass();
  await render(data);
  await press('draw-4-a1');
  await open('4-a1');
  await press('slot-0-kind-own');
  await press('slot-close');
  expect(label('draw-4-a1')).toBe('الخميس، الحصة 1 مساءً: 4م1');
  await press('draw-4-a1');
  await press('slot-remove');
  expect(label('draw-4-a1')).toBe(`الخميس، الحصة 1 مساءً: ${text.week.empty}`);
  expect((await saved(data)).entries).toEqual([]);
});

test.each(
  (Object.keys(catalogues) as Language[]).flatMap((language) =>
    (['rtl', 'ltr'] as const).map((direction) => [language, direction] as const),
  ),
)('names every choice of a slot, 48 dp each (%s, %s)', async (language, direction) => {
  await i18n.changeLanguage(language);
  await render(await withClass(), direction);
  await open('0-m1');
  await press('slot-0-kind-class');
  await press('slot-0-weeks-B');
  await press('slot-1-kind-own');
  expect(accessibilityProblems(root())).toEqual([]);
  expect(shown()).toContain(catalogues[language].week.bivalentNote);
});
