// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { type CountryProfile, type DeviceFacts } from '@minhajna/core';
import type { Translate } from '../documents/document-data';
import { currentLanguage } from '../text/i18n';
import { dayName } from '../today/DayMark';

/** The last file saved or the source of a restore, as shown on the devices page. */
export function backupLine(t: Translate, facts: DeviceFacts, profile: Pick<CountryProfile, 'months'>): string {
  const { lastBackup: last, restoredFile: file, received } = facts;
  if (file !== null && file.from !== 'phone')
    return t(`settings.savedFile.${file.from}`, { day: dayName(t, file.day, currentLanguage(), profile) });
  if (last === null && received?.from === 'phone')
    return t('settings.savedFile.phone', { day: dayName(t, received.day, currentLanguage(), profile) });
  return last === null
    ? t('settings.devices.noBackup')
    : t('settings.devices.last', { day: dayName(t, last, currentLanguage(), profile) });
}
