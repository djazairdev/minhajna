// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «الأجهزة والنسخ» (#247, Devices-pilot, answer 478): sync not open yet, and
// why; the transfer opening its screen; no backup and no sheet at first, the
// first backup giving the sheet first; a backup saved under the recovery key,
// the whole archive with the private notes and without the personal fields or
// the key, its day recorded and said; a cancelled save neither said nor
// recorded; the first backup started once after its sheet; the last line on the
// 30-day reminder, or that it is off; and every text in French and English.
// Made-up records only.

import { deviceFacts, eventOf, readArchive } from '@minhajna/core';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import type { TestData } from '../jest/app-data';
import { DAY, mount, press, root, settle, texts, unmount } from '../jest/components-screen';
import { withPupils } from '../jest/roll-class';
import files from '../src/native/NativeMinhajnaFiles';
import { Devices } from '../src/settings/Devices';
import { setNotifyPrefs } from '../src/settings/notify-prefs';
import { i18n, missingKeys } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const KEY = ['K7QF', '3M9T', 'WX2R', '8HDN', 'P4VC', '6JYE'].join('');
const makeZip = jest.spyOn(files, 'makeZip');
const saveFile = jest.spyOn(files, 'saveFile');

beforeEach(() => {
  missingKeys.length = 0;
});
afterEach(async () => {
  await unmount();
  setNotifyPrefs({ backup: true });
  await i18n.changeLanguage('ar');
  jest.clearAllMocks();
});

const digest = (text: string) => {
  const { createHash } = jest.requireActual<typeof import('node:crypto')>('node:crypto');
  return Promise.resolve(createHash('sha256').update(text, 'utf8').digest('hex'));
};

const disabled = (testID: string) =>
  (
    root().findAll((node) => node.props.testID === testID && node.props.accessibilityState !== undefined)[0]?.props
      .accessibilityState as { disabled?: boolean } | undefined
  )?.disabled === true;

async function screen(data: TestData, backupNow = false) {
  const onTransfer = jest.fn();
  const onSheet = jest.fn();
  const onBackupStarted = jest.fn();
  await mount(
    data,
    <Devices onTransfer={onTransfer} onSheet={onSheet} backupNow={backupNow} onBackupStarted={onBackupStarted} />,
  );
  await ReactTestRenderer.act(settle);
  return { onTransfer, onSheet, onBackupStarted };
}

/** The made-up class with a private note, the teacher's personal fields and a recovery key. */
async function keyed(): Promise<TestData> {
  const data = await withPupils();
  await data.book.recordAll(DAY, [
    { kind: 'teacher.personal.set', personal: { name: 'اسم شخصي (مثال)', signatureOn: false } },
    { kind: 'session.noted', note: { sessionKey: 'made-up-session', note: 'ملاحظة خاصة (مثال)' } },
    { kind: 'recovery.set', recovery: { key: KEY } },
  ]);
  return data;
}

test('says sync is not open, and gives the sheet before the first backup', async () => {
  const { onTransfer, onSheet } = await screen(await withPupils());
  expect(accessibilityProblems(root())).toEqual([]);
  expect(texts()).toEqual(
    expect.arrayContaining([
      'المفاتيح عندك وحدك',
      'المزامنة بين أجهزتي',
      'لم تُفتح بعد',
      'إلى ذلك الحين، طريقان دون خادم ولا حساب:',
      'لا نسخة بعد',
      'تُعطى مع أول نسخة',
    ]),
  );
  expect(texts()).toContain(
    'لا يملك المشروع أي مفتاح، فلا يستطيع استرجاع البيانات. ' +
      'ويذكّر التطبيق بعد 30 يوماً دون نسخة، ما لم يُوقَف التذكير في «الإشعارات».',
  );
  expect(texts()).toContain('ملف مشفّر ورمز لمرة واحدة، دون شبكة');
  await press('devices-transfer');
  expect(onTransfer).toHaveBeenCalledTimes(1);
  expect(disabled('devices-sheet')).toBe(true);
  await press('devices-backup-now');
  expect(onSheet).toHaveBeenCalledWith(true);
  expect(makeZip).not.toHaveBeenCalled();
});

test('saves the whole archive under the recovery key, and records and says its day', async () => {
  const data = await keyed();
  const { onSheet } = await screen(data);
  expect(texts()).toContain('أُعدّت في الخميس 15 أكتوبر · تفتح النسخ الاحتياطية على جهاز جديد');
  await press('devices-sheet');
  expect(onSheet).toHaveBeenCalledWith(false);
  await press('devices-backup-now');
  await ReactTestRenderer.act(settle);
  expect(makeZip).toHaveBeenCalledTimes(1);
  const [names, made, name, password] = makeZip.mock.calls[0];
  expect(names).toEqual(['minhajna-archive.json']);
  expect(name).toBe('نسخة منهاجنا 2026-10-15');
  expect(password).toBe(KEY);
  const text = made[0];
  expect(text).toContain('ملاحظة خاصة (مثال)');
  expect(text).not.toContain('اسم شخصي (مثال)');
  expect(text).not.toContain(KEY);
  expect((await readArchive(text, digest)).ok).toBe(true);
  expect(saveFile).toHaveBeenCalledTimes(1);
  expect(deviceFacts(data.book.entries).lastBackup).toBe(DAY);
  expect(texts()).toEqual(expect.arrayContaining(['حُفظت النسخة.', 'آخر نسخة: الخميس 15 أكتوبر']));
});

test('a cancelled save is neither said nor recorded', async () => {
  const data = await keyed();
  saveFile.mockResolvedValueOnce(false);
  await screen(data);
  await press('devices-backup-now');
  await ReactTestRenderer.act(settle);
  expect(data.book.entries.some((entry) => eventOf(entry)?.kind === 'backup.saved')).toBe(false);
  expect(texts()).not.toContain('حُفظت النسخة.');
  expect(texts()).toContain('لا نسخة بعد');
});

test('starts the first backup once, after its sheet was confirmed', async () => {
  const data = await keyed();
  const { onBackupStarted } = await screen(data, true);
  await ReactTestRenderer.act(settle);
  expect(onBackupStarted).toHaveBeenCalledTimes(1);
  expect(makeZip).toHaveBeenCalledTimes(1);
  expect(data.book.entries.filter((entry) => eventOf(entry)?.kind === 'backup.saved')).toHaveLength(1);
});

test('says when the backup reminder is turned off', async () => {
  setNotifyPrefs({ backup: false });
  await screen(await withPupils());
  expect(texts()).toContain(
    'لا يملك المشروع أي مفتاح، فلا يستطيع استرجاع البيانات. تذكير النسخ الاحتياطي موقوف في «الإشعارات».',
  );
});

test('every text is found in French and English', async () => {
  for (const [language, title] of [
    ['fr', 'Synchronisation entre mes appareils'],
    ['en', 'Sync between my devices'],
  ] as const) {
    await i18n.changeLanguage(language);
    await screen(await keyed());
    expect(texts()).toContain(title);
    expect(texts().join(' ')).not.toContain('settings.devices');
    await unmount();
  }
  expect(missingKeys).toEqual([]);
});
