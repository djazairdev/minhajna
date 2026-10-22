// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { parseDay, pace } from '@minhajna/core';
import ReactTestRenderer from 'react-test-renderer';
import { settingsData } from '../jest/settings-data';
import { closeSettingsScreen, settingsTexts, showSettingsScreen } from '../jest/settings-screen';
import { ClassesTab } from '../src/classes/ClassesTab';
import { setCountMinutes } from '../src/settings/preferences';
import { coreContext } from '../src/storage/core-context';
import { i18n } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
beforeEach(() => setCountMinutes(false));
afterEach(async () => {
  await closeSettingsScreen();
  setCountMinutes(false);
  await i18n.changeLanguage('ar');
});

test.each(['ar', 'fr', 'en'] as const)(
  'adds minutes to an already mounted class view without changing pacing (%s)',
  async (language) => {
    const data = await settingsData();
    const course = data.book.state.courses.get('c-1')!;
    await data.book.record(parseDay('2026-10-15'), { kind: 'course.set', course: { ...course, sessionMinutes: 30 } });
    const context = coreContext({ ...data, state: data.book.state });
    const before = pace(context, 'c-1', parseDay('2026-10-15'));
    const history = [...data.book.entries];
    await showSettingsScreen(
      <ClassesTab onClass={() => undefined} onBook={() => undefined} onWeek={() => undefined} />,
      data,
      language,
    );
    const words = settingsTexts();
    await ReactTestRenderer.act(() => setCountMinutes(true));
    expect(settingsTexts()).not.toEqual(words);
    expect(settingsTexts().some((text) => /\d/.test(text) && /دقيق|minute/.test(text))).toBe(true);
    expect(pace(context, 'c-1', parseDay('2026-10-15'))).toEqual(before);
    expect(data.book.entries).toEqual(history);
    await ReactTestRenderer.act(() => setCountMinutes(false));
    expect(settingsTexts()).toEqual(words);
  },
);
