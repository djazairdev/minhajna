// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «بيان التقدّم» (#438, #439, Share, R-3.10-01, R-3.10-02, R-3.10-08 to
// R-3.10-10, answers 485 and 486), opened from a class page or Settings: chips
// for the subject's other classes with a plan, then the statement as it will
// leave, every field in words, that it carries no pupil data and that the
// reasons for sessions not held stay on the phone. Nothing is signed or
// recorded until «طباعة», «PDF», «رمز QR» or «ملف موقّع»
// (statement-actions.ts); the third button is the code when the signed
// statement will fit one, else the signed file, with a line saying why. Each
// share then asks «لمن؟», and «سجل المشاركة» lists them all. A failed signature
// makes nothing.

import { courseSetup, progressStatement, sharingHistory, statementFitsInQr } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { Notice } from '../components/Notice';
import { controlIcon } from '../design/Icon';
import { colors, spacing, typography } from '../design/tokens';
import { settingsStyles } from '../settings/styles';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { ShareHistory } from './ShareHistory';
import { ShareTo, type ShareToProps } from './ShareTo';
import { StatementFields } from './StatementFields';
import { StatementQr } from './StatementQr';
import { useStatementActions } from './statement-actions';
import { statementClass, statementLines } from './statement-lines';

export type StatementShareProps = {
  readonly courseId: string;
  readonly onCourse: (courseId: string) => void;
};

export function StatementShare({ courseId, onCourse }: StatementShareProps) {
  const t = useText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const { state, profile, year, calendar, calendarRelease, packs, today, entries } = useAppData();
  const day = today();
  const context = coreContext({ profile, year, calendar, calendarRelease, packs, state });
  const course = state.courses.get(courseId);
  const choices = [...state.courses.values()]
    .filter((one) => one.subject === course?.subject && one.year === course.year)
    .filter((one) => courseSetup(context, one.id).pack !== null)
    .map((one) => ({ value: one.id, label: state.classes.get(one.classId)?.name ?? one.id }));
  const statement = course === undefined ? null : progressStatement(context, courseId, day);
  const actions = useStatementActions(courseId);
  const { busy, said } = actions;
  const [opened, setOpened] = useState<ShareToProps['share']>(null);
  const opener = useRef<ViewInstance | null>(null);
  const shares = sharingHistory(entries());
  const asked = actions.asked === null ? opened : { ...actions.asked, day, to: null };
  const closeAsked = () => {
    actions.ask(null);
    setOpened(null);
  };
  const fits = statement !== null && statementFitsInQr(statement);

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
          <View ref={opener} collapsable={false} style={[styles.actions, { direction }]}>
            <Button
              testID="statement-print"
              variant="line"
              label={t('statement.print')}
              disabled={busy}
              onPress={actions.print}
            />
            <Button
              testID="statement-pdf"
              variant="line"
              label={t('statement.pdf')}
              disabled={busy}
              onPress={actions.save}
            />
            <Button
              testID={fits ? 'statement-qr-show' : 'statement-file'}
              variant="line"
              label={t(fits ? 'statement.how.qr' : 'statement.how.file')}
              disabled={busy}
              onPress={fits ? actions.show : actions.send}
            />
          </View>
          {!fits && <Text style={[styles.note, align]}>{t('statement.tooLong')}</Text>}
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
      <ShareHistory shares={shares} onShare={setOpened} />
      <ShareTo share={asked} onClose={closeAsked} returnFocusRef={opener} />
      {actions.shown !== null && <StatementQr shown={actions.shown} onClose={actions.close} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  strong: { ...typography.label, color: colors.ink },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-10'] },
  note: { ...typography.caption, color: colors.ink2 },
});
