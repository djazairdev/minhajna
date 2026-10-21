// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A signed calendar update whose signature checks (Import-update board,
// R-4.8-03, R-4.8-04): who signed it and the key's fingerprint, what it
// holds, and, for a new release, what it changes for the teacher's own
// schools and classes, with the others only counted (answer 310).

import { formatDay, type CalendarUpdate, type TrustedKey, type UpdateChange, type UpdateStatus } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { Text, View } from 'react-native';
import { Badge } from '../components/Badge';
import { localized } from '../setup/names';
import { settingsStyles as styles } from '../settings/styles';
import { useText } from '../text/i18n';
import { UpdateChangeList } from './UpdateChangeList';
import { isolate } from '../week/grid-labels';

/** The fingerprint in groups of four, read left to right inside any sentence. */
export function fingerprintText(fingerprint: string): string {
  return isolate(fingerprint.match(/.{1,4}/g)?.join(' ') ?? fingerprint);
}

export function UpdateDetails({
  update,
  signer,
  status,
  via,
  mine,
  others,
}: {
  update: CalendarUpdate;
  signer: TrustedKey;
  status: UpdateStatus;
  via: string;
  mine: readonly UpdateChange[];
  others: number;
}) {
  const t = useText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  return (
    <View testID="update-details" style={styles.card}>
      <Text style={[styles.body, align]}>{via}</Text>
      <Badge
        testID="update-status"
        variant={status === 'new' ? 'done' : 'default'}
        label={t(`calendarView.update.status.${status}`)}
      />
      <Text accessibilityRole="header" style={[styles.title, align]}>
        {t('calendarView.update.signed')}
      </Text>
      <Text style={[styles.body, align]}>
        {t('calendarView.update.signer', { holder: isolate(localized(signer.holder)) })}
      </Text>
      <Text style={[styles.body, align]}>{t('calendarView.update.fingerprint')}</Text>
      <Text testID="update-fingerprint" selectable style={[styles.body, align]}>
        {fingerprintText(signer.fingerprint)}
      </Text>
      <Text accessibilityRole="header" style={[styles.title, align]}>
        {t('calendarView.update.contents')}
      </Text>
      <Text style={[styles.body, align]}>{t('calendarView.update.calendar', { year: isolate(update.year) })}</Text>
      <Text style={[styles.body, align]}>
        {t('calendarView.update.release', { release: isolate(update.release), day: formatDay(update.published) })}
      </Text>
      {status === 'new' && (
        <>
          <Text accessibilityRole="header" style={[styles.title, align]}>
            {t('calendarView.update.changes')}
          </Text>
          <UpdateChangeList mine={mine} others={others} />
        </>
      )}
      {status === 'held' && <Text style={[styles.body, align]}>{t('calendarView.update.held')}</Text>}
      {status === 'older' && <Text style={[styles.body, align]}>{t('calendarView.update.older')}</Text>}
    </View>
  );
}
