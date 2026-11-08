// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// N-Reference's levels and publishing against a made-up directory (answers
// 804, 805 and 809): the draft starts from the profile's options; a pair is
// added and an option hidden, each change saved as it is made; publishing saves
// a draft never saved first, and an old version is published again; a save
// after someone else's says so, sends nothing more, and the latest copy reads
// back. Every name is made up.

import { startingLevels } from '@minhajna/core';
import { Platform } from 'react-native';
import { COMMUNE, schoolIn } from '../jest/dashboard-world';
import { FakeDirectory } from '../jest/fake-directory';
import { has, press, texts, unmount } from '../../android/jest/ministry-page';
import { cemOptions, openReference, pick, profile } from '../jest/reference-desk';
import words from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let directory: FakeDirectory;
const puts = () => directory.seen.filter((one) => one.startsWith('PUT')).length;

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
  directory = new FakeDirectory();
  directory.install();
});

afterEach(async () => {
  await unmount();
  jest.restoreAllMocks();
});

it('starts from the profile and saves a pair and a hidden option', async () => {
  await openReference(directory);
  expect(texts()).toContain(words.levels.classTeacher);
  await press('levels-level-cem');
  await press('levels-add-pair');
  await pick('option-first', 'arabic');
  await pick('option-second', 'islamic');
  await press('option-save');
  expect(cemOptions(directory)).toContain('arabic+islamic');
  await press('levels-add-pair');
  await pick('option-first', 'islamic');
  await pick('option-second', 'arabic');
  expect(texts()).toContain(words.levels.exists);
  await press('option-cancel');
  await press('option-hide-computing');
  expect(cemOptions(directory)).not.toContain('computing');
  expect(directory.revision).toBe(2);
});

it('saves a draft never saved before publishing it', async () => {
  await openReference(directory);
  await press('reference-go-publish');
  await press('publish-now');
  expect(directory.revision).toBe(1);
  expect(directory.versions).toHaveLength(1);
});

it('publishes a change, then an old version again', async () => {
  await openReference(directory);
  await press('reference-go-publish');
  await press('publish-now');
  await press('reference-tab-levels');
  await press('levels-level-cem');
  await press('option-hide-computing');
  await press('reference-tab-publish');
  expect(texts()).toContain(words.publish.options);
  await press('publish-now');
  await press('publish-again-2029.1');
  expect(directory.versions).toHaveLength(3);
  expect(cemOptions(directory)).toContain('computing');
});

it('says when someone else saved first, and reads the latest copy', async () => {
  await openReference(directory);
  directory.revision = 7;
  directory.draft = { levels: startingLevels(profile), schools: [schoolIn('160155', COMMUNE, 'مدرسة من غيري')] };
  await press('levels-add');
  await pick('option-first', 'arabic');
  await press('option-save');
  expect(texts()).toContain(words.problem.stale);
  expect(has('option-form')).toBe(false);
  const before = puts();
  await press('option-hide-french');
  expect(puts()).toBe(before);
  await press('dashboard-retry');
  await press('option-hide-french');
  expect(puts()).toBe(before + 1);
  expect(directory.draft?.schools.map((one) => one.id)).toEqual(['160155']);
});
