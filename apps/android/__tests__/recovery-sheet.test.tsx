// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «ورقة الاسترجاع» (#247, Recovery-sheet, answer 478): a first sheet with a new
// key in six numbered groups, read group by group; the printed page with the
// key and no name; the key kept only once typed back, as typed, and a wrong one
// refused; the key kept shown again with no check, and a new key that erases
// the earlier one's content once confirmed, and keeps it when the new one fails
// to save; no keyboard suggestions; one confirmation for two quick taps; the
// guard that refuses screenshots; and every text in French and English.

import { deviceFacts, readRecoveryKey } from '@minhajna/core';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import type { TestData } from '../jest/app-data';
import { DAY, mount, press, root, settle, texts, unmount } from '../jest/components-screen';
import { withPupils } from '../jest/roll-class';
import { LockStorage } from '../src/lock/lock-storage';
import { screenKind } from '../src/lock/screen-guard';
import { SettingsRecoveryScreen } from '../src/navigation/SettingsScreens';
import pdf from '../src/native/NativeMinhajnaPdf';
import { RecoverySheet } from '../src/settings/RecoverySheet';
import { i18n, missingKeys } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const KEY = ['K7QF', '3M9T', 'WX2R', '8HDN', 'P4VC', '6JYE'].join('');
const printHtml = jest.spyOn(pdf, 'printHtml');

beforeEach(() => {
  missingKeys.length = 0;
});
afterEach(async () => {
  await unmount();
  await i18n.changeLanguage('ar');
  jest.clearAllMocks();
});

async function screen(data: TestData, first: boolean) {
  const onConfirmed = jest.fn();
  await mount(data, <RecoverySheet storage={data.storage.asSpec()} first={first} onConfirmed={onConfirmed} />);
  return onConfirmed;
}

/** The key the sheet shows, from its groups' spoken labels. */
const shown = () =>
  root()
    .findAll(
      (node) =>
        typeof node.type === 'string' &&
        typeof node.props.accessibilityLabel === 'string' &&
        node.props.accessible === true,
    )
    .map((node) => String(node.props.accessibilityLabel))
    .filter((label) => label.startsWith('المجموعة'))
    .map((label) => label.split(': ')[1].replace(/ /g, ''))
    .join('');

async function type(text: string) {
  await ReactTestRenderer.act(async () => {
    const [field] = root().findAll(
      (node) => node.props.testID === 'recovery-typed' && typeof node.props.onChangeText === 'function',
    );
    (field?.props as { onChangeText: (value: string) => void }).onChangeText(text);
    await settle();
  });
}

test('gives a new key in six groups, and keeps it only once typed back', async () => {
  const data = await withPupils();
  const onConfirmed = await screen(data, true);
  expect(accessibilityProblems(root())).toEqual([]);
  const key = shown();
  expect(readRecoveryKey(key)).toBe(key);
  expect(texts()).toEqual(
    expect.arrayContaining([
      'هذا مفتاح الاسترجاع. يعيد البيانات على جهاز جديد إن ضاع الهاتف، ويفتح النسخ الاحتياطية.',
      'طُبعت أو كُتبت: التأكد منها',
      'تُمنع صور الشاشة هنا. ولا يُرسل المفتاح إلى أي خادم.',
    ]),
  );
  expect(texts().filter((text) => /^[0-9A-Z]{4}$/.test(text))).toHaveLength(6);
  await press('recovery-print');
  expect(printHtml).toHaveBeenCalledTimes(1);
  const [html, title, landscape] = printHtml.mock.calls[0];
  expect([title, landscape]).toEqual(['ورقة الاسترجاع', false]);
  expect(html).toContain(key);
  expect(html).toContain(key.slice(0, 4));
  expect(html.match(/<tr>/g)).toHaveLength(4);
  expect(html.match(/class="g"/g)).toHaveLength(6);
  expect(html).toContain('\u20687-Zip\u2069');
  expect(html).not.toContain('4م1');
  await type(`${key.slice(0, 23)}${key.endsWith('X') ? 'Y' : 'X'}`);
  await press('recovery-confirm');
  expect(texts().join(' ')).toContain('لا يطابق ما كُتب المفتاح. تُراجع الورقة ويُكتب من جديد.');
  expect(onConfirmed).not.toHaveBeenCalled();
  expect(deviceFacts(data.book.entries).recovery).toBeNull();
  await type(key.toLowerCase().replace(/(.{4})/g, '$1 '));
  await press('recovery-confirm');
  await ReactTestRenderer.act(settle);
  expect(onConfirmed).toHaveBeenCalledTimes(1);
  expect(deviceFacts(data.book.entries).recovery).toEqual({ key, day: DAY });
});

test('shows the key kept with no check, and a new key erases the earlier one once confirmed', async () => {
  const data = await withPupils();
  await data.book.record(DAY, { kind: 'recovery.set', recovery: { key: KEY } });
  const onConfirmed = await screen(data, false);
  expect(shown()).toBe(KEY);
  expect(root().findAll((node) => node.props.testID === 'recovery-check')).toHaveLength(0);
  await press('recovery-new-key');
  const fresh = shown();
  expect(fresh).not.toBe(KEY);
  await type(fresh);
  await press('recovery-confirm');
  await ReactTestRenderer.act(settle);
  expect(onConfirmed).toHaveBeenCalledTimes(1);
  const facts = deviceFacts(data.book.entries);
  expect(facts.recovery?.key).toBe(fresh);
  expect(facts.earlierKeys).toEqual([]);
  expect(JSON.stringify(data.book.entries)).not.toContain(KEY);
});

test('a failed save keeps the earlier key and the sheet, and two quick taps confirm once', async () => {
  const data = await withPupils();
  await data.book.record(DAY, { kind: 'recovery.set', recovery: { key: KEY } });
  const onConfirmed = await screen(data, false);
  await press('recovery-new-key');
  const fresh = shown();
  const field = root().findAll(
    (node) => node.props.testID === 'recovery-typed' && typeof node.props.keyboardType === 'string',
  )[0];
  expect(field?.props.keyboardType).toBe('visible-password');
  jest.spyOn(data.book, 'record').mockRejectedValueOnce(new Error('Synthetic failure'));
  await type(fresh);
  await press('recovery-confirm');
  await ReactTestRenderer.act(settle);
  expect(onConfirmed).not.toHaveBeenCalled();
  expect(texts()).toContain('لم تُحفظ الورقة. أعد المحاولة.');
  expect(deviceFacts(data.book.entries).recovery?.key).toBe(KEY);
  await ReactTestRenderer.act(async () => {
    const onPress = (
      root().findAll((node) => node.props.testID === 'recovery-confirm' && typeof node.props.onPress === 'function')[0]
        ?.props as { onPress: () => void }
    ).onPress;
    onPress();
    onPress();
    await settle();
  });
  await ReactTestRenderer.act(settle);
  expect(onConfirmed).toHaveBeenCalledTimes(1);
  expect(data.book.entries.filter((entry) => entry.kind === 'recovery.set' && entry.content !== null)).toHaveLength(1);
  expect(deviceFacts(data.book.entries).recovery?.key).toBe(fresh);
});

test('a first sheet confirmed goes back to the devices page to start its backup, a new key just back', async () => {
  for (const first of [true, false]) {
    const data = await withPupils();
    if (!first) await data.book.record(DAY, { kind: 'recovery.set', recovery: { key: KEY } });
    const navigation = { popTo: jest.fn(), goBack: jest.fn() };
    const props = {
      navigation,
      route: { key: 'r', name: 'SettingsRecovery', params: { first } },
    } as unknown as Parameters<typeof SettingsRecoveryScreen>[0];
    await mount(
      data,
      <LockStorage.Provider value={data.storage.asSpec()}>
        <SettingsRecoveryScreen {...props} />
      </LockStorage.Provider>,
    );
    if (!first) await press('recovery-new-key');
    await type(shown());
    await press('recovery-confirm');
    if (first) expect(navigation.popTo).toHaveBeenCalledWith('SettingsDevices', { backup: true });
    else expect(navigation.goBack).toHaveBeenCalledTimes(1);
    await unmount();
  }
});

test('refuses screenshots of the sheet, whatever the teacher allowed', () => {
  expect(screenKind('SettingsRecovery')).toBe('pin');
  expect(screenKind('SettingsDevices')).toBe('records');
});

test('every text is found in French and English', async () => {
  for (const [language, title] of [
    ['fr', 'Imprimée ou recopiée : la vérifier'],
    ['en', 'Printed or written: check it'],
  ] as const) {
    await i18n.changeLanguage(language);
    await screen(await withPupils(), true);
    expect(texts()).toContain(title);
    expect(texts().join(' ')).not.toContain('settings.recovery');
    await unmount();
  }
  expect(missingKeys).toEqual([]);
});
