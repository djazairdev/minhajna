// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reader mode's R-Open (#246, answer 489): Settings reaches «البيانات المستلمة»
// with no class of its own; a statement opened from a signed file, a PDF's link
// or a QR code is checked, kept once and shown with every field, the first
// under its key, its pack's newer edition, and the lines on pupil data and
// their own devices; a later one from the same key names the earlier one; a
// changed or foreign file, one signed in a demo world (#563), or a PDF with no
// link, says so and is never kept; the teacher is named per key; and the list
// shows each statement, newest first, each opening as kept, and one no longer
// kept says so. Made-up keys and statements only.

import {
  parseDay,
  receivedStatements,
  signStatement,
  statementLink,
  teacherNames,
  type ProgressStatement,
} from '@minhajna/core';
import { useWindowDimensions } from 'react-native';
import { accessibilityProblems } from '../jest/accessibility';
import { openTestData, type TestData } from '../jest/app-data';
import { calendarInput as NativeInput } from '../jest/calendar-input';
import {
  closeSettingsScreen,
  pressSettings,
  settingsRoot,
  settingsTexts,
  showSettingsScreen,
  typeSettings,
} from '../jest/settings-screen';
import signature from '../src/native/NativeMinhajnaSignature';
import { ReaderList } from '../src/reader/ReaderList';
import { ReaderOpen } from '../src/reader/ReaderOpen';
import { Settings } from '../src/settings/Settings';
import { catalogues, i18n, missingKeys } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

const statement = (day: string, section = '4M2'): ProgressStatement => ({
  format: 'minhajna.statement',
  version: { major: 1, minor: 0 },
  day: parseDay(day),
  class: { level: 'cem', grade: '4am', section, subject: 'arabic', year: '2026-2027' },
  pack: { id: 'dz.cem.4am.arabic.example', release: '2026.1' },
  lastUnit: null,
  lastResource: { id: 'u1-2', title: 'Made-up resource', status: 'started' },
  delay: { sessions: 0, weeks: null, bufferUsed: 0, bufferLeft: 2 },
  notHeld: { calendar: 1, other: 0 },
  td: { calendar: 0, other: 0 },
});
const signed = async (value: ProgressStatement) =>
  signStatement(value, await signature.teacherKey(), (payload) => signature.sign(payload));
const has = (id: string) => settingsRoot().findAll((node) => node.props.testID === id).length > 0;
const kept = (data: TestData) => receivedStatements(data.book.entries).map((one) => [one.how, one.statement.day]);
const open = async (data: TestData, file: string, language: 'ar' | 'fr' | 'en' = 'ar') => {
  await showSettingsScreen(<ReaderOpen onList={jest.fn()} />, data, language);
  jest.mocked(NativeInput.readStatement).mockResolvedValueOnce(file);
  await pressSettings('reader-file');
};

beforeEach(() => {
  jest.clearAllMocks();
  missingKeys.length = 0;
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale: 1 });
});
afterEach(async () => {
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
});

test('Settings reaches the statements received with no class of its own', async () => {
  const data = await openTestData();
  const onOpen = jest.fn();
  await showSettingsScreen(<Settings onOpen={onOpen} />, data);
  expect(has('settings-received')).toBe(true);
  expect(has('settings-statement')).toBe(false);
  await pressSettings('settings-received');
  expect(onOpen).toHaveBeenCalledWith('received');
});

test.each(['ar', 'fr', 'en'] as const)(
  'a signed file is checked, kept once and shown in full (%s)',
  async (language) => {
    const data = await openTestData();
    const file = await signed(statement('2026-10-01'));
    await open(data, file, language);
    const text = catalogues[language].reader;
    expect(has('reader-checked')).toBe(true);
    expect(settingsTexts()).toEqual(expect.arrayContaining([text.valid, text.first, text.noPupils, text.onPhone]));
    expect(settingsTexts().some((line) => line.includes('2026.2'))).toBe(true);
    expect(kept(data)).toEqual([['file', '2026-10-01']]);
    expect(accessibilityProblems(settingsRoot())).toEqual([]);
    expect(missingKeys).toEqual([]);
    jest.mocked(NativeInput.readStatement).mockResolvedValueOnce(file);
    await pressSettings('reader-file');
    expect(kept(data)).toHaveLength(1);
  },
);

test('a PDF link and a QR code are kept, and a later statement names the earlier one', async () => {
  const data = await openTestData();
  await open(data, statementLink(await signed(statement('2026-10-01'))));
  await closeSettingsScreen();
  await showSettingsScreen(<ReaderOpen onList={jest.fn()} />, data);
  jest.mocked(NativeInput.scanQr).mockResolvedValueOnce(await signed(statement('2026-10-08')));
  await pressSettings('reader-scan');
  expect(kept(data)).toEqual([
    ['pdf', '2026-10-01'],
    ['qr', '2026-10-08'],
  ]);
  expect(String(settingsRoot().findByProps({ testID: 'reader-sender' }).props.children)).toContain('01/10/2026');
});

test('a changed, foreign or demo world’s file says so and is never kept', async () => {
  const data = await openTestData();
  const file = JSON.parse(await signed(statement('2026-10-01'))) as Record<string, string>;
  await open(data, JSON.stringify({ ...file, payload: file.payload.replace('2026-10-01', '2026-10-02') }));
  expect(settingsTexts()).toContain(catalogues.ar.reader.problems.signature);
  await closeSettingsScreen();
  await open(data, '{"format":"minhajna.calendar-notice"}');
  expect(settingsTexts()).toContain(catalogues.ar.reader.problems.invalid);
  await closeSettingsScreen();
  await open(data, '');
  expect(settingsTexts()).toContain(catalogues.ar.reader.problems.invalid);
  const world = await signStatement(
    statement('2026-10-01'),
    await signature.teacherKey(),
    (text) => signature.sign(text),
    'ABCDE',
  );
  await closeSettingsScreen();
  await open(data, world);
  expect(settingsTexts()).toContain(catalogues.ar.reader.problems.world);
  for (const link of ['minhajna-statement:', 'minhajna-statement:!!']) {
    await closeSettingsScreen();
    await open(data, link);
    expect(settingsTexts()).toContain(catalogues.ar.reader.problems.noLink);
  }
  expect(kept(data)).toEqual([]);
  expect(has('reader-checked')).toBe(false);
});

test('the teacher is named per key, and the list shows each statement newest first', async () => {
  const data = await openTestData();
  await open(data, await signed(statement('2026-10-01')));
  await pressSettings('reader-name-open');
  expect(settingsRoot().findByProps({ testID: 'reader-name-save' }).props.disabled).toBe(true);
  await typeSettings('reader-name', 'Made-up Teacher');
  await typeSettings('reader-school', 'Made-up School');
  await pressSettings('reader-name-save');
  expect([...teacherNames(data.book.entries).values()].map((one) => [one.name, one.school])).toEqual([
    ['Made-up Teacher', 'Made-up School'],
  ]);
  await closeSettingsScreen();
  await open(data, await signed(statement('2026-10-08', '4M3')));
  await closeSettingsScreen();
  const onOpen = jest.fn();
  await showSettingsScreen(<ReaderList onOpen={onOpen} onPicture={jest.fn()} />, data);
  const [first, second] = receivedStatements(data.book.entries);
  const rows = settingsRoot().findAll((node) => String(node.props.testID).startsWith('reader-received-'));
  expect(rows.map((node) => node.props.testID as string).filter((id, at, all) => all.indexOf(id) === at)).toEqual([
    `reader-received-${second.id}`,
    `reader-received-${first.id}`,
  ]);
  expect(settingsTexts().some((line) => line.includes('Made-up Teacher'))).toBe(true);
  await pressSettings(`reader-received-${first.id}`);
  expect(onOpen).toHaveBeenCalledWith(first.id);
  await closeSettingsScreen();
  await showSettingsScreen(<ReaderOpen id={first.id} onList={jest.fn()} />, data);
  expect([has('reader-checked'), has('reader-gone'), has('reader-file')]).toEqual([true, false, false]);
  await closeSettingsScreen();
  await showSettingsScreen(<ReaderOpen id="gone" onList={jest.fn()} />, data);
  expect(settingsTexts()).toContain(catalogues.ar.reader.gone);
});
