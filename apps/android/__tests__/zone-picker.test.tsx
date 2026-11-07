// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The wilaya picker (#25), now the Ministry calendar's (setup chooses the
// wilaya from the directory's list, answer 804): the search, the list it
// opens, and the wilaya chosen. Made-up zones only.

import type { Zone } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Modal, Text, TextInput } from 'react-native';
import type { ModalProps, PressableProps, TextInputProps } from 'react-native';
import ReactTestRenderer, { type ReactTestInstance } from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { useState } from 'react';
import { ZonePicker } from '../src/setup/ZonePicker';
import { fold, zoneMatches } from '../src/setup/zone-search';
import { catalogues, i18n, type Language } from '../src/text/i18n';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const zones: Zone[] = [
  { code: '07', name: { ar: 'منطقة الواحة', fr: 'Zone de l’Oasis', en: 'Oasis zone' } },
  { code: '16', name: { ar: 'منطقة الأمل', fr: 'Zone de l’Espoir', en: 'Hope zone' } },
  { code: '19', name: { ar: 'منطقة سطيفة', fr: 'Zone de Sétifa', en: 'Setifa zone' } },
];

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const root = () => tree!.root;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  await i18n.changeLanguage('ar');
});

const chosen: string[] = [];

function Holder() {
  const [value, setValue] = useState<string | undefined>(undefined);
  return (
    <ZonePicker
      testID="zone-s"
      zones={zones}
      value={value}
      onChange={(code) => {
        chosen.push(code);
        setValue(code);
      }}
    />
  );
}

async function render(direction: 'rtl' | 'ltr' = 'rtl') {
  chosen.length = 0;
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={direction}>
        <Holder />
      </LocaleDirContext.Provider>,
    );
  });
}

const settle = () => ReactTestRenderer.act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

/** The first node with this test ID that can be pressed. */
function control(id: string): ReactTestInstance {
  const [node] = root().findAll(
    (candidate) => candidate.props.testID === id && typeof candidate.props.onPress === 'function',
    { deep: false },
  );
  if (node === undefined) throw new Error(`Nothing to press has the test ID ${id}`);
  return node;
}

/** The text input inside the field with this test ID. */
const input = (id: string) =>
  root()
    .find((node) => node.props.testID === id)
    .findByType(TextInput).props as TextInputProps;

/** The field itself, rather than the picker that carries the same test ID. */
const field = (id: string) =>
  root().find((node) => node.props.testID === `zone-${id}` && node.props.accessibilityRole === 'button');

async function press(id: string) {
  await ReactTestRenderer.act(() => {
    (control(id).props as PressableProps).onPress?.({} as never);
  });
}

const isOpen = () => (root().findByType(Modal).props as ModalProps).visible === true;
const rows = (id: string) =>
  root()
    .findAll((node) => typeof node.props.testID === 'string' && /^zone-.+-\d+$/.test(node.props.testID), {
      deep: false,
    })
    .map((node) => String(node.props.testID).slice(`zone-${id}-`.length));

async function search(id: string, query: string) {
  await ReactTestRenderer.act(() => {
    input(`zone-${id}-search`).onChangeText?.(query);
  });
}

test('folds short vowels, letter variants, accents and apostrophes before matching', () => {
  expect(fold('الشلَف')).toBe('الشلف');
  expect(fold('أدرار')).toBe(fold('ادرار'));
  expect(fold('Sétif')).toBe('setif');
  expect(fold('Zone de l’Oasis')).toBe('zone de l oasis');
  expect(zoneMatches(zones[2], 'setif')).toBe(true);
  expect(zoneMatches(zones[1], 'الامل')).toBe(true);
  expect(zoneMatches(zones[0], '7')).toBe(true);
  expect(zoneMatches(zones[0], '07')).toBe(true);
  expect(zoneMatches(zones[1], '1')).toBe(true);
  expect(zoneMatches(zones[0], '1')).toBe(false);
  expect(zoneMatches(zones[0], '  ')).toBe(true);
});

test('opens the list, finds a wilaya by name or number, and gives the one chosen', async () => {
  await render();
  const id = 's';
  expect(field(id).props.accessibilityLabel).toBe(`${text.setup.zone}: ${text.setup.zoneChoose}`);
  expect(isOpen()).toBe(false);
  await press(`zone-${id}`);
  expect(isOpen()).toBe(true);
  expect(rows(id)).toEqual(['07', '16', '19']);
  await search(id, 'سطيفة');
  expect(rows(id)).toEqual(['19']);
  await search(id, '16');
  expect(rows(id)).toEqual(['16']);
  await search(id, 'لا شيء');
  expect(rows(id)).toEqual([]);
  expect(
    root()
      .findAllByType(Text)
      .map((node) => node.props.children as unknown),
  ).toContain(text.setup.zoneNone);
  await search(id, '');
  await press(`zone-${id}-16`);
  await settle();
  expect(isOpen()).toBe(false);
  expect(chosen).toEqual(['16']);
  expect(field(id).props.accessibilityLabel).toBe(`${text.setup.zone}: 16 · منطقة الأمل`);
});

test('closes unchanged, and a new search starts empty', async () => {
  await render();
  const id = 's';
  await press(`zone-${id}`);
  await search(id, '19');
  await press(`zone-${id}-close`);
  await settle();
  expect(isOpen()).toBe(false);
  expect(chosen).toEqual([]);
  await press(`zone-${id}`);
  expect(rows(id)).toEqual(['07', '16', '19']);
});

test.each(
  (Object.keys(catalogues) as Language[]).flatMap((language) =>
    (['rtl', 'ltr'] as const).map((direction) => [language, direction] as const),
  ),
)('names the field, the search and every wilaya, 48 dp each (%s, %s)', async (language, direction) => {
  await i18n.changeLanguage(language);
  await render(direction);
  await press('zone-s');
  expect(accessibilityProblems(root())).toEqual([]);
});
