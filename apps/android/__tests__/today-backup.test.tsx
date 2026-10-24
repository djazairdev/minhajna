// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Today's 30-day backup reminder (#247, Today-backup, answer 482): nothing
// before it falls due, 30 days after the first change or the last backup;
// then the last backup's day, or none, and «نسخة الآن», saved under the
// recovery key through the file picker, or the recovery sheet first without
// one; «تذكيري لاحقاً» putting it off 7 days, with «تراجع»; nothing when it is
// turned off; a restore putting it off 30 days; and every text in French
// and English. Made-up records only.

import { addDays, deviceFacts, parseDay, type Day } from '@minhajna/core';
import { accessibilityProblems } from '../jest/accessibility';
import type { TestData } from '../jest/app-data';
import { DAY, mount, press, root, texts, unmount } from '../jest/components-screen';
import { withPupils } from '../jest/roll-class';
import files from '../src/native/NativeMinhajnaFiles';
import { backupLater, putOffFromRestore, setBackupLater } from '../src/settings/backup-later';
import { setNotifyPrefs } from '../src/settings/notify-prefs';
import { i18n, missingKeys } from '../src/text/i18n';
import { TodayBackup } from '../src/today/TodayBackup';
import { Today } from '../src/today/Today';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const KEY = ['K7QF', '3M9T', 'WX2R', '8HDN', 'P4VC', '6JYE'].join('');
const DUE = addDays(DAY, 30);
const makeZip = jest.spyOn(files, 'makeZip');
const saveFile = jest.spyOn(files, 'saveFile');

beforeEach(() => {
  missingKeys.length = 0;
});
afterEach(async () => {
  await unmount();
  setBackupLater(null);
  setNotifyPrefs({ backup: true });
  await i18n.changeLanguage('ar');
  jest.clearAllMocks();
});

const has = (testID: string) => root().findAll((node) => node.props.testID === testID).length > 0;

async function show(data: TestData, day: Day = DUE) {
  const onSheet = jest.fn();
  await mount(data, <TodayBackup day={day} onSheet={onSheet} />, day);
  return onSheet;
}

test('shows nothing before it falls due, then that no backup was saved, with both choices', async () => {
  const data = await withPupils();
  expect(deviceFacts(data.book.entries).firstChange).toBe(DAY);
  await show(data, addDays(DUE, -1));
  expect(has('today-backup')).toBe(false);
  await unmount();
  await show(data);
  expect(texts()).toEqual([
    'لا نسخة احتياطية منذ 30 يوماً',
    'لم تُحفظ نسخة على هذا الهاتف بعد.',
    'ما لم تحفظه نسخة يبقى على هذا الهاتف وحده. ولا يملك المشروع أي مفتاح، فلا يستطيع استرجاعه.',
    'نسخة الآن',
    'تذكيري لاحقاً',
  ]);
  expect(accessibilityProblems(root())).toEqual([]);
});

test('saves the backup under the recovery key through the file picker, then says so', async () => {
  const data = await withPupils();
  await data.book.record(DAY, { kind: 'recovery.set', recovery: { key: KEY } });
  const onSheet = await show(data);
  await press('today-backup-now');
  expect(makeZip).toHaveBeenCalledTimes(1);
  expect(makeZip.mock.calls[0]?.[3]).toBe(KEY);
  expect(saveFile).toHaveBeenCalledTimes(1);
  expect(onSheet).not.toHaveBeenCalled();
  expect(deviceFacts(data.book.entries).lastBackup).toBe(DUE);
  expect(texts()).toEqual(['حُفظت نسخة اليوم.']);
});

test('a cancelled save leaves the reminder as it was, and a failed one says so', async () => {
  const data = await withPupils();
  await data.book.record(DAY, { kind: 'recovery.set', recovery: { key: KEY } });
  await show(data);
  saveFile.mockResolvedValueOnce(false);
  await press('today-backup-now');
  expect(has('today-backup')).toBe(true);
  expect(has('today-backup-failed')).toBe(false);
  makeZip.mockRejectedValueOnce(new Error('full'));
  await press('today-backup-now');
  expect(texts()).toContain('لم تُحفظ النسخة. أعد المحاولة.');
  expect(deviceFacts(data.book.entries).lastBackup).toBeNull();
});

test('without a recovery key, «نسخة الآن» gives the recovery sheet first', async () => {
  const onSheet = await show(await withPupils());
  await press('today-backup-now');
  expect(onSheet).toHaveBeenCalledTimes(1);
  expect(makeZip).not.toHaveBeenCalled();
});

test('gives the last backup day, and counts 30 days from it', async () => {
  const data = await withPupils();
  const saved = parseDay('2026-10-20');
  await data.book.record(saved, { kind: 'backup.saved' });
  await show(data);
  expect(has('today-backup')).toBe(false);
  await unmount();
  await show(data, addDays(saved, 30));
  expect(texts()).toContain('آخر نسخة احتياطية: الثلاثاء 20 أكتوبر');
});

test('«تذكيري لاحقاً» puts it off 7 days, «تراجع» brings it back, and it comes back on its day', async () => {
  const data = await withPupils();
  await show(data);
  await press('today-backup-put-off');
  expect(backupLater()).toBe(addDays(DUE, 7));
  expect(texts()).toEqual(['يعود التذكير يوم السبت 21 نوفمبر.', 'تراجع']);
  await press('today-backup-undo');
  expect(backupLater()).toBeNull();
  expect(has('today-backup')).toBe(true);
  await press('today-backup-put-off');
  await unmount();
  await show(data, addDays(DUE, 6));
  expect(has('today-backup')).toBe(false);
  await unmount();
  await show(data, addDays(DUE, 7));
  expect(has('today-backup')).toBe(true);
});

test('shows nothing once turned off in «الإشعارات»', async () => {
  setNotifyPrefs({ backup: false });
  await show(await withPupils());
  expect(has('today-backup')).toBe(false);
});

test('a restore puts the reminder off 30 days from its day', async () => {
  expect(putOffFromRestore(DUE)).toBe(true);
  expect(backupLater()).toBe(addDays(DUE, 30));
  await show(await withPupils(), addDays(DUE, 29));
  expect(has('today-backup')).toBe(false);
});

test('Today shows the reminder when its navigator offers the recovery sheet', async () => {
  const data = await withPupils();
  await mount(data, <Today onHelp={jest.fn()} onDetails={jest.fn()} onRoll={jest.fn()} />, DUE);
  expect(has('today-backup')).toBe(false);
  await unmount();
  const onSheet = jest.fn();
  const today = <Today onHelp={jest.fn()} onDetails={jest.fn()} onRoll={jest.fn()} onBackupSheet={onSheet} />;
  await mount(data, today, DUE);
  await press('today-backup-now');
  expect(onSheet).toHaveBeenCalledTimes(1);
});

test.each(['fr', 'en'] as const)('every text is found in %s', async (language) => {
  await i18n.changeLanguage(language);
  const data = await withPupils();
  await show(data);
  await press('today-backup-put-off');
  await press('today-backup-undo');
  expect(texts()).toContain(i18n.t('today.backup.none'));
  expect(missingKeys).toEqual([]);
});
