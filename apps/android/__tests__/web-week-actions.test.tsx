// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the PC week's pane does (#251, answer 526): a session confirmed as
// proposed with Today's «تراجع» after, kept out of the pilot's timings;
// another outcome from Today's sheet; the session's details opened in the
// pane with a way back, the session kept chosen meanwhile; a later session
// with its proposal only; a recorded one corrected there, and «صفحة الدفتر»
// opening the course's texts book on the session. Made-up records.

import { confirmSessions, current, todayView } from '@minhajna/core';
import { NavigationContainer } from '@react-navigation/native';
import { Platform, type PressableProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { context, DAY, mount, press, root, settle, unmount } from '../jest/components-screen';
import { withPupils } from '../jest/roll-class';
import { HomeTabs } from '../src/navigation/HomeTabs';
import { PilotTimings, type TimingStore } from '../src/pilot/timing-store';
import text from '../src/text/ar.json';
import { PcWeek } from '../src/week/pc/PcWeek';

jest.mock('../src/navigation/RecordScreens', () => ({ TodayTab: () => null, ClassesTabScreen: () => null }));
jest.mock('../src/navigation/DocumentScreens', () => ({ DocumentsTabScreen: () => null }));
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});
afterEach(async () => {
  await unmount();
  jest.restoreAllMocks();
});

const FIRST = 'c-1/2026-10-15/m1/k-1-w';
const shown = (testID: string) => root().findAll((node) => node.props.testID === testID).length > 0;
const week = (more: { onBook?: jest.Mock } = {}) => (
  <PcWeek onPrint={jest.fn()} onBook={jest.fn()} onNote={jest.fn()} {...more} />
);

const undo = () =>
  ReactTestRenderer.act(async () => {
    (
      root().findAll(
        (node) => node.props.accessibilityLabel === text.today.undo && typeof node.props.onPress === 'function',
      )[0]?.props as PressableProps
    ).onPress?.({} as never);
    await settle();
  });

test('a session confirmed from the pane is recorded, and its undo takes it back', async () => {
  const data = await withPupils();
  await mount(data, week());
  await press('week-pane-confirm');
  expect(current(data.book.state.sessions.get(FIRST))).toMatchObject({ outcome: 'done' });
  expect(shown('week-snack')).toBe(true);
  await undo();
  expect(current(data.book.state.sessions.get(FIRST))).toBeNull();
  expect(shown('week-snack')).toBe(false);
});

test("another outcome is chosen on Today's sheet", async () => {
  const data = await withPupils();
  await mount(data, week());
  expect(shown('outcome-not-held')).toBe(false);
  await press('week-pane-other', 'outcome-not-held');
  expect(current(data.book.state.sessions.get(FIRST))).toMatchObject({ outcome: 'not-held' });
  await press('outcome-done');
});

test("the session's details open in the pane and lead back to it", async () => {
  await mount(await withPupils(), week());
  await press('week-pane-details');
  expect(shown('entry-confirm')).toBe(true);
  expect(shown('week-pane-confirm')).toBe(false);
  await press('week-pane-back');
  expect(shown('entry-confirm')).toBe(false);
  expect(shown('week-pane-confirm')).toBe(true);
});

test('a recorded session is corrected in the pane, and its texts book opens on it', async () => {
  const data = await withPupils();
  const [first] = todayView(context(data), DAY).sessions;
  await data.book.recordAll(
    DAY,
    confirmSessions(context(data), [{ session: first.session, choice: { outcome: 'not-held' } }]),
  );
  const onBook = jest.fn();
  await mount(data, week({ onBook }));
  await press(`week-cell-${FIRST}`, 'week-pane-book');
  expect(onBook).toHaveBeenCalledWith('c-1', FIRST);
  await press('week-pane-fix');
  expect(shown('fix-notice')).toBe(true);
  await press('week-pane-back');
  expect(shown('week-pane-fix')).toBe(true);
});

test('a later session keeps its proposal, with nothing to confirm before its day', async () => {
  await mount(await withPupils(), week());
  await press('week-after');
  expect(shown('week-pane-proposal')).toBe(true);
  expect(shown('week-pane-confirm')).toBe(false);
  expect(shown('week-pane-other')).toBe(false);
  expect(shown('week-pane-details')).toBe(false);
});

test('a session open in the pane stays open when an undo changes the session to confirm first', async () => {
  const data = await withPupils();
  await mount(data, week());
  await press('week-pane-confirm', 'week-pane-details');
  expect(shown('entry-confirm')).toBe(true);
  await undo();
  expect(current(data.book.state.sessions.get(FIRST))).toBeNull();
  expect(shown('entry-confirm')).toBe(true);
});

test("the week's confirmations stay out of the pilot's timings, which Today's keep", async () => {
  const store = { load: jest.fn(), add: jest.fn(() => Promise.resolve()), clear: jest.fn() } satisfies TimingStore;
  await mount(
    await withPupils(),
    <PilotTimings.Provider value={store}>
      <NavigationContainer>
        <HomeTabs />
      </NavigationContainer>
    </PilotTimings.Provider>,
  );
  await press('rail-PcWeek', 'week-pane-confirm');
  await unmount();
  expect(store.add).not.toHaveBeenCalled();
  await mount(await withPupils(), <PilotTimings.Provider value={store}>{week()}</PilotTimings.Provider>);
  await press('week-pane-confirm');
  await unmount();
  expect(store.add).toHaveBeenCalledTimes(1);
});
