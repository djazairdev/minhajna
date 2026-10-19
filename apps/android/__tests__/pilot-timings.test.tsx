// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «توقيتاتي في التجربة» (#220, answer 267): the four cards and the lines a
// teacher may share, word for word the same, with no day and no class; the
// share sheet, and nothing sent otherwise; clearing after a question; the
// Documents tab's row in a pilot build only; and the clock: a session's
// first confirmation on Today in one tap, kept once it can no longer be
// undone, dropped by an undo, not one tap with the sheet's choice, a week
// of the backlog split among its sessions, from its own screen, a roll
// call's first taking, time in the background left out, and a correction
// not timed; and minutes from roll calls alone. Made-up records and figures
// only. Thursday 15 October 2026 is
// in the school week that starts on Sunday 11 October.

import { parseDay, timingSummary, type Timing } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import type { ReactElement } from 'react';
import { AppState, Share, type AppStateStatus, type PressableProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withData, type TestData } from '../jest/app-data';
import { FakeStorage } from '../jest/fake-storage';
import { withPupils } from '../jest/roll-class';
import { key, withDay } from '../jest/today-day';
import { DocumentsTab } from '../src/documents/DocumentsTab';
import { EntryScreen, RollScreen } from '../src/navigation/RecordScreens';
import { PilotTimings as PilotScreen } from '../src/pilot/PilotTimings';
import { sharedLines, shareText, timingCards } from '../src/pilot/timing-figures';
import { PilotTimings, timingStore, type TimingStore } from '../src/pilot/timing-store';
import { i18n } from '../src/text/i18n';
import text from '../src/text/ar.json';
import { Today } from '../src/today/Today';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const t = i18n.getFixedT('ar');
const week = parseDay('2026-10-11');
const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction', activityType: undefined });
let clock = 0;
jest.spyOn(performance, 'now').mockImplementation(() => clock);
let tree: ReactTestRenderer.ReactTestRenderer | undefined;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  jest.clearAllMocks();
});

const session = (tenths: number, oneTap: boolean): Timing => ({ kind: 'session', week, tenths, oneTap });
const sample: Timing[] = [
  ...[30, 40, 40, 50, 60, 70, 80, 90, 95].map((tenths) => session(tenths, true)),
  session(120, false),
  { kind: 'roll', week, tenths: 1200, oneTap: false },
];

function storeWith(timings: readonly Timing[] = []): { storage: FakeStorage; store: TimingStore } {
  const storage = FakeStorage.unlocked();
  storage.timings = timings.map((one) => ({ ...one }));
  return { storage, store: timingStore(storage.asSpec(), 0) };
}

async function mount(data: TestData, element: ReactElement, store: TimingStore | null, day = '2026-10-15') {
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        {withData(data, <PilotTimings.Provider value={store}>{element}</PilotTimings.Provider>, day)}
      </LocaleDirContext.Provider>,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const pressable = (id: string) =>
  tree!.root.findAll(
    (node) => node.props.testID === id && typeof (node.props as PressableProps).onPress === 'function',
  );

async function press(id: string) {
  await ReactTestRenderer.act(async () => {
    (pressable(id)[0]?.props as PressableProps).onPress?.({} as never);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const label = (id: string) =>
  String(tree!.root.find((node) => node.props.testID === id && typeof node.type === 'string').props.accessibilityLabel);

test('the cards and the shared lines say the same, rounded so «أو أقل» holds', () => {
  const summary = timingSummary(sample);
  const cards = timingCards(t, summary);
  expect(cards.map((card) => [card.id, card.value, card.unit, card.line])).toEqual([
    ['median', '7', 'ثوانٍ', 'و9 من كل 10 حصص في 10 ثوانٍ أو أقل'],
    ['one-tap', '90%', undefined, '9 من 10 حصص'],
    ['weekly', '3', 'دقائق', 'الحصص والمناداة · أسبوع واحد'],
    ['export', text.pilotTimings.notYet, undefined, text.pilotTimings.exportLine],
  ]);
  const lines = sharedLines(t, summary, '0.2.0');
  expect(lines.map((line) => line.value)).toEqual([
    '0.2.0 · نسخة التجربة',
    'الوسيط 7 · و9 من 10 في 10 أو أقل',
    '90% · 9 من 10 حصص',
    '3 · الحصص والمناداة · أسبوع واحد',
    text.pilotTimings.notYet,
  ]);
  expect(shareText(t, lines).split('\n')).toHaveLength(6);
  expect(sharedLines(t, timingSummary([]), '0.2.0')).toEqual([]);
  expect(timingCards(t, timingSummary([])).map((card) => card.value)).toEqual([
    '—',
    '—',
    '—',
    text.pilotTimings.notYet,
  ]);
  const rolls = timingSummary([{ kind: 'roll', week, tenths: 1800, oneTap: false }]);
  expect(timingCards(t, rolls).map((card) => card.value)).toEqual(['—', '—', '3', text.pilotTimings.notYet]);
  expect(sharedLines(t, rolls, '0.2.0').map((line) => line.value)).toEqual([
    '0.2.0 · نسخة التجربة',
    '—',
    '—',
    '3 · الحصص والمناداة · أسبوع واحد',
    text.pilotTimings.notYet,
  ]);
  expect(t('pilotTimings.oneTapOf', { oneTap: 1, count: 2 })).toBe('1 من حصتين');
});

test('the screen shows the figures, shares them by the share sheet only, and clears them after a question', async () => {
  const { storage, store } = storeWith(sample);
  await mount(await withDay(), <PilotScreen store={store} />, store);
  expect(label('timings-median')).toContain('7 ثوانٍ');
  expect(tree!.root.findAllByProps({ testID: 'timings-sent' }).length).toBeGreaterThan(0);
  expect(accessibilityProblems(tree!.root)).toEqual([]);
  await press('timings-share');
  const [content] = share.mock.calls[0];
  const message = (content as { message: string }).message;
  expect(message).toContain('الوسيط 7');
  expect(message).toContain('0.1.0');
  expect(message).not.toMatch(/\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}|4م1|4م2/);
  await press('timings-clear');
  expect(storage.timings).toHaveLength(sample.length);
  await press('timings-clear-yes');
  expect(storage.timings).toEqual([]);
  expect(tree!.root.findAllByProps({ testID: 'timings-cleared' }).length).toBeGreaterThan(0);
  expect(tree!.root.findAllByProps({ testID: 'timings-none' }).length).toBeGreaterThan(0);
});

test('with no timings yet it says so and offers nothing to share', async () => {
  const { store } = storeWith();
  await mount(await withDay(), <PilotScreen store={store} />, store);
  expect(tree!.root.findAllByProps({ testID: 'timings-none' }).length).toBeGreaterThan(0);
  expect(tree!.root.findAllByProps({ testID: 'timings-sent' })).toHaveLength(0);
  const button = tree!.root.find((node) => node.props.testID === 'timings-share' && typeof node.type === 'string');
  expect(button.props.accessibilityState).toMatchObject({ disabled: true });
});

test('the Documents tab’s last row opens «توقيتاتي» in a pilot build only', async () => {
  const onTimings = jest.fn();
  const tab = <DocumentsTab onOpen={jest.fn()} onPrintWeek={jest.fn()} onFixes={jest.fn()} onTimings={onTimings} />;
  await mount(await withDay(), tab, null);
  expect(pressable('documents-timings')).toHaveLength(0);
  await ReactTestRenderer.act(() => tree?.unmount());
  await mount(await withDay(), tab, storeWith().store);
  await press('documents-timings');
  expect(onTimings).toHaveBeenCalled();
});

test('Today times a first confirmation in one tap, leaving out the time in the background', async () => {
  const { storage, store } = storeWith();
  const listeners: ((status: AppStateStatus) => void)[] = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_, handler) => {
    listeners.push(handler);
    return { remove: jest.fn() };
  });
  const status = (value: AppStateStatus) =>
    Object.defineProperty(AppState, 'currentState', { value, configurable: true, writable: true });
  status('active');
  clock = 1000;
  await mount(await withDay(), today(), store);
  clock = 3000;
  status('background');
  await ReactTestRenderer.act(() => listeners.forEach((one) => one('background')));
  clock = 60000;
  status('active');
  await ReactTestRenderer.act(() => listeners.forEach((one) => one('active')));
  clock = 62200;
  await press(`today-${key(1)}-confirm`);
  expect(storage.timings).toEqual([]);
  await ReactTestRenderer.act(() => tree?.unmount());
  expect(storage.timings).toEqual([{ kind: 'session', week, tenths: 42, oneTap: true }]);
});

const today = () => <Today onHelp={jest.fn()} onDetails={jest.fn()} onRoll={jest.fn()} />;

const undoNow = () =>
  ReactTestRenderer.act(() => {
    const undo = tree!.root.findAll(
      (node) => node.props.accessibilityLabel === text.today.undo && typeof node.props.onPress === 'function',
    )[0];
    (undo?.props as PressableProps).onPress?.({} as never);
  });

test('an undone confirmation leaves no timing, and a choice in the sheet is not one tap', async () => {
  const { storage, store } = storeWith();
  const data = await withDay();
  clock = 0;
  await mount(data, today(), store);
  clock = 2000;
  await press(`today-${key(1)}-confirm`);
  await undoNow();
  clock = 5000;
  await press(`today-${key(1)}-other`);
  await press('outcome-not-held');
  await ReactTestRenderer.act(() => tree?.unmount());
  expect(storage.timings).toEqual([{ kind: 'session', week, tenths: 30, oneTap: false }]);
});

test('a second choice for the same session adds its time, and the timing is kept when the app leaves', async () => {
  const { storage, store } = storeWith();
  const listeners: ((status: AppStateStatus) => void)[] = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_, handler) => {
    listeners.push(handler);
    return { remove: jest.fn() };
  });
  clock = 0;
  await mount(await withDay(), today(), store);
  clock = 2000;
  await press(`today-${key(1)}-other`);
  await press('outcome-not-held');
  clock = 3500;
  await press('outcome-make-up');
  expect(storage.timings).toEqual([]);
  await ReactTestRenderer.act(() => listeners.forEach((one) => one('background')));
  expect(storage.timings).toEqual([{ kind: 'session', week, tenths: 35, oneTap: false }]);
  await ReactTestRenderer.act(() => tree?.unmount());
  expect(storage.timings).toHaveLength(1);
});

test('a week of the backlog confirmed at once splits the tap’s time among its two sessions', async () => {
  const { storage, store } = storeWith();
  clock = 0;
  await mount(await withDay(), today(), store, '2026-10-22');
  clock = 3100;
  await press('backlog-confirm');
  await ReactTestRenderer.act(() => tree?.unmount());
  expect(storage.timings.map((one) => [one.tenths, one.oneTap])).toEqual([
    [16, true],
    [15, true],
  ]);
});

test('a session’s own screen times its first confirmation only, and a roll call its first taking', async () => {
  const { storage, store } = storeWith();
  const navigation = { goBack: jest.fn(), navigate: jest.fn(), setOptions: jest.fn() };
  const data = await withDay();
  clock = 0;
  const entry = (
    <EntryScreen navigation={navigation as never} route={{ params: { key: key(1), day: '2026-10-15' } } as never} />
  );
  await mount(data, entry, store);
  clock = 9000;
  await press('entry-confirm');
  expect(storage.timings).toEqual([{ kind: 'session', week, tenths: 90, oneTap: false }]);
  await ReactTestRenderer.act(() => tree?.unmount());
  await mount(data, entry, store);
  await press('entry-confirm');
  expect(storage.timings).toHaveLength(1);
  expect(navigation.goBack).toHaveBeenCalledTimes(2);
  await ReactTestRenderer.act(() => tree?.unmount());
  const pupils = await withPupils();
  clock = 0;
  const route = { params: { key: key(1), day: '2026-10-15', courseId: 'c-1' } };
  await mount(pupils, <RollScreen navigation={navigation as never} route={route as never} />, store);
  clock = 30000;
  await press('roll-save');
  expect(storage.timings.at(-1)).toEqual({ kind: 'roll', week, tenths: 300, oneTap: false });
});
