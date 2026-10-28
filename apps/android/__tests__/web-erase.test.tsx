// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «مسح هذا الحاسوب» (#250, Web-erase, answers 518 to 520), through the app
// as the web build picks its screens: the lock page's «نسيت عبارة المرور؟»
// leads to a short erase page for a locked PC, with no counts, closed until
// ticked, that erases once and starts the app again; a failure is said with
// the page kept, and «رجوع» goes back to the passphrase; an erase the app's
// other tabs keep waiting says so, with the page busy. The welcome then
// says the PC was erased, only in the tab that erased it. In Settings, the
// erase screen names this browser and this PC, and one kept waiting stays
// busy and holds the route. Every new text is in French
// and English. Made-up passphrases and records.

import ReactTestRenderer from 'react-test-renderer';
import { Platform, Text } from 'react-native';
import type { PressableProps, TextInputProps, TextProps } from 'react-native';
import App from '../App';
import {
  mount,
  press as screenPress,
  root,
  settle as screenSettle,
  texts as screenTexts,
  unmount,
} from '../jest/components-screen';
import { browserState, resetBrowser } from '../jest/fake-browser';
import { FakeStorage } from '../jest/fake-storage';
import { withPupils } from '../jest/roll-class';
import { TextField } from '../src/components/TextField';
import { forgetKept } from '../src/lock/browser-offers';
import ui from '../src/native/NativeMinhajnaInterface';
import { EraseDevice } from '../src/settings/EraseDevice';
import settingsAr from '../src/settings/text/ar.json';
import settingsEn from '../src/settings/text/en.json';
import settingsFr from '../src/settings/text/fr.json';
import text from '../src/text/ar.json';
import en from '../src/text/en.json';
import fr from '../src/text/fr.json';

jest.mock('../src/native/NativeMinhajnaBrowser', () => jest.requireActual<object>('../jest/fake-browser'));
jest.mock('../src/lock/CreatePin', () => jest.requireActual<object>('../src/lock/CreatePin.web'));
jest.mock('../src/lock/Unlock', () => jest.requireActual<object>('../src/lock/Unlock.web'));
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const PASSPHRASE = 'chalk on the green board';
const erase = text.lock.web.erase;
let restart: jest.SpyInstance;

let tree: ReactTestRenderer.ReactTestRenderer | undefined;

beforeEach(() => {
  resetBrowser();
  forgetKept();
  restart = jest.spyOn(ui, 'restart');
});
afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  await unmount();
  jest.restoreAllMocks();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

async function act(run: () => void) {
  await ReactTestRenderer.act(async () => {
    run();
    await settle();
  });
}

function lockedPc(): FakeStorage {
  const storage = new FakeStorage();
  storage.pinRule = /^.{12,}$/u;
  storage.pin = PASSPHRASE;
  storage.created = true;
  return storage;
}

const start = (storage: FakeStorage) =>
  act(() => (tree = ReactTestRenderer.create(<App storage={storage.asSpec()} />)));
const props = (testID: string) => tree!.root.findByProps({ testID }).props as PressableProps;
const press = (testID: string) => act(() => props(testID).onPress?.({} as never));
const texts = () => tree!.root.findAllByType(Text).map((node): unknown => (node.props as TextProps).children);
const tick = (testID: string) =>
  act(() =>
    (tree!.root.findByProps({ testID }).props as { onCheckedChange: (on: boolean) => void }).onCheckedChange(true),
  );
const has = (testID: string) => tree!.root.findAll((node) => node.props.testID === testID).length > 0;

async function openErase() {
  await press('passphrase-forgot');
  expect(texts()).toContain(text.lock.web.forgotLine);
  await press('passphrase-erase');
}

test('the lock page leads to erasing a locked PC, closed until ticked, then erases once and starts again', async () => {
  const storage = lockedPc();
  await start(storage);
  expect(has('passphrase')).toBe(true);
  expect(has('passphrase-erase')).toBe(false);
  await openErase();
  expect(texts()).toEqual(
    expect.arrayContaining([
      erase.title,
      erase.oneStep,
      erase.gone,
      erase.goneAll,
      erase.goneKey,
      erase.keptLine,
      erase.lost,
      settingsAr.eraseDevice.understood,
    ]),
  );
  expect(has('passphrase')).toBe(false);
  expect(props('erase-locked-confirm').disabled).toBe(true);
  await press('erase-locked-confirm');
  expect(storage.stopped).toBe(false);
  await tick('erase-locked-understood');
  await act(() => {
    props('erase-locked-confirm').onPress?.({} as never);
    props('erase-locked-confirm').onPress?.({} as never);
  });
  expect(storage.stopped).toBe(true);
  expect(storage.pin).toBeNull();
  expect(restart).toHaveBeenCalledTimes(1);
});

test('a failed erase is said with the page kept, and Back returns to the passphrase', async () => {
  const storage = lockedPc();
  storage.eraseFails = true;
  await start(storage);
  await openErase();
  await tick('erase-locked-understood');
  await press('erase-locked-confirm');
  expect(texts()).toContain(settingsAr.eraseDevice.failed);
  expect(restart).not.toHaveBeenCalled();
  expect(props('erase-locked-confirm').disabled).toBe(false);
  await press('erase-locked-back');
  expect(has('passphrase')).toBe(true);
  const [input] = tree!.root.findAll((node) => node.type === TextField && node.props.testID === 'passphrase');
  await act(() => (input?.props as TextInputProps).onChangeText?.(PASSPHRASE));
  await press('passphrase-open');
  expect(has('passphrase')).toBe(false);
  expect(storage.stopped).toBe(false);
});

test('an erase kept waiting by other tabs says so and keeps the page busy', async () => {
  const storage = lockedPc();
  const erasing = jest
    .spyOn(storage, 'eraseDevice')
    .mockRejectedValue(Object.assign(new Error('The erase waits'), { code: 'E_ERASE_WAITS' }));
  await start(storage);
  await openErase();
  await tick('erase-locked-understood');
  await press('erase-locked-confirm');
  expect(texts()).toContain(settingsAr.eraseDevice.waits);
  expect(texts()).not.toContain(settingsAr.eraseDevice.failed);
  expect(props('erase-locked-confirm').disabled).toBe(true);
  expect(props('erase-locked-back').disabled).toBe(true);
  await press('erase-locked-confirm');
  expect(erasing).toHaveBeenCalledTimes(1);
  expect(restart).not.toHaveBeenCalled();
});

test('the welcome says the PC was erased only in the tab that erased it', async () => {
  browserState.erased = true;
  await start(new FakeStorage());
  expect(texts()).toEqual(
    expect.arrayContaining([
      text.welcome.erased.badge,
      text.welcome.erased.title,
      [text.welcome.erased.line, text.welcome.erased.kept, text.welcome.erased.again].join(' '),
    ]),
  );
  await act(() => tree?.unmount());
  browserState.erased = false;
  await start(new FakeStorage());
  expect(has('welcome-start')).toBe(true);
  expect(has('welcome-erased')).toBe(false);
});

test('the Settings erase screen names this browser and this PC on a PC', async () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  const data = await withPupils();
  await mount(data, <EraseDevice storage={data.storage.asSpec()} onExport={() => undefined} />);
  const pc = settingsAr.eraseDevice.pc;
  expect(screenTexts()).toEqual(expect.arrayContaining([pc.gone, pc.goneKey, pc.keptNone, pc.exportLine, pc.erase]));
  expect(screenTexts()).not.toContain(settingsAr.eraseDevice.goneKey);
});

test('the Settings erase kept waiting by other tabs says so, stays busy and holds the route', async () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  const data = await withPupils();
  const erasing = jest
    .spyOn(data.storage, 'eraseDevice')
    .mockRejectedValue(Object.assign(new Error('The erase waits'), { code: 'E_ERASE_WAITS' }));
  const onBusy = jest.fn();
  await mount(data, <EraseDevice storage={data.storage.asSpec()} onExport={() => undefined} onBusy={onBusy} />);
  await screenPress('erase-understood', 'erase-confirm');
  await ReactTestRenderer.act(screenSettle);
  expect(screenTexts()).toContain(settingsAr.eraseDevice.waits);
  expect(screenTexts()).not.toContain(settingsAr.eraseDevice.failed);
  const confirm = root().findAll(
    (node) => node.props.testID === 'erase-confirm' && node.props.disabled !== undefined,
  )[0];
  expect(confirm?.props.disabled).toBe(true);
  expect(onBusy.mock.calls).toEqual([[true]]);
  await screenPress('erase-confirm');
  expect(erasing).toHaveBeenCalledTimes(1);
  expect(restart).not.toHaveBeenCalled();
});

test('every new text is in French and English', () => {
  const pairs = [
    [text.lock.web.erase, fr.lock.web.erase, en.lock.web.erase],
    [text.welcome.erased, fr.welcome.erased, en.welcome.erased],
    [settingsAr.eraseDevice.pc, settingsFr.eraseDevice.pc, settingsEn.eraseDevice.pc],
    [settingsAr.pc, settingsFr.pc, settingsEn.pc],
  ] as const;
  for (const [ar, ...others] of pairs) {
    for (const other of others) {
      expect(Object.keys(other)).toEqual(Object.keys(ar));
      for (const [key, value] of Object.entries(other)) {
        expect(value).not.toBe('');
        expect(value).not.toBe((ar as Record<string, string>)[key]);
      }
    }
  }
});
