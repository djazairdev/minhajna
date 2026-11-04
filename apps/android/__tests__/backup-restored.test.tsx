// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { archiveOf, archiveText, deviceFacts, parseDay } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Platform } from 'react-native';
import { accessibilityProblems } from '../jest/accessibility';
import { openTestData } from '../jest/app-data';
import { mount, root, texts, unmount } from '../jest/components-screen';
import { FakeStorage } from '../jest/fake-storage';
import { withPupils } from '../jest/roll-class';
import files from '../src/native/NativeMinhajnaFiles';
import { restoreFile, type RestoreRoute } from '../src/restore/restore-run';
import { Devices } from '../src/settings/Devices';
import { EraseDevice } from '../src/settings/EraseDevice';
import { setBackupLater } from '../src/settings/backup-later';
import { nativeDeps } from '../src/storage/history';
import { i18n, missingKeys } from '../src/text/i18n';
import { TodayBackup } from '../src/today/TodayBackup';
import { dayName } from '../src/today/DayMark';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('../src/lock/browser-offers', () => ({
  ...jest.requireActual<typeof import('../src/lock/browser-offers')>('../src/lock/browser-offers'),
  useDataKept: () => true,
}));

const MADE = parseDay('2026-10-15');
const RESTORED = parseDay('2026-10-31');
const DUE = parseDay('2026-11-14');
const KEY = ['K7QF', '3M9T', 'WX2R', '8HDN', 'P4VC', '6JYE'].join('');
const readZip = jest.spyOn(files, 'readZip');

afterEach(async () => {
  await unmount();
  setBackupLater(null);
  await i18n.changeLanguage('ar');
  jest.restoreAllMocks();
  readZip.mockReset();
});

async function restored(from: RestoreRoute) {
  const source = await withPupils();
  const archive = archiveOf(source.book.entries, source.book.state, {
    made: MADE,
    app: '0.6.2',
    country: source.profile.code,
    calendarRelease: source.calendarRelease,
    privateNotes: true,
    bundledPacks: source.packs,
  });
  const target = FakeStorage.unlocked();
  const spec = target.asSpec();
  jest.spyOn(files, 'readZip').mockResolvedValueOnce(archiveText(archive));
  expect(
    await restoreFile(
      {
        route: from,
        token: 'invented-file',
        secret: from === 'archive' ? '' : KEY,
        country: source.profile.code,
        day: RESTORED,
      },
      { files, storage: spec, deps: nativeDeps(spec) },
    ),
  ).toEqual({ ok: true });
  return openTestData(target);
}

test.each(['android', 'web'] as const)(
  'restored files are named accurately on %s, in every language',
  async (platform) => {
    jest.replaceProperty(Platform, 'OS', platform);
    for (const language of ['ar', 'fr', 'en'] as const) {
      await i18n.changeLanguage(language);
      for (const from of ['backup', 'archive'] as const) {
        missingKeys.length = 0;
        const data = await restored(from);
        const direction = language === 'ar' ? 'rtl' : 'ltr';
        await mount(
          data,
          <LocaleDirContext.Provider value={direction}>
            <Devices onTransfer={jest.fn()} onSheet={jest.fn()} backupNow={false} onBackupStarted={jest.fn()} />
          </LocaleDirContext.Provider>,
          RESTORED,
        );
        const day = dayName(i18n.t, MADE, language, data.profile);
        expect(texts()).toContain(i18n.t(`settings.savedFile.${from}`, { day }));
        expect(texts()).not.toContain(i18n.t('settings.devices.noBackup'));
        expect(accessibilityProblems(root())).toEqual([]);
        await unmount();
        await mount(
          data,
          <LocaleDirContext.Provider value={direction}>
            <EraseDevice storage={data.storage.asSpec()} onExport={jest.fn()} />
          </LocaleDirContext.Provider>,
          RESTORED,
        );
        expect(texts()).toContain(
          i18n.t(from === 'backup' ? 'settings.savedFile.keptBackup' : 'settings.savedFile.keptArchive', { day }),
        );
        expect(texts()).toContain(i18n.t('settings.savedFile.none'));
        expect(accessibilityProblems(root())).toEqual([]);
        await unmount();
        await data.book.record(RESTORED, { kind: 'setup.finished' });
        await mount(data, <EraseDevice storage={data.storage.asSpec()} onExport={jest.fn()} />, RESTORED);
        expect(texts()).toContain(i18n.t('settings.savedFile.lost', { count: 1 }));
        expect(missingKeys).toEqual([]);
        await unmount();
      }
    }
  },
);

test('the due reminder names the source file, not a nonexistent new backup', async () => {
  for (const from of ['backup', 'archive'] as const) {
    const data = await restored(from);
    await mount(data, <TodayBackup day={DUE} onSheet={jest.fn()} />, DUE);
    expect(texts()).toContain(i18n.t(`settings.savedFile.${from}`, { day: dayName(i18n.t, MADE, 'ar', data.profile) }));
    expect(texts()).not.toContain(i18n.t('today.backup.none'));
    await unmount();
  }
});

test('a transferred file is not presented as a retained backup', async () => {
  const data = await restored('phone');
  expect(deviceFacts(data.book.entries).restoredFile?.from).toBe('phone');
  await mount(
    data,
    <Devices onTransfer={jest.fn()} onSheet={jest.fn()} backupNow={false} onBackupStarted={jest.fn()} />,
  );
  expect(texts()).toContain(i18n.t('settings.savedFile.phone', { day: dayName(i18n.t, RESTORED, 'ar', data.profile) }));
  await unmount();
  await mount(data, <EraseDevice storage={data.storage.asSpec()} onExport={jest.fn()} />, RESTORED);
  expect(texts()).toContain(i18n.t('settings.savedFile.phoneUnconfirmed'));
  expect(texts()).toContain(i18n.t('settings.savedFile.phoneErase'));
});

test('a phone that received a copy counts only the changes made after it arrived', async () => {
  const data = await restored('phone');
  await data.book.record(RESTORED, { kind: 'session.noted', note: { sessionKey: 'made-up', note: 'Made-up note' } });
  expect(deviceFacts(data.book.entries).sinceCopy).toBe(1);
  await mount(data, <EraseDevice storage={data.storage.asSpec()} onExport={jest.fn()} />, RESTORED);
  expect(texts()).toContain(i18n.t('settings.savedFile.phoneEraseChanges', { count: 1 }));
  expect(texts()).not.toContain(i18n.t('settings.savedFile.phoneErase'));
  expect(missingKeys).toEqual([]);
});

test('a phone copy sent on and taken back stays unproven, and one that came back claims no copy', async () => {
  const data = await restored('phone');
  const erase = <EraseDevice storage={data.storage.asSpec()} onExport={jest.fn()} />;
  const sent = { kind: 'handover.sent', handover: { last: data.book.entries.at(-1)!.hash } } as const;
  await data.book.record(RESTORED, sent);
  await data.book.record(RESTORED, { kind: 'handover.ended', handover: { how: 'taken' } });
  await mount(data, erase, RESTORED);
  expect(texts()).toContain(i18n.t('settings.savedFile.phoneUnconfirmed'));
  expect(texts()).toContain(i18n.t('settings.savedFile.phoneErase'));
  await unmount();
  await data.book.record(RESTORED, sent);
  await data.book.record(RESTORED, { kind: 'handover.ended', handover: { how: 'back' } });
  await mount(data, erase, RESTORED);
  const count = deviceFacts(data.book.entries).sinceCopy;
  expect(count).toBeGreaterThan(0);
  expect(texts()).toContain(i18n.t('settings.eraseDevice.keptNone'));
  expect(texts()).toContain(i18n.t('settings.eraseDevice.lost', { count }));
  expect(texts()).not.toContain(i18n.t('settings.savedFile.phoneUnconfirmed'));
});

test.each([
  ['ar', [0, 1, 2, 3, 11, 100]],
  ['fr', [1, 2, 1000000]],
  ['en', [1, 2]],
] as const)('the changes a received copy leaves on the phone are said in %s', async (language, counts) => {
  await i18n.changeLanguage(language);
  const said = counts.map((count) => i18n.t('settings.savedFile.phoneEraseChanges', { count }));
  expect(new Set(said).size).toBe(counts.length);
  expect(missingKeys).toEqual([]);
});

test.each([
  ['backup', 'keptBackup'],
  ['archive', 'keptArchive'],
] as const)('a confirmed transfer leaves the restored %s named on the erase screen', async (from, kept) => {
  const data = await restored(from);
  const last = data.book.entries.at(-1)!.hash;
  await data.book.record(RESTORED, { kind: 'handover.sent', handover: { last } });
  await mount(data, <EraseDevice storage={data.storage.asSpec()} onExport={jest.fn()} />, RESTORED);
  const day = dayName(i18n.t, MADE, 'ar', data.profile);
  expect(texts()).toContain(i18n.t(`settings.savedFile.${kept}`, { day }));
  expect(missingKeys).toEqual([]);
  expect(texts()).toContain(
    i18n.t('settings.savedFile.transfer.kept', { day: dayName(i18n.t, RESTORED, 'ar', data.profile) }),
  );
});
