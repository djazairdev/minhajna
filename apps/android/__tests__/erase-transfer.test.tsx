// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Erase warnings after a confirmed transfer (#494), on the phone and PC,
// with made-up records only. All languages name the transfer, preserve the
// excluded-personal-fields warning and count changes outside its snapshot.

import { parseDay, type RecordEvent } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Platform } from 'react-native';
import { accessibilityProblems } from '../jest/accessibility';
import { mount, root, texts, unmount } from '../jest/components-screen';
import { withPupils } from '../jest/roll-class';
import { EraseDevice } from '../src/settings/EraseDevice';
import { i18n, missingKeys } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const day = parseDay('2026-10-21');
const change: RecordEvent = { kind: 'session.noted', note: { sessionKey: 'made-up', note: 'Made-up note' } };
const lines = [
  {
    language: 'ar',
    kept: 'النسخة التي فتحتها على الجهاز الآخر يوم الأربعاء 21 أكتوبر: لا يمسّها هذا المسح.',
    none: 'لا تغيير بعد النقل يوم الأربعاء 21 أكتوبر: التغييرات على الجهاز الآخر.',
    one: 'تغيير واحد لم يكن في الملف الذي نقلته يوم الأربعاء 21 أكتوبر، ولا في نسخة احتياطية لاحقة: يضيع بالمسح.',
    leftOut:
      'الحقول الشخصية في بطاقة الأستاذ والتوقيع المرسوم لا ينتقلان إلى الجهاز الآخر ولا إلى النسخ الاحتياطية: يضيعان بالمسح.',
  },
  {
    language: 'fr',
    kept: 'La copie ouverte sur l’autre appareil le Mercredi 21 octobre : cet effacement n’y touche pas.',
    none: 'Aucun changement après le transfert du Mercredi 21 octobre : les changements sont sur l’autre appareil.',
    one: '1 changement absent du fichier transféré le Mercredi 21 octobre et de toute sauvegarde ultérieure : il est perdu avec l’effacement.',
    leftOut:
      'Les champs personnels de la fiche de l’enseignant et la signature dessinée ne sont ni transférés ni sauvegardés : ils partent avec l’effacement.',
  },
  {
    language: 'en',
    kept: 'The copy you opened on the other device on Wednesday 21 October: this erasure does not touch it.',
    none: 'No change after the transfer on Wednesday 21 October: the changes are on the other device.',
    one: '1 change was not in the file transferred on Wednesday 21 October or a later backup, and is lost with the erasure.',
    leftOut:
      'The teacher card’s personal fields and the drawn signature are neither transferred nor backed up: they go with the erasure.',
  },
] as const;

beforeEach(() => {
  missingKeys.length = 0;
});
afterEach(async () => {
  await unmount();
  jest.restoreAllMocks();
  await i18n.changeLanguage('ar');
});

async function transferred(between = false, after = false, backup = false) {
  const data = await withPupils();
  if (backup) await data.book.record(parseDay('2026-10-20'), { kind: 'backup.saved' });
  const last = data.book.entries.at(-1)!.hash;
  if (between) await data.book.record(day, change);
  await data.book.record(day, { kind: 'handover.sent', handover: { last } });
  if (after) await data.book.record(day, change);
  return data;
}

async function screen(data: Awaited<ReturnType<typeof withPupils>>, language = 'ar') {
  await i18n.changeLanguage(language);
  await mount(
    data,
    <LocaleDirContext.Provider value={language === 'ar' ? 'rtl' : 'ltr'}>
      <EraseDevice storage={data.storage.asSpec()} onExport={jest.fn()} />
    </LocaleDirContext.Provider>,
  );
}

describe.each(['android', 'web'] as const)('a confirmed transfer on %s', (platform) => {
  beforeEach(() => jest.replaceProperty(Platform, 'OS', platform));

  test.each(lines)('names the transfer with no lost changes in $language', async (line) => {
    await screen(await transferred(), line.language);
    expect(texts()).toEqual(expect.arrayContaining([line.kept, line.none, line.leftOut]));
    expect(accessibilityProblems(root())).toEqual([]);
    expect(missingKeys).toEqual([]);
  });

  test.each(lines)('counts a change made while the file was being opened in $language', async (line) => {
    await screen(await transferred(true), line.language);
    expect(texts()).toEqual(expect.arrayContaining([line.kept, line.one, line.leftOut]));
    expect(texts()).not.toContain(line.none);
    expect(missingKeys).toEqual([]);
  });

  test('counts later changes and keeps the earlier backup’s own date', async () => {
    await screen(await transferred(false, true, true), 'en');
    expect(texts()).toEqual(
      expect.arrayContaining([
        lines[2].kept,
        lines[2].one,
        'The last backup, made on Tuesday 20 October, and the files saved elsewhere: the erasure does not touch them.',
      ]),
    );
  });

  test('uses a newer backup instead of the earlier transfer', async () => {
    const data = await transferred();
    await data.book.record(parseDay('2026-10-22'), { kind: 'backup.saved' });
    await screen(data, 'en');
    expect(texts()).toContain('No change since the last backup, on Thursday 22 October: every change is in it.');
    expect(texts()).not.toContain(lines[2].kept);
  });

  test('does not claim that an unconfirmed or invalid transfer reached another device', async () => {
    const data = await withPupils();
    await screen(data, 'en');
    expect(texts()).not.toContain(lines[2].kept);
    await unmount();
    await data.book.record(day, { kind: 'handover.sent', handover: { last: 'a'.repeat(64) } });
    await screen(data, 'en');
    expect(texts()).not.toContain(lines[2].kept);
    expect(texts().some((text) => text.startsWith(`${data.book.entries.length} changes have reached neither`))).toBe(
      true,
    );
  });
});
