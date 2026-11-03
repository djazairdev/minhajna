// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { CountryProfile, DeviceFacts } from '@minhajna/core';
import type { Translate } from '../documents/document-data';
import { currentLanguage } from '../text/i18n';
import { dayName } from '../today/DayMark';

/** The most complete copy known to exist elsewhere, using the recorded history boundary. */
export function eraseCopyLines(t: Translate, facts: DeviceFacts, profile: Pick<CountryProfile, 'months'>) {
  const { lastCopy, sinceCopy: count } = facts;
  const name = (day: NonNullable<DeviceFacts['lastBackup']>) => dayName(t, day, currentLanguage(), profile);
  if (lastCopy === null)
    return {
      kept: [
        t(facts.received?.from === 'phone' ? 'settings.savedFile.phoneUnconfirmed' : 'settings.eraseDevice.keptNone'),
      ],
      lost: t(facts.received?.from === 'phone' ? 'settings.savedFile.phoneErase' : 'settings.eraseDevice.lost', {
        count,
      }),
    };

  const day = name(lastCopy.day);
  if (lastCopy.from === 'transfer')
    return {
      kept: [
        ...(facts.backupMade === null ? [] : [t('settings.eraseDevice.keptBackup', { day: name(facts.backupMade) })]),
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
