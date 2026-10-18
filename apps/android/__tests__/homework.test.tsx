// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The texts book's homework record (#214, P67): on Today, the homework that
// comes back on the day's first session of the class, then its counts once
// entered; the record in the order the homework was set, the homework back
// today open, homework still out shown only; the two counts with their
// share of the class list, rounded; «الجميع أنجزه بنفسه»; «تراجع», which
// puts back what was there before; a class with no list, or no homework,
// saying so, and the year's pages printing; a count from a longer list;
// and the count on the next session when the first was not held. Made-up
// records only.

import { confirmSessions, current, parseDay, sessionsBetween, type HomeworkItem } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import type React from 'react';
import { Text, type PressableProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withData, type TestData } from '../jest/app-data';
import { withPupils } from '../jest/roll-class';
import { withDay } from '../jest/today-day';
import { HomeworkBook } from '../src/homework/HomeworkBook';
import { coreContext } from '../src/storage/core-context';
import text from '../src/text/ar.json';
import { Today } from '../src/today/Today';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const root = () => tree!.root;
const onHomework = jest.fn();

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  jest.clearAllMocks();
});

const set = (slot: number) => `c-1/2026-10-15/m${slot}/k-1-w`;
const back = (slot: number) => `c-1/2026-10-22/m${slot}/k-1-w`;

/** Homework set on Thursday 15 October: in the first session for the 22nd, in the second for the 29th. */
async function withHomework(pupils = true): Promise<TestData> {
  const data = pupils ? await withPupils() : await withDay();
  const context = coreContext({ ...data, state: data.book.state });
  const [first, second] = sessionsBetween(context, parseDay('2026-10-15'), parseDay('2026-10-15'), new Set(['c-1']));
  if (first === undefined || second === undefined) throw new Error('No sessions');
  await data.book.recordAll(
    parseDay('2026-10-15'),
    confirmSessions(context, [
      { session: first, details: { homework: { text: 'التمرين 2 ص 21', due: parseDay('2026-10-22') } } },
      { session: second, details: { homework: { text: 'أسئلة الفهم ص 17', due: parseDay('2026-10-29') } } },
    ]),
  );
  return data;
}

async function mount(data: TestData, element: React.ReactElement, today = '2026-10-22') {
  await ReactTestRenderer.act(() => tree?.unmount());
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">{withData(data, element, today)}</LocaleDirContext.Provider>,
    );
  });
}

const shown = () =>
  root()
    .findAllByType(Text)
    .map((node) =>
      [node.props.children as unknown]
        .flat()
        .filter((part) => typeof part === 'string' || typeof part === 'number')
        .join(''),
    );
const said = (testID: string) =>
  root()
    .findAll((node) => node.type === Text && node.props.testID === testID)
    .map((node) => [node.props.children].flat().join(''))[0];
const control = (id: string) =>
  root().findAll((node) => node.props.testID === id && typeof (node.props as PressableProps).onPress === 'function')[0];
const press = async (id: string) => {
  await ReactTestRenderer.act(() => {
    (control(id)?.props as PressableProps).onPress?.({} as never);
  });
};
const count = (data: TestData, slot = 1) => current(data.book.state.homeworkCounts.get(set(slot)));

test("Today shows the homework that comes back on the class's first session, then its counts", async () => {
  const data = await withHomework();
  await mount(data, <Today onHelp={jest.fn()} onDetails={jest.fn()} onRoll={jest.fn()} onHomework={onHomework} />);
  const strip = `today-${back(1)}-homework-${set(1)}`;
  expect(shown()).toContain('يُسلَّم اليوم: ⁨التمرين 2 ص 21⁩');
  expect(root().findAll((node) => node.props.testID === `today-${back(2)}-homework-${set(1)}`)).toHaveLength(0);
  expect(accessibilityProblems(root())).toEqual([]);
  await press(`${strip}-open`);
  expect(onHomework).toHaveBeenCalledWith(expect.objectContaining({ due: '2026-10-22', text: 'التمرين 2 ص 21' }));
  const [item] = onHomework.mock.calls[0] as [HomeworkItem];
  await data.book.record(parseDay('2026-10-22'), {
    kind: 'homework.counted',
    count: { sessionKey: item.session.key, due: item.due, notDone: 3, reliedOn: 2 },
  });
  await mount(data, <Today onHelp={jest.fn()} onDetails={jest.fn()} onRoll={jest.fn()} onHomework={onHomework} />);
  expect(shown()).toContain('أُحصي الواجب · لم يُنجزه: 3 · بمساعدة الغير: 2');
});

test('opens the homework back today, counts it with its share of the list, and takes the count back', async () => {
  const data = await withHomework();
  await mount(data, <HomeworkBook courseId="c-1" />);
  expect(said('homework-heading')).toBe('دفتر النصوص · ⁨4م1⁩ · اللغة العربية · الواجبات');
  expect(root().findAll((node) => node.props.testID === `homework-counter-${set(1)}`).length).toBeGreaterThan(0);
  expect(control(`homework-row-${set(2)}`)).toBeUndefined();
  expect(accessibilityProblems(root())).toEqual([]);
  for (let n = 0; n < 3; n += 1) await press('homework-notDone-increase');
  for (let n = 0; n < 2; n += 1) await press('homework-reliedOn-increase');
  expect(said('homework-notDone-share')).toBe('7%');
  expect(said('homework-reliedOn-share')).toBe('4%');
  expect(shown()).toContain('من 45 تلميذاً');
  await press('homework-confirm');
  expect(count(data)).toEqual({ sessionKey: set(1), due: '2026-10-22', notDone: 3, reliedOn: 2 });
  expect(said(`homework-${set(1)}-notDone`)).toBe('3 · 7%');
  expect(said(`homework-${set(1)}-reliedOn`)).toBe('2 · 4%');
  expect(root().findAll((node) => node.props.testID === 'homework-snack').length).toBeGreaterThan(0);
  await ReactTestRenderer.act(() => {
    (
      root().findAll(
        (node) => node.props.accessibilityLabel === text.today.undo && typeof node.props.onPress === 'function',
      )[0]?.props as PressableProps
    ).onPress?.({} as never);
  });
  expect(count(data)).toBeNull();
  expect(said(`homework-${set(1)}-notDone`)).toBe('');
});

test('«الجميع أنجزه بنفسه» records none of either, and «تراجع» after a correction puts the earlier count back', async () => {
  const data = await withHomework();
  await mount(data, <HomeworkBook courseId="c-1" sessionKey={set(1)} />, '2026-10-23');
  await press('homework-none');
  expect(count(data)).toEqual({ sessionKey: set(1), due: '2026-10-22', notDone: 0, reliedOn: 0 });
  await press('homework-reliedOn-increase');
  await press('homework-confirm');
  expect(count(data)).toEqual({ sessionKey: set(1), due: '2026-10-22', notDone: 0, reliedOn: 1 });
  await ReactTestRenderer.act(() => {
    (
      root().findAll(
        (node) => node.props.accessibilityLabel === text.today.undo && typeof node.props.onPress === 'function',
      )[0]?.props as PressableProps
    ).onPress?.({} as never);
  });
  expect(count(data)).toEqual({ sessionKey: set(1), due: '2026-10-22', notDone: 0, reliedOn: 0 });
  expect(data.book.state.homeworkCounts.get(set(1))).toHaveLength(3);
});

test('a class with no list says so instead of counting, and a subject with no homework says so', async () => {
  const data = await withHomework(false);
  await mount(data, <HomeworkBook courseId="c-1" />);
  expect(shown()).toContain(text.homework.noList);
  expect(root().findAll((node) => node.props.testID === 'homework-confirm')).toHaveLength(0);
  const onPrint = jest.fn();
  await mount(data, <HomeworkBook courseId="c-2" onPrint={onPrint} />);
  expect(said('homework-empty')).toBe(text.homework.empty);
  await press('homework-print');
  expect(onPrint).toHaveBeenCalled();
});

test('a count kept from a longer list opens at what the list now allows', async () => {
  const data = await withHomework();
  await data.book.record(parseDay('2026-10-22'), {
    kind: 'homework.counted',
    count: { sessionKey: set(1), due: parseDay('2026-10-22'), notDone: 45, reliedOn: 0 },
  });
  await data.book.record(parseDay('2026-10-23'), {
    kind: 'pupil.moved',
    pupilId: 'p-1',
    movement: { day: parseDay('2026-10-20'), kind: 'out', reason: 'Transfer', confirmed: true },
  });
  await mount(data, <HomeworkBook courseId="c-1" sessionKey={set(1)} />, '2026-10-23');
  expect(said('homework-notDone-value')).toBe('44');
  expect(said(`homework-${set(1)}-notDone`)).toBe('45');
  expect(shown()).toContain('من 44 تلميذاً');
});

test('Today offers the count on the next session when the first was not held', async () => {
  const data = await withHomework();
  const context = coreContext({ ...data, state: data.book.state });
  const [first] = sessionsBetween(context, parseDay('2026-10-22'), parseDay('2026-10-22'), new Set(['c-1']));
  if (first === undefined) throw new Error('No session');
  await data.book.recordAll(
    parseDay('2026-10-22'),
    confirmSessions(context, [{ session: first, choice: { outcome: 'not-held' } }]),
  );
  await mount(data, <Today onHelp={jest.fn()} onDetails={jest.fn()} onRoll={jest.fn()} onHomework={onHomework} />);
  expect(root().findAll((node) => node.props.testID === `today-${back(1)}-homework-${set(1)}`)).toHaveLength(0);
  expect(root().findAll((node) => node.props.testID === `today-${back(2)}-homework-${set(1)}`).length).toBeGreaterThan(
    0,
  );
});
