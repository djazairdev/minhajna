// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  announcedLate,
  editableCalendarEntry,
  entryUpdate,
  formatDay,
  isLunarHoliday,
  isWeekReset,
  movePublished,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { controlIcon } from '../design/Icon';
import { spacing } from '../design/tokens';
import { localized } from '../setup/names';
import { settingsStyles as styles } from '../settings/styles';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { schoolEntries, type CalendarOrigin } from './view';
import { coreContext } from '../storage/core-context';
import { CancelEntry } from './Cancel';
import { GroupPreview } from './GroupPreview';
import { lunarText } from './Lunar';
import { RamadanHours } from './RamadanHours';
import { holderOf } from './UpdateChanges';
import { isolate } from '../week/grid-labels';

/** Route identifiers are resolved against the current school scope, never trusted as record contents. */
export function CalendarEntry({
  id,
  origin,
  schoolId,
  onEdit,
  onCancelled,
  onLunar,
}: {
  id: string;
  origin: CalendarOrigin;
  schoolId: string;
  onEdit?: () => void;
  onCancelled?: () => void;
  onLunar?: () => void;
}) {
  const t = useText();
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const data = useAppData();
  const row = schoolEntries(data, schoolId).find((one) => one.origin === origin && one.entry.id === id);
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const entry = row?.entry;
  const base = data.calendar.find((one) => one.id === id);
  const lunar = base !== undefined && isLunarHoliday(base) && entry !== undefined;
  const editable = entry !== undefined && origin === 'local' && editableCalendarEntry(coreContext(data), id) !== null;
  const fromUpdate = origin === 'bundled' ? entryUpdate(coreContext(data), id) : undefined;
  const movedOn = origin === 'bundled' ? movePublished(coreContext(data), id) : undefined;
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          direction,
          paddingLeft: insets.left + spacing['space-16'],
          paddingRight: insets.right + spacing['space-16'],
          paddingBottom: insets.bottom + spacing['space-24'],
        },
      ]}
    >
      {entry === undefined ? (
        <Text style={[styles.body, align]}>{t('calendarView.missing')}</Text>
      ) : (
        <>
          <Text accessibilityRole="header" style={[styles.title, align]}>
            {localized(entry.name)}
          </Text>
          <Text style={[styles.body, align]}>
            {t('calendarView.range', { from: formatDay(entry.from), to: formatDay(entry.to) })}
          </Text>
          <Badge label={t(`calendarView.layer.${entry.layer}`)} />
          {!isWeekReset(entry) && (
            <Text style={[styles.body, align]}>{t(`calendarView.periods.${entry.half ?? 'all'}`)}</Text>
          )}
          {entry.times === 'ramadan' ? (
            <RamadanHours entry={entry} />
          ) : (
            <Badge
              label={t(`settings.confidence.${entry.confidence}`)}
              variant={entry.confidence === 'announced' ? 'done' : 'warning'}
            />
          )}
          <Text style={[styles.body, align]}>{t(`calendarView.effect.${entry.effect}`)}</Text>
          {entry.rotation !== undefined && data.state.classes.has(entry.rotation.classId) && (
            <GroupPreview entry={entry} />
          )}
          {entry.adds !== undefined && <Text style={[styles.body, align]}>{t(`calendarView.adds.${entry.adds}`)}</Text>}
          {entry.follows !== undefined && (
            <Text style={[styles.body, align]}>
              {t('calendarView.follows', { day: t(`week.days.${entry.follows}`) })}
            </Text>
          )}
          {entry.times === 'ramadan' && <Text style={[styles.body, align]}>{t('calendarView.ramadan')}</Text>}
          <Text style={[styles.body, align]}>{t('settings.source', { source: entry.source })}</Text>
          {entry.moved !== undefined && (
            <>
              <Text testID="calendar-entry-first" style={[styles.body, align]}>
                {t('calendarView.update.entry.first', {
                  range: t('calendarView.range', { from: formatDay(entry.moved.from), to: formatDay(entry.moved.to) }),
                })}
              </Text>
              <Text style={[styles.body, align]}>
                {t('calendarView.update.entry.reason', { reason: isolate(entry.moved.reason) })}
              </Text>
            </>
          )}
          {movedOn !== undefined && announcedLate(entry, movedOn) && (
            <Text testID="calendar-entry-late" style={[styles.body, align]}>
              {t('calendarView.update.late')}
            </Text>
          )}
          <Text testID="calendar-entry-origin" style={[styles.sub, align]}>
            {fromUpdate === undefined
              ? t(`calendarView.origin.${origin}`)
              : t('calendarView.update.entry.origin', {
                  release: isolate(fromUpdate.update.release),
                  day: formatDay(fromUpdate.update.published),
                  holder: holderOf(data.keys, fromUpdate.key),
                })}
          </Text>
          {entry.received !== undefined && (
            <>
              <Notice icon={controlIcon('info')} message={t('calendarView.receive.received')} />
              <Text style={[styles.body, align]}>
                {t('calendarView.receive.sender', { sender: entry.received.sender })}
              </Text>
            </>
          )}
          <Text style={[styles.sub, align]}>{t('calendarView.identifier', { id: entry.id })}</Text>
          {entry.layer === 'teacher' && <Notice icon={controlIcon('lock')} message={t('calendarView.private')} />}
          {entry.confirmedFrom !== undefined && (
            <Notice
              icon={controlIcon('info')}
              message={t(`calendarView.lunarEdit.${row?.inactive === true ? 'stale' : 'local'}`)}
            />
          )}
          {lunar && onLunar !== undefined && (
            <Button testID="calendar-lunar" label={t(lunarText(base, 'open'))} onPress={onLunar} />
          )}
          {editable && onEdit !== undefined ? (
            <Button testID="calendar-edit" label={t('calendarView.edit.edit')} onPress={onEdit} />
          ) : (
            <Notice icon={controlIcon('info')} message={t('calendarView.edit.readOnly')} />
          )}
        </>
      )}
      {origin === 'local' && onCancelled !== undefined && (
        <CancelEntry id={id} schoolId={schoolId} onCancelled={onCancelled} />
      )}
    </ScrollView>
  );
}
