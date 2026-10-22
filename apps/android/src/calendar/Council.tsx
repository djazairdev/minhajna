// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A class council (#224, answer 334): one class, a term and a time, on one
// day of the school year. It takes no sessions. The term follows the chosen
// day until the teacher picks one. Its name is written from the class and the
// term in each of the app's languages; moving it to another day forgets that
// it was held.
// A class archived after a reorientation is offered only for its own
// council already set (#231).

import { maxDay, minDay, setCalendarEntry, type CalendarEntry, type Day, type Term } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChipGroup } from '../components/Chip';
import { Notice } from '../components/Notice';
import { TextField } from '../components/TextField';
import { controlIcon } from '../design/Icon';
import { spacing } from '../design/tokens';
import { MonthDays } from '../extra/MonthDays';
import { SourceConfidence } from '../extra/SourceConfidence';
import { settingsStyles as styles } from '../settings/styles';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { i18n, useText } from '../text/i18n';
import { readClock } from '../times/times-rules';
import { calendarCatalogues } from './catalogues';
import { PreviewActions } from './PreviewActions';
import { useCalendarPreview } from './useCalendarPreview';

/** The council's name in each language, such as «مجلس القسم 4م2 للفصل الأول». */
function councilName(className: string, term: number): Record<string, string> {
  return Object.fromEntries(
    Object.keys(calendarCatalogues).map((language) => {
      const t = i18n.getFixedT(language);
      return [
        language,
        t('calendarView.council.name', {
          class: className,
          term: t(`calendarView.council.terms.${term as 1 | 2 | 3}`),
        }),
      ];
    }),
  );
}

/** The term a day falls in, or the last one begun before it; the first term before the year. */
function termOn(terms: readonly Term[], day: Day): number {
  return terms.filter((one) => one.from <= day).at(-1)?.number ?? terms[0]?.number ?? 1;
}

export function Council({
  schoolId,
  old,
  onSaved,
}: {
  schoolId: string;
  old?: CalendarEntry;
  onSaved: (entry: CalendarEntry) => void;
}) {
  const data = useAppData();
  const t = useText();
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const context = coreContext(data);
  const classes = [...data.state.classes.values()].filter(
    (one) => one.schoolId === schoolId && (one.archivedFrom === undefined || one.id === old?.council?.classId),
  );
  const terms = data.year.terms.map((one) => one.number);
  const [id] = useState(() => old?.id ?? data.newId());
  const [classId, setClass] = useState(old?.council?.classId ?? classes[0]?.id ?? '');
  const [picked, setTerm] = useState<number | null>(old?.council?.term ?? null);
  const [day, setDay] = useState(() => old?.from ?? minDay(maxDay(data.today(), data.year.from), data.year.to));
  const [month, setMonth] = useState(day.slice(0, 7));
  const [at, setAt] = useState(old?.council?.at ?? '');
  const [source, setSource] = useState(old?.source ?? '');
  const [confidence, setConfidence] = useState<'announced' | 'expected'>(
    old?.confidence === 'expected' ? 'expected' : 'announced',
  );
  const term = picked ?? termOn(data.year.terms, day);
  const clock = readClock(at);
  const draft = useCalendarPreview(() => {
    const schoolClass = data.state.classes.get(classId);
    if (schoolClass === undefined || clock === null) throw new RangeError('A council needs its class and time');
    const held = old?.council?.held === true && old.from === day;
    return setCalendarEntry(context, {
      ...old,
      id,
      layer: 'school',
      schoolId,
      from: day,
      to: day,
      effect: 'marker',
      council: { classId, term, at: clock, ...(held && { held: true }) },
      name: councilName(schoolClass.name, term),
      source,
      confidence,
    });
  }, onSaved);
  const align = { writingDirection: direction, textAlign: 'start' } as const;
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
      <Text accessibilityRole="header" style={[styles.title, align]}>
        {data.state.schools.get(schoolId)?.name ?? t('calendarView.noSchool')}
      </Text>
      <Notice icon={controlIcon('info')} message={t('calendarView.council.notice')} />
      {classes.length === 0 ? (
        <Text style={[styles.body, align]}>{t('calendarView.council.noClass')}</Text>
      ) : old === undefined ? (
        <ChipGroup
          testID="council-class"
          label={t('calendarView.council.class')}
          selected={classId}
          choices={classes.map((one) => ({ value: one.id, label: one.name }))}
          onSelect={(next) => draft.change(() => setClass(next))}
        />
      ) : (
        <Text style={[styles.body, align]}>{data.state.classes.get(classId)?.name ?? ''}</Text>
      )}
      <ChipGroup
        testID="council-term"
        label={t('calendarView.council.term')}
        selected={String(term)}
        choices={terms.map((number) => ({
          value: String(number),
          label: t(`calendarView.council.chips.${number as 1 | 2 | 3}`),
        }))}
        onSelect={(next) => draft.change(() => setTerm(Number(next)))}
      />
      <MonthDays
        month={month}
        selected={day}
        first={data.year.from}
        last={data.year.to}
        profile={data.profile}
        onMonth={setMonth}
        onSelect={(next) => draft.change(() => setDay(next))}
      />
      <TextField
        testID="council-at"
        label={t('calendarView.council.at')}
        placeholder={t('calendarView.council.atExample')}
        value={at}
        onChangeText={(next) => draft.change(() => setAt(next))}
        keyboardType="numbers-and-punctuation"
        maxLength={8}
        textDirection="ltr"
        editable={!draft.busy}
        {...(draft.invalid && clock === null && { error: t('calendarView.council.badTime') })}
      />
      <SourceConfidence
        testID="calendar"
        source={source}
        confidence={confidence}
        busy={draft.busy}
        onSource={(next) => draft.change(() => setSource(next))}
        onConfidence={(next) => draft.change(() => setConfidence(next))}
      />
      <PreviewActions draft={draft} />
    </ScrollView>
  );
}
