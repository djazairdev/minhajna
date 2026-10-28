// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The September check for an inspector (#225, Sept-check, R-4.11-06,
// answers 296 to 299), opened from a class's plan or from Ready: the sheet
// as it prints, then «طباعة» on Android's print screen or «حفظ PDF» where
// the teacher picks, the teacher's box carrying the drawn signature unless
// «فارغة» is chosen while it is in use (#236, answer 414). TalkBack reads
// each line of the table as one, with each class's figure, and the table
// scrolls sideways when many classes leave its lines too narrow. The QR code
// waits for signing (#223).

import { formatDay } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Notice } from '../components/Notice';
import { controlIcon } from '../design/Icon';
import { fontFamilyForWeight } from '../design/fonts';
import { colors, fontFamilies, radius, spacing, typography } from '../design/tokens';
import { useOutputRun } from '../documents/output-run';
import { useSheetSignature } from '../documents/sheet-signature';
import { septCheckHtml } from '../documents/sept-check-html';
import { settingsStyles } from '../settings/styles';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { figure, septSheet, type SeptSheet } from './sept-check';
import { useOutputLog } from '../log/output-log';
import { PrintSave } from '../documents/PrintSave';

export type SeptCheckProps = {
  readonly courseId: string;
  /** Opens the drawn signature from «إعدادات التوقيع». */
  readonly onSignature?: () => void;
};

export function SeptCheck({ courseId, onSignature }: SeptCheckProps) {
  const t = useText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const { state, profile, year, calendar, calendarRelease, packs, today } = useAppData();
  const day = today();
  const sheet = useMemo(
    () => septSheet(coreContext({ profile, year, calendar, calendarRelease, packs, state }), t, courseId, day),
    [profile, year, calendar, calendarRelease, packs, state, t, courseId, day],
  );
  const output = useOutputRun();
  const { busy, said, print, save } = output;
  const logged = useOutputLog();
  const signing = useSheetSignature('sept-signature', output, onSignature);
  const html = () => septCheckHtml(t, sheet!, currentLanguage(), direction, signing.mark);
  const file = `${t('septCheck.file')} ${formatDay(day)}.pdf`.replace(/[\\/:*?"<>|]/g, '-');

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
      <Text style={[settingsStyles.sub, align]}>{t('septCheck.subtitle')}</Text>
      <Text style={[settingsStyles.body, align]}>{t('septCheck.intro')}</Text>
      {sheet === null ? (
        <Notice testID="sept-none" icon={controlIcon('info')} message={t('septCheck.none')} />
      ) : (
        <>
          <Sheet sheet={sheet} />
          {signing.choice}
          {said !== null && (
            <Notice
              testID="sept-said"
              icon={controlIcon(said === 'saved' ? 'check' : 'info')}
              message={t(said === 'saved' ? 'documents.output.saved' : 'documents.output.failed')}
            />
          )}
          <View style={styles.actions}>
            <PrintSave
              print={{
                testID: 'sept-print',
                label: t('septCheck.print'),
                disabled: busy,
                onPress: () => print(html, t('septCheck.title'), false, logged('sept-check', day).printed, file),
              }}
              save={{
                testID: 'sept-save',
                variant: 'line',
                label: t('septCheck.save'),
                disabled: busy,
                onPress: () => save(html, 'sept-check', file, false, logged('sept-check', day).saved),
              }}
            />
          </View>
          {signing.warning}
        </>
      )}
    </ScrollView>
  );
}

/** The sheet as it prints, on paper-coloured card. */
function Sheet({ sheet }: { readonly sheet: SeptSheet }) {
  const t = useText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const centre = { writingDirection: direction, textAlign: 'center' } as const;
  const cells = (values: readonly string[], strong: boolean) =>
    values.map((value, at) => (
      <View key={at} style={[styles.cell, styles.value]}>
        <Text style={[styles.number, strong && styles.strong]}>{value}</Text>
      </View>
    ));
  return (
    <View testID="sept-sheet" style={styles.sheet}>
      <Text style={[styles.small, align]}>{sheet.school}</Text>
      <Text style={[styles.small, align]}>{sheet.date}</Text>
      <Text accessibilityRole="header" style={[styles.heading, centre]}>
        {t('septCheck.title')}
      </Text>
      <Text style={[styles.strongText, centre]}>{sheet.who}</Text>
      <Text style={[styles.small, centre]}>{sheet.period}</Text>
      <ScrollView horizontal contentContainerStyle={styles.wide} style={{ direction }}>
        <View style={[styles.table, { direction }]}>
          <View style={styles.row} importantForAccessibility="no-hide-descendants">
            <View style={[styles.cell, styles.label]} />
            {cells(sheet.classes, true)}
          </View>
          {sheet.rows.map((row) =>
            row.values === undefined ? (
              <View key={row.key} accessible style={[styles.row, styles.section]}>
                <Text accessibilityRole="header" style={[styles.cellText, styles.strong, align]}>
                  {row.label}
                </Text>
              </View>
            ) : (
              <View
                key={row.key}
                testID={`sept-row-${row.key}`}
                accessible
                accessibilityLabel={t('septCheck.row', {
                  label: row.label,
                  values: row.values
                    .map((value, at) => t('septCheck.value', { name: sheet.classes[at], value: figure(value) }))
                    .join(t('septCheck.and')),
                })}
                style={styles.row}
              >
                <View style={[styles.cell, styles.label]}>
                  <Text style={[styles.cellText, row.strong === true && styles.strong, align]}>{row.label}</Text>
                </View>
                {cells(row.values.map(figure), row.strong === true)}
              </View>
            ),
          )}
        </View>
      </ScrollView>
      {sheet.notes.map((note) => (
        <Text key={note} style={[styles.small, align]}>
          {note}
        </Text>
      ))}
      <Text accessibilityRole="header" style={[styles.strongText, align]}>
        {t('septCheck.packHead')}
      </Text>
      {sheet.packs.map((pack) => (
        <View key={pack.title}>
          <Text style={[styles.strongText, align]}>{pack.title}</Text>
          {pack.lines.map((line) => (
            <Text key={line} style={[styles.small, align]}>
              {line}
            </Text>
          ))}
        </View>
      ))}
      <Text accessibilityRole="header" style={[styles.strongText, align]}>
        {t('septCheck.sourcesHead')}
      </Text>
      <Text style={[styles.small, align]}>{sheet.sources}</Text>
      <View style={[styles.signs, { direction }]}>
        {[t('septCheck.teacherSign'), t('septCheck.inspectorSign')].map((label) => (
          <View key={label} style={styles.sign}>
            <Text style={[styles.strongText, align]}>{label}</Text>
            <Text style={[styles.small, align]}>{t('septCheck.signDate')}</Text>
          </View>
        ))}
      </View>
      <Text style={[styles.small, align]}>{t('septCheck.privacy')}</Text>
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
  small: { ...typography.caption, color: colors.ink },
  strongText: { ...typography.label, color: colors.ink },
  wide: { flexGrow: 1 },
  table: {
    flexGrow: 1,
    borderWidth: 1,
    borderColor: colors.ink2,
    borderRadius: radius['radius-card'],
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line, minHeight: 40 },
  section: { padding: spacing['space-8'], backgroundColor: colors.paper },
  cell: { padding: spacing['space-6'], justifyContent: 'center' },
  label: { flex: 1, minWidth: 168 },
  value: { width: 48, alignItems: 'center', borderStartWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  cellText: { ...typography.caption, color: colors.ink },
  number: { ...typography.body, color: colors.ink, fontVariant: ['tabular-nums'] },
  strong: { fontFamily: fontFamilyForWeight(fontFamilies.arabic, '700'), fontWeight: '700' },
  signs: { flexDirection: 'row', gap: spacing['space-8'] },
  sign: {
    flex: 1,
    minHeight: 96,
    justifyContent: 'space-between',
    padding: spacing['space-8'],
    borderWidth: 1,
    borderColor: colors.ink2,
  },
  actions: { gap: spacing['space-8'] },
});
