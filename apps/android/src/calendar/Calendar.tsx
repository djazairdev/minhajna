// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  CalendarView,
  CALENDAR_LAYERS,
  formatDay,
  isWeekReset,
  maxDay,
  minDay,
  monthOf,
  type CalendarLayer,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChipGroup } from '../components/Chip';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { RowLink } from '../components/RowLink';
import { controlIcon } from '../design/Icon';
import { spacing } from '../design/tokens';
import { localized } from '../setup/names';
import { settingsStyles as styles } from '../settings/styles';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { Month } from './Month';
import { inMonth, schoolEntries, type CalendarOrigin } from './view';

/** Stage 1 of #222: browsing never writes history, confirms a date or imports a file. */
export function Calendar({
  onEntry,
  onAdd,
  onReset,
  onGroups,
  onReceive,
}: {
  onEntry: (id: string, origin: CalendarOrigin, schoolId: string) => void;
  onAdd?: (schoolId: string) => void;
  onReset?: (schoolId: string) => void;
  onGroups?: (schoolId: string) => void;
  onReceive?: (schoolId: string) => void;
}) {
  const t = useText();
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const data = useAppData();
  const { profile, year, state, calendar, today } = data;
  const schools = [...state.schools.values()];
  const [schoolId, setSchool] = useState(schools[0]?.id ?? '');
  const [layer, setLayer] = useState<CalendarLayer | 'all'>('all');
  const [month, setMonth] = useState(() => monthOf(minDay(maxDay(today(), year.from), year.to)));
  const school = state.schools.get(schoolId);
  const zone = profile.zones?.find((one) => one.code === school?.zone);
  const rows = inMonth(schoolEntries(data, schoolId), month).filter(
    ({ entry }) => layer === 'all' || entry.layer === layer,
  );
  const view = useMemo(
    () => new CalendarView({ country: profile, year, calendar, packs: new Map() }, state.calendar),
    [profile, year, calendar, state.calendar],
  );
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
      <Text style={[styles.title, align]}>{year.id}</Text>
      {school === undefined ? (
        <Text style={[styles.body, align]}>{t('calendarView.noSchool')}</Text>
      ) : (
        <>
          {schools.length > 1 ? (
            <ChipGroup
              testID="calendar-school"
              label={t('calendarView.school')}
              selected={schoolId}
              choices={schools.map((one) => ({ value: one.id, label: one.name }))}
              onSelect={setSchool}
            />
          ) : (
            <Text style={[styles.title, align]}>{school.name}</Text>
          )}
          <Text style={[styles.sub, align]}>
            {t('calendarView.zone', { zone: zone === undefined ? t('calendarView.noZone') : localized(zone.name) })}
          </Text>
          <ChipGroup
            testID="calendar-layer"
            label={t('calendarView.layers')}
            selected={layer}
            choices={(['all', ...CALENDAR_LAYERS] as const).map((value) => ({
              value,
              label: t(`calendarView.layer.${value}`),
            }))}
            onSelect={setLayer}
          />
          <View style={styles.card}>
            <Month month={month} rows={rows} view={view} schoolId={schoolId} onMonth={setMonth} />
          </View>
          {rows.length === 0 && (
            <Text testID="calendar-empty" style={[styles.body, align]}>
              {t('calendarView.empty')}
            </Text>
          )}
          {rows.map(({ entry, origin, inactive }) => (
            <RowLink
              key={`${origin}:${entry.id}`}
              testID={`calendar-entry-${origin}-${entry.id}`}
              icon={controlIcon(entry.layer === 'teacher' ? 'lock' : 'school')}
              title={localized(entry.name)}
              description={[
                t('calendarView.range', { from: formatDay(entry.from), to: formatDay(entry.to) }),
                t(`calendarView.layer.${entry.layer}`),
                ...(entry.rotation === undefined ? [] : [state.classes.get(entry.rotation.classId)?.name ?? '']),
                ...(!isWeekReset(entry) ? [t(`calendarView.periods.${entry.half ?? 'all'}`)] : []),
                t(`settings.confidence.${entry.confidence}`),
                t('settings.source', { source: entry.source }),
                ...(inactive ? [t('calendarView.lunarEdit.stale')] : []),
              ].join('\n')}
              onPress={() => onEntry(entry.id, origin, schoolId)}
            />
          ))}
        </>
      )}
      <Notice icon={controlIcon('info')} message={t('calendarView.readOnly')} />
      {school !== undefined && onReceive !== undefined && (
        <Button testID="calendar-receive" label={t('calendarView.receive.open')} onPress={() => onReceive(schoolId)} />
      )}
      {school !== undefined && onAdd !== undefined && (
        <Button testID="calendar-add" label={t('calendarView.edit.add')} onPress={() => onAdd(schoolId)} />
      )}
      {school !== undefined && onReset !== undefined && (
        <Button
          testID="calendar-ab"
          variant="line"
          label={t('calendarView.abEdit.open')}
          onPress={() => onReset(schoolId)}
        />
      )}
      {school !== undefined && onGroups !== undefined && (
        <Button
          testID="calendar-groups"
          variant="line"
          label={t('calendarView.groups.open')}
          onPress={() => onGroups(schoolId)}
        />
      )}
    </ScrollView>
  );
}
