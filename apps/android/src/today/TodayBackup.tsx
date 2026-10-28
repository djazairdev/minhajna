// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Today's backup reminder (#247, Today-backup, R-6.5-07, answer 482), as
// drawn without the sync row: once 30 days have passed without a backup, or
// since the first change when there is none, it gives the last backup's day,
// says what no backup holds stays on this phone alone, and offers «نسخة الآن»
// and «تذكيري لاحقاً». With a recovery key the backup is saved through the file
// picker, the second tap; without one, the devices page gives the recovery
// sheet first. «تذكيري لاحقاً» puts the reminder off 7 days, with «تراجع».
// Nothing shows when the reminder is turned off in «الإشعارات». On a PC
// whose browser has not agreed to keep the data (answer 511), it says so
// each day instead, as the lock page does, and offers «نسخة احتياطية الآن»
// until a backup is saved that day; it cannot be put off or turned off.
// Until the browser's answer is read, nothing shows, so one card never
// gives way to the other. On a PC, the web app's update comes first
// (`TodayDeviceCards`).

import { BACKUP_LATER_DAYS, addDays, backupReminderDay, compareDays, deviceFacts, type Day } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { controlIcon } from '../design/Icon';
import { colors, radius, spacing, typography } from '../design/tokens';
import { setBackupLater, useBackupLater } from '../settings/backup-later';
import { useBackup } from '../settings/backup-run';
import { useDataKept } from '../lock/browser-offers';
import { useNotifyPrefs } from '../settings/notify-prefs';
import { useAppData } from '../storage/AppData';
import { useDeviceText } from '../text/device-text';
import { currentLanguage } from '../text/i18n';
import { dayName } from './DayMark';
import { TodayAppUpdate } from './TodayAppUpdate';
import { takesUpdates } from '../settings/update-offer';

export type TodayBackupProps = {
  /** Today. */
  readonly day: Day;
  /** Opens the devices page and the recovery sheet, for a first backup. */
  readonly onSheet: () => void;
};

/** This device's cards on Today: the PC web app's update, on a PC only, then the backup. */
export function TodayDeviceCards(props: TodayBackupProps) {
  return (
    <>
      {takesUpdates && <TodayAppUpdate />}
      <TodayBackup {...props} />
    </>
  );
}

/** The reminder put off: the day it was put off to before, and the day it comes back. */
type Put = { readonly before: Day | null; readonly until: Day };

export function TodayBackup({ day, onSheet }: TodayBackupProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const kept = useDataKept();
  const { entries, profile } = useAppData();
  const on = useNotifyPrefs().backup;
  const later = useBackupLater();
  const { busy, said, backup } = useBackup();
  const [put, setPut] = useState<Put | null>(null);
  const facts = deviceFacts(entries());
  const due = backupReminderDay(facts, later);
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const name = (one: Day) => dayName(t, one, currentLanguage(), profile);
  const putOff = (until: Day | null, next: Put | null) => {
    try {
      setBackupLater(until);
      setPut(next);
    } catch {
      setPut(null);
    }
  };
  if (kept === null) return null;
  if (said === 'saved') {
    return <Notice testID="today-backup-saved" icon={controlIcon('check')} message={t('today.backup.saved')} />;
  }
  const key = facts.recovery?.key;
  const now = () => (key === undefined ? onSheet() : backup(key));
  if (kept === false) {
    const saved = facts.lastBackup !== null && compareDays(facts.lastBackup, day) === 0;
    return (
      <View testID="today-keep" style={styles.card}>
        <Text accessibilityRole="header" style={[styles.title, align]}>
          {t('lock.web.risk.title')}
        </Text>
        <Text style={[styles.body, align]}>{t('lock.web.risk.why')}</Text>
        <Text style={[styles.note, align]}>{t('lock.web.cleared')}</Text>
        {saved ? (
          <Notice testID="today-keep-saved" icon={controlIcon('check')} message={t('today.backup.saved')} />
        ) : (
          <>
            {said === 'failed' && (
              <Notice testID="today-keep-failed" icon={controlIcon('info')} message={t('today.backup.failed')} />
            )}
            <Button testID="today-keep-now" label={t('today.keep.now')} disabled={busy} onPress={now} />
            <Text style={[styles.note, align]}>{t('today.keep.where')}</Text>
          </>
        )}
      </View>
    );
  }
  if (put !== null) {
    return (
      <View testID="today-backup-later" style={styles.card}>
        <Text style={[styles.body, align]}>{t('today.backup.back', { day: name(put.until) })}</Text>
        <Button
          testID="today-backup-undo"
          variant="line"
          label={t('today.backup.undo')}
          onPress={() => putOff(put.before, null)}
        />
      </View>
    );
  }
  if (!on || due === null || compareDays(day, due) < 0) return null;
  const until = addDays(day, BACKUP_LATER_DAYS);
  return (
    <View testID="today-backup" style={styles.card}>
      <Text accessibilityRole="header" style={[styles.title, align]}>
        {t('notify.backupTitle')}
      </Text>
      <Text testID="today-backup-last" style={[styles.body, align]}>
        {facts.lastBackup === null ? t('today.backup.none') : t('today.backup.last', { day: name(facts.lastBackup) })}
      </Text>
      <Text style={[styles.note, align]}>{t('today.backup.body')}</Text>
      {said === 'failed' && (
        <Notice testID="today-backup-failed" icon={controlIcon('info')} message={t('today.backup.failed')} />
      )}
      <Button testID="today-backup-now" label={t('today.backup.now')} disabled={busy} onPress={now} />
      <Button
        testID="today-backup-put-off"
        variant="line"
        label={t('today.backup.later')}
        disabled={busy}
        onPress={() => putOff(until, { before: later, until })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing['space-8'],
    paddingVertical: spacing['space-12'],
    paddingHorizontal: spacing['space-14'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  title: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
});
