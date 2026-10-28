// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «تبرير التقويم المستمر» (#239, Marks-pupil, answers 443 and 454): chips for
// the class and subject, the term and, in primary, the month; the previous and
// next pupil with «3 من 45»; the pupil's page; then «لهذا التلميذ» or «للقسم
// كله», the note that «داخلي · سري» is on every page, «طباعة» and «حفظ PDF».
// The whole class prints one page per pupil on the list. Each print and saved
// PDF goes into the activity log with its period, never a name; a saved PDF is
// named by the class, the list number and the period (answer 455), never the
// pupil. Opened from the grade book on a pupil who is not on the period's list,
// it adds them after the list for that visit, and the whole class still prints
// the list alone (answer 460). A term whose marks descriptive observations
// replace, such as 1AP's first, has no justification: it says so in place of
// the pages (answer 464).

import { courseObserved, termNumberOn } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChipGroup } from '../components/Chip';
import { IconButton } from '../components/IconButton';
import { Notice } from '../components/Notice';
import { RadioCardGroup } from '../components/RadioCard';
import { controlIcon } from '../design/Icon';
import { colors, radius, spacing, typography } from '../design/tokens';
import { justifyHtml } from '../documents/justify-html';
import { useOutputRun } from '../documents/output-run';
import { courseLabel } from '../exams/course-label';
import { useOutputLog } from '../log/output-log';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { openingMonth, periodMonths } from './component-rules';
import { justifyCourses, justifyPage, justifyPupils } from './justify-rules';
import { JustifySheet } from './JustifySheet';
import { assessmentData, termWord } from './marks-rules';
import { PrintSave } from '../documents/PrintSave';

export type MarksJustifyProps = {
  /** The class and subject to open on; the first with continuous assessment when not given. */
  readonly courseId?: string;
  readonly term?: number;
  readonly month?: string;
  /** The pupil to open on, such as the one a grade-book row was for; the first on the list when not on it. */
  readonly pupilId?: string;
};

export function MarksJustify(props: MarksJustifyProps) {
  const t = useText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const { state, profile, year, calendar, calendarRelease, packs, today } = useAppData();
  const context = useMemo(
    () => coreContext({ profile, year, calendar, calendarRelease, packs, state }),
    [profile, year, calendar, calendarRelease, packs, state],
  );
  const data = assessmentData(profile);
  const courses = data === null ? [] : justifyCourses(context, data);
  const [chosen, setChosen] = useState(props.courseId);
  const courseId = chosen !== undefined && courses.includes(chosen) ? chosen : courses[0];
  const [term, setTerm] = useState(props.term ?? termNumberOn(year, today()));
  const months = courseId === undefined ? [] : periodMonths(context, courseId, term);
  const [pickedMonth, setMonth] = useState(props.month);
  const month = pickedMonth !== undefined && months.includes(pickedMonth) ? pickedMonth : openingMonth(months, today());
  const listed = courseId === undefined ? [] : justifyPupils(context, courseId, term, month, today());
  const asked = props.pupilId;
  const added =
    asked !== undefined &&
    courseId === props.courseId &&
    term === props.term &&
    pickedMonth === props.month &&
    !listed.includes(asked) &&
    state.pupils.has(asked);
  const pupils = added ? [...listed, asked] : listed;
  const [index, setIndex] = useState(() =>
    Math.max(0, props.pupilId === undefined ? 0 : pupils.indexOf(props.pupilId)),
  );
  const [all, setAll] = useState(false);
  const { busy, said, print, save, clear } = useOutputRun();
  const logged = useOutputLog();
  if (data === null || courseId === undefined) {
    return <Text style={[styles.empty, { writingDirection: direction }]}>{t('marks.justify.none')}</Text>;
  }
  const at = Math.min(index, Math.max(pupils.length - 1, 0));
  const pageOf = (pupilId: string) =>
    justifyPage(t, context, data, { courseId, term, month, pupilId, today: today(), profile });
  const observed = courseObserved(state, data, courseId, term);
  const page = pupils[at] === undefined || observed ? null : pageOf(pupils[at]);
  const terms = [...year.terms].map((one) => one.number).sort((a, b) => a - b);
  const monthName = (one: string) => profile.months?.[Number(one.slice(5, 7)) - 1]?.[currentLanguage()] ?? one;
  const change = (step: () => void) => {
    step();
    setIndex(0);
    clear();
  };
  const html = () => {
    const pages = (all ? listed : pupils.slice(at, at + 1)).flatMap((id) => pageOf(id) ?? []);
    return justifyHtml(t, pages, { lang: currentLanguage(), dir: direction, title: t('marks.justify.title') });
  };
  const period = month ?? `term-${term}`;
  const who = all ? '' : ` ${t('marks.justify.fileOne', { n: at + 1 })}`;
  const when = month === undefined ? termWord(t, term) : monthName(month);
  const named = `${courseLabel(t, state, profile, courseId, true)}${who} ${when}`;
  const file = `${t('marks.justify.file')} ${named}.pdf`.replace(/[\\/:*?"<>|]/g, '-');
  const log = logged('marks-justify', period);
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
      {courses.length > 1 && (
        <ChipGroup
          testID="justify-course"
          label={t('marks.justify.course')}
          selected={courseId}
          onSelect={(next) => change(() => setChosen(next))}
          choices={courses.map((id) => ({ value: id, label: courseLabel(t, state, profile, id, true) }))}
        />
      )}
      {terms.length > 1 && (
        <ChipGroup
          testID="justify-term"
          label={t('marks.termLabel')}
          selected={String(term)}
          onSelect={(next) => change(() => setTerm(Number(next)))}
          choices={terms.map((one) => ({ value: String(one), label: termWord(t, one) }))}
        />
      )}
      {month !== undefined && (
        <ChipGroup
          testID="justify-month"
          label={t('marks.componentMarks.months')}
          selected={month}
          onSelect={(next) => change(() => setMonth(next))}
          choices={months.map((one) => ({ value: one, label: monthName(one) }))}
        />
      )}
      {page === null ? (
        <Notice
          testID="justify-empty"
          icon={controlIcon('info')}
          message={
            observed ? t('marks.observations.instead', { term: termWord(t, term) }) : t('marks.justify.noPupils')
          }
        />
      ) : (
        <>
          <View testID="justify-step" style={styles.step}>
            <View style={styles.flip}>
              <IconButton
                testID="justify-previous"
                icon={controlIcon('chevron')}
                accessibilityLabel={t('marks.justify.previous')}
                disabled={busy || at === 0}
                onPress={() => setIndex(at - 1)}
              />
            </View>
            <Text accessibilityLiveRegion="polite" style={styles.count}>
              {t('marks.justify.step', { n: at + 1, total: pupils.length })}
            </Text>
            <IconButton
              testID="justify-next"
              icon={controlIcon('chevron')}
              accessibilityLabel={t('marks.justify.next')}
              disabled={busy || at >= pupils.length - 1}
              onPress={() => setIndex(at + 1)}
            />
          </View>
          <JustifySheet page={page} />
          <RadioCardGroup
            testID="justify-scope"
            label={t('marks.justify.scope')}
            selected={all ? 'all' : 'one'}
            disabled={busy}
            onSelect={(value) => {
              setAll(value === 'all');
              clear();
            }}
            choices={[
              { value: 'one', label: t('marks.justify.one'), description: t('marks.justify.oneLine') },
              {
                value: 'all',
                label: t('marks.justify.all'),
                description: t('marks.justify.allLine', { count: listed.length }),
              },
            ]}
          />
          <Notice
            testID="justify-confidential"
            variant="notice"
            badge={t('documents.confidential')}
            message={t('marks.justify.confidential')}
          />
          {said !== null && (
            <Notice
              testID="justify-said"
              icon={controlIcon(said === 'saved' ? 'check' : 'info')}
              message={t(said === 'saved' ? 'documents.output.saved' : 'documents.output.failed')}
            />
          )}
          <View style={styles.actions}>
            <PrintSave
              print={{
                testID: 'justify-print',
                label: t('documents.output.print'),
                disabled: busy,
                onPress: () => print(html, t('marks.justify.title'), false, log.printed, file),
              }}
              save={{
                testID: 'justify-save',
                variant: 'line',
                label: t('documents.output.save'),
                disabled: busy,
                onPress: () => save(html, 'document-marks-justify', file, false, log.saved),
              }}
            />
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: spacing['space-16'], paddingTop: spacing['space-16'] },
  empty: { ...typography.body, color: colors.ink2, padding: spacing['space-16'] },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  flip: { transform: [{ scaleX: -1 }] },
  count: { ...typography.label, color: colors.ink, flex: 1, textAlign: 'center' },
  actions: { gap: spacing['space-10'], paddingTop: spacing['space-8'] },
});
