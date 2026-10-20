// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import ReactTestRenderer from 'react-test-renderer';
import type { TestData } from '../jest/app-data';
import {
  closeSettingsScreen,
  pressSettings,
  settingsControl,
  settingsInput,
  settingsTexts,
  showSettingsScreen,
  typeSettings,
} from '../jest/settings-screen';
import { withDay } from '../jest/today-day';
import { CalendarForm } from '../src/calendar/Form';
import { Button } from '../src/components/Button';
import { useAppData } from '../src/storage/AppData';
import { catalogues, i18n } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
const onSaved = jest.fn();
const onAddDay = jest.fn();
beforeEach(() => {
  onSaved.mockReset();
  onAddDay.mockReset();
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
  await showSettingsScreen(
    <>
      <PendingEdit />
      <CalendarForm schoolId="s-1" onSaved={onSaved} onAddDay={onAddDay} />
    </>,
    data,
  );
  await typeSettings('calendar-source', 'إعلان تجريبي');
  await pressSettings('calendar-preview');
}

test('double taps and stale field callbacks cannot change or duplicate a pending save', async () => {
  const data = await withDay();
  const held = holdWrites(data);
  await open(data);
  const source = settingsInput('calendar-source').onChangeText!;
  await ReactTestRenderer.act(() => {
    void settingsControl('calendar-save').onPress?.({} as never);
    void settingsControl('calendar-save').onPress?.({} as never);
    source('تغيير متأخر مختلق');
  });
  expect(settingsControl('calendar-save').disabled).toBe(true);
  expect(settingsInput('calendar-source').value).toBe('إعلان تجريبي');
  expect(onSaved).not.toHaveBeenCalled();
  await held.release();
  expect(held.write).toHaveBeenCalledTimes(1);
  expect(onSaved).toHaveBeenCalledTimes(1);
  expect(data.book.state.calendar).toHaveLength(1);
});

test('a pending earlier edit requires a new preview before the calendar save', async () => {
  const data = await withDay();
  const held = holdWrites(data);
  await open(data);
  await pressSettings('synthetic-edit');
  await ReactTestRenderer.act(() => {
    void settingsControl('calendar-save').onPress?.({} as never);
  });
  expect(onSaved).not.toHaveBeenCalled();
  await held.release();
  expect(held.write).toHaveBeenCalledTimes(1);
  expect(data.book.state.calendar).toHaveLength(0);
  expect(settingsTexts()).toContain(catalogues.ar.calendarView.edit.changed);
  await pressSettings('calendar-preview');
  await pressSettings('calendar-save');
  expect(data.book.state.calendar).toHaveLength(1);
  expect(onSaved).toHaveBeenCalledTimes(1);
});

test('also waits for an edit queued during the initial wait before trusting a preview', async () => {
  const data = await withDay();
  const held = holdWrites(data);
  await open(data);
  await ReactTestRenderer.act(() => {
    void settingsControl('calendar-save').onPress?.({} as never);
    void settingsControl('synthetic-edit').onPress?.({} as never);
  });
  await held.release();
  expect(held.write).toHaveBeenCalledTimes(1);
  expect(data.book.state.calendar).toHaveLength(0);
  expect(onSaved).not.toHaveBeenCalled();
  expect(settingsTexts()).toContain(catalogues.ar.calendarView.edit.changed);
});

test('leaving before an earlier edit settles does not enqueue a calendar write', async () => {
  const data = await withDay();
  const held = holdWrites(data);
  await open(data);
  await pressSettings('synthetic-edit');
  await ReactTestRenderer.act(() => {
    void settingsControl('calendar-save').onPress?.({} as never);
  });
  await closeSettingsScreen();
  await held.release();
  expect(held.write).toHaveBeenCalledTimes(1);
  expect(data.book.state.personal?.name).toBe('أستاذة مختلقة');
  expect(data.book.state.calendar).toHaveLength(0);
  expect(onSaved).not.toHaveBeenCalled();
});

test('leaving after a calendar write starts keeps that write but prevents navigation', async () => {
  const data = await withDay();
  const held = holdWrites(data);
  await open(data);
  await ReactTestRenderer.act(() => {
    void settingsControl('calendar-save').onPress?.({} as never);
  });
  expect(held.write).toHaveBeenCalledTimes(1);
  await closeSettingsScreen();
  await held.release();
  expect(data.book.state.calendar).toHaveLength(1);
  expect(onSaved).not.toHaveBeenCalled();
});
