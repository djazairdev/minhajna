// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «تعويض» (#224, answer 332): a cover the teacher gives a colleague's
// class, from Today's «حصة». The school, the class as typed, any day of the
// school year and the times as on paper. It has no plan, is never counted
// and never goes in the texts book; Today shows it on its day, and «تمّت»
// there writes it in the daily journal. Until the school space exists, the
// teacher types it; the director's assignment will fill it later. Only a
// school with a middle or secondary level is offered, as cover-schools.ts
// says.

import { maxDay, minDay, setDuty, type Day, type RecordEvent } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SaveProblem } from '../calendar/SaveProblem';
import { useCalendarSave } from '../calendar/useCalendarSave';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { Notice } from '../components/Notice';
import { TextField } from '../components/TextField';
import { controlIcon } from '../design/Icon';
import { colors, spacing, typography } from '../design/tokens';
import { MonthDays } from '../extra/MonthDays';
import { coverSchools } from './cover-schools';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { readSpan } from '../times/times-rules';
import { dayName } from '../today/DayMark';

export function CoverEntry({ onDone }: { onDone: () => void }) {
  const t = useText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const data = useAppData();
  const { state, profile, year, today, newId } = data;
  const writer = useCalendarSave();
  const schools = coverSchools(state);
  const [schoolId, setSchool] = useState(schools[0]?.id ?? '');
  const [className, setClassName] = useState('');
  const [day, setDay] = useState<Day>(() => minDay(maxDay(today(), year.from), year.to));
  const [month, setMonth] = useState(day.slice(0, 7));
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [tried, setTried] = useState(false);
  const [refused, setRefused] = useState(false);
  const times = readSpan(from, to);
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const save = async () => {
    setTried(true);
    if (times === null || className.trim() === '') return;
    let event: RecordEvent;
    try {
      event = setDuty(coreContext(data), { id: newId(), kind: 'cover', day, ...times, schoolId, className });
    } catch {
      setRefused(true);
      return;
    }
    setRefused(false);
    if (await writer.save(event, state)) onDone();
  };
  return (
    <ScrollView
      style={styles.screen}
      keyboardShouldPersistTaps="handled"
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
      <Notice icon={controlIcon('info')} message={t('cover.intro')} />
      {schools.length > 1 && (
        <ChipGroup
          testID="cover-school"
          label={t('cover.school')}
          choices={schools.map((one) => ({ value: one.id, label: one.name }))}
          selected={schoolId}
          onSelect={setSchool}
        />
      )}
      <TextField
        testID="cover-class"
        label={t('cover.class')}
        placeholder={t('cover.classExample')}
        value={className}
        onChangeText={setClassName}
        maxLength={20}
        {...(tried && className.trim() === '' && { error: t('cover.classWrong') })}
      />
      <View style={styles.group}>
        <Text style={[styles.label, align]}>{t('cover.date')}</Text>
        <MonthDays
          month={month}
          selected={day}
          first={year.from}
          last={year.to}
          profile={profile}
          onMonth={setMonth}
          onSelect={setDay}
        />
        <Text testID="cover-day" style={[styles.body, align]}>
          {dayName(t, day, currentLanguage(), profile)}
        </Text>
      </View>
      <View style={styles.group}>
        <Text style={[styles.label, align]}>{t('duties.time')}</Text>
        <View style={styles.pair}>
          {(['from', 'to'] as const).map((end) => (
            <View key={end} style={styles.half}>
              <TextField
                testID={`cover-${end}`}
                label={t(`duties.${end}`)}
                placeholder={t('duties.clockExample')}
                value={end === 'from' ? from : to}
                onChangeText={end === 'from' ? setFrom : setTo}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                textDirection="ltr"
                {...(tried && times === null && { error: t('duties.timeWrong') })}
              />
            </View>
          ))}
        </View>
      </View>
      {refused && <Notice testID="cover-refused" icon={controlIcon('info')} message={t('cover.refused')} />}
      <SaveProblem testID="cover-failed" problem={writer.problem} />
      <Button testID="cover-save" label={t('cover.save')} disabled={writer.busy} onPress={() => void save()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: spacing['space-16'], paddingTop: spacing['space-16'] },
  group: { gap: spacing['space-8'] },
  pair: { flexDirection: 'row', gap: spacing['space-12'] },
  half: { flex: 1 },
  label: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
});
