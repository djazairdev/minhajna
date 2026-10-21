// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Importing a signed plan pack (#223 part 2, answers 326 to 331): the shared
// import screen checks it and adds a new release, a key that may not sign
// packs is refused, and the new release joins the pack list while the class
// pinned to the old one stays on it, with a badge on its plan and in
// Settings. Made-up keys and packs only.

import { PACK_UPDATE_FORMAT, parseDay } from '@minhajna/core';
import cem4Arabic from '@minhajna/data/dz/packs/dz.cem.4am.arabic.example.json';
import { useWindowDimensions } from 'react-native';
import { makeTestKey, signedFile } from '../../../packages/core/test/signed-fixtures';
import { accessibilityProblems } from '../jest/accessibility';
import { calendarInput as NativeInput } from '../jest/calendar-input';
import {
  closeSettingsScreen,
  pressSettings,
  settingsRoot,
  settingsTexts,
  showSettingsScreen,
} from '../jest/settings-screen';
import { withDay } from '../jest/today-day';
import { ImportUpdate } from '../src/calendar/ImportUpdate';
import { ClassPlan } from '../src/classes/ClassPlan';
import { Packs } from '../src/plan/Packs';
import { Plans } from '../src/settings/Plans';
import { catalogues, i18n, missingKeys } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

const key = makeTestKey();
const calendarOnly = makeTestKey('example-calendar', ['calendar']);
const payload = (release: string) => ({
  format: PACK_UPDATE_FORMAT,
  version: { major: 1, minor: 0 },
  country: 'dz',
  published: '2026-10-03',
  pack: { ...cem4Arabic, release },
});
const onAdded = jest.fn();
const has = (id: string) => settingsRoot().findAll((node) => node.props.testID === id).length > 0;
const open = async (file: string, language: 'ar' | 'fr' | 'en' = 'ar') => {
  const data = { ...(await withDay()), keys: [key.trusted, calendarOnly.trusted] };
  jest.mocked(NativeInput.readFile).mockResolvedValueOnce(file);
  const screen = <ImportUpdate onApplied={jest.fn()} onAdded={onAdded} onReport={jest.fn()} />;
  await showSettingsScreen(screen, data, language);
  await pressSettings('update-file');
  return data;
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

test.each(['ar', 'fr', 'en'] as const)(
  'checks and adds a signed pack release, its class staying (%s)',
  async (language) => {
    const data = await open(signedFile(key, payload('2026.2')), language);
    const text = catalogues[language].calendarView.update;
    expect(has('pack-details')).toBe(true);
    expect(settingsTexts()).toContain(text.status.new);
    expect(has('pack-stays-c-1')).toBe(true);
    expect(accessibilityProblems(settingsRoot())).toEqual([]);
    expect(missingKeys).toEqual([]);
    await pressSettings('update-apply');
    expect(onAdded).toHaveBeenCalledWith('4am', 'arabic');
    expect(data.book.state.addedPacks.map((one) => one.update.pack.release)).toEqual(['2026.2']);
    expect(data.book.state.addedPacks[0]?.key).toBe(key.trusted.id);
    expect(data.book.state.courses.get('c-1')?.pack).toEqual({ id: cem4Arabic.id, release: '2026.1' });
  },
);

test('a release the app has is held, and an older one is not added', async () => {
  await open(signedFile(key, payload('2026.1')));
  expect(settingsTexts()).toContain(catalogues.ar.calendarView.update.pack.held);
  expect(has('update-apply')).toBe(false);
  await closeSettingsScreen();
  const data = await open(signedFile(key, payload('2026.3')));
  await pressSettings('update-apply');
  jest.mocked(NativeInput.readFile).mockResolvedValueOnce(signedFile(key, payload('2026.2')));
  await pressSettings('update-file');
  expect(settingsTexts()).toContain(catalogues.ar.calendarView.update.pack.older);
  expect(has('update-apply')).toBe(false);
  expect(data.book.state.addedPacks).toHaveLength(1);
});

test('a pack signed with a key that may sign only the calendar is refused after its signature checks', async () => {
  const data = await open(signedFile(calendarOnly, payload('2026.2')));
  const text = catalogues.ar.calendarView.update;
  expect(settingsTexts()).toContain(text.problems['key-kind'].title);
  const check = (id: string) =>
    String(settingsRoot().find((node) => node.props.testID === `update-check-${id}`).props.children);
  expect(check('signature')).toBe(text.check.passed.replace('{{check}}', text.checks.signature));
  expect(check('content')).toBe(text.check.failed.replace('{{check}}', text.checks.content));
  expect(has('update-apply')).toBe(false);
  expect(data.book.state.addedPacks).toEqual([]);
});

test('the added release joins the pack list, and pinning it keeps the class on its own', async () => {
  const data = await open(signedFile(key, payload('2026.2')));
  await pressSettings('update-apply');
  await closeSettingsScreen();
  const onImport = jest.fn();
  const onDone = jest.fn();
  await showSettingsScreen(<Packs grade="4am" subject="arabic" onImport={onImport} onDone={onDone} />, data);
  const card = settingsRoot().find((node) => node.props.testID === `pack-${cem4Arabic.id}`);
  expect(String(card.props.description)).toContain('2026.2');
  expect(String(card.props.description)).toContain('4م1');
  await pressSettings(`pack-${cem4Arabic.id}`);
  await pressSettings('pack-pin');
  expect(onDone).toHaveBeenCalledTimes(1);
  expect(data.book.state.courses.get('c-1')?.pack).toEqual({ id: cem4Arabic.id, release: '2026.1' });
  expect(data.book.state.courses.get('c-2')?.pack).toEqual({ id: cem4Arabic.id, release: '2026.2' });
  await pressSettings('pack-import');
  expect(onImport).toHaveBeenCalledTimes(1);
});

test("the class's plan and Settings show that a newer release is in the app", async () => {
  const data = await open(signedFile(key, payload('2026.2')));
  await pressSettings('update-apply');
  await closeSettingsScreen();
  await showSettingsScreen(<ClassPlan courseId="c-1" />, data);
  expect(has('plan-newer')).toBe(true);
  expect(missingKeys).toEqual([]);
  await closeSettingsScreen();
  await showSettingsScreen(<Plans onChoose={jest.fn()} />, data);
  expect(has('settings-newer-k-1-arabic-4am')).toBe(true);
  expect(has('settings-newer-k-2-arabic-4am')).toBe(false);
});

test('a pack for another country, or with a broken ID, says which', async () => {
  const text = catalogues.ar.calendarView.update.problems;
  const foreign = { ...payload('2026.2'), pack: { ...cem4Arabic, release: '2026.2', id: 'tn.cem.4am.arabic.example' } };
  await open(signedFile(key, foreign));
  expect(settingsTexts()).toContain(text.country.title);
  await closeSettingsScreen();
  await open(signedFile(key, { ...payload('2026.2'), pack: { ...cem4Arabic, release: '2026.2', id: 'dz.broken' } }));
  expect(settingsTexts()).toContain(text.content.title);
});

test("last year's class on an older release is not listed as staying", async () => {
  const data = { ...(await withDay()), keys: [key.trusted] };
  const old = {
    id: 'c-old',
    classId: 'k-2',
    subject: 'arabic',
    year: '2025-2026',
    pack: { id: cem4Arabic.id, release: '2025.9' },
  };
  await data.book.record(parseDay('2026-10-15'), { kind: 'course.set', course: old });
  jest.mocked(NativeInput.readFile).mockResolvedValueOnce(signedFile(key, payload('2026.2')));
  const screen = <ImportUpdate onApplied={jest.fn()} onAdded={onAdded} onReport={jest.fn()} />;
  await showSettingsScreen(screen, data);
  await pressSettings('update-file');
  expect(has('pack-stays-c-1')).toBe(true);
  expect(has('pack-stays-c-old')).toBe(false);
});
