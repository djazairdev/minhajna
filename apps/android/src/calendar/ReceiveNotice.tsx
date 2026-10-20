// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { formatDay, type CalendarNotice } from '@minhajna/core';
import { Text, View } from 'react-native';
import { gradeName, levelName, localized } from '../setup/names';
import { settingsStyles as styles } from '../settings/styles';
import { useText } from '../text/i18n';
import { useAppData } from '../storage/AppData';
import { isolate } from '../week/grid-labels';

/** Received labels are claims from the file, never proof of the sender or school's identity. */
export function ReceiveNotice({ notice }: { notice: CalendarNotice }) {
  const t = useText();
  const { profile } = useAppData();
  const entry = notice.entry;
  const zone = notice.school?.zone ?? entry.zone;
  const place = profile.zones?.find((one) => one.code === zone);
  const zoneName = place === undefined ? zone : `${zone} · ${localized(place.name)}`;
  const zoneText = zoneName === undefined ? '' : isolate(zoneName);
  return (
    <View testID="calendar-received-notice" style={styles.card}>
      {notice.version.minor > 0 && <Text style={styles.body}>{t('calendarView.receive.newerMinor')}</Text>}
      <Text accessibilityRole="header" style={styles.title}>
        {localized(entry.name)}
      </Text>
      <Text style={styles.body}>
        {t('calendarView.range', { from: formatDay(entry.from), to: formatDay(entry.to) })}
      </Text>
      <Text style={styles.body}>{t(`calendarView.periods.${entry.half ?? 'all'}`)}</Text>
      <Text style={styles.body}>{t('settings.source', { source: isolate(entry.source) })}</Text>
      <Text style={styles.body}>{t(`settings.confidence.${entry.confidence}`)}</Text>
      <Text style={styles.body}>{t('calendarView.receive.sender', { sender: isolate(notice.sender) })}</Text>
      {notice.school !== undefined && (
        <Text style={styles.body}>
          {t('calendarView.receive.school', {
            name: isolate(notice.school.name),
            zone: zoneText,
            code: isolate(notice.school.code ?? t('calendarView.receive.noCode')),
          })}
        </Text>
      )}
      {entry.layer === 'zone' && <Text style={styles.body}>{t('calendarView.receive.zone', { zone: zoneText })}</Text>}
      {(entry.levels !== undefined || entry.grades !== undefined) && (
        <Text style={styles.body}>
          {[
            ...(entry.levels ?? []).map((code) => levelName(t, profile, code)),
            ...(entry.grades ?? []).map((code) => gradeName(profile, code)),
          ].join(' · ')}
        </Text>
      )}
    </View>
  );
}
