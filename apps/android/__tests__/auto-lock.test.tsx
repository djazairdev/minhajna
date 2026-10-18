// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import ReactTestRenderer from 'react-test-renderer';
import { AppState } from 'react-native';
import { noteUse } from '../src/lock/activity';
import { CHECK_EVERY, useAutoLock } from '../src/lock/useAutoLock';

function Probe({ active, minutes, lock }: { active: boolean; minutes: number; lock: () => void }) {
  useAutoLock(active, minutes, lock);
  return null;
}

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
let listen: jest.SpyInstance;

beforeEach(() => {
  jest.useFakeTimers({ now: 1_000_000 });
  listen = jest.spyOn(AppState, 'addEventListener');
  listen.mockClear();
});

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  jest.useRealTimers();
});

async function mount(lock: () => void, active = true, minutes = 5) {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<Probe active={active} minutes={minutes} lock={lock} />);
  });
}

const advance = (millis: number) => ReactTestRenderer.act(() => jest.advanceTimersByTimeAsync(millis));

test('locks once after the whole delay unused, and not before', async () => {
  const lock = jest.fn();
  await mount(lock);
  await advance(5 * 60_000 - CHECK_EVERY);
  expect(lock).not.toHaveBeenCalled();
  await advance(CHECK_EVERY);
  expect(lock).toHaveBeenCalledTimes(1);
  await advance(10 * 60_000);
  expect(lock).toHaveBeenCalledTimes(1);
});

test('a touch or a typed letter starts the delay again', async () => {
  const lock = jest.fn();
  await mount(lock, true, 1);
  await advance(50_000);
  noteUse();
  await advance(50_000);
  expect(lock).not.toHaveBeenCalled();
  await advance(10_000);
  expect(lock).toHaveBeenCalledTimes(1);
});

test('checks at once when the app comes back to the front', async () => {
  const lock = jest.fn();
  await mount(lock);
  jest.setSystemTime(1_000_000 + 5 * 60_000);
  const [[, listener]] = listen.mock.calls as [string, (state: string) => void][];
  listener('active');
  expect(lock).toHaveBeenCalledTimes(1);
});

test('a clock moved back locks rather than waiting longer', async () => {
  const lock = jest.fn();
  await mount(lock);
  jest.setSystemTime(1_000_000 - 60_000);
  await advance(CHECK_EVERY);
  expect(lock).toHaveBeenCalledTimes(1);
});

test('does nothing while the history is closed', async () => {
  const lock = jest.fn();
  await mount(lock, false);
  await advance(30 * 60_000);
  expect(lock).not.toHaveBeenCalled();
  expect(listen).not.toHaveBeenCalled();
});
