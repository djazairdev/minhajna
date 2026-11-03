// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The insights page in its states (#624, answer 695), in every language and
// both directions, at text 200%: named controls, no missing words, text that
// grows. A teachers' world says taking part is off and what is never sent; a
// national world lists each class stopped in the world's school's space from
// its join's day, each read as one line, a join whose classes it does not know
// as the teacher's classes, named by the world's school where another join
// shows the space is its own and else by its short ID, every join so when the
// working out fails, that they are being worked out, or that no space is joined
// yet; retired, the curriculum report replaces them from the first totals day.
// The classes come from the seeded teacher whose assignment the code names.
// Real mode's Settings shows no insights row in 0.7.0. Every school, class and
// day is made up.

import { assignmentId, directorSchool, type Day, type InsightsState } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Text, useWindowDimensions, View, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { settingsData } from '../jest/settings-data';
import { closeSettingsScreen, settingsTexts, showSettingsScreen } from '../jest/settings-screen';
import { nodeKit } from '../jest/world-server';
import { seededWorld } from '../src/director/director-world';
import { InsightsPage } from '../src/insights/InsightsPage';
import { InsightsRow } from '../src/insights/InsightsRow';
import { joinRows, stoppedClasses, type StoppedClass } from '../src/insights/stopped-classes';
import { bundledReference, readReference } from '../src/reference';
import { shortSchool } from '../src/school/SchoolJoined';
import { Settings } from '../src/settings/Settings';
import { catalogues, i18n, missingKeys, type Language } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

const reference = readReference(bundledReference);
if (!reference.ok) throw new Error('The bundled reference data is refused');
const school = directorSchool(seededWorld('K7QF4', reference))!;
const SPACE = 'made-up-school-space-1';
const day = (text: string) => text as Day;
const dayText = (one: Day) => `«${one}»`;
let tree: ReactTestRenderer.ReactTestRenderer | undefined;

beforeEach(() => {
  missingKeys.length = 0;
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale: 2 });
});

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
});

async function render(node: React.ReactNode, language: Language = 'ar') {
  await ReactTestRenderer.act(async () => {
    await i18n.changeLanguage(language);
    tree?.unmount();
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={language === 'ar' ? 'rtl' : 'ltr'}>{node}</LocaleDirContext.Provider>,
    );
  });
}

const texts = () => tree!.root.findAllByType(Text).map((node) => (node.props as TextProps).children);
const shown = (testID: string) =>
  tree!.root.findAll((node) => node.props.testID === testID && typeof node.type === 'string').length;

const JOINS = [{ school: SPACE, assignment: '0'.repeat(32), since: day('2026-12-17') }];
const STATES: readonly InsightsState[] = [
  { kind: 'teacher' },
  { kind: 'school', joins: [] },
  { kind: 'school', joins: JOINS },
  { kind: 'retired', since: day('2027-03-18') },
];

const rowsOf = (state: InsightsState) =>
  state.kind === 'school' ? [...joinRows(state.joins), { ...joinRows(state.joins)[0], name: '4AM2', school }] : [];

const page = (state: InsightsState, stopped: readonly StoppedClass[] | null = rowsOf(state)) => (
  <InsightsPage state={state} stopped={stopped} date="«2026-12-17»" dayText={dayText} onClose={() => undefined} />
);

test.each((['ar', 'fr', 'en'] as const).flatMap((language) => STATES.map((state) => [language, state] as const)))(
  'names every control and lets text grow (%s, %o)',
  async (language, state) => {
    await render(
      <View>
        <InsightsRow state={state} on={false} onPress={() => undefined} />
        {page(state)}
      </View>,
      language,
    );
    const words = catalogues[language].demo.insights;
    expect(texts()).toContain(words.row[state.kind]);
    expect(texts()).toContain(words.sub[state.kind]);
    expect(accessibilityProblems(tree!.root)).toEqual([]);
    expect(missingKeys).toEqual([]);
    for (const node of tree!.root.findAllByType(Text)) {
      const props = node.props as TextProps;
      expect(props.numberOfLines).toBeUndefined();
      expect(props.allowFontScaling).not.toBe(false);
      expect(props.maxFontSizeMultiplier).toBeUndefined();
    }
  },
);

test('a teachers’ world says taking part is off and what is never sent', async () => {
  await render(page({ kind: 'teacher' }));
  const words = catalogues.ar.demo.insights;
  expect(texts()).toEqual(expect.arrayContaining([words.purpose, words.off, words.never.pupils, words.never.school]));
  expect([shown('insights-school'), shown('insights-retired')]).toEqual([0, 0]);
});

test('a national world stops each class of the space joined, from the day its join was certified', async () => {
  const teacher = school.teachers[0];
  const OTHER = 'made-up-other-space';
  const joins = [
    { school: SPACE, assignment: await assignmentId(SPACE, teacher.id, nodeKit.mac), since: day('2026-12-17') },
    { school: SPACE, assignment: '1'.repeat(32), since: day('2026-12-17') },
    { school: OTHER, assignment: '0'.repeat(32), since: day('2026-12-18') },
    { school: OTHER, assignment: '2'.repeat(32), since: day('2026-12-18') },
  ];
  const stopped = await stoppedClasses(joins, school, nodeKit.mac);
  const names = school.classes.filter((one) => teacher.classIds.includes(one.id)).map((one) => one.name);
  expect(stopped.map((one) => [one.name, one.school?.id ?? null])).toEqual([
    ...names.map((name) => [name, school.id]),
    [null, school.id],
    [null, null],
    [null, null],
  ]);
  expect(await stoppedClasses(joins, null, nodeKit.mac)).toEqual(joinRows(joins));
  expect(joinRows(joins.slice(0, 1))).toEqual([
    { name: null, school: null, space: SPACE, assignment: joins[0].assignment, since: day('2026-12-17') },
  ]);
  await render(page({ kind: 'school', joins }, stopped));
  const words = catalogues.ar.demo.insights.school;
  expect(shown('insights-stopped')).toBe(names.length + 3);
  const inSpace = (where: string, date: string) => words.inSpace.replace('{{school}}', where).replace('{{date}}', date);
  expect(texts()).toEqual(
    expect.arrayContaining([
      ...names,
      words.mine,
      inSpace(school.name, '«2026-12-17»'),
      inSpace(shortSchool(OTHER), '«2026-12-18»'),
      words.nationalHead,
    ]),
  );
  const first = tree!.root.findAll((node) => node.props.testID === 'insights-stopped' && typeof node.type === 'string');
  expect(first[0].props).toMatchObject({
    accessible: true,
    accessibilityLabel: [names[0], inSpace(school.name, '«2026-12-17»'), words.stopped].join('. '),
  });
  expect([shown('insights-no-join'), shown('insights-working')]).toEqual([0, 0]);
  await render(page({ kind: 'school', joins: [] }));
  expect(shown('insights-no-join')).toBe(1);
  await render(page({ kind: 'school', joins }, null));
  expect([shown('insights-no-join'), shown('insights-stopped'), shown('insights-working')]).toEqual([0, 0, 1]);
});

test('retired, the curriculum report replaces them from the first totals day', async () => {
  await render(page({ kind: 'retired', since: day('2027-03-18') }));
  const words = catalogues.ar.demo.insights.retired;
  expect(texts()).toEqual(
    expect.arrayContaining([words.head, words.since.replace('{{date}}', '«2027-03-18»'), words.holds.floors]),
  );
  expect(texts()).not.toContain(catalogues.ar.demo.insights.purpose);
});

test('real mode’s Settings shows no insights row in 0.7.0', async () => {
  for (const language of ['ar', 'fr', 'en'] as const) {
    await showSettingsScreen(<Settings onOpen={() => undefined} />, await settingsData(), language);
    const title = catalogues[language].demo.insights.title;
    expect(settingsTexts().some((one) => String(one).includes(title))).toBe(false);
  }
});
