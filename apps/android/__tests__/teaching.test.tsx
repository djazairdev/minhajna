// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Setup's first step (#25, answers 802 to 809): the level, the option for that
// level, the wilaya, commune and school, chosen from the directory's list with
// nothing typed; each select offered once the one before is chosen and
// emptied when an earlier one changes; Next records the chosen school; the
// step says when the list loads, when nothing is published and when there is
// no network, with a retry. The list and every name are made up.

import { LocaleDirContext } from '@react-navigation/native';
import { StyleSheet, Text, TextInput } from 'react-native';
import type { PressableProps, TextInputProps, TextProps } from 'react-native';
import ReactTestRenderer, { type ReactTestInstance } from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { openTestData, withData, type TestData } from '../jest/app-data';
import { MADE_UP_LIST, pickSchool, serveReference } from '../jest/directory-list';
import type { DirectoryOptions } from '../src/network/directory-network';
import { Teaching } from '../src/setup/Teaching';
import { catalogues, i18n, type Language } from '../src/text/i18n';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer;
const onNext = jest.fn();
const root = () => tree.root;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree.unmount());
  await i18n.changeLanguage('ar');
  onNext.mockReset();
  jest.restoreAllMocks();
});

const settle = () => ReactTestRenderer.act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

async function render(data: TestData, direction: 'rtl' | 'ltr' = 'rtl') {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={direction}>
        {withData(data, <Teaching onNext={onNext} />)}
      </LocaleDirContext.Provider>,
    );
  });
  await settle();
}

function control(id: string): ReactTestInstance {
  const [node] = root().findAll(
    (one) => one.props.testID === id && typeof (one.props as PressableProps).onPress === 'function',
    { deep: false },
  );
  if (node === undefined) throw new Error(`Nothing to press has the test ID ${id}`);
  return node;
}

async function press(id: string) {
  await ReactTestRenderer.act(() => {
    (control(id).props as PressableProps).onPress?.({} as never);
  });
  await settle();
}

const exists = (id: string) => root().findAll((node) => node.props.testID === id, { deep: false }).length > 0;
const shown = () =>
  root()
    .findAllByType(Text)
    .map((node) => [node.props.children as unknown].flat().join(''));
const rows = (field: string) => [
  ...new Set(
    root()
      .findAll((node) => typeof node.props.testID === 'string' && node.props.testID.startsWith(`choice-${field}-`))
      .map((node) => String(node.props.testID).slice(`choice-${field}-`.length))
      .filter((value) => value !== 'sheet' && value !== 'search'),
  ),
];

test('offers each select once the one before is chosen, with only what the list holds there', async () => {
  serveReference();
  const data = await openTestData();
  const name = (code: string) => data.profile.subjects.find((subject) => subject.code === code)?.name.ar;
  await render(data);
  expect(shown()).toContain(text.setup.teachingHeading);
  expect(['level', 'option', 'wilaya', 'commune', 'school'].map((field) => exists(`choice-${field}`))).toEqual([
    true,
    false,
    false,
    false,
    false,
  ]);
  expect(control('setup-next').props).toMatchObject({ disabled: true });
  await press('choice-level');
  expect(rows('level')).toEqual(['primary', 'cem']);
  await press('choice-level-primary');
  await press('choice-option');
  expect(control('choice-option-class').props.label).toBe(text.setup.classTeacher);
  await press('choice-option-class');
  await press('choice-level');
  await press('choice-level-cem');
  expect(exists('choice-wilaya')).toBe(false);
  await press('choice-option');
  expect(rows('option')).toEqual(['arabic', 'arabic-islamic', 'math']);
  expect(control('choice-option-arabic-islamic').props.label).toBe(`${name('arabic')} و${name('islamic')}`);
  await press('choice-option-arabic');
  await press('choice-wilaya');
  expect(rows('wilaya')).toEqual(['07', '16']);
  await press('choice-wilaya-16');
  await press('choice-commune');
  expect(rows('commune')).toEqual(['1601']);
  await press('choice-commune-1601');
  await press('choice-school');
  expect(rows('school')).toEqual(['cem-16-2', 'cem-16-1']);
  await press('choice-school-cem-16-1');
  expect(control('setup-next').props).toMatchObject({ disabled: false });
});

test('records the chosen school on Next, keeping the history’s ID, and shows it on opening again', async () => {
  serveReference();
  const data = await openTestData();
  await render(data);
  await pickSchool(root, { level: 'cem', option: 'arabic-islamic', wilaya: '16', commune: '1601', school: 'cem-16-1' });
  await press('setup-next');
  expect(onNext).toHaveBeenCalledTimes(1);
  const [school] = [...data.book.state.schools.values()];
  expect(school).toMatchObject({
    code: 'cem-16-1',
    name: 'متوسطة النجاح',
    levels: ['cem'],
    subjects: ['arabic', 'islamic'],
    zone: '16',
  });
  await ReactTestRenderer.act(() => tree.unmount());
  await render(data);
  expect(control('choice-school').props.accessibilityLabel).toBe(`${text.setup.school}: متوسطة النجاح`);
  await press('choice-school');
  await press('choice-school-cem-16-2');
  await press('setup-next');
  expect([...data.book.state.schools.values()]).toEqual([
    expect.objectContaining({ id: school.id, code: 'cem-16-2', name: 'متوسطة الفجر' }),
  ]);
});

test.each([
  ['E_DIRECTORY_MISSING', 'none'],
  ['E_DIRECTORY_NETWORK', 'offline'],
  ['E_DIRECTORY_WAKING', 'offline'],
] as const)('says so with a retry when the list is %s', async (code, line) => {
  const served = serveReference(code);
  await render(await openTestData());
  expect(shown()).toContain(text.setup.directory[line]);
  expect(exists('choice-level')).toBe(false);
  expect(control('setup-next').props).toMatchObject({ disabled: true });
  served.mockResolvedValue(MADE_UP_LIST);
  await press('directory-retry');
  expect(exists('directory-state')).toBe(false);
  expect(exists('choice-level')).toBe(true);
});

test('says the list is loading, then that the server wakes, and refuses a list the reader refuses', async () => {
  let wake: (() => void) | undefined;
  serveReference().mockImplementation((_path: string, _code?: string, options?: DirectoryOptions) => {
    wake = options?.onWaking;
    return new Promise(() => undefined);
  });
  await render(await openTestData());
  expect(shown()).toContain(text.setup.directory.loading);
  expect(exists('directory-retry')).toBe(false);
  await ReactTestRenderer.act(() => wake?.());
  expect(shown()).toContain(text.setup.directory.waking);
  await ReactTestRenderer.act(() => tree.unmount());
  serveReference({ ...MADE_UP_LIST, format: 2 } as never);
  await render(await openTestData());
  expect(shown()).toContain(text.setup.directory.refused);
});

test('a long list offers a search in its sheet', async () => {
  const schools = Array.from({ length: 12 }, (_, at) => ({
    ...MADE_UP_LIST.schools[0],
    id: `cem-16-${at + 10}`,
    name: `متوسطة رقم ${at + 10}`,
  }));
  serveReference({ ...MADE_UP_LIST, schools });
  await render(await openTestData());
  await press('choice-level');
  await press('choice-level-cem');
  await press('choice-option');
  await press('choice-option-math');
  await press('choice-wilaya');
  await press('choice-wilaya-16');
  await press('choice-commune');
  await press('choice-commune-1601');
  await press('choice-school');
  expect(rows('school')).toHaveLength(12);
  const search = root().find((node) => node.props.testID === 'choice-school/search');
  await ReactTestRenderer.act(() => {
    (search.findByType(TextInput).props as TextInputProps).onChangeText?.('21');
  });
  expect(rows('school')).toEqual(['cem-16-21']);
});

test('keeps no fixed text height or line limit, so text at 200% wraps', async () => {
  serveReference();
  await render(await openTestData());
  await pickSchool(root);
  for (const node of root().findAllByType(Text)) {
    const props = node.props as TextProps;
    expect(props.numberOfLines).toBeUndefined();
    expect(StyleSheet.flatten(props.style) ?? {}).not.toHaveProperty('height');
  }
});

test.each(
  (Object.keys(catalogues) as Language[]).flatMap((language) =>
    (['rtl', 'ltr'] as const).map((direction) => [language, direction] as const),
  ),
)('names every control and keeps 48 dp targets (%s, %s)', async (language, direction) => {
  await i18n.changeLanguage(language);
  serveReference();
  await render(await openTestData(), direction);
  await pickSchool(root);
  expect(accessibilityProblems(root())).toEqual([]);
  await press('choice-school');
  expect(accessibilityProblems(root())).toEqual([]);
});
