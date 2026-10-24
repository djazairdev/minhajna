// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «نقل مباشر» on the old phone (#247, Transfer, answers 478 and 480): a
// one-time key drawn as the screen opens, shown as a QR code of the transfer's
// form and in six groups, kept nowhere; the whole archive, private notes
// included and the personal fields left out, sent through the share menu or
// saved through the file picker under that key, each recorded in the log; a
// cancelled save neither said nor recorded; a file that could not be made
// said; two quick taps making one file; the shared file deleted as the screen
// closes; the screen guarded; and every text in French and English. Made-up
// records only.

import { eventOf, readArchive, readTransferQr, TRANSFER_QR_PREFIX } from '@minhajna/core';
import type { PressableProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import type { TestData } from '../jest/app-data';
import { control, DAY, mount, press, root, settle, texts, unmount } from '../jest/components-screen';
import { FakeStorage } from '../jest/fake-storage';
import { withPupils } from '../jest/roll-class';
import { screenKind } from '../src/lock/screen-guard';
import qr from '../src/native/NativeMinhajnaCalendarInput';
import files from '../src/native/NativeMinhajnaFiles';
import { Transfer } from '../src/settings/Transfer';
import { i18n, missingKeys } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const makeZip = jest.spyOn(files, 'makeZip');
const shareFile = jest.spyOn(files, 'shareFile');
const saveFile = jest.spyOn(files, 'saveFile');
const dropFile = jest.spyOn(files, 'dropFile');
const qrRows = jest.spyOn(qr, 'qrRows');

beforeEach(() => {
  missingKeys.length = 0;
});
afterEach(async () => {
  await unmount();
  await i18n.changeLanguage('ar');
  jest.clearAllMocks();
});

const digest = (text: string) => {
  const { createHash } = jest.requireActual<typeof import('node:crypto')>('node:crypto');
  return Promise.resolve(createHash('sha256').update(text, 'utf8').digest('hex'));
};

const outputs = (data: TestData) =>
  data.book.entries.flatMap((entry) => {
    const event = eventOf(entry);
    return event?.kind === 'output.recorded' ? [[event.output.document, event.output.period, event.output.how]] : [];
  });

/** The made-up class, a private note and the teacher's personal fields. */
async function classData(): Promise<TestData> {
  const data = await withPupils();
  await data.book.recordAll(DAY, [
    { kind: 'teacher.personal.set', personal: { name: 'اسم شخصي (مثال)', signatureOn: false } },
    { kind: 'session.noted', note: { sessionKey: 'made-up-session', note: 'ملاحظة خاصة (مثال)' } },
  ]);
  return data;
}

async function screen(data: TestData) {
  await mount(data, <Transfer storage={FakeStorage.unlocked().asSpec()} />);
  await ReactTestRenderer.act(settle);
}

/** The key the screen drew, read back from the text its QR code was made of. */
const drawnKey = () => readTransferQr(qrRows.mock.calls[0]?.[0] ?? '') ?? '';

test('shows a one-time key as a QR code and in six groups, and keeps it nowhere', async () => {
  const data = await classData();
  await screen(data);
  expect(accessibilityProblems(root())).toEqual([]);
  expect(qrRows).toHaveBeenCalledTimes(1);
  expect(qrRows.mock.calls[0]?.[0].startsWith(TRANSFER_QR_PREFIX)).toBe(true);
  const key = drawnKey();
  expect(key).toHaveLength(24);
  const labels = root()
    .findAll((node) => typeof node.type === 'string' && typeof node.props.accessibilityLabel === 'string')
    .map((node) => node.props.accessibilityLabel as string);
  expect(labels).toContain('رمز QR لفتح ملف النقل على الهاتف الجديد');
  expect(labels.filter((label) => label.startsWith('المجموعة '))).toHaveLength(6);
  expect(texts()).toEqual(
    expect.arrayContaining([
      'من هذا الهاتف إلى هاتف جديد',
      'رمز لمرة واحدة',
      'تُمنع صور الشاشة هنا. ولا يُحفظ الرمز في أي مكان، ولا يُرسل إلى أي خادم.',
    ]),
  );
  expect(JSON.stringify(data.storage.rows)).not.toContain(key);
  expect(screenKind('SettingsTransfer')).toBe('pin');
});

test('sends the whole archive under the key, and records it', async () => {
  const data = await classData();
  await screen(data);
  await press('transfer-share');
  expect(makeZip).toHaveBeenCalledTimes(1);
  const [names, made, name, password] = makeZip.mock.calls[0] ?? [];
  expect(names).toEqual(['minhajna-archive.json']);
  expect(name).toBe('نقل منهاجنا 2026-10-15');
  expect(password).toBe(drawnKey());
  const text = made?.[0] ?? '';
  expect(text).toContain('ملاحظة خاصة (مثال)');
  expect(text).not.toContain('اسم شخصي (مثال)');
  expect(text).not.toContain(drawnKey());
  expect((await readArchive(text, digest)).ok).toBe(true);
  expect(shareFile).toHaveBeenCalledWith('00112233aabbccdd', 'إرسال ملف النقل');
  expect(texts()).toContain('فُتحت المشاركة. يبقى هذا الرمز ظاهراً حتى يصل الملف.');
  expect(outputs(data)).toEqual([['transfer', '2026-10-15', 'archive']]);
  await unmount();
  expect(dropFile).toHaveBeenCalledWith('00112233aabbccdd');
});

test('saves through the file picker; a cancelled save is neither said nor recorded', async () => {
  const data = await classData();
  await screen(data);
  saveFile.mockResolvedValueOnce(false);
  await press('transfer-save');
  expect(root().findAll((node) => node.props.testID === 'transfer-said')).toHaveLength(0);
  expect(outputs(data)).toEqual([]);
  await press('transfer-save');
  expect(texts()).toContain('حُفظ الملف.');
  expect(outputs(data)).toEqual([['transfer', '2026-10-15', 'archive']]);
  expect(makeZip.mock.calls.every((call) => call[3] === drawnKey())).toBe(true);
  await unmount();
  expect(dropFile).not.toHaveBeenCalled();
});

test('says a file that could not be made, and makes one file for two quick taps', async () => {
  const data = await classData();
  await screen(data);
  makeZip.mockRejectedValueOnce(new Error('E_FILE'));
  await press('transfer-share');
  expect(texts()).toContain('لم يُعدّ الملف. أعد المحاولة.');
  expect(shareFile).not.toHaveBeenCalled();
  makeZip.mockClear();
  await ReactTestRenderer.act(async () => {
    const share = control('transfer-share')?.props as PressableProps;
    share.onPress?.({} as never);
    share.onPress?.({} as never);
    await settle();
  });
  await ReactTestRenderer.act(settle);
  expect(makeZip).toHaveBeenCalledTimes(1);
});

test.each(['fr', 'en'] as const)('names every text and control in %s', async (language) => {
  await i18n.changeLanguage(language);
  await screen(await classData());
  await press('transfer-share');
  expect(accessibilityProblems(root())).toEqual([]);
  expect(missingKeys).toEqual([]);
});
