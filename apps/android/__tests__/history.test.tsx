// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import type { TextProps } from 'react-native';
import { HistoryError, HistoryLog, parseDay } from '@minhajna/core';
import App from '../App';
import { FakeStorage } from '../jest/fake-storage';
import { fromHex, nativeDeps, nativeStore, openRecordBook } from '../src/storage/history';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const day = parseDay('2026-10-15');

async function openLog(storage: FakeStorage): Promise<HistoryLog> {
  await storage.openHistory();
  return HistoryLog.open(nativeStore(storage.asSpec()), nativeDeps(storage.asSpec()));
}

/** The texts the app shows once its history has had a turn to open. */
async function shown(storage: FakeStorage): Promise<unknown[]> {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App storage={storage.asSpec()} />);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return tree!.root.findAllByType(Text).map((node): unknown => (node.props as TextProps).children);
}

test('reads hex from the native random source', () => {
  expect(fromHex('00ff7a')).toEqual(new Uint8Array([0, 255, 122]));
  expect(() => fromHex('0F')).toThrow(RangeError);
  expect(nativeDeps(new FakeStorage().asSpec()).random(16)).toHaveLength(16);
});

test('keeps entries through the native store, as they were hashed', async () => {
  const storage = new FakeStorage();
  const log = await openLog(storage);
  const note = await log.append(day, 'private', 'note', { text: 'تذكير: الفرض يوم الأحد', count: 1.5, list: [null] });
  await log.append(day, 'lesson-record', 'note', { text: 'second' });

  const reopened = await openLog(storage);
  expect(reopened.entries).toEqual(log.entries);
  expect(storage.rows[0]).toMatchObject({ seq: 0, id: note.id, salt: note.content?.salt });
  expect(JSON.parse(storage.rows[0].body!)).toEqual(note.content?.body);
});

test('erases content in the store, and the history still verifies', async () => {
  const storage = new FakeStorage();
  const log = await openLog(storage);
  const note = await log.append(day, 'private', 'note', { text: 'to erase' });
  await log.erase(day, [note.id]);

  expect(storage.rows[0]).toMatchObject({ salt: null, body: null });
  const reopened = await openLog(storage);
  expect(reopened.entries[0].content).toBeNull();
});

test('refuses a history changed outside the app', async () => {
  const storage = new FakeStorage();
  const log = await openLog(storage);
  await log.append(day, 'private', 'note', { text: 'kept' });
  storage.rows[0].body = JSON.stringify({ text: 'changed' });

  await expect(openLog(storage)).rejects.toBeInstanceOf(HistoryError);
});

test('refuses to hash text that is not well-formed', async () => {
  await expect(nativeDeps(new FakeStorage().asSpec()).digest('a\ud800')).rejects.toThrow('E_NOT_WELL_FORMED');
});

describe('at start', () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  test('opens an empty history with nothing new on screen', async () => {
    const storage = new FakeStorage();
    expect(await shown(storage)).toEqual([text.name, text.tagline, text.latinName]);
    expect(storage.opened).toBe(true);
    expect((await openRecordBook(storage.asSpec())).entries).toEqual([]);
  });

  test('shows one line, and nothing from the history, when it does not verify', async () => {
    const storage = new FakeStorage();
    const log = await openLog(storage);
    await log.append(day, 'private', 'note', { text: 'kept' });
    storage.rows[0].hash = '0'.repeat(64);

    expect(await shown(storage)).toEqual([text.name, text.tagline, text.latinName, text.historyRefused]);
    expect(warn).toHaveBeenCalledWith('History refused', expect.any(HistoryError));
  });

  test('shows the same line when the key is gone', async () => {
    const storage = new FakeStorage();
    storage.keyLost = true;
    expect(await shown(storage)).toContain(text.historyRefused);
  });
});
