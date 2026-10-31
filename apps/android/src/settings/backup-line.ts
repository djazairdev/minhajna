// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { deviceFacts, type CountryProfile, type Entry } from '@minhajna/core';
import type { Translate } from '../documents/document-data';
import { currentLanguage } from '../text/i18n';
import { dayName } from '../today/DayMark';

/** The day of the last backup, as the devices page and its Settings row say it, or that there is none yet (#247). */
export function backupLine(t: Translate, entries: readonly Entry[], profile: Pick<CountryProfile, 'months'>): string {
  const { lastBackup: last, restoredFile: file } = deviceFacts(entries);
  if (file !== null && file.from !== 'phone')
    return t(`settings.savedFile.${file.from}`, { day: dayName(t, file.day, currentLanguage(), profile) });
  return last === null
    ? t('settings.devices.noBackup')
    : t('settings.devices.last', { day: dayName(t, last, currentLanguage(), profile) });
}
