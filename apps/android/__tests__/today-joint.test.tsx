// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A joint class on Today (#43, P-Multi): one card for each slot with every
// year on its own plan, one tap confirming every year's proposal or a tap on
// one confirming it alone, its undo, and one roll call for the class.
// Made-up schools, classes and timetables only.

import { current, parseDay, type TimetableEntry } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Text, type PressableProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { openTestData, withData, type TestData } from '../jest/app-data';
import { i18n } from '../src/text/i18n';
import text from '../src/text/ar.json';
import { Today } from '../src/today/Today';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const root = () => tree!.root;
const onRoll = jest.fn();

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  await i18n.changeLanguage('ar');
});

const entry = (index: number): TimetableEntry => ({
  id: `e-${index}`,
  weekday: 4,
  slot: { half: 'morning', index },
  courseId: 'c-4',
  groupId: 'k-w',
  weeks: 'every',
  sessionType: 'lesson',
});

/** Thursday 15 October 2026: 4-5 أ, 4AP on free entry and 5AP on its example pack, at 08:00 and 09:00. */
async function withJoint(): Promise<TestData> {
  const data = await openTestData();
  await data.book.recordAll(parseDay('2026-10-15'), [
    {
      kind: 'school.set',
      school: { id: 's-1', name: 'ابتدائية الأمل', levels: ['primary'], subjects: ['arabic'], zone: '16' },
    },
    {
      kind: 'class.set',
      schoolClass: {
        id: 'k',
        schoolId: 's-1',
        level: 'primary',
        grade: '4ap',
        name: '4-5 أ',
        groups: [
          { id: 'k-w', kind: 'whole', name: '4-5 أ' },
          { id: 'k-4', kind: 'level', name: '4AP', grade: '4ap' },
          { id: 'k-5', kind: 'level', name: '5AP', grade: '5ap' },
        ],
      },
    },
    ...['k-4', 'k-5'].map((year, at) => ({
      kind: 'pupil.set' as const,
      pupil: { id: `p-${at}`, classId: 'k', name: `تلميذ ${at}`, sex: 'f' as const, groups: [year], movements: [] },
    })),
    { kind: 'course.set', course: { id: 'c-4', classId: 'k', subject: 'arabic', year: '2026-2027', pack: null } },
    {
      kind: 'course.set',
      course: {
        id: 'c-5',
        classId: 'k',
        subject: 'arabic',
        year: '2026-2027',
        grade: '5ap',
        pack: { id: 'dz.primary.5ap.arabic.example', release: '2026.1' },
      },
    },
    {
      kind: 'timetable.set',
      version: { id: 'v-1', from: parseDay('2026-10-11'), source: 'hand', entries: [entry(1), entry(2)], blocks: [] },
    },
  ]);
  return data;
}

async function show(data: TestData) {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        {withData(data, <Today onHelp={jest.fn()} onDetails={jest.fn()} onRoll={onRoll} />, '2026-10-15')}
      </LocaleDirContext.Provider>,
    );
  });
}

const card = (slot: number) => `today-k/2026-10-15/m${slot}/k-w`;
const session = (course: string, slot: number) => `${course}/2026-10-15/m${slot}/k-w`;
const settle = () => ReactTestRenderer.act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
const pressable = (id: string) =>
  root().findAll((node) => node.props.testID === id && typeof (node.props as PressableProps).onPress === 'function');
const has = (id: string) => pressable(id).length > 0;
const press = async (id: string) => {
  await ReactTestRenderer.act(() => {
    (pressable(id)[0].props as PressableProps).onPress?.({} as never);
  });
  await settle();
};
const shown = () =>
  root()
    .findAllByType(Text)
    .map((node) => [node.props.children as unknown].flat().join(''));
const recorded = (data: TestData, key: string) => current(data.book.state.sessions.get(key));

test('shows each slot once, each year on its own plan, with one roll call', async () => {
  await show(await withJoint());
  expect(has(`${card(1)}-year-5ap`)).toBe(true);
  expect(has(`${card(1)}-details-4ap`)).toBe(true);
  expect(has(`${card(1)}-confirm`)).toBe(true);
  expect(has(`${card(2)}-confirm`)).toBe(false);
  expect(root().findAll((node) => node.props.testID === `today-${session('c-5', 1)}`)).toHaveLength(0);
  expect(shown()).toEqual(expect.arrayContaining([text.joint.confirm_one, text.joint.confirmNote, '4', '5']));
  const rolls = new Set(
    root()
      .findAll((node) => String(node.props.testID).endsWith('-roll-open'))
      .map((node) => String(node.props.testID)),
  );
  expect(rolls.size).toBe(2);
  expect(accessibilityProblems(root())).toEqual([]);
});

test('confirms every year with a proposal in one tap, leaves the year on free entry, and undoes', async () => {
  const data = await withJoint();
  await show(data);
  await press(`${card(1)}-confirm`);
  expect(recorded(data, session('c-5', 1))).toMatchObject({ outcome: 'done' });
  expect(recorded(data, session('c-4', 1))).toBeNull();
  expect(has(`${card(1)}-fix-5ap`)).toBe(true);
  await ReactTestRenderer.act(() => {
    const undo = root().find(
      (node) => node.props.accessibilityLabel === text.today.undo && typeof node.props.onPress === 'function',
    );
    (undo.props as PressableProps).onPress?.({} as never);
  });
  await settle();
  expect(recorded(data, session('c-5', 1))).toBeNull();
});

test('confirms one year alone with a tap on its proposal', async () => {
  const data = await withJoint();
  await show(data);
  await press(`${card(1)}-year-5ap`);
  expect(recorded(data, session('c-5', 1))).toMatchObject({ outcome: 'done' });
  expect(shown()).toContain(text.today.snack);
});
