// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «سؤال المفتش» (#230, Plan-stale, answers 382 and 384), opened from the
// plan of a class on a stale pack: the sheet as it prints, then «طباعة» on
// Android's print screen or «حفظ PDF» where the teacher picks, the teacher's
// box carrying the drawn signature unless «فارغة» is chosen while it is in
// use (#236, answer 414). Nothing is sent: the teacher shows the printed page
// to the inspector.

import { formatDay } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { controlIcon } from '../design/Icon';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useOutputRun } from '../documents/output-run';
import { useSheetSignature } from '../documents/sheet-signature';
import { staleQuestionHtml } from '../documents/stale-question-html';
import { settingsStyles } from '../settings/styles';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { staleSheet, type StaleSheet } from './stale-question';
import { useOutputLog } from '../log/output-log';

export type StaleQuestionProps = {
  readonly courseId: string;
  /** Opens the drawn signature from «إعدادات التوقيع». */
  readonly onSignature?: () => void;
};

export function StaleQuestion({ courseId, onSignature }: StaleQuestionProps) {
  const t = useText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const { state, profile, year, calendar, calendarRelease, packs, today } = useAppData();
  const day = today();
  const sheet = useMemo(
    () => staleSheet(coreContext({ profile, year, calendar, calendarRelease, packs, state }), t, courseId, day),
    [profile, year, calendar, calendarRelease, packs, state, t, courseId, day],
  );
  const output = useOutputRun();
  const { busy, said, print, save } = output;
  const logged = useOutputLog();
  const signing = useSheetSignature('stale-question-signature', output, onSignature);
  const html = () => staleQuestionHtml(t, sheet!, currentLanguage(), direction, signing.mark);
  const file = `${t('staleQuestion.file')} ${formatDay(day)}.pdf`.replace(/[\\/:*?"<>|]/g, '-');

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
      <Text style={[settingsStyles.sub, align]}>{t('staleQuestion.subtitle')}</Text>
      <Text style={[settingsStyles.body, align]}>{t('staleQuestion.intro')}</Text>
      {sheet === null ? (
        <Notice testID="stale-question-none" icon={controlIcon('info')} message={t('staleQuestion.none')} />
      ) : (
        <>
          <Sheet sheet={sheet} />
          {signing.choice}
          {said !== null && (
            <Notice
              testID="stale-question-said"
              icon={controlIcon(said === 'saved' ? 'check' : 'info')}
              message={t(said === 'saved' ? 'documents.output.saved' : 'documents.output.failed')}
            />
          )}
          <View style={styles.actions}>
            <Button
              testID="stale-question-print"
              label={t('septCheck.print')}
              disabled={busy}
              onPress={() => print(html, t('staleQuestion.title'), false, logged('stale-question', day).printed)}
            />
            <Button
              testID="stale-question-save"
              variant="line"
              label={t('septCheck.save')}
              disabled={busy}
              onPress={() => save(html, 'stale-question', file, false, logged('stale-question', day).saved)}
            />
          </View>
          {signing.warning}
        </>
      )}
    </ScrollView>
  );
}

/** The sheet as it prints, on paper-coloured card. */
function Sheet({ sheet }: { readonly sheet: StaleSheet }) {
  const t = useText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const centre = { writingDirection: direction, textAlign: 'center' } as const;
  const head = (label: string) => (
    <Text accessibilityRole="header" style={[styles.strong, align]}>
      {label}
    </Text>
  );
  return (
    <View testID="stale-question-sheet" style={styles.sheet}>
      <Text style={[styles.small, align]}>{sheet.school}</Text>
      <Text style={[styles.small, align]}>{sheet.date}</Text>
      <Text accessibilityRole="header" style={[styles.heading, centre]}>
        {t('staleQuestion.title')}
      </Text>
      <Text style={[styles.strong, centre]}>{sheet.who}</Text>
      <Text style={[styles.small, centre]}>{sheet.classes}</Text>
      {head(t('staleQuestion.packHead'))}
      {sheet.pack.map((line) => (
        <Text key={line} style={[styles.small, align]}>
          {line}
        </Text>
      ))}
      {head(t('staleQuestion.reasonHead'))}
      <Text style={[styles.small, align]}>{sheet.reason}</Text>
      {head(t('staleQuestion.questionHead'))}
      <Text style={[styles.body, align]}>{t('staleQuestion.question')}</Text>
      <Text style={[styles.small, align]}>{t('staleQuestion.meanwhile')}</Text>
      <View style={[styles.signs, { direction }]}>
        {[t('septCheck.teacherSign'), t('staleQuestion.inspectorSign')].map((label) => (
          <View key={label} style={styles.sign}>
            <Text style={[styles.strong, align]}>{label}</Text>
            <Text style={[styles.small, align]}>{t('septCheck.signDate')}</Text>
          </View>
        ))}
      </View>
      <Text style={[styles.small, align]}>{t('staleQuestion.privacy')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    gap: spacing['space-8'],
    padding: spacing['space-14'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  heading: { ...typography['web-heading'], color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  small: { ...typography.caption, color: colors.ink },
  strong: { ...typography.label, color: colors.ink },
  signs: { flexDirection: 'row', gap: spacing['space-8'] },
  sign: {
    flex: 1,
    minHeight: 120,
    justifyContent: 'space-between',
    padding: spacing['space-8'],
    borderWidth: 1,
    borderColor: colors.ink2,
  },
  actions: { gap: spacing['space-8'] },
});
