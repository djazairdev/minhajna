// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import type { TextProps } from 'react-native';
import { HistoryError, HistoryLog, parseDay } from '@minhajna/core';
import App from '../App';
import { AppNavigator } from '../src/navigation/AppNavigator';
import { FakeStorage } from '../jest/fake-storage';
import { typePin } from '../jest/unlock';
import { fromHex, nativeDeps, nativeStore } from '../src/storage/history';
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

/** The texts the app shows once its history has had a turn to open, past the lock where there is one. */
async function shown(storage: FakeStorage): Promise<unknown[]> {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App storage={storage.asSpec()} />);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  if (storage.pin !== null) await typePin(tree!, storage.pin);
  const shown = tree!.root.findAllByType(Text).map((node): unknown => (node.props as TextProps).children);
  await ReactTestRenderer.act(() => tree!.unmount());
  return shown;
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

  test('keeps navigation unavailable until history verification completes', async () => {
    const storage = FakeStorage.unlocked();
    const originalOpen = storage.openHistory.bind(storage);
    let complete: (() => void) | undefined;
    jest.spyOn(storage, 'openHistory').mockImplementation(async () => {
      await new Promise<void>((resolve) => {
        complete = resolve;
      });
      await originalOpen();
    });
    const reportDrawn = jest.fn();
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<App storage={storage.asSpec()} reportDrawn={reportDrawn} />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(reportDrawn).toHaveBeenCalledTimes(1);
    await typePin(tree!);
    expect(tree!.root.findAllByType(AppNavigator)).toHaveLength(0);
    await ReactTestRenderer.act(async () => {
      if (complete === undefined) throw new Error('History opening did not start');
      complete();
      await Promise.resolve();
    });
    expect(tree!.root.findAllByType(AppNavigator)).toHaveLength(1);
    expect(reportDrawn).toHaveBeenCalledTimes(1);
    await ReactTestRenderer.act(() => {
      tree!.update(
        <App
          storage={storage.asSpec()}
          reportDrawn={() => {
            reportDrawn();
          }}
        />,
      );
    });
    expect(reportDrawn).toHaveBeenCalledTimes(1);
    await ReactTestRenderer.act(() => tree!.unmount());
  });

  test('says the first screen is drawn once when the history does not verify too', async () => {
    const storage = FakeStorage.unlocked();
    storage.rows.push({
      seq: 0,
      id: 'x',
      day: '2026-10-15',
      layer: 'private',
      kind: 'note',
      digest: '',
      previous: '',
      hash: '',
      salt: null,
      body: null,
    });
    const reportDrawn = jest.fn();
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<App storage={storage.asSpec()} reportDrawn={reportDrawn} />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await typePin(tree!);
    expect(tree!.root.findAllByType(Text).map((node): unknown => (node.props as TextProps).children)).toContain(
      text.log.broken.title,
    );
    expect(reportDrawn).toHaveBeenCalledTimes(1);
    await ReactTestRenderer.act(() => tree!.unmount());
  });

  test('opens nothing before the first PIN, and offers the way into the app', async () => {
    const storage = new FakeStorage();
    expect(await shown(storage)).toEqual([
      text.name,
      text.tagline,
      text.welcome.line,
      text.preview.badge,
      text.preview.short,
      text.language.label,
      text.language.ar,
      text.language.fr,
      text.language.en,
      text.welcome.noAccount,
      text.welcome.offline,
      text.welcome.onPhone,
      text.welcome.start,
    ]);
    expect(storage.opened).toBe(false);
    expect(storage.created).toBe(false);
  });

  test('shows what still checks, and nothing past the break, when the chain breaks', async () => {
    const storage = new FakeStorage();
    const log = await openLog(storage);
    await log.append(day, 'private', 'note', { text: 'kept' });
    storage.rows[0].hash = '0'.repeat(64);
    storage.pin = '1234';
    const before = JSON.stringify(storage.rows);

    const texts = await shown(storage);
    expect(texts).toEqual(expect.arrayContaining([text.log.broken.title, text.log.broken.trustedNone]));
    expect(texts).not.toContain(text.historyRefused);
    expect(JSON.stringify(texts)).not.toContain('kept');
    expect(JSON.stringify(storage.rows)).toBe(before);
    expect(warn).toHaveBeenCalledWith('History refused', expect.any(HistoryError));
  });

  test('shows the same line when the key is gone', async () => {
    const storage = FakeStorage.unlocked();
    storage.opened = false;
    storage.keyLost = true;
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<App storage={storage.asSpec()} />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await typePin(tree!);
    const texts = tree!.root.findAllByType(Text).map((node): unknown => (node.props as TextProps).children);
    expect(texts).toContain(text.historyRefused);
    await ReactTestRenderer.act(() => tree!.unmount());
  });
});
