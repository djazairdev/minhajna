// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Importing a signed calendar update in real mode (#223, R-4.8-03 to R-4.8-05):
// a file a trusted key signed is checked, previewed and applied in each
// language; one already applied is held; a file changed after signing, a newer
// format inside a valid signature, an unknown key, another year, another kind
// and a file that is not signed are each refused in their own words, nothing
// changing; a file naming a demo world or signed with a world's key is refused
// before its signature is checked (#608); and cancelling a second read keeps
// the update shown. Every key, entry and world is made up.

import { CALENDAR_UPDATE_FORMAT, worldSignedFile } from '@minhajna/core';
import { useWindowDimensions } from 'react-native';
import { makeTestKey, signedFile } from '../../../packages/core/test/signed-fixtures';
import { signWith, worldKeys } from '../../../packages/core/test/world-signing';
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
import { fingerprintText } from '../src/calendar/UpdateDetails';
import { checksFor } from '../src/calendar/UpdateRefused';
import { catalogues, i18n, missingKeys } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

const words = catalogues.ar.calendarView.update;
const key = makeTestKey();
const stranger = makeTestKey('example-stranger');
const closure = (id: string, zone: string) => ({
  id,
  layer: 'zone',
  zone,
  from: '2026-10-22',
  to: '2026-10-22',
  effect: 'closure',
  name: { ar: 'تعليق تجريبي', en: 'Example suspension', fr: 'Suspension fictive' },
  source: 'إعلان تجريبي غير رسمي',
  confidence: 'announced',
});
const payload = {
  format: CALENDAR_UPDATE_FORMAT,
  version: { major: 1, minor: 0 },
  country: 'dz',
  year: '2026-2027',
  release: '2026.5',
  published: '2026-10-15',
  entries: [closure('example-mine', '16'), closure('example-elsewhere', '31')],
  removed: [],
};
const onApplied = jest.fn();
const onReport = jest.fn();
const has = (id: string) => settingsRoot().findAll((node) => node.props.testID === id).length > 0;
const open = async (file: string, language: 'ar' | 'fr' | 'en' = 'ar') => {
  const data = { ...(await withDay()), keys: [key.trusted] };
  jest.mocked(NativeInput.readFile).mockResolvedValueOnce(file);
  await showSettingsScreen(
    <ImportUpdate onApplied={onApplied} onAdded={jest.fn()} onReport={onReport} />,
    data,
    language,
  );
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

test.each(['ar', 'fr', 'en'] as const)('checks, previews and applies a signed update (%s)', async (language) => {
  const data = await open(signedFile(key, payload), language);
  const text = catalogues[language].calendarView.update;
  const texts = settingsTexts();
  expect(texts).toContain(text.status.new);
  expect(texts).toContain(text.signed);
  expect(texts).toContain(fingerprintText(key.trusted.fingerprint));
  expect(has('update-change-example-mine')).toBe(true);
  expect(has('update-change-example-elsewhere')).toBe(false);
  expect(has('update-others')).toBe(true);
  expect(has('calendar-impact')).toBe(true);
  expect(accessibilityProblems(settingsRoot())).toEqual([]);
  expect(missingKeys).toEqual([]);
  expect(data.book.state.calendarUpdates).toEqual([]);
  await pressSettings('update-apply');
  expect(onApplied).toHaveBeenCalledWith('2026.5');
  expect(data.book.state.calendarUpdates.map((one) => one.update.release)).toEqual(['2026.5']);
  expect(data.book.state.calendarUpdates[0]?.key).toBe(key.trusted.id);
});

test('an update already applied is held, and nothing is offered', async () => {
  const data = await open(signedFile(key, payload));
  await pressSettings('update-apply');
  jest.mocked(NativeInput.readFile).mockResolvedValueOnce(signedFile(key, payload));
  await pressSettings('update-file');
  expect(settingsTexts()).toContain(catalogues.ar.calendarView.update.status.held);
  expect(has('update-apply')).toBe(false);
  expect(data.book.state.calendarUpdates).toHaveLength(1);
});

test('a file changed after signing is refused, nothing changes, and reporting opens Help', async () => {
  const signed = JSON.parse(signedFile(key, payload)) as { payload: string };
  const changed = JSON.stringify({ ...signed, payload: signed.payload.replace('2026-10-22', '2026-10-21') });
  const data = await open(changed);
  const text = catalogues.ar.calendarView.update;
  expect(has('update-refused')).toBe(true);
  expect(settingsTexts()).toContain(text.problems.signature.title);
  expect(settingsTexts().some((one) => one.startsWith(text.checks.signature))).toBe(true);
  expect(has('update-apply')).toBe(false);
  expect(accessibilityProblems(settingsRoot())).toEqual([]);
  await pressSettings('update-report');
  expect(onReport).toHaveBeenCalledTimes(1);
  expect(data.book.state.calendarUpdates).toEqual([]);
});

test('a newer update format inside a valid signature shows the signature checked', async () => {
  await open(signedFile(key, { ...payload, version: { major: 2, minor: 0 } }));
  const text = catalogues.ar.calendarView.update;
  expect(settingsTexts()).toContain(text.problems['update-version'].title);
  const holder = text.checks.keyOf.replace('{{holder}}', '\u2068Example holder\u2069');
  expect(settingsTexts()).toContain(text.check.passed.replace('{{check}}', text.checks.signature));
  expect(settingsTexts()).toContain(text.check.passed.replace('{{check}}', holder));
  expect(settingsTexts()).toContain(text.check.failed.replace('{{check}}', text.checks.content));
});

test('cancelling a second read keeps the update shown', async () => {
  await open(signedFile(key, payload));
  jest.mocked(NativeInput.readFile).mockResolvedValueOnce(null);
  await pressSettings('update-file');
  expect(has('update-details')).toBe(true);
  expect(has('update-apply')).toBe(true);
});

test.each([
  ['an unknown key', (): string => signedFile(stranger, payload), 'unknown-key'],
  ['another year', (): string => signedFile(key, { ...payload, year: '2027-2028' }), 'year'],
  ['not a calendar update', (): string => signedFile(key, { format: 'minhajna.pack' }), 'kind'],
  ['not a signed file', (): string => '{}', 'invalid'],
  [
    'a file naming a demo world',
    (): string => JSON.stringify({ ...JSON.parse(signedFile(key, payload)), world: 'K7QF4' }),
    'world',
  ],
  [
    'a file signed with a world’s key',
    (): string => JSON.stringify({ ...JSON.parse(signedFile(key, payload)), key: 'world-ministry' }),
    'world',
  ],
] as const)('refuses %s', async (_name, file, problem) => {
  const data = await open(file());
  expect(settingsTexts()).toContain(catalogues.ar.calendarView.update.problems[problem].title);
  expect(has('update-apply')).toBe(false);
  expect(data.book.state.calendarUpdates).toEqual([]);
});

test('a file a demo world’s key signed is refused in its own words, failing the first check only', async () => {
  const world = worldKeys('K7QF4');
  await open(await worldSignedFile(world, 'world-ministry', JSON.stringify(payload), signWith));
  const check = (outcome: 'passed' | 'failed' | 'skipped', name: keyof typeof words.checks) =>
    words.check[outcome].replace('{{check}}', words.checks[name]);
  expect(settingsTexts()).toEqual(
    expect.arrayContaining([
      words.problems.world.title,
      check('failed', 'format'),
      check('skipped', 'key'),
      check('skipped', 'signature'),
      check('skipped', 'content'),
    ]),
  );
  expect(has('update-apply')).toBe(false);
  expect(checksFor('world')).toEqual({ format: 'failed', key: 'skipped', signature: 'skipped', content: 'skipped' });
});
