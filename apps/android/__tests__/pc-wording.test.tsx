// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The PC's words (#250, answers 506 and 509): on a PC the transfer and
// restore screens read their PC wording, naming this PC and the phone, with
// no scan button, no Send and no line about screenshots; the phone keeps
// its own. Every PC text sits beside the phone's text it replaces, in all
// three languages, and none speaks of this phone; a PC text missing in the
// interface's language gives that language's phone text, never another
// language's. Made-up records only.

import { Platform, Text } from 'react-native';
import { openTestData } from '../jest/app-data';
import { mount, root, settle, texts, unmount } from '../jest/components-screen';
import { FakeStorage } from '../jest/fake-storage';
import { withPupils } from '../jest/roll-class';
import { Restore } from '../src/restore/Restore';
import { Transfer } from '../src/settings/Transfer';
import { pcKey, useDeviceText } from '../src/text/device-text';
import { catalogues, i18n, missingKeys } from '../src/text/i18n';
import ReactTestRenderer from 'react-test-renderer';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

/** «هذا الهاتف», and «صور الشاشة» for screenshots. */
const THIS_PHONE = '\u0647\u0630\u0627 \u0627\u0644\u0647\u0627\u062a\u0641';
const SCREENSHOTS = '\u0635\u0648\u0631 \u0627\u0644\u0634\u0627\u0634\u0629';

const has = (testID: string) => root().findAll((node) => node.props.testID === testID).length > 0;

/** Every text of a catalogue, by its full key. */
function flat(value: unknown, path: string[] = []): [string, string][] {
  if (typeof value === 'string') return [[path.join('.'), value]];
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value).flatMap(([key, inner]) => flat(inner, [...path, key]));
}

beforeEach(() => {
  missingKeys.length = 0;
});
afterEach(async () => {
  await unmount();
  await i18n.changeLanguage('ar');
  jest.restoreAllMocks();
});

test('puts pc before the last part of a key', () => {
  expect(pcKey('settings.transfer.sub')).toBe('settings.transfer.pc.sub');
  expect(pcKey('settings.restore.problems.too-large')).toBe('settings.restore.problems.pc.too-large');
  expect(pcKey('name')).toBe('pc.name');
});

test('keeps each PC text beside the text it replaces, in every language, never saying this phone', () => {
  const keys = (language: keyof typeof catalogues) => flat(catalogues[language]).map(([key]) => key);
  const pcKeys = keys('en').filter((key) => key.split('.').includes('pc'));
  expect(pcKeys.length).toBeGreaterThan(30);
  for (const language of ['ar', 'fr'] as const) {
    expect(keys(language).filter((key) => key.split('.').includes('pc'))).toEqual(pcKeys);
  }
  const all = new Set(keys('en'));
  for (const key of pcKeys) expect([key, all.has(key.replace('.pc.', '.').replace(/^pc\./u, ''))]).toEqual([key, true]);
  const phone = new RegExp(`this phone|ce téléphone|${THIS_PHONE}|screenshot|capture|${SCREENSHOTS}`, 'iu');
  for (const language of ['ar', 'fr', 'en'] as const) {
    const said = flat(catalogues[language]).filter(([key, text]) => key.split('.').includes('pc') && phone.test(text));
    expect(said).toEqual([]);
  }
});

describe('on a PC', () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'web');
  });

  test('the transfer names this PC and the phone, offers Save alone, and says nothing of screenshots', async () => {
    await i18n.changeLanguage('en');
    await mount(await withPupils(), <Transfer storage={FakeStorage.unlocked().asSpec()} />);
    await ReactTestRenderer.act(settle);
    expect(texts()).toEqual(
      expect.arrayContaining([
        'From this PC to your phone',
        'The code is kept nowhere and sent to no server.',
        'On this PC or a USB key, then to your phone by cable or USB key.',
      ]),
    );
    expect(texts().filter((text) => /this phone|new phone|Screenshots|Quick Share/u.test(text))).toEqual([]);
    expect(has('transfer-qr')).toBe(true);
    expect(has('transfer-share')).toBe(false);
    expect(missingKeys).toEqual([]);
  });

  test("a PC text missing in the interface's language gives that language's phone text", async () => {
    i18n.addResourceBundle('ar', 'pcTest', { a: { line: 'phone ar', pc: { line: 'pc ar' } } });
    i18n.addResourceBundle('en', 'pcTest', { a: { line: 'phone en' } });
    try {
      await i18n.changeLanguage('en');
      const Line = () => <Text>{(useDeviceText() as unknown as (key: string) => string)('pcTest:a.line')}</Text>;
      await mount(await withPupils(), <Line />);
      expect(texts()).toEqual(['phone en']);
      await unmount();
      await i18n.changeLanguage('ar');
      await mount(await withPupils(), <Line />);
      expect(texts()).toEqual(['pc ar']);
    } finally {
      i18n.removeResourceBundle('ar', 'pcTest');
      i18n.removeResourceBundle('en', 'pcTest');
    }
  });

  test('the restore takes a typed code, with no scan button or camera line', async () => {
    await i18n.changeLanguage('en');
    const storage = FakeStorage.unlocked();
    await mount(await openTestData(storage), <Restore storage={storage.asSpec()} onRestored={jest.fn()} />);
    expect(texts()).toEqual(
      expect.arrayContaining(['From your phone or a backup', 'The phone in hand', 'The code shown on the phone']),
    );
    expect(has('restore-scan')).toBe(false);
    expect(texts().filter((text) => /this phone|old phone|camera|[Ss]can/u.test(text))).toEqual([]);
    expect(missingKeys).toEqual([]);
  });
});

test('on a phone, the transfer and restore keep their words and the scan button', async () => {
  const storage = FakeStorage.unlocked();
  await mount(await openTestData(storage), <Restore storage={storage.asSpec()} onRestored={jest.fn()} />);
  expect(has('restore-scan')).toBe(true);
  expect(texts()).toContain(
    '\u0627\u0644\u0647\u0627\u062a\u0641 \u0627\u0644\u0642\u062f\u064a\u0645 \u0641\u064a \u0627\u0644\u064a\u062f',
  );
  await unmount();
  await mount(await withPupils(), <Transfer storage={FakeStorage.unlocked().asSpec()} />);
  await ReactTestRenderer.act(settle);
  expect(texts()).toContain(
    `\u0645\u0646 ${THIS_PHONE} \u0625\u0644\u0649 \u0647\u0627\u062a\u0641 \u062c\u062f\u064a\u062f`,
  );
});
