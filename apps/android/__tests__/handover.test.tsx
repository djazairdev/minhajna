// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The working copy handed to the other device, on screen (#250, answers 503,
// 513 and 514): once the transfer file has left, the teacher confirms that
// the other device opened it, which keeps the file's last entry, unless a
// change was made since; no file leaves while the copy is away. The banner
// then says since when the work is there, every change but a backup or a
// print is refused with a sheet that says why, drawn apart from the banner
// so a screen over the tabs shows it too, and taking over asks first.
// «استلام النسخة» offers a transfer or a backup only, and says what a backup
// leaves behind. Every text in French and English too. Made-up records only.

import { deviceFacts } from '@minhajna/core';
import { Pressable, Text } from 'react-native';
import { accessibilityProblems } from '../jest/accessibility';
import type { TestData } from '../jest/app-data';
import { DAY, mount, press, root, texts, unmount } from '../jest/components-screen';
import { FakeStorage } from '../jest/fake-storage';
import { withPupils } from '../jest/roll-class';
import files from '../src/native/NativeMinhajnaFiles';
import { Restore } from '../src/restore/Restore';
import { HandoverBar } from '../src/settings/HandoverBar';
import { HandoverRefused } from '../src/settings/HandoverSheets';
import settings from '../src/settings/text/ar.json';
import { Transfer } from '../src/settings/Transfer';
import { useAppData } from '../src/storage/AppData';
import { i18n, missingKeys } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const saveFile = jest.spyOn(files, 'saveFile');
const words = settings.handover;

beforeEach(() => {
  missingKeys.length = 0;
});
afterEach(async () => {
  await unmount();
  await i18n.changeLanguage('ar');
  jest.clearAllMocks();
});

const has = (testID: string) => root().findAll((node) => node.props.testID === testID).length > 0;
const shown = (testID: string) =>
  root().findAll((node) => node.props.testID === testID && node.props.visible === true).length > 0;

/** A made-up screen that tries to note a session and to log a print. */
function Changes() {
  const { record } = useAppData();
  return (
    <>
      <Pressable
        testID="try-note"
        onPress={() => record({ kind: 'session.noted', note: { sessionKey: 'made-up', note: 'Made-up note' } })}
      >
        <Text>note</Text>
      </Pressable>
      <Pressable
        testID="try-print"
        onPress={() =>
          record({
            kind: 'output.recorded',
            output: { id: 'made-up-print', document: 'week', period: DAY, how: 'print', blank: false },
          })
        }
      >
        <Text>print</Text>
      </Pressable>
    </>
  );
}

async function handed(): Promise<TestData> {
  const data = await withPupils();
  await data.book.record(DAY, { kind: 'handover.sent', handover: { last: data.book.entries.at(-1)!.hash } });
  return data;
}

test('the transfer keeps the sent file’s last entry once the teacher confirms the other device opened it', async () => {
  const data = await withPupils();
  const last = data.book.entries.at(-1)!.hash;
  await mount(data, <Transfer storage={FakeStorage.unlocked().asSpec()} />);
  expect(has('transfer-handover')).toBe(false);
  await press('transfer-save');
  expect(saveFile).toHaveBeenCalledTimes(1);
  expect(texts()).toEqual(expect.arrayContaining([words.title, words.line, words.confirm]));
  await press('transfer-handed');
  expect(deviceFacts(data.book.entries).handedOver).toEqual({ day: DAY, last });
  expect(has('transfer-handed-done')).toBe(true);
  expect(has('transfer-away')).toBe(false);
});

test('no file leaves while the copy is away, and a change made after the file asks for it again', async () => {
  const away = await handed();
  await mount(away, <Transfer storage={FakeStorage.unlocked().asSpec()} />);
  expect(has('transfer-away')).toBe(true);
  await press('transfer-save');
  expect(saveFile).not.toHaveBeenCalled();
  await unmount();
  const data = await withPupils();
  await mount(
    data,
    <>
      <Changes />
      <Transfer storage={FakeStorage.unlocked().asSpec()} />
    </>,
  );
  await press('transfer-save');
  await press('try-note');
  expect(has('transfer-changed')).toBe(true);
  expect(has('transfer-handed')).toBe(false);
  expect(texts()).toContain(words.changed);
});

test('the banner says since when the work is away', async () => {
  await mount(await handed(), <HandoverBar onReceive={jest.fn()} />);
  expect(texts().some((text) => text.startsWith(words.away.split('{{')[0]))).toBe(true);
  expect(accessibilityProblems(root().findAll((node) => node.props.testID === 'handover-bar')[0])).toEqual([]);
});

test('a change is refused with a sheet of its own, with no banner on screen, but a print is kept', async () => {
  const data = await handed();
  const onReceive = jest.fn();
  await mount(
    data,
    <>
      <Changes />
      <HandoverRefused onReceive={onReceive} />
    </>,
  );
  const before = data.book.entries.length;
  await press('try-print');
  expect(data.book.entries).toHaveLength(before + 1);
  expect(shown('handover-refused')).toBe(false);
  await press('try-note');
  expect(data.book.entries).toHaveLength(before + 1);
  expect(shown('handover-refused')).toBe(true);
  expect(texts()).toEqual(expect.arrayContaining([words.refusedTitle, words.refusedReassurance]));
  await press('handover-refused-receive');
  expect(onReceive).toHaveBeenCalledTimes(1);
  expect(shown('handover-refused')).toBe(false);
});

test('taking over asks first, then lets changes through and hides the banner', async () => {
  const data = await handed();
  await mount(
    data,
    <>
      <Changes />
      <HandoverBar onReceive={jest.fn()} />
      <HandoverRefused onReceive={jest.fn()} />
    </>,
  );
  await press('try-note');
  await press('handover-refused-take');
  expect(shown('handover-refused')).toBe(false);
  await press('handover-take');
  expect(shown('handover-take-sheet')).toBe(true);
  expect(texts()).toEqual(expect.arrayContaining([words.takeTitle, words.takeReassurance]));
  await press('handover-take-confirm');
  expect(deviceFacts(data.book.entries).handedOver).toBeNull();
  expect(has('handover-bar')).toBe(false);
  const before = data.book.entries.length;
  await press('try-note');
  expect(data.book.entries).toHaveLength(before + 1);
});

test('nothing shows while the work is here', async () => {
  await mount(await withPupils(), <HandoverBar onReceive={jest.fn()} />);
  expect(has('handover-bar')).toBe(false);
});

test('receiving the copy offers a transfer or a backup from the other device only', async () => {
  const data = await handed();
  const storage = FakeStorage.unlocked().asSpec();
  await mount(data, <Restore back storage={storage} onRestored={jest.fn()} />);
  expect(has('restore-route-phone') && has('restore-route-backup')).toBe(true);
  expect(has('restore-route-archive') || has('restore-route-sync') || has('restore-left')).toBe(false);
  expect(texts()).toEqual(
    expect.arrayContaining([settings.takeBack.sub, settings.takeBack.line, settings.takeBack.phoneHow]),
  );
  await press('restore-route-backup');
  expect(texts()).toContain(settings.takeBack.backupHow);
});

test('every handover text exists in French and English', async () => {
  for (const language of ['fr', 'en']) {
    await i18n.changeLanguage(language);
    const data = await handed();
    await mount(
      data,
      <>
        <Changes />
        <HandoverBar onReceive={jest.fn()} />
        <HandoverRefused onReceive={jest.fn()} />
        <Transfer storage={FakeStorage.unlocked().asSpec()} />
      </>,
    );
    await press('handover-take');
    await press('try-note');
    await unmount();
  }
  expect(missingKeys).toEqual([]);
});
