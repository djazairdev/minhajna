// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The free-entry card on Today (#232, PS-Today, answer 399): the focus
// session of a class with no plan pack, or a stale one, says why nothing is
// proposed and takes what was taught as typed, in the subject's writing
// direction; «تسجيل الحصة» asks for the text first, then records it as
// content from outside the plan, and the focus moves on; «تأكيد اليوم كله»
// never records such a session with nothing written; a test or a reception
// is never written freely. Made-up classes only.

import { current, parseDay, type TimetableEntry } from '@minhajna/core';
import { TextInput } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { closeSettingsScreen, settingsRoot, settingsTexts, showSettingsScreen } from '../jest/settings-screen';
import { thursday, withSpecialist } from '../jest/specialist-classes';
import { withStale } from '../jest/stale-pack';
import { catalogues, i18n, missingKeys } from '../src/text/i18n';
import { Today } from '../src/today/Today';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const show = () => <Today onHelp={jest.fn()} onDetails={jest.fn()} onRoll={jest.fn()} />;
const fields = () =>
  settingsRoot().findAll(
    (node) => typeof node.props.testID === 'string' && node.props.testID.endsWith('-free') && node.type === TextInput,
  );
const press = async (label: string) => {
  const button = settingsRoot().findAll(
    (node) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function',
  )[0];
  await ReactTestRenderer.act(() => (button?.props.onPress as () => void)());
};

afterEach(async () => {
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
});

test('a class with no pack is written freely, then recorded, and the focus moves on', async () => {
  missingKeys.length = 0;
  const data = await withSpecialist();
  await showSettingsScreen(show(), data);
  expect(settingsTexts()).toContain(catalogues.ar.today.free.none);
  const [field] = fields();
  expect(field?.props.testID).toMatch(/^today-.*-free$/);
  expect(field?.props.style).toEqual(expect.arrayContaining([expect.objectContaining({ writingDirection: 'ltr' })]));
  await press(catalogues.ar.today.free.save);
  expect(settingsTexts()).toContain(catalogues.ar.today.free.empty);
  expect([...data.book.state.sessions.values()].map(current).filter(Boolean)).toEqual([]);
  await ReactTestRenderer.act(() => (field?.props.onChangeText as (text: string) => void)(' Les couleurs (exemple) '));
  await press(catalogues.ar.today.free.save);
  const recorded = [...data.book.state.sessions.values()].map(current).filter((one) => one !== null);
  expect(recorded.map((one) => [one.session.courseId, one.outcome, one.unplanned])).toEqual([
    ['f-1', 'changed', 'Les couleurs (exemple)'],
  ]);
  expect(fields()).toHaveLength(1);
  expect(settingsTexts().filter((line) => line === catalogues.ar.today.free.empty)).toEqual([]);
  expect(accessibilityProblems(settingsRoot())).toEqual([]);
  expect(missingKeys).toEqual([]);
});

test('a class on a stale pack says so, and the whole day is not confirmed with nothing written', async () => {
  await showSettingsScreen(show(), await withStale());
  const texts = settingsTexts();
  expect(texts.filter((line) => line === catalogues.ar.today.free.stale)).toHaveLength(1);
  expect(texts).toContain(catalogues.ar.today.packStale);
  expect(fields()).toHaveLength(1);
  expect(settingsRoot().findAll((node) => node.props.testID === 'today-confirm-day')).toEqual([]);
});

test('a test or a reception slot of a class with no pack is not written freely', async () => {
  const slot = (id: string, index: number, sessionType: string): TimetableEntry => ({
    ...thursday(id, 'morning', index, 'f-1', 'k-1'),
    sessionType,
  });
  const data = await withSpecialist();
  const version = data.book.state.timetables[0].version;
  await data.book.record(parseDay('2026-10-15'), {
    kind: 'timetable.set',
    version: {
      ...version,
      entries: [slot('e-1', 1, 'test'), slot('e-2', 2, 'reception')],
    },
  });
  await showSettingsScreen(show(), data);
  expect(fields()).toEqual([]);
  expect(settingsTexts()).not.toContain(catalogues.ar.today.free.none);
});
