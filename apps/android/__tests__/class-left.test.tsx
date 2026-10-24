// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «غادروا القسم» on the Class page (#248, answer 475): the pupils whose
// confirmed departure's day has come, whatever its reason, after the list in
// its order, each with the day they left and opening their page; a departure
// waiting for the director or for its day leaves the pupil in the list; no
// section when nobody left, and a pupil whose data was erased in neither; and
// the texts in French and English. The teacher has 4م1, with 45 made-up
// pupils, and today is Thursday 15 October 2026.

import { parseDay, type MovementReason, type RecordEvent } from '@minhajna/core';
import { createRef } from 'react';
import type { ViewInstance } from 'react-native';
import type { TestData } from '../jest/app-data';
import { mount, press, root, texts, unmount } from '../jest/components-screen';
import { withPupils } from '../jest/roll-class';
import { ClassPage } from '../src/classes/ClassPage';
import { i18n, missingKeys } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

beforeEach(() => {
  missingKeys.length = 0;
});
afterEach(async () => {
  await unmount();
  await i18n.changeLanguage('ar');
});

const leaves = (pupilId: string, day: string, reason: MovementReason, confirmed = true): RecordEvent => ({
  kind: 'pupil.moved',
  pupilId,
  movement: { day: parseDay(day), kind: 'out', reason, ...(confirmed && { confirmed }) },
});

async function page(data: TestData) {
  const onPupil = jest.fn();
  await mount(
    data,
    <ClassPage
      courseId="c-1"
      settings={false}
      settingsOpener={createRef<ViewInstance>()}
      onSettings={jest.fn()}
      onCourse={jest.fn()}
      onRoll={jest.fn()}
      onBook={jest.fn()}
      onPlan={jest.fn()}
      onHomework={jest.fn()}
      onExtra={jest.fn()}
      onSupervised={jest.fn()}
      onMove={jest.fn()}
      onSeats={jest.fn()}
      onRules={jest.fn()}
      onReorient={jest.fn()}
      onPupil={onPupil}
    />,
  );
  return onPupil;
}

const nameOf = (data: TestData, pupilId: string) => data.book.state.pupils.get(pupilId)?.name ?? '';
const shown = (testID: string) => root().findAll((node) => node.props.testID === testID).length > 0;

test('lists the pupils who left after the list, each with the day and opening their page', async () => {
  const data = await withPupils();
  await data.book.recordAll(parseDay('2026-10-12'), [
    leaves('p-3', '2026-10-11', 'transfer'),
    leaves('p-2', '2026-10-12', 'class-change'),
    leaves('p-4', '2026-10-11', 'transfer', false),
    leaves('p-5', '2026-10-20', 'other'),
  ]);
  const onPupil = await page(data);
  const all = texts();
  const heading = all.indexOf('غادروا القسم');
  expect(heading).toBeGreaterThan(all.indexOf(nameOf(data, 'p-4')));
  expect(heading).toBeGreaterThan(all.indexOf(nameOf(data, 'p-5')));
  expect(all.slice(heading + 1, heading + 7)).toEqual([
    '2',
    nameOf(data, 'p-2'),
    'غادرت في 12/10/2026',
    '3',
    nameOf(data, 'p-3'),
    'غادر في 11/10/2026',
  ]);
  expect(all.filter((one) => one.startsWith('غادر'))).toHaveLength(3);
  await press('class-pupil-p-3');
  expect(onPupil).toHaveBeenCalledWith('p-3');
});

test('no section when nobody left, and a pupil whose data was erased is in neither', async () => {
  const data = await withPupils();
  await page(data);
  expect(shown('class-left')).toBe(false);
  await unmount();
  await data.book.record(parseDay('2026-10-12'), leaves('p-3', '2026-10-11', 'transfer'));
  await data.book.erasePupil(parseDay('2026-10-15'), 'p-3');
  await page(data);
  expect(shown('class-left')).toBe(false);
  expect(shown('class-pupil-p-3')).toBe(false);
});

test('the texts in French and English', async () => {
  for (const [language, heading, line] of [
    ['fr', 'Ont quitté la classe', 'Parti le 11/10/2026'],
    ['en', 'Left the class', 'Left on 11/10/2026'],
  ] as const) {
    await i18n.changeLanguage(language);
    const data = await withPupils();
    await data.book.record(parseDay('2026-10-12'), leaves('p-3', '2026-10-11', 'transfer'));
    await page(data);
    expect(texts()).toEqual(expect.arrayContaining([heading, line]));
    await unmount();
  }
  expect(missingKeys).toEqual([]);
});
