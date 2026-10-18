// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «تصحيح الحصة» (#34, Entry-fix): a recorded session opens from what was
// recorded, a correction keeps both versions with its coded reason, a
// detail can be taken out, the stages can change, and the words of «سبب
// آخر» stay in the private note. Made-up schools, classes and timetables.

import {
  confirmSessions,
  parseDay,
  recordsForRoute,
  todayView,
  type OutboundRoute,
  type SessionConfirmation,
} from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Text, type PressableProps, type TextInputProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withData, type TestData } from '../jest/app-data';
import { key, withDay } from '../jest/today-day';
import { Entry } from '../src/entry/Entry';
import { coreContext } from '../src/storage/core-context';
import text from '../src/text/ar.json';

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
  onDone.mockReset();
});

async function show(data: TestData, sessionKey = key(1)) {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        {withData(data, <Entry sessionKey={sessionKey} day={day} onDone={onDone} />, '2026-10-17')}
      </LocaleDirContext.Provider>,
    );
  });
}

/** Records the day's first sessions with these confirmations, by their place in the day. */
async function record(data: TestData, ...confirmations: Omit<SessionConfirmation, 'session'>[]) {
  const context = coreContext({ ...data, state: data.book.state });
  const sessions = todayView(context, day).sessions;
  await data.book.recordAll(
    day,
    confirmSessions(
      context,
      confirmations.map((confirmation, index) => ({ ...confirmation, session: sessions[index].session })),
    ),
  );
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
const control = (id: string) =>
  root().findAll((node) => node.props.testID === id && typeof node.props.onPress === 'function')[0];
const press = async (id: string) => {
  await ReactTestRenderer.act(() => {
    (control(id)?.props as PressableProps).onPress?.({} as never);
  });
};
const type = async (id: string, value: string) => {
  await ReactTestRenderer.act(() => {
    root()
      .findAll((node) => node.props.testID === id && typeof node.props.onChangeText === 'function')
      .map((node) => node.props as TextInputProps)[0]
      ?.onChangeText?.(value);
  });
};

test('opens from what was recorded, and saves nothing until something changes', async () => {
  const data = await withDay();
  await record(data, { details: { homework: { text: 'التمرين 5', due: parseDay('2026-10-22') } } });
  await show(data);
  expect(shown()).toEqual(
    expect.arrayContaining([text.fix.title, text.fix.promise, text.fix.recorded, text.fix.reasonLabel, text.fix.paper]),
  );
  expect(accessibilityProblems(root())).toEqual([]);
  const recorded = root().findAll(
    (node) => node.props.testID === 'fix-recorded' && typeof node.props.accessibilityLabel === 'string',
  )[0];
  expect(recorded?.props.accessibilityLabel).toContain('⁧08سا – 09سا⁩');
  expect((control('entry-confirm')?.props as PressableProps).disabled).toBe(true);
});

test('takes the homework out, keeps both versions, and shows the change by day', async () => {
  const data = await withDay();
  await record(data, { details: { homework: { text: 'التمرين 5', due: parseDay('2026-10-22') } } });
  await show(data);
  await type('entry-homework', '');
  expect(shown()).toEqual(
    expect.arrayContaining([
      text.fix.log,
      'الواجب المنزلي: كان التمرين 5، يُسلَّم الخميس 22/10، أصبح لا شيء',
      'يُضاف يوم 17/10/2026، دون ساعة.',
    ]),
  );
  await press('fix-reason-entry-error');
  await press('entry-confirm');
  expect(onDone).toHaveBeenCalled();
  const versions = data.book.state.sessions.get(key(1));
  expect(versions).toHaveLength(2);
  expect(versions?.[0]?.value?.homework?.text).toBe('التمرين 5');
  expect(versions?.[1]?.value?.homework).toBeUndefined();
  expect(versions?.[1]?.value?.outcome).toBe('done');
  expect(versions?.[1]?.reason).toBe('entry-error');
});

test('changes the stages, and keeps the words of «سبب آخر» in the private note', async () => {
  const data = await withDay();
  await record(data, { choice: { outcome: 'merged', with: 'u1-1' } }, {});
  await show(data, key(2));
  await press('entry-stage-3');
  expect(shown()).toEqual(expect.arrayContaining([text.fix.log]));
  await press('fix-reason-other');
  await type('fix-reason-text', 'سبب مختلق');
  await press('entry-confirm');
  const versions = data.book.state.sessions.get(key(2));
  expect(versions?.[1]?.value).toMatchObject({
    outcome: 'partial',
    coverage: [{ op: 'taught', item: 'u1-2', from: 0, to: 2 }],
  });
  expect(versions?.[1]?.reason).toBe('other');
  expect(data.book.state.notes.get(key(2))).toMatchObject({ reasonText: 'سبب مختلق' });
  const outbound: readonly OutboundRoute[] = ['documents', 'statement', 'handover', 'handover-direct', 'school-space'];
  for (const route of outbound) {
    expect(JSON.stringify(recordsForRoute(data.book.state, route))).not.toContain('سبب مختلق');
  }
});
