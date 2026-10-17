// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Setup's first step (#25): levels, subjects and schools, each change saved
// as it is made. Made-up schools only.

import { LocaleDirContext } from '@react-navigation/native';
import { StyleSheet, Text, TextInput } from 'react-native';
import type { PressableProps, TextInputProps, TextProps } from 'react-native';
import ReactTestRenderer, { type ReactTestInstance } from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { openTestData, withData, type TestData } from '../jest/app-data';
import { Teaching } from '../src/setup/Teaching';
import { NAME_PAUSE } from '../src/setup/useSchools';
import { catalogues, i18n, type Language } from '../src/text/i18n';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer;
const onNext = jest.fn();

afterEach(async () => {
  await ReactTestRenderer.act(() => tree.unmount());
  await i18n.changeLanguage('ar');
  onNext.mockReset();
  jest.restoreAllMocks();
});

async function render(data: TestData, direction: 'rtl' | 'ltr' = 'rtl') {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={direction}>
        {withData(data, <Teaching onNext={onNext} />)}
      </LocaleDirContext.Provider>,
    );
  });
}

/** Lets every queued change reach the fake store. */
const settle = () => ReactTestRenderer.act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

function byID(id: string): ReactTestInstance {
  const [node] = tree.root.findAll((candidate) => candidate.props.testID === id, { deep: false });
  if (node === undefined) throw new Error(`Nothing has the test ID ${id}`);
  return node;
}

const exists = (id: string) => tree.root.findAll((node) => node.props.testID === id).length > 0;

async function press(id: string) {
  await ReactTestRenderer.act(() => {
    (byID(id).props as PressableProps).onPress?.({} as never);
  });
}

const input = (id: string) => byID(`school-name-${id}`).findByType(TextInput).props as TextInputProps;

async function type(id: string, value: string) {
  await ReactTestRenderer.act(() => {
    input(id).onChangeText?.(value);
  });
}

async function leave(id: string) {
  await ReactTestRenderer.act(() => {
    input(id).onBlur?.({} as never);
  });
}

/** The IDs of the schools shown open, in order. */
function openSchools(): string[] {
  return tree.root
    .findAll((node) => typeof node.props.testID === 'string' && node.props.testID.startsWith('levels-'), {
      deep: false,
    })
    .map((node) => String(node.props.testID).slice('levels-'.length));
}

/** The labels of a group's chips, the «more» chip included. */
function chips(group: string): string[] {
  return tree.root
    .findAll((node) => typeof node.props.testID === 'string' && node.props.testID.startsWith(`${group}-`), {
      deep: false,
    })
    .map((node) => String(node.props.label));
}

function shown(): string[] {
  return tree.root.findAllByType(Text).map((node) => [node.props.children as unknown].flat().join(''));
}

const saved = (data: TestData, id: string) => data.book.state.schools.get(id);

async function fillFirst(data: TestData): Promise<string> {
  await render(data);
  const [id] = openSchools();
  await press(`levels-${id}-cem`);
  await press(`subjects-${id}-arabic`);
  await type(id, 'متوسطة النجاح');
  await leave(id);
  await settle();
  return id;
}

test('starts with one empty school, the first five subjects and «مواد أخرى», and waits to go on', async () => {
  const data = await openTestData();
  await render(data);
  const [id] = openSchools();
  expect(shown()).toEqual(expect.arrayContaining([text.setup.teachingHeading, text.setup.teachingIntro]));
  expect(chips(`levels-${id}`)).toEqual(['ابتدائي', 'متوسط', 'ثانوي']);
  expect(chips(`subjects-${id}`)).toEqual([
    'اللغة العربية',
    'التربية الإسلامية',
    'اللغة الفرنسية',
    'اللغة الإنجليزية',
    'الرياضيات',
    text.setup.moreSubjects,
  ]);
  expect(byID('setup-next').props).toMatchObject({ disabled: true, accessibilityHint: text.setup.nextHint });
  expect(exists(`delete-${id}`)).toBe(false);
  expect(data.book.entries).toHaveLength(0);
});

test('saves each choice at once, and drops a subject no chosen level offers', async () => {
  const data = await openTestData();
  await render(data);
  const [id] = openSchools();
  await press(`levels-${id}-lycee`);
  await settle();
  expect(saved(data, id)).toEqual({ id, name: '', levels: ['lycee'], subjects: [] });
  expect(chips(`subjects-${id}`)).not.toContain('التربية الإسلامية');
  await press(`subjects-${id}-more`);
  expect(chips(`subjects-${id}`)).toEqual(expect.arrayContaining(['الفلسفة', 'العلوم الإسلامية']));
  expect(chips(`subjects-${id}`)).not.toContain(text.setup.moreSubjects);
  await press(`levels-${id}-cem`);
  await press(`subjects-${id}-philosophy`);
  await settle();
  expect(saved(data, id)?.subjects).toEqual(['philosophy']);
  await press(`levels-${id}-lycee`);
  await settle();
  expect(saved(data, id)).toMatchObject({ levels: ['cem'], subjects: [] });
});

test('saves the name once typing pauses or the field is left, without spaces around it', async () => {
  const data = await openTestData();
  await render(data);
  const [id] = openSchools();
  await type(id, '  متوسطة النجاح ');
  await settle();
  expect(saved(data, id)).toBeUndefined();
  await ReactTestRenderer.act(() => new Promise<void>((resolve) => setTimeout(resolve, NAME_PAUSE + 50)));
  await settle();
  expect(saved(data, id)?.name).toBe('متوسطة النجاح');
  await type(id, 'متوسطة الأمل');
  await leave(id);
  await settle();
  expect(saved(data, id)?.name).toBe('متوسطة الأمل');
});

test('a second school folds the first to its line, with its own levels and subjects', async () => {
  const data = await openTestData();
  const first = await fillFirst(data);
  expect(byID('setup-next').props).toMatchObject({ disabled: false });
  await press('add-school');
  const [second] = openSchools();
  expect(second).not.toBe(first);
  expect(byID(`summary-${first}`).props.accessibilityLabel).toBe('تعديل متوسطة النجاح. متوسط · اللغة العربية');
  expect(shown()).toEqual(
    expect.arrayContaining([text.setup.schoolsIntro, 'المؤسسة 2', text.setup.merged, 'متوسط · اللغة العربية']),
  );
  expect(byID('setup-next').props).toMatchObject({ disabled: true });
  await type(second, 'متوسطة الأمل');
  await press(`levels-${second}-cem`);
  await press(`subjects-${second}-arabic`);
  await press(`subjects-${second}-islamic`);
  await settle();
  expect(shown()).toEqual(
    expect.arrayContaining(['المستوى في متوسطة الأمل', 'المادة في متوسطة الأمل', text.setup.twoSubjects]),
  );
  expect(saved(data, second)).toEqual({
    id: second,
    name: 'متوسطة الأمل',
    levels: ['cem'],
    subjects: ['arabic', 'islamic'],
  });
  expect(byID('setup-next').props).toMatchObject({ disabled: false });
  await press(`summary-${first}`);
  expect(openSchools()).toEqual([first]);
  expect(exists(`summary-${second}`)).toBe(true);
  await press('setup-next');
  expect(onNext).toHaveBeenCalledTimes(1);
});

test('deleting a school erases every version of it', async () => {
  const data = await openTestData();
  const first = await fillFirst(data);
  await press('add-school');
  const [second] = openSchools();
  await press(`levels-${second}-primary`);
  await type(second, 'ابتدائية الأمل');
  await leave(second);
  await settle();
  expect(data.book.state.schools.size).toBe(2);
  await press(`delete-${second}`);
  await settle();
  expect([...data.book.state.schools.keys()]).toEqual([first]);
  expect(JSON.stringify(data.storage.rows)).not.toContain('ابتدائية الأمل');
  expect(openSchools()).toEqual([first]);
  expect(exists(`delete-${first}`)).toBe(false);
});

test('shows what was chosen before when setup opens again', async () => {
  const data = await openTestData();
  const id = await fillFirst(data);
  await ReactTestRenderer.act(() => tree.unmount());
  await render(await openTestData(data.storage));
  expect(openSchools()).toEqual([id]);
  expect(byID(`school-name-${id}`).props.value).toBe('متوسطة النجاح');
  expect(byID(`levels-${id}-cem`).findByProps({ accessibilityRole: 'checkbox' }).props.accessibilityState).toEqual({
    checked: true,
  });
});

test('says so when a change could not be saved', async () => {
  const data = await openTestData();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(data.storage, 'appendEntry').mockRejectedValue(new Error('E_DISK_FULL'));
  await render(data);
  const [id] = openSchools();
  await press(`levels-${id}-cem`);
  await settle();
  expect(shown()).toContain(text.setup.notSaved);
});

test('keeps no fixed text height or line limit, so text at 200% wraps', async () => {
  const data = await openTestData();
  await fillFirst(data);
  await press('add-school');
  for (const node of tree.root.findAllByType(Text)) {
    const props = node.props as TextProps;
    expect(props.numberOfLines).toBeUndefined();
    expect(StyleSheet.flatten(props.style) ?? {}).not.toHaveProperty('height');
  }
});

test.each(
  (Object.keys(catalogues) as Language[]).flatMap((language) =>
    (['rtl', 'ltr'] as const).map((direction) => [language, direction] as const),
  ),
)('names every control and keeps 48 dp targets with two schools (%s, %s)', async (language, direction) => {
  await i18n.changeLanguage(language);
  const data = await openTestData();
  await render(data, direction);
  expect(accessibilityProblems(tree.root)).toEqual([]);
  await press('add-school');
  expect(accessibilityProblems(tree.root)).toEqual([]);
  expect(shown()).toContain(catalogues[language].setup.merged);
});
