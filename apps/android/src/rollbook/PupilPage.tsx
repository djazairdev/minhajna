// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// One pupil in the roll-call book (#217, Pupil and Pupil-year), opened from the
// Class page and the Month and yearly tables (answer 259): their class, list
// number and registration number, chips for the months up to today and the
// school year, their figures in half-days in the teacher's own sessions, the
// yearly summary's link for the year, then the absences with their toggle, the
// corrections through «تصحيح غياب أو تأخر مسجّل», the late arrivals, the change
// log and the pupil's moves. A toggle records at once; the next waits until the
// record has it.

import { countYear, type PupilCount, type RollCallUnit, type State } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet } from '../components/BottomSheet';
import { ChipGroup } from '../components/Chip';
import { OptionRow } from '../components/OptionRow';
import { RowLink } from '../components/RowLink';
import { controlIcon } from '../design/Icon';
import { colors, spacing, typography } from '../design/tokens';
import { classRows } from '../classes/class-rules';
import { localized } from '../setup/names';
import { unitTime } from '../roll/roll-labels';
import { listNumbers } from '../roll/roll-rules';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { dayName } from '../today/DayMark';
import { bookMonths } from './month-rules';
import { PupilFigures, PupilYearTable } from './PupilFigures';
import { PupilAbsences, PupilLates, PupilLog } from './PupilLists';
import { EMPTY_VIEW, justifyEvents, pupilSpan, pupilView, type PupilAbsence } from './pupil-rules';

export type PupilPageProps = {
  readonly courseId: string;
  readonly pupilId: string;
  /** A month written YYYY-MM, or `year`. */
  readonly month: string;
  readonly onMonth: (month: string) => void;
  readonly onClassYear: () => void;
  readonly onCorrect: (unit: RollCallUnit) => void;
  readonly onMove: () => void;
};

export function PupilPage(props: PupilPageProps) {
  const t = useText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const { state, profile, year, calendar, calendarRelease, packs, bells, today, recordAll, unsaved, settled } =
    useAppData();
  const language = currentLanguage();
  const day = today();
  const context = useMemo(
    () => coreContext({ profile, year, calendar, calendarRelease, packs, state }),
    [profile, year, calendar, calendarRelease, packs, state],
  );
  const row = useMemo(
    () => classRows(context, day).find((one) => one.course.id === props.courseId),
    [context, day, props.courseId],
  );
  const months = useMemo(() => bookMonths(context, day), [context, day]);
  const yearly = props.month === 'year';
  const month = yearly ? 'year' : months.includes(props.month) ? props.month : (months.at(-1) ?? props.month);
  const classId = row?.schoolClass.id ?? '';
  const view = useMemo(() => {
    const span = pupilSpan(context, month, day);
    if (classId === '') return null;
    return span === null ? EMPTY_VIEW : pupilView(context, classId, props.pupilId, span.from, span.to);
  }, [context, month, day, classId, props.pupilId]);
  const summary = useMemo(() => {
    if (!yearly || classId === '') return null;
    const counts = countYear(context, classId, undefined, day);
    const of = (pupils: readonly PupilCount[]) => pupils.find((one) => one.pupilId === props.pupilId) ?? null;
    return {
      months: counts.months.map((one) => ({ month: one.month, count: of(one.counts.pupils) })),
      year: of(counts.year.pupils),
    };
  }, [yearly, classId, context, day, props.pupilId]);
  const [sent, setSent] = useState<{ readonly state: State; readonly unsaved: boolean } | null>(null);
  const sending = useRef<{ readonly state: State; readonly unsaved: boolean } | null>(null);
  const busy = sent !== null && sent.state === state && sent.unsaved === unsaved;
  const [correcting, setCorrecting] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const opener = useRef<ViewInstance>(null);
  const pupil = state.pupils.get(props.pupilId);
  if (row === undefined || pupil === undefined || view === null) return null;
  const align = { writingDirection: direction, textAlign: 'auto' } as const;
  const monthName = (one: string) => profile.months?.[Number(one.slice(5, 7)) - 1]?.[language] ?? one;
  const subject = profile.subjects.find((one) => one.code === row.course.subject);
  const subjectName = subject === undefined ? row.course.subject : localized(subject.name);
  const alone = [...state.courses.values()].filter((one) => one.classId === row.schoolClass.id).length === 1;
  const number = listNumbers(context, row.schoolClass.id).get(pupil.id) ?? 0;
  const head =
    pupil.registration === undefined
      ? t('pupilPage.head', { class: row.schoolClass.name, number })
      : t('pupilPage.headRegistration', { class: row.schoolClass.name, number, registration: pupil.registration });
  const onJustify = (absence: PupilAbsence, justified: boolean) => {
    const last = sending.current;
    if (last !== null && last.state === state && last.unsaved === unsaved) return;
    let events;
    try {
      events = justifyEvents(context, absence, pupil.id, justified);
    } catch {
      setRefused(month);
      return;
    }
    if (events.length === 0) return;
    setRefused(null);
    sending.current = { state, unsaved };
    setSent(sending.current);
    recordAll(events);
    void settled().finally(() => {
      sending.current = null;
      setSent(null);
    });
  };
  const note = (text: string) => <Text style={[styles.note, align]}>{text}</Text>;
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          direction,
          paddingBottom: insets.bottom + spacing['space-24'],
          paddingLeft: insets.left + spacing['space-16'],
          paddingRight: insets.right + spacing['space-16'],
        },
      ]}
    >
      <Text testID="pupil-head" style={[styles.line, align]}>
        {head}
      </Text>
      <ChipGroup
        testID="pupil-switch"
        label={t('rollBook.months')}
        selected={month}
        onSelect={props.onMonth}
        choices={[
          ...months.map((one) => ({ value: one, label: monthName(one) })),
          { value: 'year', label: t('pupilPage.year') },
        ]}
      />
      {yearly ? (
        <>
          <PupilYearTable
            months={(summary?.months ?? []).map((one) => ({ ...one, name: monthName(one.month) }))}
            year={summary?.year ?? null}
          />
          {note(
            alone
              ? t('pupilPage.yearNote', { subject: subjectName, day: dayName(t, day, language, profile) })
              : t('pupilPage.yearNoteAll', { day: dayName(t, day, language, profile) }),
          )}
          <RowLink
            testID="pupil-class-year"
            icon={controlIcon('school')}
            title={t('pupilPage.classYear')}
            description={t('pupilPage.classYearSub')}
            onPress={props.onClassYear}
          />
        </>
      ) : (
        <>
          <PupilFigures count={view.count} />
          {note(alone ? t('pupilPage.unitNote', { subject: subjectName }) : t('pupilPage.unitNoteAll'))}
        </>
      )}
      <PupilAbsences view={view} busy={busy} onJustify={onJustify} />
      {refused === month && note(t('pupilPage.refused'))}
      <View ref={opener} collapsable={false}>
        <RowLink
          testID="pupil-correct"
          icon={controlIcon('tune')}
          title={t('pupilPage.correct')}
          onPress={() => setCorrecting(true)}
        />
      </View>
      <PupilLates view={view} />
      <PupilLog view={view} />
      <RowLink testID="pupil-move" icon={controlIcon('plus')} title={t('pupilPage.move')} onPress={props.onMove} />
      <BottomSheet
        testID="pupil-correct-sheet"
        visible={correcting}
        title={t('pupilPage.correct')}
        context={t('pupilPage.correctContext')}
        reassurance={t('pupilPage.lock')}
        returnFocusRef={opener}
        onClose={() => setCorrecting(false)}
      >
        {view.taken.length === 0 && note(t('pupilPage.correctNone'))}
        {view.taken.map(({ unit, mark }) => (
          <OptionRow
            key={unit.key}
            testID={`pupil-correct-${unit.key}`}
            label={dayName(t, unit.day, language, profile)}
            sub={[unitTime({ state, bells, calendar }, unit, direction), t(`pupilPage.markNames.${mark}`)]
              .filter((part) => part !== null)
              .join(' · ')}
            directional
            disabled={unit.sessions.length === 0}
            onPress={() => {
              setCorrecting(false);
              props.onCorrect(unit);
            }}
          />
        ))}
      </BottomSheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: spacing['space-16'], paddingTop: spacing['space-16'] },
  line: { ...typography.body, color: colors.pencil },
  note: { ...typography.caption, color: colors.ink2 },
});
