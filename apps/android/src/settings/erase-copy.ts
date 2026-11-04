// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { CountryProfile, Day, DeviceFacts } from '@minhajna/core';
import type { Translate } from '../documents/document-data';
import { currentLanguage } from '../text/i18n';
import { dayName } from '../today/DayMark';

/** The erase warning's lines: the most complete copy known to exist elsewhere, if any, and what erasing loses. */
export function eraseCopyLines(t: Translate, facts: DeviceFacts, profile: Pick<CountryProfile, 'months'>) {
  const { lastCopy, sinceCopy: count } = facts;
  const name = (day: Day) => dayName(t, day, currentLanguage(), profile);
  const file = facts.restoredFile;
  if (lastCopy === null) {
    if (facts.received?.from !== 'phone')
      return { kept: [t('settings.eraseDevice.keptNone')], lost: t('settings.eraseDevice.lost', { count }) };
    return {
      kept: [t('settings.savedFile.phoneUnconfirmed')],
      lost:
        file?.from === 'phone' && count > 0
          ? t('settings.savedFile.phoneEraseChanges', { count })
          : t('settings.savedFile.phoneErase'),
    };
  }

  const day = name(lastCopy.day);
  if (lastCopy.from === 'transfer')
    return {
      kept: [
        ...(facts.backupMade === null ? [] : [t('settings.eraseDevice.keptBackup', { day: name(facts.backupMade) })]),
        ...(file === null || file.from === 'phone'
          ? []
          : [
              t(file.from === 'backup' ? 'settings.savedFile.keptBackup' : 'settings.savedFile.keptArchive', {
                day: name(file.day),
              }),
            ]),
        t('settings.savedFile.transfer.kept', { day }),
        t('settings.savedFile.transfer.leftOut'),
      ],
      lost: t(count === 0 ? 'settings.savedFile.transfer.lostNone' : 'settings.savedFile.transfer.lost', {
        count,
        day,
      }),
    };

  if (lastCopy.from === 'backup')
    return {
      kept: [t('settings.eraseDevice.keptBackup', { day }), t('settings.eraseDevice.keptLeftOut')],
      lost: t(count === 0 ? 'settings.eraseDevice.lostNone' : 'settings.eraseDevice.lostSince', { count, day }),
    };

  return {
    kept: [
      t(lastCopy.from === 'restored-backup' ? 'settings.savedFile.keptBackup' : 'settings.savedFile.keptArchive', {
        day,
      }),
      t('settings.savedFile.leftOut'),
    ],
    lost: t(count === 0 ? 'settings.savedFile.none' : 'settings.savedFile.lost', { count }),
  };
}
