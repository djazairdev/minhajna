// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Every text a screen shows, or reads out to TalkBack, must come from the
// catalogue of the interface's language (#21). The screens are rendered in
// each state the app has and in each language, and anything shown that no
// entry of that language produces fails the test, an Arabic fallback included.

import i18next from 'i18next';
import type { ReactElement } from 'react';
import { Text } from 'react-native';
import type { PressableProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { AppNavigator } from '../src/navigation/AppNavigator';
import { Welcome } from '../src/navigation/Welcome';
import { catalogues, currentLanguage, i18n, missingKeys, type Language } from '../src/text/i18n';
import { installPluralRules } from '../src/text/plural-rules';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const LANGUAGES = Object.keys(catalogues) as Language[];
const COUNTS = [0, 1, 2, 3, 11, 100];
const SESSIONS = ['لا حصة', 'حصة واحدة', 'حصتان', '3 حصص', '11 حصة', '100 حصة'];

/** Every entry of a catalogue, with its nested keys joined by dots. */
function entries(catalogue: object, prefix = ''): [string, string][] {
  return Object.entries(catalogue).flatMap(([key, value]): [string, string][] =>
    typeof value === 'string' ? [[prefix + key, value]] : entries(value as object, `${prefix}${key}.`),
  );
}

/** A key without its plural suffix, so that languages with different plural forms compare. */
function base(key: string): string {
  return key.replace(/_(zero|one|two|few|many|other)$/, '');
}

function placeholders(value: string): string[] {
  return [...value.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]).sort();
}

/** Whether a shown text is one some entry of the language produces, with any {{placeholder}} filled. */
function inCatalogue(shown: string, language: Language): boolean {
  return entries(catalogues[language]).some(([, value]) => {
    const pattern = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{\\\{\w+\\\}\\\}/g, '.+');
    return new RegExp(`^${pattern}$`, 'su').test(shown);
  });
}

/** The texts on screen and the labels TalkBack reads that no entry produces. */
function notInCatalogue(tree: ReactTestRenderer.ReactTestRenderer): string[] {
  const shown = tree.root.findAllByType(Text).map((node) => [node.props.children as unknown].flat().join(''));
  const labels = tree.root
    .findAll((node) => typeof (node.props as { accessibilityLabel?: unknown }).accessibilityLabel === 'string')
    .map((node) => (node.props as { accessibilityLabel: string }).accessibilityLabel);
  return [...new Set([...shown, ...labels])].filter((text) => !inCatalogue(text, currentLanguage()));
}

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

async function render(element: ReactElement): Promise<ReactTestRenderer.ReactTestRenderer> {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(element);
  });
  mounted.push(tree!);
  return tree!;
}

async function press(tree: ReactTestRenderer.ReactTestRenderer, match: (props: PressableProps) => boolean) {
  const [node] = tree.root.findAll(
    (candidate) => typeof (candidate.props as PressableProps).onPress === 'function' && match(candidate.props),
  );
  expect(node).toBeDefined();
  await ReactTestRenderer.act(() => {
    (node.props as PressableProps).onPress?.({} as never);
  });
}

beforeEach(() => {
  missingKeys.length = 0;
});

afterEach(async () => {
  for (const tree of mounted.splice(0)) await ReactTestRenderer.act(() => tree.unmount());
  await i18n.changeLanguage('ar');
});

async function speak(language: Language) {
  await ReactTestRenderer.act(async () => {
    await i18n.changeLanguage(language);
  });
}

test('counts sessions in all six Arabic plural forms, with Western digits', () => {
  expect(COUNTS.map((count) => i18n.t('count.sessions', { count }))).toEqual(SESSIONS);
  expect(SESSIONS.join('')).not.toMatch(/[٠-٩]/);
});

test('counts sessions the same way on Hermes, which has no Intl.PluralRules', async () => {
  const engine = Intl.PluralRules;
  Reflect.deleteProperty(Intl, 'PluralRules');
  try {
    installPluralRules();
    const hermes = i18next.createInstance();
    await hermes.init({ lng: 'ar', resources: { ar: { translation: catalogues.ar } }, initAsync: false });
    expect(COUNTS.map((count) => hermes.t('count.sessions', { count }))).toEqual(SESSIONS);
  } finally {
    Object.defineProperty(Intl, 'PluralRules', { value: engine, writable: true, configurable: true });
  }
});

test.each(['ar', 'ar-DZ'])('picks the CLDR form for every count in the comparison (%s)', (lng) => {
  const forms = {
    'لا حصة': [0],
    'حصة واحدة': [1],
    حصتان: [2],
    '{{count}} حصص': [3, 10, 103, 110, 203],
    '{{count}} حصة': [11, 99, 111, 199, 100, 101, 102, 200],
  };
  for (const [form, counts] of Object.entries(forms)) {
    for (const count of counts) {
      expect(i18n.t('count.sessions', { count, lng })).toBe(form.replace('{{count}}', String(count)));
    }
  }
});

test('counts sessions in French and English, with no plural form missing', () => {
  expect([0, 1, 2, 3, 1_000_000].map((count) => i18n.t('count.sessions', { count, lng: 'fr' }))).toEqual([
    'Aucune séance',
    '1 séance',
    '2 séances',
    '3 séances',
    '1000000 de séances',
  ]);
  expect([0, 1, 2, 11].map((count) => i18n.t('count.sessions', { count, lng: 'en' }))).toEqual([
    'No session',
    '1 session',
    '2 sessions',
    '11 sessions',
  ]);
});

test.each(LANGUAGES)('has every text of the Arabic catalogue, with the same placeholders (%s)', (language) => {
  const arabic = new Map<string, string[]>();
  for (const [key, value] of entries(catalogues.ar)) arabic.set(base(key), placeholders(value));
  const translated = new Map<string, string[]>();
  for (const [key, value] of entries(catalogues[language])) translated.set(base(key), placeholders(value));
  expect([...translated.keys()].sort()).toEqual([...arabic.keys()].sort());
  for (const [key, found] of translated) expect([key, found]).toEqual([key, arabic.get(key)]);
});

test.each(LANGUAGES)('gives every counted text each plural form of its language (%s)', (language) => {
  const forms: string[] = new Intl.PluralRules(language).resolvedOptions().pluralCategories;
  const counted = new Map<string, string[]>();
  for (const [key] of entries(catalogues[language])) {
    const match = /^(.+)_(zero|one|two|few|many|other)$/.exec(key);
    if (match) counted.set(match[1], [...(counted.get(match[1]) ?? []), match[2]]);
  }
  expect(counted.size).toBeGreaterThan(0);
  for (const [key, found] of counted) {
    expect([key, forms.filter((form) => !found.includes(form))]).toEqual([key, []]);
    expect([key, found.filter((form) => form !== 'zero' && !forms.includes(form))]).toEqual([key, []]);
  }
});

test.each(LANGUAGES)('has no empty text (%s)', (language) => {
  expect(entries(catalogues[language]).filter(([, value]) => value.trim() === '')).toEqual([]);
});

test.each(LANGUAGES)('shows only catalogue texts on the welcome page, refusals included (%s)', async (language) => {
  await speak(language);
  const tree = await render(<Welcome standalone referenceRefused historyRefused />);
  expect(notInCatalogue(tree)).toEqual([]);
  expect(missingKeys).toEqual([]);
});

test.each(LANGUAGES)('shows only catalogue texts on every tab and on the inner screen (%s)', async (language) => {
  await speak(language);
  const tree = await render(<AppNavigator direction={language === 'ar' ? 'rtl' : 'ltr'} />);
  for (const tab of ['Today', 'Classes', 'Documents']) {
    await press(tree, (props) => props.testID === `tab-${tab}`);
    expect(notInCatalogue(tree)).toEqual([]);
  }
  await press(tree, (props) => props.accessibilityRole === 'button');
  expect(notInCatalogue(tree)).toEqual([]);
  expect(missingKeys).toEqual([]);
});

test('catches a text written into a screen', async () => {
  const tree = await render(<Text>{'غير موجود في الفهرس'}</Text>);
  expect(notInCatalogue(tree)).toEqual(['غير موجود في الفهرس']);
});

/** TypeScript refuses a key the catalogue lacks; one from outside TypeScript is still caught at run time. */
test('records a key the catalogue lacks', () => {
  const untyped = i18n.t.bind(i18n) as (key: string) => string;
  expect(untyped('navigation.nowhere')).toBe('navigation.nowhere');
  expect(missingKeys).toEqual(['navigation.nowhere']);
});
