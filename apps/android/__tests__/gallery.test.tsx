// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/// <reference types="node" />

// The component gallery (#20): it opens from the developer menu, shows every
// component in each interface language and both directions, and each control
// on it can be read by TalkBack and pressed with a thumb.

import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DevSettings } from 'react-native';
import type { PressableProps, ViewProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { AppNavigator, GALLERY_MENU_ITEM } from '../src/navigation/AppNavigator';
import { TopBar } from '../src/navigation/NavigationChrome';
import { Gallery } from '../src/gallery/Gallery';
import { Button, type ButtonProps } from '../src/components/Button';
import { entries } from '../src/gallery/entries';
import { samples } from '../src/gallery/samples';
import { catalogues, i18n, type Language } from '../src/text/i18n';
import { accessibilityProblems } from '../jest/accessibility';
import type { FakeDevMenu } from '../jest/fake-dev-menu';

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
}

async function press(testID: string) {
  const [control] = tree.root.findAll(
    (node) => (node.props as PressableProps).testID === testID && !!node.props.onPress,
  );
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
  await render(<AppNavigator direction="rtl" />);
  const open = (DevSettings as unknown as FakeDevMenu).items.get(GALLERY_MENU_ITEM);
  expect(open).toBeDefined();
  await ReactTestRenderer.act(() => {
    open?.();
  });
  expect(tree.root.findAllByType(Gallery)).toHaveLength(1);
  const headers = tree.root.findAllByType(TopBar).map((node) => (node.props as NativeStackHeaderProps).options.title);
  expect(headers[0]).toBe(samples.ar.title);
});

test.each(LANGUAGES.flatMap((language) => (['rtl', 'ltr'] as const).map((direction) => [language, direction])))(
  'shows every component, readable and large enough to press (%s, %s)',
  async (language, direction) => {
    await i18n.changeLanguage(language);
    await render(<Gallery />);
    await press(`gallery-${direction}`);
    for (const entry of entries)
      expect(tree.root.findAllByProps({ testID: `gallery-entry-${entry.name}` })).not.toEqual([]);
    expect(accessibilityProblems(tree.root)).toEqual([]);
    const rotation = direction === 'rtl' ? '135deg' : '225deg';
    expect(backArrows()).toHaveLength(2);
    expect(backArrows().filter((style) => !style.includes(rotation))).toEqual([]);
  },
);

test('selects a tab in the bottom bar sample as the app does', async () => {
  await render(<Gallery />);
  const selected = () =>
    tree.root
      .findAll((node) => (node.props as PressableProps).accessibilityRole === 'tab' && !!node.props.onPress)
      .map((node) => (node.props as PressableProps).accessibilityState?.selected)
      .slice(0, 3);
  expect(selected()).toEqual([true, false, false]);
  await press('tab-Classes');
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
  expect(tree.root.findAllByType(Button).map((node) => (node.props as ButtonProps).label)).toEqual([
    ...weights,
    ...weights,
    labels[5],
  ]);
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

test('checks an inactive button even without an onPress handler', async () => {
  const { Pressable } = jest.requireActual<typeof import('react-native')>('react-native');
  await render(
    <Pressable
      testID="inactive"
      disabled
      accessibilityRole="button"
      accessibilityState={{ disabled: true }}
      style={{ width: 20, height: 20 }}
    />,
  );
  expect(accessibilityProblems(tree.root)).toEqual([
    'inactive: nothing for TalkBack to read',
    'inactive: smaller than 48dp (20×20)',
  ]);
});

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
