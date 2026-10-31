// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { CountryProfile, DeviceFacts } from '@minhajna/core';
import type { Translate } from '../documents/document-data';
import { currentLanguage } from '../text/i18n';
import { dayName } from '../today/DayMark';

/** The known retained file, never a transfer assumed to be a backup (#485); personal fields always stay out. */
export function eraseCopyLines(t: Translate, facts: DeviceFacts, profile: Pick<CountryProfile, 'months'>) {
  const file = facts.restoredFile;
  if (file !== null && file.from !== 'phone') {
    const day = dayName(t, file.day, currentLanguage(), profile);
    return {
      kept: [
        t(file.from === 'backup' ? 'settings.savedFile.keptBackup' : 'settings.savedFile.keptArchive', { day }),
        t('settings.savedFile.leftOut'),
      ],
      lost: t(file.since === 0 ? 'settings.savedFile.none' : 'settings.savedFile.lost', { count: file.since }),
    };
  }
  const { lastBackup, sinceBackup } = facts;
  const day = lastBackup === null ? '' : dayName(t, lastBackup, currentLanguage(), profile);
  return {
    kept:
      lastBackup === null
        ? [t('settings.eraseDevice.keptNone')]
        : [t('settings.eraseDevice.keptBackup', { day }), t('settings.eraseDevice.keptLeftOut')],
    lost:
      lastBackup === null
        ? t('settings.eraseDevice.lost', { count: sinceBackup })
        : sinceBackup === 0
          ? t('settings.eraseDevice.lostNone', { day })
          : t('settings.eraseDevice.lostSince', { count: sinceBackup, day }),
  };
}
