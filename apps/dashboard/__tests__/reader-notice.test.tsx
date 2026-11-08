// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reader mode's privacy notice and its page on connections (answer 857): the
// first-use notice, the notice from Settings and the connections page show
// the dashboard's own words, never the PC teacher app's, while the teacher
// app's notice keeps its own. Every passphrase is made up.

import { Platform } from 'react-native';
import { Connections, PrivacyNotice } from '../../android/src/help/PrivacyNotice';
import teacher from '../../android/src/text/ar.json';
import { has, passphraseStorage, PASSPHRASE, press, rendered, show, texts, unlock, unmount } from '../jest/reader-page';
import words from '../src/text/ar.json';

jest.mock('../../android/src/lock/CreatePin', () => jest.requireActual<object>('../../android/src/lock/CreatePin.web'));
jest.mock('../../android/src/lock/Unlock', () => jest.requireActual<object>('../../android/src/lock/Unlock.web'));
jest.mock('../../android/src/lock/LockPin', () => jest.requireActual<object>('../../android/src/lock/LockPin.web'));
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const notice = words.reader.privacy;
const SECTIONS = ['phone', 'reader', 'site', 'directory', 'tracking', 'erase', 'publisher', 'rights'] as const;
/** The PC teacher app's words that must not show in the dashboard. */
const TEACHER_PC = [
  teacher.privacy.intro,
  teacher.privacy.pc.phoneText,
  teacher.privacy.pc.leaveText,
  teacher.privacy.pc.publisherText,
  teacher.privacy.demoText,
  teacher.privacy.trackingText,
];

/** The title of the notice's link to what the app connects to. */
const linkTitle = () =>
  rendered().root.findAll((node) => node.props.testID === 'privacy-connections' && node.props.title !== undefined)[0]
    ?.props.title as unknown;

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});

afterEach(async () => {
  await unmount();
  jest.restoreAllMocks();
});

test('the first-use notice and the connections page speak of the dashboard, not the teacher app', async () => {
  await unlock(passphraseStorage(PASSPHRASE), jest.fn());
  expect(has('privacy-accept')).toBe(true);
  const shown = texts();
  expect(shown).toEqual(
    expect.arrayContaining([
      notice.heading,
      notice.intro,
      notice.fileLine,
      ...SECTIONS.flatMap((key) => [notice[`${key}Title`], notice[`${key}Text`]]),
    ]),
  );
  for (const line of TEACHER_PC) expect(shown).not.toContain(line);
  expect(['privacy-demo', 'privacy-never', 'privacy-leave'].map(has)).toEqual([false, false, false]);
  expect(shown).toContain(teacher.privacy.contact);
  expect(linkTitle()).toBe(words.reader.connections.title);
  await press('privacy-connections');
  const connections = words.reader.connections;
  expect(texts()).toEqual(
    expect.arrayContaining([
      connections.title,
      connections.site,
      connections.directory,
      connections.reader,
      connections.crashReport,
      connections.register,
    ]),
  );
  expect(texts()).not.toContain(teacher.connections.pc.none);
  expect(texts()).not.toContain(teacher.connections.demo);
});

test('the teacher app’s notice and connections keep the PC teacher app’s words', async () => {
  await show(<PrivacyNotice onConnections={jest.fn()} />);
  expect(texts()).toEqual(expect.arrayContaining(TEACHER_PC.filter((line) => line !== teacher.privacy.intro)));
  expect(texts()).toContain(teacher.privacy.heading);
  expect(texts()).not.toContain(notice.heading);
  expect(linkTitle()).toBe(teacher.connections.title);
  expect(
    ['phone', 'leave', 'demo', 'never', 'tracking', 'publisher', 'rights'].map((key) => has(`privacy-${key}`)),
  ).toEqual([true, true, true, true, true, true, true]);
  await unmount();
  await show(<Connections />);
  expect(texts()).toContain(teacher.connections.pc.none);
  expect(texts()).not.toContain(words.reader.connections.site);
});
