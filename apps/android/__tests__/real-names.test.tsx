// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Real class lists (#211, answer 274): the switch is off in the project's
// builds, and a build without a declaration, or before its PIN is chosen,
// never asks for real names. Here the switch is on, as in the build the
// Ministry runs: the class list says how names are protected, the welcome
// waits for the PIN, Help and the privacy notice state the declaration,
// Help asks to compare with the build's own checksums, and every control
// is named in each language. The reference is made up.

import { parseDay } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { openTestData, withData } from '../jest/app-data';
import { AboutBuild } from '../src/help/BuildFacts';
import { PrivacyNotice } from '../src/help/PrivacyNotice';
import { WelcomeScreen } from '../src/navigation/SetupScreens';
import { Welcome } from '../src/navigation/Welcome';
import { buildDeclaration, realNamesDeclaration } from '../src/privacy/real-names';
import { TypeList } from '../src/setup/TypeList';
import text from '../src/text/ar.json';
import { catalogues, i18n, type Language } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('../src/privacy/real-names', () => ({
  ...jest.requireActual<object>('../src/privacy/real-names'),
  REAL_NAMES: { declaration: ' D-2027-0042 ' },
}));

let tree: ReactTestRenderer.ReactTestRenderer | undefined;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  await i18n.changeLanguage('ar');
});

async function render(element: React.ReactElement, direction: 'rtl' | 'ltr' = 'rtl') {
  await ReactTestRenderer.act(() => tree?.unmount());
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<LocaleDirContext.Provider value={direction}>{element}</LocaleDirContext.Provider>);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
}

const shown = () => tree!.root.findAllByType(Text).map((node) => [node.props.children as unknown].flat().join(''));
const exists = (id: string) => tree!.root.findAll((node) => node.props.testID === id).length > 0;

async function typeList() {
  const data = await openTestData();
  const day = parseDay('2026-10-15');
  await data.book.record(day, {
    kind: 'school.set',
    school: { id: 's-1', name: 'متوسطة النجاح', levels: ['cem'], subjects: ['arabic'], zone: '16' },
  });
  await data.book.record(day, {
    kind: 'class.set',
    schoolClass: {
      id: 'c-1',
      schoolId: 's-1',
      level: 'cem',
      grade: '4am',
      name: '4م3',
      groups: [{ id: 'g-1', kind: 'whole', name: '4م3' }],
    },
  });
  return withData(data, <TypeList classId="c-1" onDone={jest.fn()} />);
}

test('gives a declaration only to a build that carries one, and only once the lock is set', () => {
  expect(buildDeclaration(null)).toBeNull();
  expect(buildDeclaration({ declaration: '  ' })).toBeNull();
  expect(buildDeclaration({ declaration: ' D-1 ' })).toBe('D-1');
  expect(realNamesDeclaration({ declaration: 'D-1' }, false)).toBeNull();
  expect(realNamesDeclaration(null, true)).toBeNull();
  expect(realNamesDeclaration({ declaration: 'D-1' }, true)).toBe('D-1');
});

test('the class list takes real names and says how they are protected', async () => {
  await render(await typeList());
  expect(exists('real-names')).toBe(true);
  expect(exists('made-up-only')).toBe(false);
  expect(shown()).toEqual(expect.arrayContaining([text.realNames.badge, text.realNames.setup]));
  expect(shown()).not.toContain(text.setup.madeUpOnly);
});

test('the welcome waits for the PIN before taking real names, and says so once it is set', async () => {
  await render(<Welcome />);
  expect(shown()).toEqual(expect.arrayContaining([text.realNames.badge, text.realNames.beforeLock]));
  expect(shown()).not.toContain(text.preview.short);
  await render(<Welcome lockSet />);
  expect(shown()).toContain(text.realNames.setup);
  expect(shown()).not.toContain(text.realNames.beforeLock);
});

test("the navigator's welcome is the one after the PIN", async () => {
  const navigation = { navigate: jest.fn() } as unknown as Parameters<typeof WelcomeScreen>[0]['navigation'];
  const data = await openTestData();
  await render(withData(data, <WelcomeScreen navigation={navigation} route={{ key: 'Welcome', name: 'Welcome' }} />));
  expect(shown()).toContain(text.realNames.setup);
  expect(shown()).not.toContain(text.realNames.beforeLock);
});

test('Help and the privacy notice state the declaration, isolated', async () => {
  const reference = '\u2068D-2027-0042\u2069';
  await render(<AboutBuild />);
  expect(shown()).toEqual(
    expect.arrayContaining([text.realNames.title, i18n.t('realNames.message', { declaration: reference })]),
  );
  expect(shown()).not.toContain(text.preview.message);
  expect(shown()).toContain(text.realNames.compare);
  expect(shown()).not.toContain(text.preview.compare);
  await render(<PrivacyNotice onConnections={jest.fn()} />);
  expect(shown()).toContain(i18n.t('realNames.privacy', { declaration: reference }));
  expect(exists('privacy-declaration')).toBe(true);
});

test.each(
  (Object.keys(catalogues) as Language[]).flatMap((language) =>
    (['rtl', 'ltr'] as const).map((direction) => [language, direction] as const),
  ),
)('names every control (%s, %s)', async (language, direction) => {
  await i18n.changeLanguage(language);
  await render(await typeList(), direction);
  expect(accessibilityProblems(tree!.root)).toEqual([]);
  expect(shown()).toContain(catalogues[language].realNames.setup);
  await render(<PrivacyNotice onConnections={jest.fn()} />, direction);
  expect(accessibilityProblems(tree!.root)).toEqual([]);
});
