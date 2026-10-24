// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { parseDay, type TeacherCover } from '@minhajna/core';
import { Text, useWindowDimensions, type TextProps } from 'react-native';
import { accessibilityProblems } from '../jest/accessibility';
import { closeSettingsScreen, settingsRoot, settingsTexts, showSettingsScreen } from '../jest/settings-screen';
import { withDay } from '../jest/today-day';
import { catalogues, i18n, missingKeys } from '../src/text/i18n';
import { Today } from '../src/today/Today';
import { SchoolCoverCards } from '../src/school/SchoolCoverCards';
import { SchoolCoverSource } from '../src/school/cover-source';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));
const day = parseDay('2026-10-15');
const rows: readonly TeacherCover[] = [
  {
    session: {
      id: 'given',
      schoolId: 's-1',
      classId: 'k-other',
      level: 'cem',
      className: 'قسم تجريبي ذو اسم طويل لاختبار وضوح تكليف التعويض',
      day,
      slot: { half: 'morning', index: 4 },
    },
    direction: 'given',
    choice: 'supervision',
    assigned: true,
    completed: false,
  },
  {
    session: {
      id: 'received',
      schoolId: 's-1',
      classId: 'k-1',
      level: 'cem',
      className: '4م1',
      day,
      slot: { half: 'afternoon', index: 2 },
    },
    direction: 'received',
    choice: 'colleague',
    assigned: false,
    completed: false,
  },
];
beforeEach(() => {
  missingKeys.length = 0;
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale: 1 });
});
afterEach(async () => {
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
});

test('ordinary teacher mode does not mount school-assignment cards or install a school source', async () => {
  const data = await withDay();
  const before = [...data.book.entries];
  await showSettingsScreen(<Today onHelp={jest.fn()} onDetails={jest.fn()} onRoll={jest.fn()} />, data);
  expect(settingsRoot().findAll((node) => String(node.props.testID).startsWith('school-cover-card-'))).toHaveLength(0);
  expect(data.book.entries).toEqual(before);
});

test.each((['ar', 'fr', 'en'] as const).flatMap((language) => [1, 2].map((fontScale) => ({ language, fontScale }))))(
  'the school-supplied projection is readable and read-only ($language, $fontScale×)',
  async ({ language, fontScale }) => {
    jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale });
    const data = await withDay();
    const before = [...data.book.entries];
    await showSettingsScreen(
      <SchoolCoverSource.Provider value={() => rows}>
        <SchoolCoverCards day={day} />
      </SchoolCoverSource.Provider>,
      data,
      language,
    );
    expect(settingsTexts()).toContain(`${catalogues[language].schoolCover.cover.given} · ${rows[0].session.className}`);
    expect(settingsTexts()).toContain(catalogues[language].schoolCover.cover.needed);
    expect(accessibilityProblems(settingsRoot())).toEqual([]);
    expect(settingsRoot().findAll((node) => typeof node.props.onPress === 'function')).toHaveLength(0);
    for (const node of settingsRoot().findAllByType(Text)) {
      const props = node.props as TextProps;
      expect(props.numberOfLines).toBeUndefined();
      expect(props.allowFontScaling).not.toBe(false);
      expect(props.maxFontSizeMultiplier).toBeUndefined();
    }
    expect(data.book.entries).toEqual(before);
    expect(missingKeys).toEqual([]);
  },
);

test('revoked or unavailable school access fails closed without displaying a stale assignment', async () => {
  await showSettingsScreen(
    <SchoolCoverSource.Provider
      value={() => {
        throw new Error('Access revoked');
      }}
    >
      <SchoolCoverCards day={day} />
    </SchoolCoverSource.Provider>,
    await withDay(),
  );
  expect(settingsTexts()).toEqual([]);
});
