// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A cover the teacher gives a colleague's class (#224, answer 332): «تعويض»
// on «حصة» opens its form; Today shows it on its day with «تمّت», which
// writes it in the daily journal, or «حذف التعويض»; the journal's day page
// has its row, in grey until done. It takes no session. Made-up data.

import { parseDay, sessionsBetween, type ExamDuty } from '@minhajna/core';
import { useWindowDimensions } from 'react-native';
import { accessibilityProblems } from '../jest/accessibility';
import type { TestData } from '../jest/app-data';
import {
  closeSettingsScreen,
  pressSettings,
  settingsRoot,
  settingsTexts,
  showSettingsScreen,
  typeSettings,
} from '../jest/settings-screen';
import { withDay } from '../jest/today-day';
import { journalPages } from '../src/documents/journal-pages';
import { CoverEntry } from '../src/exams/CoverEntry';
import { coverSchools } from '../src/exams/cover-schools';
import { ExtraSession } from '../src/extra/ExtraSession';
import { coreContext } from '../src/storage/core-context';
import { catalogues, i18n, missingKeys } from '../src/text/i18n';
import { Today } from '../src/today/Today';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

const day = parseDay('2026-10-15');
const has = (id: string) => settingsRoot().findAll((node) => node.props.testID === id).length > 0;
const cover = (fields: Partial<ExamDuty> = {}): ExamDuty => ({
  id: 'cover-1',
  kind: 'cover',
  day,
  from: '11:00',
  to: '12:00',
  schoolId: 's-1',
  className: '3م4',
  ...fields,
});
const journal = (data: TestData) =>
  journalPages(
    {
      state: data.book.state,
      profile: data.profile,
      year: data.year,
      calendar: data.calendar,
      calendarRelease: data.calendarRelease,
      packs: data.packs,
      bells: data.bells,
      day,
      lang: 'ar',
      dir: 'rtl',
    },
    i18n.getFixedT('ar'),
    false,
    'combined',
  );
const showToday = async (data: TestData, language: 'ar' | 'fr' | 'en' = 'ar') =>
  showSettingsScreen(<Today onHelp={jest.fn()} onDetails={jest.fn()} onRoll={jest.fn()} />, data, language);

beforeEach(() => {
  missingKeys.length = 0;
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale: 1 });
});
afterEach(async () => {
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
});

test('«تعويض» on «حصة» opens the cover form', async () => {
  const onCover = jest.fn();
  await showSettingsScreen(<ExtraSession onCover={onCover} />, await withDay());
  await pressSettings('extra-kind-cover');
  expect(onCover).toHaveBeenCalled();
});

test.each(['ar', 'fr', 'en'] as const)('the cover form has named controls (%s)', async (language) => {
  await showSettingsScreen(<CoverEntry onDone={jest.fn()} />, await withDay(), language);
  expect(accessibilityProblems(settingsRoot())).toEqual([]);
  expect(missingKeys).toEqual([]);
});

test('the form asks for the class and the times, then saves a cover on any day', async () => {
  const data = await withDay();
  const onDone = jest.fn();
  await showSettingsScreen(<CoverEntry onDone={onDone} />, data);
  await pressSettings('cover-save');
  expect(settingsTexts()).toContain(catalogues.ar.cover.classWrong);
  expect(settingsTexts()).toContain(catalogues.ar.duties.timeWrong);
  await typeSettings('cover-class', ' 3م4 ');
  await pressSettings('extra-day-2026-10-20');
  await typeSettings('cover-from', '11:00');
  await typeSettings('cover-to', '12:00');
  await pressSettings('cover-save');
  expect([...data.book.state.duties.values()]).toEqual([
    expect.objectContaining({ kind: 'cover', day: '2026-10-20', from: '11:00', to: '12:00', className: '3م4' }),
  ]);
  expect(onDone).toHaveBeenCalled();
});

test.each(['ar', 'fr', 'en'] as const)('Today shows a cover on its day, with «تمّت» (%s)', async (language) => {
  const data = await withDay();
  const count = () => sessionsBetween(coreContext({ ...data, state: data.book.state }), day, day).length;
  const before = count();
  await data.book.record(day, { kind: 'duty.set', duty: cover() });
  await showToday(data, language);
  expect(has('cover-cover-1')).toBe(true);
  expect(settingsTexts()).toContain(catalogues[language].special.kinds.cover);
  expect(has('cover-done-cover-1')).toBe(true);
  expect(has('day-mark')).toBe(false);
  expect(count()).toBe(before);
  expect(accessibilityProblems(settingsRoot())).toEqual([]);
  expect(missingKeys).toEqual([]);
});

test('«تمّت» writes it in the journal, black instead of grey; «حذف التعويض» removes one not done', async () => {
  const data = await withDay();
  await data.book.record(day, { kind: 'duty.set', duty: cover() });
  expect(journal(data)).toMatch(/<div class="row entry awaiting">[^]*?<bdi>3م4<\/bdi>/);
  await showToday(data);
  await pressSettings('cover-done-cover-1');
  expect(data.book.state.duties.get('cover-1')?.done).toBe(true);
  expect(has('cover-written-cover-1')).toBe(true);
  expect(has('cover-remove-cover-1')).toBe(true);
  expect(journal(data)).toContain(catalogues.ar.cover.journal);
  expect(journal(data)).not.toMatch(
    /<div class="row entry awaiting"><div class="d"><bdi>[^<]*<\/bdi><\/div><div class="k"><bdi>3م4/,
  );
  await data.book.record(day, { kind: 'duty.set', duty: cover({ id: 'cover-2', from: '14:00', to: '15:00' }) });
  await closeSettingsScreen();
  await showToday(data);
  await pressSettings('cover-remove-cover-2');
  expect(data.book.state.duties.has('cover-2')).toBe(true);
  await pressSettings('cover-keep-cover-2');
  expect(has('cover-confirm-cover-2')).toBe(false);
  await pressSettings('cover-remove-cover-2');
  await pressSettings('cover-confirm-cover-2');
  expect(data.book.state.duties.has('cover-2')).toBe(false);
  expect(has('cover-cover-2')).toBe(false);
});

test('a cover done by mistake can still be removed, and leaves the journal', async () => {
  const data = await withDay();
  await data.book.record(day, { kind: 'duty.set', duty: cover({ done: true }) });
  await showToday(data);
  await pressSettings('cover-remove-cover-1');
  await pressSettings('cover-confirm-cover-1');
  expect(data.book.state.duties.has('cover-1')).toBe(false);
  expect(journal(data)).not.toContain(catalogues.ar.cover.journal);
});

test('only a school with a middle or secondary level takes a cover, in the form and in the journal', async () => {
  const data = await withDay();
  await data.book.recordAll(day, [
    {
      kind: 'school.set',
      school: { id: 's-p', name: 'ابتدائية الأمل', levels: ['primary'], subjects: ['arabic'], zone: '16' },
    },
    { kind: 'duty.set', duty: cover({ id: 'cover-p', schoolId: 's-p', className: '5أ' }) },
  ]);
  expect(coverSchools(data.book.state).map((school) => school.id)).toEqual(['s-1']);
  expect(journal(data)).not.toContain('5أ');
  await showToday(data);
  expect(has('cover-cover-p')).toBe(false);
  await closeSettingsScreen();
  await showSettingsScreen(<CoverEntry onDone={jest.fn()} />, data);
  expect(has('cover-school')).toBe(false);
});
