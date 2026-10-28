// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The PC web app's update on Today (#250, Web-update, answers 516 and 517):
// a newer build shows with its version, its notes in the interface's
// language, and its checksum beside the current one's; «تثبيت التحديث»
// installs it by that checksum, and a failure says the current version
// keeps working; «لاحقاً» leaves a line that it waits. After an update the
// app records it once in the history, with its version and checksum, then
// forgets it, and says what was installed. Every text in French and
// English too. Made-up builds and records only.

import { activityLog, eventOf } from '@minhajna/core';
import { accessibilityProblems } from '../jest/accessibility';
import { mount, press, root, texts, unmount } from '../jest/components-screen';
import { resetUpdate, updateState } from '../jest/fake-update';
import { withPupils } from '../jest/roll-class';
import text from '../src/text/ar.json';
import { i18n, missingKeys } from '../src/text/i18n';
import { TodayAppUpdate } from '../src/today/TodayAppUpdate';

jest.mock('../src/native/NativeMinhajnaUpdate', () => jest.requireActual<object>('../jest/fake-update'));

const words = text.appUpdate;
const NEXT = 'ef'.repeat(32);
const offer = JSON.stringify({
  version: '0.6.1',
  versionCode: 60199,
  sha256: NEXT,
  notes: {
    version: '0.6.1',
    ar: ['Made-up change in Arabic'],
    fr: ['Made-up change in French'],
    en: ['Made-up change'],
  },
});

beforeEach(() => {
  resetUpdate();
  missingKeys.length = 0;
});
afterEach(async () => {
  await unmount();
  await i18n.changeLanguage('ar');
});

const has = (testID: string) => root().findAll((node) => node.props.testID === testID).length > 0;
const filled = (template: string, values: Record<string, string>) =>
  template.replace(/\{\{(\w+)\}\}/gu, (_, name: string) => values[name] ?? '');

test('a newer build shows with its notes and both checksums, and installs by its checksum', async () => {
  updateState.offer = offer;
  await mount(await withPupils(), <TodayAppUpdate />);
  expect(has('today-app-update')).toBe(true);
  expect(texts()).toEqual(
    expect.arrayContaining([
      words.title,
      filled(words.line, { version: '0.6.1', current: '0.1.0' }),
      filled(words.note, { line: 'Made-up change in Arabic' }),
      filled(words.build, { version: '0.6.1' }),
      `${'efef '.repeat(15)}efef`,
      filled(words.current, { version: '0.1.0' }),
    ]),
  );
  expect(accessibilityProblems(root().findAll((node) => node.props.testID === 'today-app-update')[0])).toEqual([]);
  await press('today-app-update-install');
  expect(updateState.installs).toEqual([NEXT]);
  expect(texts()).toContain(words.installing);
});

test('a failed install says the current version keeps working', async () => {
  updateState.offer = offer;
  updateState.fails = true;
  await mount(await withPupils(), <TodayAppUpdate />);
  await press('today-app-update-install');
  expect(texts()).toContain(filled(words.failed, { current: '0.1.0' }));
});

test('«later» leaves the current build, with a line that the update waits', async () => {
  updateState.offer = offer;
  await mount(await withPupils(), <TodayAppUpdate />);
  await press('today-app-update-later');
  expect(has('today-app-update')).toBe(false);
  expect(texts()).toContain(filled(words.waiting, { version: '0.6.1', current: '0.1.0' }));
  await press('today-app-update-now');
  expect(updateState.installs).toEqual([NEXT]);
});

test('nothing shows when the server holds no newer build, or a malformed one', async () => {
  await mount(await withPupils(), <TodayAppUpdate />);
  expect(has('today-app-update')).toBe(false);
  await unmount();
  updateState.offer = JSON.stringify({ version: '0.6.1', versionCode: 1, sha256: 'not-a-checksum' });
  await mount(await withPupils(), <TodayAppUpdate />);
  expect(has('today-app-update')).toBe(false);
});

test('an update installed before the opening is recorded once, then forgotten, and said', async () => {
  const data = await withPupils();
  updateState.installed = JSON.stringify({ from: '0.6.0', version: '0.6.1', sha256: NEXT });
  await mount(data, <TodayAppUpdate />);
  const updates = () => data.book.entries.filter((entry) => entry.kind === 'app.updated');
  expect(updates()).toHaveLength(1);
  expect(eventOf(updates()[0])).toEqual({ kind: 'app.updated', updated: { version: '0.6.1', build: NEXT } });
  expect(updateState.forgotten).toBe(1);
  expect(texts()).toEqual(expect.arrayContaining([filled(words.done, { version: '0.6.1' }), words.same, words.logged]));
  const lines = activityLog(data.book.entries).flatMap((day) => day.items.map((item) => item.line));
  expect(lines).toContainEqual({ kind: 'app-updated', version: '0.6.1' });
  await press('today-app-updated-ok');
  expect(has('today-app-updated')).toBe(false);
  await unmount();
  updateState.installed = JSON.stringify({ from: '0.6.0', version: '0.6.1', sha256: NEXT });
  await mount(data, <TodayAppUpdate />);
  expect(updates()).toHaveLength(1);
  expect(updateState.forgotten).toBe(2);
});

test('every update text exists in French and English, with the notes in each', async () => {
  for (const language of ['fr', 'en']) {
    await i18n.changeLanguage(language);
    updateState.offer = offer;
    await mount(await withPupils(), <TodayAppUpdate />);
    expect(texts().some((line) => line.includes(language === 'fr' ? 'in French' : 'Made-up change'))).toBe(true);
    await press('today-app-update-later');
    await unmount();
    updateState.installed = JSON.stringify({ from: '0.6.0', version: '0.6.1', sha256: NEXT });
    await mount(await withPupils(), <TodayAppUpdate />);
    await unmount();
  }
  expect(missingKeys).toEqual([]);
});
