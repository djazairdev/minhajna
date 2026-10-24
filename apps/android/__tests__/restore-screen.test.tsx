// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «استرجاع البيانات» (#247, Restore, answers 478 and 480): the three routes
// open in the pilot, sync shown as not open; what does not come back said
// first; a file asked for before anything is read; a backup restored with
// the key typed, the kept copy dropped, and the history opened again; a
// wrong key said, and cleared as it is typed again; a changed file on its own
// page, with nothing kept, worded for a backup or an export; the export's
// route without a key or the recovery sheet's line; the kept copy dropped when
// the screen closes; and every text named in French and English. Made-up
// records only.

import { archiveOf, archiveText, parseDay } from '@minhajna/core';
import { TextInput, type TextInputProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { openTestData } from '../jest/app-data';
import { mount, press, root, settle, texts, unmount } from '../jest/components-screen';
import { FakeStorage } from '../jest/fake-storage';
import { withPupils } from '../jest/roll-class';
import files from '../src/native/NativeMinhajnaFiles';
import { Restore } from '../src/restore/Restore';
import { openRecordBook } from '../src/storage/history';
import { i18n, missingKeys } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const KEY = ['K7QF', '3M9T', 'WX2R', '8HDN', 'P4VC', '6JYE'].join('');
const TOKEN = '0011223344556677';
const openZip = jest.spyOn(files, 'openZip');
const readZip = jest.spyOn(files, 'readZip');
const dropFile = jest.spyOn(files, 'dropFile');

beforeEach(() => {
  missingKeys.length = 0;
});
afterEach(async () => {
  await unmount();
  await i18n.changeLanguage('ar');
  jest.clearAllMocks();
});

/** The made-up class's backup text. */
async function backupText(): Promise<string> {
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

async function screen(route: 'phone' | 'backup' = 'backup') {
  const storage = FakeStorage.unlocked();
  const data = await openTestData(storage);
  const onRestored = jest.fn();
  await mount(data, <Restore storage={storage.asSpec()} onRestored={onRestored} />);
  if (route !== 'phone') await press(`restore-route-${route}`);
  return { storage, onRestored };
}

async function typeSecret(text: string) {
  await ReactTestRenderer.act(async () => {
    const field = root().findAll((node) => node.type === TextInput && node.props.testID === 'restore-secret')[0];
    (field?.props as TextInputProps).onChangeText?.(text);
    await settle();
  });
}

const disabled = (testID: string) =>
  (
    root().findAll((node) => node.props.testID === testID && node.props.accessibilityState !== undefined)[0]?.props
      .accessibilityState as { disabled?: boolean } | undefined
  )?.disabled === true;
const has = (testID: string) => root().findAll((node) => node.props.testID === testID).length > 0;

test('shows the routes, says what does not come back, and asks for the file first', async () => {
  await screen('phone');
  expect(accessibilityProblems(root())).toEqual([]);
  expect(texts()).toEqual(
    expect.arrayContaining([
      'من هاتف آخر أو من نسخة',
      'الهاتف القديم في اليد',
      'ملف نسخة احتياطية',
      'فتح أرشيف «منهاجنا»',
      'اختيار ملف النقل',
      'الرمز الظاهر على الهاتف القديم',
      'تُطلب الكاميرا الآن، لمسح الرمز وحده.',
      'الحقول الشخصية في بطاقة الأستاذ: تُكتب من جديد',
      'التوقيع المرسوم: يُرسم من جديد',
    ]),
  );
  expect(texts()).not.toContain('لا يملك المشروع أي مفتاح: دون ورقة الاسترجاع، لا يمكن استرجاع شيء.');
  expect(disabled('restore-route-phone')).toBe(false);
  expect(disabled('restore-route-sync')).toBe(true);
  await press('restore-route-sync');
  expect(has('restore-scan')).toBe(true);
  await press('restore-route-backup');
  expect(has('restore-scan')).toBe(false);
  expect(texts()).toContain('لا يملك المشروع أي مفتاح: دون ورقة الاسترجاع، لا يمكن استرجاع شيء.');
  await press('restore-run');
  expect(texts()).toContain('يُختار الملف أولاً.');
  expect(readZip).not.toHaveBeenCalled();
});

test('restores a backup with the key typed, drops the copy and opens the history again', async () => {
  const text = await backupText();
  const { storage, onRestored } = await screen();
  openZip.mockResolvedValueOnce({ token: TOKEN, name: 'نسخة منهاجنا 2026-10-15.zip' });
  readZip.mockResolvedValueOnce(text);
  await press('restore-pick');
  expect(texts()).toContain('الملف: نسخة منهاجنا 2026-10-15.zip');
  await typeSecret(KEY.toLowerCase());
  await press('restore-run');
  expect(readZip).toHaveBeenCalledWith(TOKEN, 'minhajna-archive.json', KEY, true);
  expect(onRestored).toHaveBeenCalledTimes(1);
  expect(dropFile).toHaveBeenCalledWith(TOKEN);
  expect((await openRecordBook(storage.asSpec())).state.pupils.size).toBeGreaterThan(0);
});

test('says a key that does not open the file, and clears it as the key is typed again', async () => {
  const { storage, onRestored } = await screen();
  openZip.mockResolvedValueOnce({ token: TOKEN, name: '' });
  readZip.mockRejectedValueOnce(Object.assign(new Error('refused'), { code: 'E_ZIP_PASSWORD' }));
  await press('restore-pick');
  expect(texts()).toContain('اختير الملف');
  await typeSecret(KEY);
  await press('restore-run');
  expect(texts()).toContain('لا يفتح هذا المفتاح الملف. تُراجع الورقة ويُكتب من جديد.');
  await typeSecret(`${KEY} `);
  expect(has('restore-problem')).toBe(false);
  expect(onRestored).not.toHaveBeenCalled();
  expect(storage.rows).toEqual([]);
});

test('a changed file has its own page, and another file is chosen from it', async () => {
  const { storage } = await screen();
  openZip.mockResolvedValueOnce({ token: TOKEN, name: 'نسخة.zip' });
  readZip.mockRejectedValueOnce(Object.assign(new Error('refused'), { code: 'E_ZIP_CHANGED' }));
  await press('restore-pick');
  await typeSecret(KEY);
  await press('restore-run');
  expect(has('restore-fail')).toBe(true);
  expect(accessibilityProblems(root())).toEqual([]);
  expect(texts()).toEqual(
    expect.arrayContaining([
      'تغيّر الملف بعد حفظه',
      'لا يطابق الملف ما كُتب عند حفظه: تغيّر بعده، أو أن المفتاح ليس مفتاحه.',
      'لم يُحفظ منه شيء على هذا الهاتف، ويبقى الملف في مكانه كما هو.',
    ]),
  );
  expect(storage.rows).toEqual([]);
  await press('restore-again');
  expect(has('restore-fail')).toBe(false);
  expect(dropFile).toHaveBeenCalledWith(TOKEN);
  expect(has('restore-picked')).toBe(false);
});

test('the export route asks for its password, if it has one, and reads it without a seal', async () => {
  await screen();
  await press('restore-route-archive');
  expect(texts()).toEqual(expect.arrayContaining(['اختيار ملف التصدير', 'كلمة سر الملف، إن كانت له']));
  openZip.mockResolvedValueOnce({ token: TOKEN, name: 'أرشيف.zip' });
  readZip.mockRejectedValueOnce(Object.assign(new Error('refused'), { code: 'E_ZIP_PASSWORD' }));
  await press('restore-pick');
  await press('restore-run');
  expect(readZip).toHaveBeenCalledWith(TOKEN, 'minhajna-archive.json', '', false);
  expect(texts()).toContain('لهذا الملف كلمة سر. تُكتب في الحقل.');
  expect(texts()).not.toContain('لا يملك المشروع أي مفتاح: دون ورقة الاسترجاع، لا يمكن استرجاع شيء.');
  readZip.mockRejectedValueOnce(Object.assign(new Error('refused'), { code: 'E_ZIP_CHANGED' }));
  await press('restore-run');
  expect(texts()).toEqual(
    expect.arrayContaining([
      'لا يطابق الملف ما كُتب عند تصديره: تغيّر بعده، أو أن كلمة السر ليست كلمته، إن كانت له كلمة سر.',
      'إن كان الهاتف الذي صدر منه في اليد، يُصدَّر منه الملف من جديد. وإلا، يُختار ملف آخر، أو تُراجع كلمة السر.',
    ]),
  );
  await press('restore-again');
  expect(dropFile).toHaveBeenCalledWith(TOKEN);
  openZip.mockResolvedValueOnce({ token: TOKEN, name: 'أرشيف.zip' });
  await press('restore-pick');
  dropFile.mockClear();
  await press('restore-route-backup');
  expect(dropFile).toHaveBeenCalledWith(TOKEN);
  expect(has('restore-picked')).toBe(false);
});

test.each(['fr', 'en'] as const)('names every text and control in %s', async (language) => {
  await i18n.changeLanguage(language);
  await screen();
  expect(accessibilityProblems(root())).toEqual([]);
  openZip.mockResolvedValueOnce({ token: TOKEN, name: 'x.zip' });
  readZip.mockRejectedValueOnce(Object.assign(new Error('refused'), { code: 'E_ZIP_CHANGED' }));
  await press('restore-pick');
  await typeSecret(KEY);
  await press('restore-run');
  expect(accessibilityProblems(root())).toEqual([]);
  expect(missingKeys).toEqual([]);
});

test('drops the kept copy when the screen closes', async () => {
  await screen();
  openZip.mockResolvedValueOnce({ token: TOKEN, name: 'نسخة.zip' });
  await press('restore-pick');
  expect(dropFile).not.toHaveBeenCalled();
  await unmount();
  expect(dropFile).toHaveBeenCalledWith(TOKEN);
});
