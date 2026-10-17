// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The debug-only tools for #19's crash and start-up checks, against the Node
// fakes: the crash history keeps every confirmed note and refuses a changed
// one, and the demo year goes only into an empty history.

import { HistoryLog, parseDay } from '@minhajna/core';
import ReactTestRenderer from 'react-test-renderer';
import { FakeStorage } from '../jest/fake-storage';
import { FakeStorageCheck } from '../jest/fake-storage-check';
import { accessibilityProblems } from '../jest/accessibility';
import { CRASH_HISTORY, verifyCrashHistory, writeUntilStopped } from '../src/debug/crash-check';
import { fillWithDemoYear } from '../src/debug/demo-history';
import { HistoryTools } from '../src/debug/HistoryTools';
import { nativeDeps, nativeStore } from '../src/storage/history';

describe('the crash check', () => {
  test('confirms each note after its write, and the history then verifies with all of them', async () => {
    const storage = new FakeStorage();
    const check = new FakeStorageCheck();
    const confirmed: number[] = [];
    const count = await writeUntilStopped(
      storage.asSpec(),
      check.asSpec(),
      () => confirmed.length === 5,
      (seq) => {
        expect(check.histories.get(CRASH_HISTORY)?.rows.length).toBe(seq + 1);
        confirmed.push(seq);
      },
    );
    expect(confirmed).toEqual([0, 1, 2, 3, 4]);
    expect(count).toBe(5);
    expect(await verifyCrashHistory(storage.asSpec(), check.asSpec())).toBe(5);
    await writeUntilStopped(
      storage.asSpec(),
      check.asSpec(),
      () => confirmed.length === 7,
      (seq) => confirmed.push(seq),
    );
    expect(confirmed.slice(5)).toEqual([5, 6]);
  });

  test('refuses a crash history that was changed', async () => {
    const storage = new FakeStorage();
    const check = new FakeStorageCheck();
    let n = 0;
    await writeUntilStopped(
      storage.asSpec(),
      check.asSpec(),
      () => n === 3,
      () => (n += 1),
    );
    const rows = check.histories.get(CRASH_HISTORY)?.rows ?? [];
    rows[1] = { ...rows[1], body: '{"text":"changed"}' };
    await expect(verifyCrashHistory(storage.asSpec(), check.asSpec())).rejects.toThrow('does not verify');
  });
});

describe('the demo year', () => {
  test('fills an empty history with a year that opens and verifies', async () => {
    const storage = new FakeStorage();
    const times = await fillWithDemoYear(storage.asSpec(), 'cem');
    expect(times.entries).toBe(397);
    expect(storage.rows).toHaveLength(397);
    expect(times.openMilliseconds).toBeGreaterThanOrEqual(0);
  });

  test('writes nothing into a history that already holds records', async () => {
    const storage = new FakeStorage();
    await storage.openHistory();
    const log = await HistoryLog.open(nativeStore(storage.asSpec()), nativeDeps(storage.asSpec()));
    await log.append(parseDay('2026-10-01'), 'private', 'note', { text: 'A real record' });
    await expect(fillWithDemoYear(storage.asSpec(), 'primary')).rejects.toThrow('not empty');
    expect(storage.rows).toHaveLength(1);
  });
});

test('the tools can be read by TalkBack and pressed with a thumb', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<HistoryTools check={new FakeStorageCheck().asSpec()} />);
  });
  expect(accessibilityProblems(tree!.root)).toEqual([]);
  await ReactTestRenderer.act(() => tree!.unmount());
});
