// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The storage check that debug builds run on the phone (#19), here against
// the Node fakes: it runs every shared check, each in its own throwaway
// history that it deletes, and a faulty storage fails it.

import { DevSettings, Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { FakeStorage } from '../jest/fake-storage';
import { FakeStorageCheck } from '../jest/fake-storage-check';
import type { FakeDevMenu } from '../jest/fake-dev-menu';
import { runStorageChecks } from '../src/debug/storage-check';
import { AppNavigator, STORAGE_CHECK_MENU_ITEM } from '../src/navigation/AppNavigator';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

// The same assert as on the phone, which names where values differ, not what they hold.
jest.mock('node:assert/strict', () => jest.requireActual<object>('../src/debug/strict-assert'));

jest.mock('../src/native/NativeMinhajnaStorageCheck', () => {
  const { FakeStorageCheck: Fake } =
    jest.requireActual<typeof import('../jest/fake-storage-check')>('../jest/fake-storage-check');
  return { __esModule: true, default: new Fake().asSpec() };
});

/** Erases every entry's content, whatever it is asked to erase. */
class EraseAll extends FakeStorage {
  override eraseContent(): Promise<void> {
    return super.eraseContent(this.rows.map((row) => row.id));
  }
}

describe('the storage check', () => {
  test('runs every shared check, each in a history of its own that it then deletes', async () => {
    const check = new FakeStorageCheck();
    const results = await runStorageChecks(new FakeStorage().asSpec(), check.asSpec());
    expect(results.length).toBe(8);
    expect(results.filter((result) => !result.passed)).toEqual([]);
    expect(new Set(check.opened).size).toBe(8);
    expect(check.opened.every((name) => /^run-[0-9a-f]{16}$/.test(name))).toBe(true);
    expect(check.histories.size).toBe(0);
  });

  test('fails a storage that erases too much, and says where, not what', async () => {
    const check = new FakeStorageCheck(() => new EraseAll());
    const reported: string[] = [];
    const results = await runStorageChecks(new FakeStorage().asSpec(), check.asSpec(), (result) =>
      reported.push(result.name),
    );
    const failed = results.filter((result) => !result.passed);
    expect(failed.length).toBeGreaterThanOrEqual(3);
    expect(reported).toEqual(results.map((result) => result.name));
    for (const result of failed) expect(result.error).not.toMatch(/ملاحظة|séance/);
    expect(check.histories.size).toBe(0);
  });

  test('opens from the developer menu, shows the result and logs it for scripts', async () => {
    const logged = jest.spyOn(console, 'log').mockImplementation(() => {});
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(<AppNavigator initialRouteName="Home" direction="ltr" />);
    });
    const open = (DevSettings as unknown as FakeDevMenu).items.get(STORAGE_CHECK_MENU_ITEM);
    expect(open).toBeDefined();
    await ReactTestRenderer.act(() => {
      open?.();
    });
    const summary = () =>
      tree?.root
        .findAll((node) => node.type === Text && node.props.testID === 'storage-summary')
        .map((node) => [node.props.children as unknown].flat().join(''))[0];
    for (let tick = 0; tick < 200 && summary() !== '8 passed, 0 failed'; tick++) {
      await ReactTestRenderer.act(() => new Promise((resolve) => setTimeout(resolve, 0)));
    }
    expect(summary()).toBe('8 passed, 0 failed');
    expect(logged).toHaveBeenLastCalledWith('[storage-check] done: 8 passed, 0 failed');
    logged.mockRestore();
    await ReactTestRenderer.act(() => tree?.unmount());
  });
});
