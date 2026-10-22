// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A clash between two schools on Week-slot (#232, answer 400): the slot's
// panel names both sessions; «الإبقاء على الاثنين» keeps it, so the week
// says no clash is open and reads the slot as kept, until «إعادة فتح
// التعارض»; «تغيير يوم واحد» moves one session to a free time of its
// school on one day only, listed until «إلغاء النقل»; and Today says which
// sessions meet, and which moved. A clash is kept against the recorded week,
// the clash's slot edits nothing else, and a move stays once its session is
// recorded. Made-up schools and classes only.

import { confirmSessions, parseDay, sessionsBetween, versionOn, weekClashes } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Text } from 'react-native';
import ReactTestRenderer, { type ReactTestInstance } from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withData, type TestData } from '../jest/app-data';
import { withClash } from '../jest/clash-schools';
import { coreContext } from '../src/storage/core-context';
import { catalogues, i18n, missingKeys } from '../src/text/i18n';
import { Today } from '../src/today/Today';
import { WeekDraw } from '../src/week/WeekDraw';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const root = () => tree!.root;
const iso = (value: string) => `\u2068${value}\u2069`;
const m1 = { half: 'morning', index: 1 } as const;
const text = catalogues.ar;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  await i18n.changeLanguage('ar');
});

async function render(data: TestData, element: React.ReactElement, on = '2026-10-15') {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">{withData(data, element, on)}</LocaleDirContext.Provider>,
    );
  });
}

const control = (id: string): ReactTestInstance =>
  root().find((node) => node.props.testID === id && typeof node.props.onPress === 'function');
const press = async (id: string) => {
  const onPress = control(id).props.onPress as () => void;
  await ReactTestRenderer.act(() => onPress());
};
const exists = (id: string) => root().findAll((node) => node.props.testID === id).length > 0;
const shown = () =>
  root()
    .findAllByType(Text)
    .map((node) => [node.props.children as unknown].flat().join(''));

test('a clash is kept, opened again, and one session moved for one day, then back', async () => {
  missingKeys.length = 0;
  const data = await withClash();
  await render(data, <WeekDraw onDone={jest.fn()} openAt={{ weekday: 4, slot: m1 }} />);
  expect(exists('clash-panel')).toBe(true);
  expect(shown()).toEqual(
    expect.arrayContaining([
      `${iso('3 ابتدائي أ')} · ${iso('مدرسة الفتح')}`,
      `${iso('5 ابتدائي أ')} · ${iso('مدرسة الرياض')}`,
    ]),
  );
  expect(shown()).not.toContain(text.week.noClash);
  await press('clash-keep');
  expect(data.book.state.keptClashes.size).toBe(1);
  expect(shown()).toContain(text.week.noClash);
  expect(shown()).toContain(text.clash.keptNote);
  await press('clash-reopen');
  expect(data.book.state.keptClashes.size).toBe(0);

  await press('clash-move');
  await press('clash-day-2026-10-22');
  await press('clash-to-e-4/a2');
  await press('clash-save');
  const [move] = [...data.book.state.moves.values()];
  expect(move && [move.courseId, move.day, move.to.half, move.to.index]).toEqual([
    'f-3',
    parseDay('2026-10-22'),
    'afternoon',
    2,
  ]);
  expect(shown().some((line) => line.includes('15:15'))).toBe(true);
  expect(accessibilityProblems(root())).toEqual([]);
  await press(`clash-unmove-${move?.id ?? ''}`);
  expect(data.book.state.moves.size).toBe(0);
  expect(missingKeys).toEqual([]);
});

test('Today says which sessions meet, and that a moved one moved', async () => {
  const data = await withClash();
  await render(data, <Today onHelp={jest.fn()} onDetails={jest.fn()} onRoll={jest.fn()} />);
  const sameAs = (name: string, school: string) => i18n.t('today.sameTime', { class: iso(name), school: iso(school) });
  expect(shown()).toEqual(
    expect.arrayContaining([sameAs('5 ابتدائي أ', 'مدرسة الرياض'), sameAs('3 ابتدائي أ', 'مدرسة الفتح')]),
  );
  await ReactTestRenderer.act(() => tree?.unmount());
  const day = parseDay('2026-10-15');
  await data.book.record(day, {
    kind: 'move.set',
    move: { id: 'mv-1', courseId: 'f-3', groupId: 'k-3-w', day, from: m1, to: { half: 'afternoon', index: 2 } },
  });
  await render(data, <Today onHelp={jest.fn()} onDetails={jest.fn()} onRoll={jest.fn()} />);
  expect(shown().some((line) => line.startsWith(text.today.sameTime.split('{{')[0] ?? ''))).toBe(false);
  expect(shown().some((line) => line.startsWith(text.today.movedFrom.split('{{')[0] ?? ''))).toBe(true);
});

test('a clash kept on a later day is kept against the recorded week, and the slot edits nothing else', async () => {
  const data = await withClash();
  await render(data, <WeekDraw onDone={jest.fn()} openAt={{ weekday: 4, slot: m1 }} />, '2026-10-20');
  expect(exists('slot-0')).toBe(false);
  expect(exists('slot-save')).toBe(false);
  await press('clash-keep');
  const version = versionOn(data.book.state.timetables, parseDay('2026-10-20'));
  expect([...data.book.state.keptClashes.values()].map((one) => one.versionId)).toEqual([version?.id]);
  expect(version && weekClashes(version, data.book.state).map((one) => one.kept)).toEqual([true]);
  expect(
    version?.entries.filter((entry) => entry.weekday === 4 && entry.slot.half === 'morning' && entry.slot.index === 1),
  ).toHaveLength(2);
});

test('a move stays once its session is recorded', async () => {
  const data = await withClash();
  const day = parseDay('2026-10-15');
  const move = {
    id: 'mv-1',
    courseId: 'f-3',
    groupId: 'k-3-w',
    day,
    from: m1,
    to: { half: 'afternoon', index: 2 },
  } as const;
  await data.book.record(day, { kind: 'move.set', move });
  const context = coreContext({ ...data, state: data.book.state });
  const moved = sessionsBetween(context, day, day).find((one) => one.courseId === 'f-3' && one.movedFrom !== undefined);
  await data.book.recordAll(
    day,
    confirmSessions(context, [{ session: moved as NonNullable<typeof moved>, choice: { outcome: 'not-held' } }]),
  );
  await render(data, <WeekDraw onDone={jest.fn()} openAt={{ weekday: 4, slot: m1 }} />);
  expect(exists('clash-unmove-mv-1')).toBe(false);
  expect(shown()).toContain(text.clash.recorded);
});
