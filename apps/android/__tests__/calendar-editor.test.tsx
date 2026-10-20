// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { layerOf, eventOf, parseDay } from '@minhajna/core';
import { Text, useWindowDimensions, type TextProps } from 'react-native';
import { accessibilityProblems } from '../jest/accessibility';
import { calendarData } from '../jest/calendar-data';
import {
  closeSettingsScreen,
  pressSettings,
  settingsControl,
  settingsInput,
  settingsRoot,
  settingsTexts,
  showSettingsScreen,
  typeSettings,
} from '../jest/settings-screen';
import { withDay } from '../jest/today-day';
import { CalendarForm } from '../src/calendar/Form';
import { catalogues, i18n, missingKeys } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));
const onSaved = jest.fn();
const onAddDay = jest.fn();
const has = (id: string) => settingsRoot().findAll((node) => node.props.testID === id).length > 0;
beforeEach(() => {
  onSaved.mockReset();
  onAddDay.mockReset();
  missingKeys.length = 0;
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale: 1 });
});
afterEach(async () => {
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
  jest.restoreAllMocks();
});

test.each((['ar', 'fr', 'en'] as const).flatMap((language) => [1, 2].map((fontScale) => ({ language, fontScale }))))(
  'offers named controls and growing text ($language, $fontScale×)',
  async ({ language, fontScale }) => {
    jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale });
    const data = await withDay();
    const before = [...data.book.entries];
    await showSettingsScreen(<CalendarForm schoolId="s-1" onSaved={onSaved} onAddDay={onAddDay} />, data, language);
    expect(accessibilityProblems(settingsRoot())).toEqual([]);
    expect(settingsTexts()).toContain(catalogues[language].calendarView.edit.wholeDay);
    expect(settingsControl('calendar-preview').accessibilityLabel).toBe(
      catalogues[language].calendarView.edit.previewButton,
    );
    for (const node of settingsRoot().findAllByType(Text)) {
      const props = node.props as TextProps;
      expect(props.numberOfLines).toBeUndefined();
      expect(props.allowFontScaling).not.toBe(false);
      expect(props.maxFontSizeMultiplier).toBeUndefined();
    }
    expect(missingKeys).toEqual([]);
    expect(data.book.entries).toEqual(before);
  },
);

test('previews without writing, then saves one sourced entry and keeps the history prefix', async () => {
  const data = await withDay();
  const before = [...data.book.entries];
  await showSettingsScreen(<CalendarForm schoolId="s-1" onSaved={onSaved} onAddDay={onAddDay} />, data);
  await typeSettings('calendar-source', 'إعلان تجريبي');
  await pressSettings('calendar-preview');
  expect(has('calendar-impact')).toBe(true);
  expect(settingsTexts()).toContain(i18n.t('calendarView.edit.affected', { count: 3 }));
  expect(data.book.entries).toEqual(before);
  await pressSettings('calendar-save');
  expect(onSaved).toHaveBeenCalledTimes(1);
  expect(data.book.state.calendar).toHaveLength(1);
  expect(data.book.state.calendar[0]).toEqual(
    expect.objectContaining({
      layer: 'school',
      schoolId: 's-1',
      effect: 'closure',
      from: '2026-10-15',
      to: '2026-10-15',
      source: 'إعلان تجريبي',
      confidence: 'announced',
    }),
  );
  expect(data.book.entries.slice(0, before.length)).toEqual(before);
  expect(data.book.entries).toHaveLength(before.length + 1);
});

test('validates required fields and invalidates a preview as soon as a field changes', async () => {
  const data = await withDay();
  await showSettingsScreen(<CalendarForm schoolId="s-1" onSaved={onSaved} onAddDay={onAddDay} />, data);
  await pressSettings('calendar-preview');
  expect(has('calendar-invalid')).toBe(true);
  expect(has('calendar-save')).toBe(false);
  await typeSettings('calendar-source', 'مصدر مختلق');
  await pressSettings('calendar-preview');
  expect(has('calendar-save')).toBe(true);
  await typeSettings('calendar-title', 'موعد تجريبي آخر');
  expect(has('calendar-save')).toBe(false);
  expect(has('calendar-impact')).toBe(false);
  expect(data.book.state.calendar).toHaveLength(0);
});

test('edits the same local ID without changing its scope or untranslated name variants', async () => {
  const data = await calendarData();
  const old = data.book.state.calendar.find((entry) => entry.id === 'school-1')!;
  const before = [...data.book.entries];
  await showSettingsScreen(<CalendarForm schoolId="s-1" old={old} onSaved={onSaved} onAddDay={onAddDay} />, data);
  expect(has('calendar-edit-school')).toBe(false);
  expect(has('calendar-kind-training')).toBe(false);
  await typeSettings('calendar-source', 'مصدر تجريبي مصحّح');
  await pressSettings('calendar-preview');
  await pressSettings('calendar-save');
  const edited = data.book.state.calendar.find((entry) => entry.id === old.id)!;
  expect(edited.name).toEqual(old.name);
  expect(edited.schoolId).toBe(old.schoolId);
  expect(edited.source).toBe('مصدر تجريبي مصحّح');
  expect(data.book.entries).toHaveLength(before.length + 1);
  expect(data.book.entries.slice(0, before.length)).toEqual(before);
});

test('keeps a training day private and does not offer promotion of a saved private entry', async () => {
  const data = await withDay();
  await showSettingsScreen(<CalendarForm schoolId="s-1" onSaved={onSaved} onAddDay={onAddDay} />, data);
  await pressSettings('calendar-kind-training');
  await typeSettings('calendar-source', 'استدعاء تجريبي');
  await pressSettings('calendar-preview');
  await pressSettings('calendar-save');
  const old = data.book.state.calendar[0];
  expect(old.layer).toBe('teacher');
  expect(old.schoolId).toBeUndefined();
  expect(layerOf(eventOf(data.book.entries.at(-1)!)!)).toBe('private');
  await showSettingsScreen(<CalendarForm schoolId="s-1" old={old} onSaved={onSaved} onAddDay={onAddDay} />, data);
  expect(has('calendar-kind-school-closure')).toBe(false);
  expect(has('calendar-kind-zone-closure')).toBe(false);
});

test('a school marker leaves sessions available and the added-day choice opens the existing editor', async () => {
  const data = await withDay();
  await showSettingsScreen(<CalendarForm schoolId="s-1" onSaved={onSaved} onAddDay={onAddDay} />, data);
  await pressSettings('calendar-kind-school-event');
  await typeSettings('calendar-source', 'إعلان تجريبي');
  await pressSettings('calendar-preview');
  expect(settingsTexts()).toContain(i18n.t('calendarView.edit.affected', { count: 0 }));
  await pressSettings('calendar-kind-added-day');
  expect(has('calendar-save')).toBe(false);
  await pressSettings('calendar-add-sessions');
  expect(onAddDay).toHaveBeenCalledWith('s-1');
  expect(data.book.state.calendar).toHaveLength(0);
});

test('rejects a stale preview even if a queued write has not redrawn the screen yet', async () => {
  const data = await withDay();
  await showSettingsScreen(<CalendarForm schoolId="s-1" onSaved={onSaved} onAddDay={onAddDay} />, data);
  await typeSettings('calendar-source', 'مصدر تجريبي');
  await pressSettings('calendar-preview');
  await data.book.record(parseDay('2026-10-15'), { kind: 'teacher.personal.set', personal: { name: 'أستاذة مختلقة' } });
  await pressSettings('calendar-save');
  expect(onSaved).not.toHaveBeenCalled();
  expect(data.book.state.calendar).toHaveLength(0);
  expect(settingsTexts()).toContain(catalogues.ar.calendarView.edit.changed);
});

test('keeps a failed draft and lets the teacher retry without duplicating the entry', async () => {
  const data = await withDay();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  const write = jest.spyOn(data.book, 'record').mockRejectedValueOnce(new Error('Synthetic write failure'));
  await showSettingsScreen(<CalendarForm schoolId="s-1" onSaved={onSaved} onAddDay={onAddDay} />, data);
  await typeSettings('calendar-source', 'مصدر تجريبي محفوظ في المسودة');
  await pressSettings('calendar-preview');
  await pressSettings('calendar-save');
  expect(onSaved).not.toHaveBeenCalled();
  expect(settingsInput('calendar-source').value).toBe('مصدر تجريبي محفوظ في المسودة');
  expect(settingsTexts()).toContain(catalogues.ar.calendarView.edit.failed);
  expect(data.book.state.calendar).toHaveLength(0);
  await pressSettings('calendar-save');
  expect(write).toHaveBeenCalledTimes(2);
  expect(onSaved).toHaveBeenCalledTimes(1);
  expect(data.book.state.calendar).toHaveLength(1);
});

test('chooses an inclusive date range and rejects an end before its start', async () => {
  const data = await withDay();
  await showSettingsScreen(<CalendarForm schoolId="s-1" onSaved={onSaved} onAddDay={onAddDay} />, data);
  await typeSettings('calendar-source', 'إعلان تجريبي');
  await pressSettings('calendar-date-edge-to');
  await pressSettings('extra-day-2026-10-14');
  await pressSettings('calendar-preview');
  expect(has('calendar-invalid')).toBe(true);
  expect(has('calendar-save')).toBe(false);
  await pressSettings('extra-day-2026-10-18');
  await pressSettings('calendar-preview');
  await pressSettings('calendar-save');
  expect(data.book.state.calendar[0]).toMatchObject({ from: '2026-10-15', to: '2026-10-18' });
});
