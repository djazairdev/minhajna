// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reader mode's spot-check sheet (#246, R-Spot, answer 491): an opened
// statement the picture keeps offers it, a misdated one does not; the sheet
// shows the class, the statement, its period and three school days drawn
// from the period, in order; it prints and saves as a PDF with those days and
// empty columns, and records nothing; a statement of another school year
// draws no days, nor one dated before its first day or misdated; print and
// PDF wait for an unnamed teacher's fingerprint. Made-up keys and statements
// only.

import { parseDay, weekday } from '@minhajna/core';
import { useWindowDimensions } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { openTestData } from '../jest/app-data';
import { settle } from '../jest/components-screen';
import { KEY_A, keepStatement, madeUpStatement } from '../jest/reader-statements';
import {
  closeSettingsScreen,
  pressSettings,
  settingsRoot,
  settingsTexts,
  showSettingsScreen,
} from '../jest/settings-screen';
import pdf from '../src/native/NativeMinhajnaPdf';
import signature from '../src/native/NativeMinhajnaSignature';
import { ReaderOpen } from '../src/reader/ReaderOpen';
import { ReaderSpot } from '../src/reader/ReaderSpot';
import { catalogues, i18n, missingKeys } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

const printHtml = jest.spyOn(pdf, 'printHtml');
const savePdf = jest.spyOn(pdf, 'savePdf');
const has = (id: string) => settingsRoot().findAll((node) => node.props.testID === id).length > 0;
const text = (id: string) => String(settingsRoot().findByProps({ testID: id }).props.children);
const show = (...args: Parameters<typeof showSettingsScreen>) =>
  ReactTestRenderer.act(async () => {
    await showSettingsScreen(...args);
    await settle();
  });

beforeEach(() => {
  jest.clearAllMocks();
  missingKeys.length = 0;
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale: 1 });
});
afterEach(async () => {
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
});

test('an opened statement the picture keeps offers the sheet, a misdated one does not', async () => {
  const data = await openTestData();
  const kept = await keepStatement(data, KEY_A, madeUpStatement('2026-10-08', '4M2'));
  const misdated = await keepStatement(data, KEY_A, madeUpStatement('2026-10-30', '4M3'));
  const onSpot = jest.fn();
  await show(<ReaderOpen id={kept} onList={jest.fn()} onSpot={onSpot} />, data);
  await pressSettings('reader-spot');
  expect(onSpot).toHaveBeenCalledWith(kept);
  await closeSettingsScreen();
  await show(<ReaderOpen id={misdated} onList={jest.fn()} onSpot={onSpot} />, data);
  expect(has('reader-spot')).toBe(false);
});

test.each(['ar', 'fr', 'en'] as const)(
  'the sheet draws three school days of the period, prints them and keeps nothing (%s)',
  async (language) => {
    const data = await openTestData();
    const id = await keepStatement(data, KEY_A, madeUpStatement('2026-10-08', '4M2'));
    const before = data.book.entries.length;
    await show(<ReaderSpot id={id} />, data, language);
    const spot = catalogues[language].reader.spot;
    expect(text('spot-who')).toContain('4M2');
    const days = [0, 1, 2].map((at) => text(`spot-day-${at}`));
    expect(new Set(days).size).toBe(3);
    const shown = days.map((line) => line.slice(-10));
    const order = shown.map((day) => day.split('/').reverse().join('-'));
    expect([...order].sort()).toEqual(order);
    for (const day of order) {
      expect(day >= data.year.from && day <= '2026-10-08').toBe(true);
      expect([5, 6]).not.toContain(weekday(parseDay(day)));
    }
    expect(settingsTexts()).toEqual(expect.arrayContaining([spot.why, spot.onPhone]));
    expect(accessibilityProblems(settingsRoot())).toEqual([]);
    expect(missingKeys).toEqual([]);
    await pressSettings('spot-print');
    const [html, title] = printHtml.mock.calls[0];
    expect(title).toBe(spot.title);
    for (const day of shown) expect(html).toContain(day);
    expect(html).toContain(spot.notebooks);
    await pressSettings('spot-pdf');
    const [made, name] = savePdf.mock.calls[0];
    expect([made, name.startsWith(`${spot.title} 4M2 `), name.endsWith('.pdf')]).toEqual(['spot', true, true]);
    expect(data.book.entries).toHaveLength(before);
  },
);

test('a statement of another school year or before its first day draws no days; an unknown one is gone', async () => {
  const data = await openTestData();
  const value = madeUpStatement('2026-06-01', '4M2');
  const id = await keepStatement(data, KEY_A, { ...value, class: { ...value.class, year: '2025-2026' } });
  await show(<ReaderSpot id={id} />, data);
  const { spot, leftOut } = catalogues.ar.reader;
  expect(settingsTexts()).toContain(spot.none.replace('{{year}}', data.year.id));
  expect(has('spot-print')).toBe(false);
  const early = await keepStatement(data, KEY_A, madeUpStatement('2026-09-15', '4M3'));
  await show(<ReaderSpot id={early} />, data);
  expect(settingsTexts()).toContain(spot.early.replace('{{year}}', data.year.id));
  expect(has('spot-print')).toBe(false);
  const misdated = await keepStatement(data, KEY_A, madeUpStatement('2026-10-30', '4M4'));
  await show(<ReaderSpot id={misdated} />, data);
  expect(settingsTexts()).toContain(leftOut);
  await closeSettingsScreen();
  await show(<ReaderSpot id="gone" />, data);
  expect(has('reader-gone')).toBe(true);
});

test('print and PDF wait while an unnamed teacher’s fingerprint is worked out', async () => {
  const data = await openTestData();
  const id = await keepStatement(data, KEY_A, madeUpStatement('2026-10-08', '4M2'));
  const pending = jest.spyOn(signature, 'keyFingerprint').mockReturnValueOnce(new Promise<string>(() => undefined));
  await show(<ReaderSpot id={id} />, data);
  const disabled = (testID: string) => settingsRoot().findByProps({ testID }).props.disabled as boolean;
  expect([disabled('spot-print'), disabled('spot-pdf')]).toEqual([true, true]);
  pending.mockRestore();
});
