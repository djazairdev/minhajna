// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { MemoryStore, parseDay, SchoolCoverBook, type CoverAuthority } from '@minhajna/core';
import { Text, useWindowDimensions, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import {
  closeSettingsScreen,
  pressSettings,
  settingsControl,
  settingsRoot,
  settingsTexts,
  showSettingsScreen,
} from '../jest/settings-screen';
import { withDay } from '../jest/today-day';
import { CoverBoard } from '../src/school/CoverBoard';
import { nativeDeps } from '../src/storage/history';
import { catalogues, i18n, missingKeys } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));
const day = parseDay('2026-10-15');
const names = (id: string) => (id === 'free' ? 'أمينة بوزيد (اسم تجريبي)' : '4م2 · 15/10/2026');
async function fixture() {
  const data = await withDay();
  const store = new MemoryStore();
  let actorId = 'director';
  const scope: CoverAuthority = {
    nationalSystem: true,
    actorId,
    schoolId: 's-1',
    year: data.year,
    members: new Map([
      ['director', ['director']],
      ['holder', ['teacher']],
      ['free', ['teacher']],
    ]),
    sessions: [
      {
        id: 'one',
        schoolId: 's-1',
        teacherId: 'holder',
        classId: 'k-1',
        className: '4م1',
        level: 'cem',
        day,
        slot: { half: 'morning', index: 1 },
      },
    ],
  };
  const book = await SchoolCoverBook.open(store, nativeDeps(data.storage.asSpec()), () => ({ ...scope, actorId }));
  const screen = <CoverBoard book={book} day={day} staffName={names} sessionName={names} />;
  return {
    data,
    book,
    store,
    screen,
    actor: (id: string) => {
      actorId = id;
    },
  };
}
const settle = () => ReactTestRenderer.act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
beforeEach(() => {
  missingKeys.length = 0;
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale: 1 });
});
afterEach(async () => {
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
});

test.each((['ar', 'fr', 'en'] as const).flatMap((language) => [1, 2].map((fontScale) => ({ language, fontScale }))))(
  'the principal panel has readable choices and named controls ($language, $fontScale×)',
  async ({ language, fontScale }) => {
    jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale });
    const { data, screen, store } = await fixture();
    await showSettingsScreen(screen, data, language);
    await pressSettings('school-cover-session-one');
    await pressSettings('school-cover-kind-colleague');
    expect(settingsTexts()).toContain(names('free'));
    expect(accessibilityProblems(settingsRoot())).toEqual([]);
    for (const node of settingsRoot().findAllByType(Text)) {
      const props = node.props as TextProps;
      expect(props.numberOfLines).toBeUndefined();
      expect(props.allowFontScaling).not.toBe(false);
      expect(props.maxFontSizeMultiplier).toBeUndefined();
    }
    expect(await store.load()).toEqual([]);
    expect(missingKeys).toEqual([]);
  },
);

test('a principal assigns cover durably, then Keep preserves it and confirmed cancellation retains history', async () => {
  const { data, screen, book, store, actor } = await fixture();
  await showSettingsScreen(screen, data);
  await pressSettings('school-cover-session-one');
  await pressSettings('school-cover-kind-colleague');
  await pressSettings('school-cover-save');
  await settle();
  expect(settingsTexts()).toContain(catalogues.ar.schoolCover.board.saved);
  actor('free');
  expect(book.teacherRows(day)[0]?.direction).toBe('given');
  actor('director');
  const before = await store.load();
  await pressSettings('school-cover-cancel-one');
  await pressSettings('school-cover-keep');
  expect(await store.load()).toEqual(before);
  await pressSettings('school-cover-cancel-one');
  await pressSettings('school-cover-confirm-cancel');
  await settle();
  expect((await store.load()).slice(0, before.length)).toEqual(before);
  expect((await store.load()).length).toBe(before.length + 1);
  expect(book.dailySheet(day)).toEqual([]);
});

test('a teacher cannot use the panel or save with a stale management control', async () => {
  const { data, screen, store, actor } = await fixture();
  await showSettingsScreen(screen, data);
  await pressSettings('school-cover-session-one');
  await pressSettings('school-cover-kind-colleague');
  const stale = settingsControl('school-cover-save');
  actor('holder');
  await ReactTestRenderer.act(() => {
    stale.onPress?.({} as never);
  });
  await settle();
  expect(await store.load()).toEqual([]);
  expect(settingsTexts()).toContain(catalogues.ar.schoolCover.board.denied);
});
