// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { addDays, confirmLunarHoliday, formatDay, type CalendarEntry } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChipGroup } from '../components/Chip';
import { Notice } from '../components/Notice';
import { TextField } from '../components/TextField';
import { controlIcon } from '../design/Icon';
import { spacing } from '../design/tokens';
import { localized } from '../setup/names';
import { settingsStyles as styles } from '../settings/styles';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { PreviewActions } from './PreviewActions';
import { useCalendarPreview } from './useCalendarPreview';

/** A sighting confirmation is the teacher's local observation, tied to an exact reference entry. */
export function Lunar({ base, onSaved }: { base: CalendarEntry; onSaved: (entry: CalendarEntry) => void }) {
  const data = useAppData();
  const t = useText();
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const old = data.state.calendar.find((entry) => entry.id === base.id && entry.confirmedFrom !== undefined);
  const [day, setDay] = useState(old?.from ?? base.from);
  const [source, setSource] = useState(old?.source ?? '');
  const draft = useCalendarPreview(() => confirmLunarHoliday(coreContext(data), base.id, day, source), onSaved);
  const align = { writingDirection: direction, textAlign: 'start' } as const;
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
      <Text accessibilityRole="header" style={[styles.title, align]}>
        {localized(base.name)}
      </Text>
      <Text style={[styles.body, align]}>
        {t('calendarView.range', { from: formatDay(base.from), to: formatDay(base.to) })}
      </Text>
      <Text style={[styles.sub, align]}>{t('settings.source', { source: base.source })}</Text>
      <Notice icon={controlIcon('info')} message={t('calendarView.lunarEdit.notice')} />
      <ChipGroup
        testID="calendar-lunar-day"
        label={t('calendarView.lunarEdit.day')}
        selected={day}
        choices={[-1, 0, 1]
          .map((shift) => addDays(base.from, shift))
          .filter((value) => value >= data.year.from && value <= data.year.to)
          .map((value) => ({ value, label: formatDay(value) }))}
        onSelect={(next) => draft.change(() => setDay(next))}
      />
      <TextField
        testID="calendar-source"
        label={t('addSessions.source')}
        placeholder={t('calendarView.lunarEdit.source')}
        value={source}
        editable={!draft.busy}
        maxLength={200}
        onChangeText={(next) => draft.change(() => setSource(next))}
      />
      <PreviewActions draft={draft} label={t('calendarView.lunarEdit.confirm')} />
    </ScrollView>
  );
}
