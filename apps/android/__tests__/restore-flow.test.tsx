// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A restore from the welcome (#247, answer 478): on a fresh install,
// «لديّ نسخة من هاتف آخر» leads through the first PIN to the restore, with the
// welcome under it, and the restored history then opens on Today; the restore
// is guarded as the PIN pads are; and once setup has begun on this phone, the
// welcome no longer offers it. Made-up records only.

import { archiveOf, archiveText, parseDay } from '@minhajna/core';
import { TextInput, type PressableProps, type TextInputProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';
import { FakeStorage } from '../jest/fake-storage';
import { withPupils } from '../jest/roll-class';
import { screenKind } from '../src/lock/screen-guard';
import files from '../src/native/NativeMinhajnaFiles';
import { AppNavigator } from '../src/navigation/AppNavigator';
import { openRecordBook } from '../src/storage/history';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const KEY = ['K7QF', '3M9T', 'WX2R', '8HDN', 'P4VC', '6JYE'].join('');
let tree: ReactTestRenderer.ReactTestRenderer | undefined;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  jest.restoreAllMocks();
});

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const has = (testID: string) => tree!.root.findAllByProps({ testID }).length > 0;
const navigator = () => tree!.root.findAllByType(AppNavigator);

async function start(storage: FakeStorage) {
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App storage={storage.asSpec()} />);
    await settle();
  });
}

async function press(testID: string) {
  await ReactTestRenderer.act(async () => {
    const node = tree!.root.findAll(
      (one) => one.props.testID === testID && typeof (one.props as PressableProps).onPress === 'function',
    )[0];
    (node?.props as PressableProps).onPress?.({} as never);
    await settle();
  });
}

async function type(pin: string) {
  for (const digit of pin) await press(`pin-${digit}`);
}

/** A finished setup with the made-up class, as a backup's text. */
async function backupText(): Promise<string> {
  const data = await withPupils();
  await data.book.recordAll(parseDay('2026-10-15'), [{ kind: 'setup.finished' }]);
  const archive = archiveOf(data.book.entries, data.book.state, {
    made: parseDay('2026-10-15'),
    app: '0.5.0',
    country: data.profile.code,
    calendarRelease: data.calendarRelease,
    privateNotes: true,
    bundledPacks: data.packs,
  });
  return archiveText(archive);
}

test('leads from the welcome through the first PIN to the restore, then opens on Today', async () => {
  const text = await backupText();
  const storage = new FakeStorage();
  await start(storage);
  await press('welcome-restore');
  await type('2580');
  await type('2580');
  expect(navigator()[0]?.props.initialState).toEqual({ index: 1, routes: [{ name: 'Welcome' }, { name: 'Restore' }] });
  expect(has('restore-run')).toBe(true);
  expect(screenKind('Restore')).toBe('pin');
  jest.spyOn(files, 'openZip').mockResolvedValueOnce({ token: '0011223344556677', name: 'نسخة.zip' });
  jest.spyOn(files, 'readZip').mockResolvedValueOnce(text);
  await press('restore-pick');
  await ReactTestRenderer.act(async () => {
    const field = tree!.root.findAll((node) => node.type === TextInput && node.props.testID === 'restore-secret')[0];
    (field?.props as TextInputProps).onChangeText?.(KEY);
    await settle();
  });
  await press('restore-run');
  await ReactTestRenderer.act(settle);
  expect(navigator()).toHaveLength(1);
  expect(navigator()[0]?.props.initialRouteName).toBe('Home');
  expect(navigator()[0]?.props.initialState).toBeUndefined();
  expect(has('restore-run')).toBe(false);
  expect((await openRecordBook(storage.asSpec())).state.setupFinished).toBe(true);
});

test('the start of setup leads to the notice, and a history begun on this phone hides the restore', async () => {
  const storage = new FakeStorage();
  await start(storage);
  await press('welcome-start');
  await type('2580');
  await type('2580');
  expect(navigator()[0]?.props.initialState).toEqual({ index: 1, routes: [{ name: 'Welcome' }, { name: 'Privacy' }] });
  await ReactTestRenderer.act(() => tree?.unmount());
  const book = await openRecordBook(storage.asSpec());
  await book.recordAll(parseDay('2026-10-15'), [
    {
      kind: 'school.set',
      school: { id: 's-1', name: 'متوسطة النجاح', levels: ['cem'], subjects: ['arabic'], zone: '16' },
    },
  ]);
  storage.opened = false;
  await start(storage);
  await type('2580');
  expect(has('welcome-start')).toBe(true);
  expect(has('welcome-restore')).toBe(false);
});
