// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/// <reference types="node" />

// The component gallery (#20): it opens from the developer menu, shows every
// component in each interface language and both directions, and each control
// on it can be read by TalkBack and pressed with a thumb.

import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DevSettings, Text, TextInput, View } from 'react-native';
import type { PressableProps, TextInputProps, ViewProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { AppNavigator, GALLERY_MENU_ITEM } from '../src/navigation/AppNavigator';
import { TopBar } from '../src/navigation/NavigationChrome';
import { Gallery } from '../src/gallery/Gallery';
import { Button, type ButtonProps } from '../src/components/Button';
import { PageHeading, type PageHeadingProps } from '../src/components/PageHeading';
import { SectionHeader } from '../src/components/SectionHeader';
import { Notice } from '../src/components/Notice';
import { Snackbar, type SnackbarProps } from '../src/components/Snackbar';
import { CheckRow } from '../src/components/CheckRow';
import { OptionRow } from '../src/components/OptionRow';
import { entries } from '../src/gallery/entries';
import { headingTexts } from '../src/gallery/heading-texts';
import { feedbackTexts } from '../src/gallery/feedback-texts';
import { fieldTexts } from '../src/gallery/text-field-texts';
import { samples } from '../src/gallery/samples';
import { catalogues, i18n, type Language } from '../src/text/i18n';
import { accessibilityProblems } from '../jest/accessibility';
import type { FakeDevMenu } from '../jest/fake-dev-menu';
import { openTestData, withData, type TestData } from '../jest/app-data';

let navData: TestData;
beforeEach(async () => {
  navData = await openTestData();
});

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const LANGUAGES = Object.keys(catalogues) as Language[];
const ROOT = join(__dirname, '../../..');

let tree: ReactTestRenderer.ReactTestRenderer;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree.unmount());
  await i18n.changeLanguage('ar');
});

async function render(element: React.ReactElement) {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(element);
  });
  await ReactTestRenderer.act(() => {
    for (const node of tree.root.findAllByType(View)) {
      const props = node.props as ViewProps;
      if (/^snack-(short|long)-nav$/.test(props.testID ?? '')) {
        props.onLayout?.({ nativeEvent: { layout: { height: 88 } } } as never);
      }
    }
  });
}

async function press(testID: string, root = tree.root) {
  const [control] = root.findAll((node) => (node.props as PressableProps).testID === testID && !!node.props.onPress);
  expect(control).toBeDefined();
  await ReactTestRenderer.act(() => {
    (control.props as PressableProps).onPress?.({} as never);
  });
}

function backArrows(): string[] {
  return tree.root
    .findAll((node) => (node.props as ViewProps).testID === 'back-icon' && typeof node.type !== 'string')
    .map((node) => JSON.stringify((node.props as ViewProps).style));
}

test('opens from the developer menu, with its title in the interface language', async () => {
  await render(withData(navData, <AppNavigator initialRouteName="Home" direction="rtl" />));
  const open = (DevSettings as unknown as FakeDevMenu).items.get(GALLERY_MENU_ITEM);
  expect(open).toBeDefined();
  await ReactTestRenderer.act(() => {
    open?.();
  });
  expect(tree.root.findAllByType(Gallery)).toHaveLength(1);
  const headers = tree.root.findAllByType(TopBar).map((node) => (node.props as NativeStackHeaderProps).options.title);
  expect(headers[0]).toBe(samples.ar.title);
});

test.each(
  LANGUAGES.flatMap((language) => (['rtl', 'ltr'] as const).map((direction) => [language, direction] as const)),
)('shows every component, readable and large enough to press (%s, %s)', async (language, direction) => {
  await i18n.changeLanguage(language);
  await render(<Gallery />);
  await press(`gallery-${direction}`);
  for (const entry of entries)
    expect(tree.root.findAllByProps({ testID: `gallery-entry-${entry.name}` })).not.toEqual([]);
  expect(accessibilityProblems(tree.root)).toEqual([]);
  expect(tree.root.findAllByType(CheckRow)).toHaveLength(5);
  expect(tree.root.findAllByType(OptionRow)).toHaveLength(5);
  expect(tree.root.findAllByType(PageHeading).map((node) => (node.props as PageHeadingProps).title)).toEqual([
    headingTexts[language].day,
    samples[language].longHeading,
    samples[language].tabs[1],
  ]);
  expect(tree.root.findAllByType(SectionHeader)).toHaveLength(5);
  expect(tree.root.findAllByType(Notice)).toHaveLength(3);
  expect(tree.root.findAllByType(Snackbar)).toHaveLength(2);
  expect(tree.root.findAllByType(Snackbar).map((node) => (node.props as SnackbarProps).message)).toEqual([
    feedbackTexts[language].confirmation,
    feedbackTexts[language].longConfirmation,
  ]);
  const inputs = tree.root.findAllByType(TextInput).map((node) => node.props as TextInputProps);
  expect(inputs).toHaveLength(9);
  expect(new Set(inputs.map((input) => input.accessibilityLabelledBy)).size).toBe(9);
  expect(inputs.find((input) => input.testID === 'field-code')?.value).toBe(fieldTexts[language].codeValue);
  const rotation = direction === 'rtl' ? '135deg' : '225deg';
  expect(backArrows()).toHaveLength(2);
  expect(backArrows().filter((style) => !style.includes(rotation))).toEqual([]);
});

test('selects a tab in the bottom bar sample as the app does', async () => {
  await render(<Gallery />);
  const selected = () =>
    tree.root
      .findByProps({ testID: 'gallery-entry-BottomNav' })
      .findAll((node) => (node.props as PressableProps).accessibilityRole === 'tab' && !!node.props.onPress)
      .map((node) => (node.props as PressableProps).accessibilityState?.selected)
      .slice(0, 3);
  expect(selected()).toEqual([true, false, false]);
  await press('tab-Classes', tree.root.findByProps({ testID: 'gallery-entry-BottomNav' }));
  expect(selected()).toEqual([false, true, false]);
});

test.each([
  ['ar', ['حفظ', 'تعديل', 'المناداة', 'تراجع', 'حذف', 'إضافة']],
  ['fr', ['Enregistrer', 'Modifier', 'Appel', 'Annuler', 'Supprimer', 'Ajouter']],
  ['en', ['Save', 'Edit', 'Roll call', 'Cancel', 'Delete', 'Add']],
] as const)('uses concise action labels rather than lesson descriptions (%s)', async (language, labels) => {
  await i18n.changeLanguage(language);
  await render(<Gallery />);
  const weights = labels.slice(0, 5);
  const entry = tree.root.findByProps({ testID: 'gallery-entry-Button' });
  expect(entry.findAllByType(Button).map((node) => (node.props as ButtonProps).label)).toEqual([
    ...weights,
    ...weights,
    labels[5],
  ]);
});

test('heading actions remain reachable and change only their own synthetic gallery counter', async () => {
  await render(<Gallery />);
  const counter = (name: string) =>
    tree.root
      .findByProps({ testID: `gallery-entry-${name}` })
      .findAllByType(Text)
      .find((node) => node.props.accessibilityLiveRegion === 'polite')?.props.children as string;
  await press('heading-settings');
  await press('heading-add');
  expect(counter('PageHeading')).toBe(samples.ar.activations.replace('{{count}}', '2'));
  expect(counter('SectionHeader')).toBe(samples.ar.activations.replace('{{count}}', '0'));
  await press('section-edit');
  expect(counter('SectionHeader')).toBe(samples.ar.activations.replace('{{count}}', '1'));
  expect(counter('PageHeading')).toBe(samples.ar.activations.replace('{{count}}', '2'));
});

test('Undo changes only the feedback preview and its confirmation can be shown again', async () => {
  await render(<Gallery />);
  const short = tree.root.findAllByType(Snackbar).find((node) => node.props.testID === 'snack-short')!;
  expect(short.props.bottomOffset).toBe(88);
  const undo = short.findAll((node) => node.props.accessibilityRole === 'button' && !!node.props.onPress)[0];
  await ReactTestRenderer.act(() => {
    (undo.props as PressableProps).onPress?.({} as never);
  });
  expect(tree.root.findAllByType(Snackbar)).toHaveLength(1);
  expect(tree.root.findAllByType(Text).some((node) => node.props.children === feedbackTexts.ar.undone)).toBe(true);
  await press('snack-short-show');
  expect(tree.root.findAllByType(Snackbar)).toHaveLength(2);
  const nav = tree.root.findAllByType(View).find((node) => node.props.testID === 'snack-short-nav')!;
  await ReactTestRenderer.act(() => {
    (nav.props as ViewProps).onLayout?.({ nativeEvent: { layout: { height: 112 } } } as never);
  });
  expect(
    tree.root.findAllByType(Snackbar).find((node) => node.props.testID === 'snack-short')?.props.bottomOffset,
  ).toBe(112);
});

test('editing a gallery field changes only its transient value', async () => {
  await render(<Gallery />);
  const field = () =>
    tree.root.findAllByType(TextInput).find((node) => node.props.testID === 'field-empty')!.props as TextInputProps;
  await ReactTestRenderer.act(() => {
    field().onChangeText?.(fieldTexts.ar.value);
  });
  expect(field().value).toBe(fieldTexts.ar.value);
  await press('gallery-ltr');
  expect(field().value).toBe(fieldTexts.ar.value);
});

test('links each entry to its page in the design system', () => {
  for (const entry of entries) {
    expect([entry.name, existsSync(join(ROOT, entry.design))]).toEqual([entry.name, true]);
    expect(entry.design).toBe(`docs/design/system/components/${entry.name}/README.md`);
  }
});

test('has an entry for every component in src/components', () => {
  const folder = join(__dirname, '../src/components');
  const components = existsSync(folder)
    ? readdirSync(folder)
        .filter((file) => file.endsWith('.tsx'))
        .map((file) => file.replace(/\.tsx$/, ''))
    : [];
  const names = entries.map((entry) => entry.name);
  expect(components.filter((component) => !names.includes(component))).toEqual([]);
});

test('catches a control TalkBack cannot name, or too small to press', async () => {
  const { Pressable, View } = jest.requireActual<typeof import('react-native')>('react-native');
  await render(
    <View>
      <Pressable testID="tiny" accessibilityRole="button" onPress={() => undefined} style={{ width: 20, height: 20 }} />
    </View>,
  );
  expect(accessibilityProblems(tree.root)).toEqual([
    'tiny: nothing for TalkBack to read',
    'tiny: smaller than 48dp (20×20)',
  ]);
});

test.each(['button', 'checkbox', 'radio', 'tab', 'switch'] as const)(
  'checks an inactive %s even without an onPress handler',
  async (role) => {
    const { Pressable } = jest.requireActual<typeof import('react-native')>('react-native');
    await render(
      <Pressable
        testID="inactive"
        disabled
        accessibilityRole={role}
        accessibilityState={{ disabled: true }}
        style={{ width: 20, height: 20 }}
      />,
    );
    expect(accessibilityProblems(tree.root)).toEqual([
      'inactive: nothing for TalkBack to read',
      'inactive: smaller than 48dp (20×20)',
    ]);
  },
);

test('checks a control that holds another, and the one it holds', async () => {
  const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');
  await render(
    <Pressable testID="card" onPress={() => undefined} style={{ height: 20 }}>
      <Text>Card</Text>
      <Pressable testID="inner" onPress={() => undefined} style={{ width: 20, height: 48 }} />
    </Pressable>,
  );
  expect(accessibilityProblems(tree.root)).toEqual([
    'Card: no accessibilityRole',
    'Card: smaller than 48dp (0×20)',
    'inner: no accessibilityRole',
    'inner: nothing for TalkBack to read',
    'inner: smaller than 48dp (20×48)',
  ]);
});
