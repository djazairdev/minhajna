// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import ReactTestRenderer from 'react-test-renderer';
import type { TestData } from '../jest/app-data';
import { noticeData } from '../jest/calendar-notice-data';
import {
  closeSettingsScreen,
  pressSettings,
  settingsControl,
  settingsTexts,
  showSettingsScreen,
} from '../jest/settings-screen';
import { withDay } from '../jest/today-day';
import { Receive } from '../src/calendar/Receive';
import { Button } from '../src/components/Button';
import { calendarInput as NativeInput } from '../jest/calendar-input';
import { useAppData } from '../src/storage/AppData';
import { catalogues, i18n } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
const onSaved = jest.fn();
const onIgnore = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
});
afterEach(async () => {
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
  jest.restoreAllMocks();
});

function PendingEdit() {
  const data = useAppData();
  return (
    <Button
      testID="synthetic-edit"
      label="Synthetic edit"
      onPress={() => data.record({ kind: 'teacher.personal.set', personal: { name: 'أستاذة مختلقة' } })}
    />
  );
}

function holdWrites(data: TestData) {
  let finish = () => undefined as void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const original = data.book.record.bind(data.book);
  const write = jest.spyOn(data.book, 'record').mockImplementation(async (day, event) => {
    await pending;
    return original(day, event);
  });
  return {
    write,
    release: async () => {
      await ReactTestRenderer.act(async () => {
        finish();
        await pending;
      });
    },
  };
}

async function open(data: TestData) {
  jest.mocked(NativeInput.readFile).mockResolvedValueOnce(JSON.stringify(noticeData()));
  await showSettingsScreen(
    <>
      <PendingEdit />
      <Receive schoolId="s-1" onSaved={onSaved} onIgnore={onIgnore} />
    </>,
    data,
  );
  await pressSettings('calendar-receive-file');
  await pressSettings('calendar-receive-acknowledge');
  await pressSettings('calendar-receive-preview');
}

test('one durable save despite double taps, with input blocked until it completes', async () => {
  const data = await withDay();
  const held = holdWrites(data);
  await open(data);
  const scan = settingsControl('calendar-receive-qr').onPress!;
  await ReactTestRenderer.act(() => {
    void settingsControl('calendar-receive-save').onPress?.({} as never);
    void settingsControl('calendar-receive-save').onPress?.({} as never);
    scan({} as never);
  });
  expect(settingsControl('calendar-receive-save').disabled).toBe(true);
  expect(NativeInput.scanQr).not.toHaveBeenCalled();
  expect(onSaved).not.toHaveBeenCalled();
  await held.release();
  expect(held.write).toHaveBeenCalledTimes(1);
  expect(data.book.state.calendar).toHaveLength(1);
  expect(onSaved).toHaveBeenCalledTimes(1);
});

test('failed writes preserve the preview and allow retry without false success', async () => {
  const data = await withDay();
  await open(data);
  jest.spyOn(data.book, 'record').mockRejectedValueOnce(new Error('Synthetic write failure'));
  await pressSettings('calendar-receive-save');
  expect(data.book.state.calendar).toHaveLength(0);
  expect(onSaved).not.toHaveBeenCalled();
  expect(settingsTexts()).toContain(catalogues.ar.calendarView.edit.failed);
  await pressSettings('calendar-receive-save');
  expect(data.book.state.calendar).toHaveLength(1);
  expect(onSaved).toHaveBeenCalledTimes(1);
});

test('a queued edit forces a new preview, including when saved during the wait', async () => {
  const data = await withDay();
  const held = holdWrites(data);
  await open(data);
  await ReactTestRenderer.act(() => {
    void settingsControl('calendar-receive-save').onPress?.({} as never);
    void settingsControl('synthetic-edit').onPress?.({} as never);
  });
  await held.release();
  expect(data.book.state.calendar).toHaveLength(0);
  expect(onSaved).not.toHaveBeenCalled();
  expect(settingsTexts()).toContain(catalogues.ar.calendarView.edit.changed);
  await pressSettings('calendar-receive-preview');
  await pressSettings('calendar-receive-save');
  expect(onSaved).toHaveBeenCalledTimes(1);
});

test('unmount cancels pending native input and ignores late results without writing', async () => {
  const data = await withDay();
  const before = [...data.book.entries];
  let finish: (text: string | null) => void = () => undefined;
  jest.mocked(NativeInput.scanQr).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await showSettingsScreen(<Receive schoolId="s-1" onSaved={onSaved} onIgnore={onIgnore} />, data);
  await ReactTestRenderer.act(() => {
    void settingsControl('calendar-receive-qr').onPress?.({} as never);
    void settingsControl('calendar-receive-file').onPress?.({} as never);
  });
  expect(NativeInput.readFile).not.toHaveBeenCalled();
  await closeSettingsScreen();
  expect(NativeInput.cancel).toHaveBeenCalled();
  await ReactTestRenderer.act(() => finish(JSON.stringify(noticeData())));
  expect(data.book.entries).toEqual(before);
  expect(onSaved).not.toHaveBeenCalled();
});

test.each([false, true])('leaving while saving never navigates (earlier queued edit: %s)', async (earlier) => {
  const data = await withDay();
  const held = holdWrites(data);
  await open(data);
  if (earlier) await pressSettings('synthetic-edit');
  await ReactTestRenderer.act(() => {
    void settingsControl('calendar-receive-save').onPress?.({} as never);
  });
  await closeSettingsScreen();
  await held.release();
  expect(data.book.state.calendar).toHaveLength(earlier ? 0 : 1);
  expect(onSaved).not.toHaveBeenCalled();
});
