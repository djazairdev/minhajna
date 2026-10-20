// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { parseDay } from '@minhajna/core';
import { Text, useWindowDimensions, type TextProps } from 'react-native';
import { accessibilityProblems } from '../jest/accessibility';
import { noticeData } from '../jest/calendar-notice-data';
import {
  closeSettingsScreen,
  pressSettings,
  settingsControl,
  settingsRoot,
  settingsTexts,
  showSettingsScreen,
} from '../jest/settings-screen';
import { withDay } from '../jest/today-day';
import { Receive } from '../src/calendar/Receive';
import { calendarInput as NativeInput } from '../jest/calendar-input';
import { catalogues, i18n, missingKeys } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));
const onSaved = jest.fn();
const onIgnore = jest.fn();
const has = (id: string) => settingsRoot().findAll((node) => node.props.testID === id).length > 0;
beforeEach(() => {
  jest.clearAllMocks();
  missingKeys.length = 0;
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale: 1 });
});
afterEach(async () => {
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
  jest.restoreAllMocks();
});

test.each((['ar', 'fr', 'en'] as const).flatMap((language) => [1, 2].map((fontScale) => ({ language, fontScale }))))(
  'previews readable unverified details with accessible controls ($language, $fontScale×)',
  async ({ language, fontScale }) => {
    jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale });
    const data = await withDay();
    const before = [...data.book.entries];
    jest.mocked(NativeInput.scanQr).mockResolvedValueOnce(JSON.stringify(noticeData()));
    await showSettingsScreen(<Receive schoolId="s-1" onSaved={onSaved} onIgnore={onIgnore} />, data, language);
    await pressSettings('calendar-receive-qr');
    expect(NativeInput.scanQr).toHaveBeenCalledWith(
      catalogues[language].calendarView.receive.scanTitle,
      catalogues[language].calendarView.receive.scanHint,
      catalogues[language].calendarView.receive.ignore,
      language === 'ar',
    );
    expect(settingsTexts()).toContain(noticeData().entry.name[language]);
    expect(settingsTexts()).toContain(catalogues[language].calendarView.receive.notice);
    expect(accessibilityProblems(settingsRoot())).toEqual([]);
    expect(missingKeys).toEqual([]);
    for (const node of settingsRoot().findAllByType(Text)) {
      const props = node.props as TextProps;
      expect(props.numberOfLines).toBeUndefined();
      expect(props.allowFontScaling).not.toBe(false);
      expect(props.maxFontSizeMultiplier).toBeUndefined();
    }
    await pressSettings('calendar-receive-preview');
    expect(has('calendar-receive-save')).toBe(false);
    expect(settingsTexts()).toContain(catalogues[language].calendarView.receive.problems.acknowledge);
    await pressSettings('calendar-receive-acknowledge');
    await pressSettings('calendar-receive-preview');
    expect(has('calendar-impact')).toBe(true);
    expect(has('calendar-receive-save')).toBe(true);
    expect(data.book.entries).toEqual(before);
  },
);

test('file input writes only after acknowledgement, preview and save; duplicate input never appends twice', async () => {
  const data = await withDay();
  const before = [...data.book.entries];
  jest.mocked(NativeInput.readFile).mockResolvedValue(JSON.stringify(noticeData()));
  await showSettingsScreen(<Receive schoolId="s-1" onSaved={onSaved} onIgnore={onIgnore} />, data);
  await pressSettings('calendar-receive-file');
  await pressSettings('calendar-receive-acknowledge');
  await pressSettings('calendar-receive-preview');
  expect(data.book.entries).toEqual(before);
  await pressSettings('calendar-receive-save');
  expect(onSaved).toHaveBeenCalledTimes(1);
  expect(data.book.entries).toHaveLength(before.length + 1);
  expect(data.book.state.calendar[0]).toEqual(
    expect.objectContaining({
      id: noticeData().entry.id,
      schoolId: 's-1',
      received: { sender: noticeData().sender, school: noticeData().school },
    }),
  );
  await pressSettings('calendar-receive-file');
  expect(has('calendar-receive-save')).toBe(false);
  await pressSettings('calendar-receive-acknowledge');
  await pressSettings('calendar-receive-preview');
  expect(has('calendar-receive-duplicate')).toBe(true);
  expect(has('calendar-receive-save')).toBe(false);
  expect(data.book.entries).toHaveLength(before.length + 1);
});

test('ignore, picker cancellation and refused camera access do not write; file input remains usable', async () => {
  const data = await withDay();
  const before = [...data.book.entries];
  jest.mocked(NativeInput.scanQr).mockRejectedValueOnce(new Error('Synthetic native refusal'));
  jest.mocked(NativeInput.readFile).mockResolvedValueOnce(null).mockResolvedValueOnce(JSON.stringify(noticeData()));
  await showSettingsScreen(<Receive schoolId="s-1" onSaved={onSaved} onIgnore={onIgnore} />, data);
  await pressSettings('calendar-receive-qr');
  expect(has('calendar-input-problem')).toBe(true);
  await pressSettings('calendar-receive-file');
  expect(has('calendar-input-problem')).toBe(false);
  expect(has('calendar-receive-preview')).toBe(false);
  await pressSettings('calendar-receive-file');
  await pressSettings('calendar-receive-ignore');
  expect(onIgnore).toHaveBeenCalledTimes(1);
  expect(onSaved).not.toHaveBeenCalled();
  expect(data.book.entries).toEqual(before);
});

test.each(['malformed', 'school', 'conflict'] as const)(
  'refuses %s without writing or reporting success',
  async (kind) => {
    const data = await withDay();
    const notice = noticeData();
    if (kind === 'school') notice.school.zone = '31';
    if (kind === 'conflict')
      await data.book.record(parseDay('2026-10-15'), {
        kind: 'calendar.set',
        entry: {
          ...notice.entry,
          id: notice.entry.id,
          layer: 'school',
          effect: 'closure',
          from: parseDay('2026-10-15'),
          to: parseDay('2026-10-15'),
          confidence: 'announced',
          schoolId: 's-1',
          source: 'Different synthetic notice',
          levels: ['cem'],
          grades: ['4am'],
        },
      });
    const before = [...data.book.entries];
    jest
      .mocked(NativeInput.readFile)
      .mockResolvedValueOnce(kind === 'malformed' ? 'https://example.invalid' : JSON.stringify(notice));
    await showSettingsScreen(<Receive schoolId="s-1" onSaved={onSaved} onIgnore={onIgnore} />, data);
    await pressSettings('calendar-receive-file');
    if (kind !== 'malformed') {
      await pressSettings('calendar-receive-acknowledge');
      await pressSettings('calendar-receive-preview');
      expect(has('calendar-receive-problem')).toBe(true);
    } else expect(has('calendar-input-problem')).toBe(true);
    expect(has('calendar-receive-save')).toBe(false);
    expect(onSaved).not.toHaveBeenCalled();
    expect(data.book.entries).toEqual(before);
  },
);

test('changing acknowledgement invalidates the preview', async () => {
  const data = await withDay();
  jest.mocked(NativeInput.readFile).mockResolvedValueOnce(JSON.stringify(noticeData()));
  await showSettingsScreen(<Receive schoolId="s-1" onSaved={onSaved} onIgnore={onIgnore} />, data);
  await pressSettings('calendar-receive-file');
  await pressSettings('calendar-receive-acknowledge');
  await pressSettings('calendar-receive-preview');
  expect(has('calendar-receive-save')).toBe(true);
  await pressSettings('calendar-receive-acknowledge');
  expect(settingsControl('calendar-receive-acknowledge').accessibilityState?.checked).toBe(false);
  expect(has('calendar-receive-save')).toBe(false);
});
