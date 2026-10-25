// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «بيان التقدّم» (#438, Share, R-3.10-01, R-3.10-02, R-3.10-08, R-3.10-09,
// answer 485), opened from a class page: chips for the subject's other classes
// with a plan, then the statement as it will leave, every field in words, that
// it carries no pupil data and that the reasons for sessions not held stay on
// the phone. Nothing is signed or recorded until «طباعة» or «PDF»: then the
// statement of that moment's day is signed with the teacher's key and goes to
// Android's print screen, or to a PDF saved where the teacher picks, named by
// the class, subject and day; each goes into the activity log with the day,
// never its content. A failed signature makes nothing.

import { courseSetup, progressStatement, type ProgressStatement } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { Notice } from '../components/Notice';
import { controlIcon } from '../design/Icon';
import { colors, spacing, typography } from '../design/tokens';
import { useOutputRun } from '../documents/output-run';
import { useOutputLog } from '../log/output-log';
import { safeFileName } from '../marks/export-file-rules';
import pdf from '../native/NativeMinhajnaPdf';
import { settingsStyles } from '../settings/styles';
import { localized } from '../setup/names';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { StatementFields } from './StatementFields';
import { statementClass, statementDay, statementLines } from './statement-lines';
import { statementHtml } from './statement-page';
import { signedNow } from './statement-sign';

export type StatementShareProps = {
  readonly courseId: string;
  readonly onCourse: (courseId: string) => void;
};

export function StatementShare({ courseId, onCourse }: StatementShareProps) {
  const t = useText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const { state, profile, year, calendar, calendarRelease, packs, today } = useAppData();
  const day = today();
  const context = coreContext({ profile, year, calendar, calendarRelease, packs, state });
  const course = state.courses.get(courseId);
  const choices = [...state.courses.values()]
    .filter((one) => one.subject === course?.subject && one.year === course.year)
    .filter((one) => courseSetup(context, one.id).pack !== null)
    .map((one) => ({ value: one.id, label: state.classes.get(one.classId)?.name ?? one.id }));
  const statement = course === undefined ? null : progressStatement(context, courseId, day);
  const { busy, said, run } = useOutputRun();
  const log = useOutputLog();

  const now = () => {
    const made = progressStatement(context, courseId, today());
    if (made === null) throw new Error('No statement to make');
    return made;
  };
  const page = async (made: ProgressStatement) => {
    const signed = await signedNow(made);
    const lines = statementLines(t, profile, made);
    const sheet = { day: statementDay(made), className: statementClass(profile, made), lines, ...signed };
    return statementHtml(t, sheet, currentLanguage(), direction);
  };
  const subject = profile.subjects.find((one) => one.code === course?.subject);
  const fileName = (made: ProgressStatement) => {
    const named = subject === undefined ? made.class.subject : localized(subject.name);
    return safeFileName(`${t('statement.title')} ${made.class.section} ${named} ${made.day}`, 'pdf');
  };
  const print = () =>
    run(async () => {
      const made = now();
      await pdf.printHtml(await page(made), t('statement.title'), false);
      log('statement', made.day).printed();
      return null;
    });
  const save = () =>
    run(async () => {
      const made = now();
      const file = await pdf.makePdf(await page(made), 'statement', false);
      if (!(await pdf.savePdf(file.name, fileName(made)))) return null;
      log('statement', made.day).saved();
      return 'saved';
    });

  return (
    <ScrollView
      style={settingsStyles.screen}
      contentContainerStyle={[
        settingsStyles.content,
        {
          direction,
          paddingLeft: insets.left + spacing['space-16'],
          paddingRight: insets.right + spacing['space-16'],
          paddingBottom: insets.bottom + spacing['space-24'],
        },
      ]}
    >
      <Text style={[settingsStyles.sub, align]}>{t('statement.subtitle')}</Text>
      {choices.length > 1 && (
        <ChipGroup
          testID="statement-classes"
          label={t('statement.classes')}
          selected={courseId}
          onSelect={onCourse}
          choices={choices}
        />
      )}
      {statement === null ? (
        <Notice testID="statement-none" icon={controlIcon('info')} message={t('statement.none')} />
      ) : (
        <>
          <Text testID="statement-class" style={[styles.strong, align]}>
            {statementClass(profile, statement)}
          </Text>
          <StatementFields lines={statementLines(t, profile, statement)} />
          <Notice icon={controlIcon('lock')} message={t('statement.reasons')} />
          <View style={[styles.actions, { direction }]}>
            <Button
              testID="statement-print"
              variant="line"
              label={t('statement.print')}
              disabled={busy}
              onPress={print}
            />
            <Button testID="statement-pdf" variant="line" label={t('statement.pdf')} disabled={busy} onPress={save} />
          </View>
          <Notice icon={controlIcon('publisher')} message={t('statement.signed')} />
          {said !== null && (
            <Notice
              testID="statement-said"
              icon={controlIcon(said === 'saved' ? 'check' : 'info')}
              message={t(said === 'saved' ? 'documents.output.saved' : 'statement.failed')}
            />
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  strong: { ...typography.label, color: colors.ink },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-10'] },
});
