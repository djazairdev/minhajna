// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «الهاتف القديم في اليد» on the restore (#247, answers 478 and 480): the
// transfer file picked, then the old phone's one-time key scanned from its QR
// code and restored under it, with a seal; a code that is not a transfer's, a
// camera that does not open, a scan that does not work and a cancelled scan; a
// typed code of the wrong shape, or one that does not open the file; and a
// changed file worded for a transfer. Made-up records only.

import { archiveOf, archiveText, parseDay, transferQr } from '@minhajna/core';
import { TextInput, type TextInputProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { openTestData } from '../jest/app-data';
import { mount, press, root, settle, texts, unmount } from '../jest/components-screen';
import { FakeStorage } from '../jest/fake-storage';
import { withPupils } from '../jest/roll-class';
import scanner from '../src/native/NativeMinhajnaCalendarInput';
import files from '../src/native/NativeMinhajnaFiles';
import { Restore } from '../src/restore/Restore';
import { openRecordBook } from '../src/storage/history';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const KEY = ['K7QF', '3M9T', 'WX2R', '8HDN', 'P4VC', '6JYE'].join('');
const TOKEN = '0011223344556677';
const openZip = jest.spyOn(files, 'openZip');
const readZip = jest.spyOn(files, 'readZip');
const scanQr = jest.spyOn(scanner, 'scanQr');

afterEach(async () => {
  await unmount();
  jest.clearAllMocks();
});

/** The made-up class's transfer text. */
async function transferText(): Promise<string> {
  const data = await withPupils();
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

async function screen() {
  const storage = FakeStorage.unlocked();
  const data = await openTestData(storage);
  const onRestored = jest.fn();
  await mount(data, <Restore storage={storage.asSpec()} onRestored={onRestored} />);
  openZip.mockResolvedValueOnce({ token: TOKEN, name: 'نقل منهاجنا 2026-10-15.zip' });
  await press('restore-pick');
  return { storage, onRestored };
}

const secret = () =>
  (
    root().findAll((node) => node.type === TextInput && node.props.testID === 'restore-secret')[0]
      ?.props as TextInputProps
  ).value;

async function typeSecret(text: string) {
  await ReactTestRenderer.act(async () => {
    const field = root().findAll((node) => node.type === TextInput && node.props.testID === 'restore-secret')[0];
    (field?.props as TextInputProps).onChangeText?.(text);
    await settle();
  });
}

test('restores the transfer file under the key scanned from the old phone', async () => {
  const text = await transferText();
  const { storage, onRestored } = await screen();
  expect(texts()).toContain('الملف: نقل منهاجنا 2026-10-15.zip');
  scanQr.mockResolvedValueOnce(transferQr(KEY));
  await press('restore-scan');
  expect(scanQr).toHaveBeenCalledWith(
    'مسح رمز النقل',
    'يُوجَّه الهاتف إلى الرمز الظاهر على الهاتف القديم.',
    'إلغاء',
    true,
  );
  expect(secret()).toBe(KEY);
  readZip.mockResolvedValueOnce(text);
  await press('restore-run');
  expect(readZip).toHaveBeenCalledWith(TOKEN, 'minhajna-archive.json', KEY, true);
  expect(onRestored).toHaveBeenCalledTimes(1);
  expect((await openRecordBook(storage.asSpec())).state.pupils.size).toBeGreaterThan(0);
});

test('says a code that is not a transfer, a failed camera or scan, and nothing for a cancelled scan', async () => {
  await screen();
  scanQr.mockResolvedValueOnce('minhajna-calendar:1:something else');
  await press('restore-scan');
  expect(texts()).toContain('ليس هذا رمز نقل من «منهاجنا».');
  expect(secret()).toBe('');
  scanQr.mockRejectedValueOnce(Object.assign(new Error('no camera'), { code: 'E_CALENDAR_CAMERA' }));
  await press('restore-scan');
  expect(texts()).toContain('تعذّر فتح الكاميرا. يُكتب الرمز بدل ذلك.');
  scanQr.mockRejectedValueOnce(Object.assign(new Error('not read'), { code: 'E_CALENDAR_INPUT' }));
  await press('restore-scan');
  expect(texts()).toContain('لم يتمّ المسح. يُكتب الرمز بدل ذلك.');
  expect(texts()).not.toContain('ليس هذا رمز نقل من «منهاجنا».');
  await typeSecret(KEY.slice(0, 12));
  scanQr.mockResolvedValueOnce(null);
  await press('restore-scan');
  expect(secret()).toBe(KEY.slice(0, 12));
  expect(root().findAll((node) => node.props.testID === 'restore-problem')).toHaveLength(0);
  expect(accessibilityProblems(root())).toEqual([]);
});

test('a typed code of the wrong shape, or one that does not open the file, is said', async () => {
  const { storage } = await screen();
  await typeSecret(KEY.slice(0, 20));
  await press('restore-run');
  expect(texts()).toContain('الرمز 24 حرفاً ورقماً، كما يظهر على الهاتف القديم.');
  expect(readZip).not.toHaveBeenCalled();
  await typeSecret(KEY);
  readZip.mockRejectedValueOnce(Object.assign(new Error('refused'), { code: 'E_ZIP_PASSWORD' }));
  await press('restore-run');
  expect(texts()).toContain(
    'لا يفتح هذا الرمز الملف. هل الملف هو الذي أُعدّ مع هذا الرمز؟ ' +
      'إن أُغلقت شاشة النقل على الهاتف القديم، يُرسل منه ملف جديد.',
  );
  readZip.mockRejectedValueOnce(Object.assign(new Error('refused'), { code: 'E_ZIP_CHANGED' }));
  await press('restore-run');
  expect(texts()).toEqual(
    expect.arrayContaining([
      'لا يطابق الملف ما كُتب عند إعداده: تغيّر بعده، أو أن الرمز ليس رمزه.',
      'يُرسل ملف نقل جديد من الهاتف القديم، ثم يُمسح رمزه الجديد.',
    ]),
  );
  expect(storage.rows).toEqual([]);
});
