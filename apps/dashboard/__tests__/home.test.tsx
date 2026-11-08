// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The dashboard app's home (answer 855): it says its data is made up, leads to
// the Ministry's reference data and to the school's pages, offers the
// interface's languages, has nothing behind it, and each page goes back to it;
// reference data that does not read shows alone; the page's title is the
// dashboard's. Every school, and the directory the pages read, is made up.

import { Platform } from 'react-native';
import { has, press, show, texts as shown, unmount } from '../../android/jest/ministry-page';
import { FakeDirectory } from '../jest/fake-directory';
import { DashboardApp } from '../src/DashboardApp';
import { bundledFiles } from '../src/reference';
import { dashboardWord } from '../src/text';
import words from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
  new FakeDirectory().install();
});

afterEach(async () => {
  await unmount();
  jest.restoreAllMocks();
});

describe('the home', () => {
  it('says its data is made up, and has nothing behind it', async () => {
    await show(<DashboardApp />);
    expect(shown()).toContain(words.madeUp);
    expect(shown()).toContain(words.home.reference);
    expect(shown()).toContain(words.home.school);
    expect(has('dashboard-side-back')).toBe(false);
    expect(has('language-fr')).toBe(true);
  });

  it('leads to each page, which goes back to it', async () => {
    await show(<DashboardApp />);
    await press('dashboard-reference');
    expect(shown()).toContain(words.who.ministry);
    await press('dashboard-side-back');
    expect(has('dashboard-reference')).toBe(true);
    await press('dashboard-school');
    expect(has('dashboard-reference')).toBe(false);
    await press('dashboard-side-back');
    expect(has('dashboard-school')).toBe(true);
  });

  it('shows alone that the reference data does not read', async () => {
    await show(<DashboardApp files={{ ...bundledFiles, profile: {} }} />);
    expect(shown()).toEqual([words.refused]);
    expect(has('dashboard-reference')).toBe(false);
  });

  it('names the page in the interface’s language', () => {
    expect(dashboardWord('dashboard.title')).toBe(words.title);
  });
});
