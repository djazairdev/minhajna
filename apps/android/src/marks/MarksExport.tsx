// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «التصدير الفصلي» for a class, subject and term (#242, Export, answer 466):
// the line; what is complete, the marks, the averages by the formula and its
// release, and the appreciations with the list's note, or how many are still
// missing, in which case nothing is exported (R-3.6-07); «الطريق الذي تعتمده
// المؤسسة», the school's workbook or the ostad grid, kept with the school; for
// the workbook, that filling it waits for the school's blank templates; for the
// ostad grid, each pupil in the grid's order with large numbers to copy by
// hand; and what Minhajna never does: ask for a platform's password, open it
// for the teacher, or make a report card.

import { EXPORT_ROUTES, type ExportRoute } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Notice } from '../components/Notice';
import { RadioCardGroup } from '../components/RadioCard';
import { colors, radius, spacing, typography } from '../design/tokens';
import { courseLabel } from '../exams/course-label';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import { appreciationList, listNote } from './appreciation-rules';
import { courseExport, courseSchool, marksLine, ostadValue, partName } from './export-rules';
import { courseMarks, assessmentData, termWord } from './marks-rules';

const ROUTE_TEXTS: Readonly<Record<ExportRoute, { readonly label: string; readonly description: string }>> = {
  workbook: { label: 'marks.export.workbook', description: 'marks.export.workbookFrom' },
  ostad: { label: 'marks.export.ostad', description: 'marks.export.ostadView' },
};

export type MarksExportProps = {
  readonly courseId: string;
  readonly term: number;
};

export function MarksExport({ courseId, term }: MarksExportProps) {
  const t = useText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const { state, profile, year, calendar, calendarRelease, packs, record } = useAppData();
  const context = useMemo(
    () => coreContext({ profile, year, calendar, calendarRelease, packs, state }),
    [profile, year, calendar, calendarRelease, packs, state],
  );
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const sheet = courseExport(context, profile, courseId, term);
  const list = appreciationList(profile);
  const data = assessmentData(profile);
  const school = courseSchool(state, courseId);
  if (sheet === null || list === null || data === null || school === undefined) {
    return <Text style={[styles.body, styles.empty, align]}>{t('marks.export.unavailable')}</Text>;
  }
  const release = courseMarks(state, data, courseId, term)?.release ?? '';
  const route = school.exportRoute ?? null;
  const done = sheet.rows.length - sheet.missingAppreciations.length;
  const choose = (chosen: ExportRoute) => {
    if (chosen !== route) record({ kind: 'school.set', school: { ...school, exportRoute: chosen } });
  };
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
      <Text testID="export-line" style={[styles.title, align]}>
        {t('marks.export.line', { class: courseLabel(t, state, profile, courseId, true), term: termWord(t, term) })}
      </Text>
      <View testID="export-status" accessible style={styles.card}>
        <Text style={[styles.body, align]}>{marksLine(t, sheet)}</Text>
        <Text style={[styles.body, align]}>
          {sheet.averaged ? t('marks.export.averages', { release }) : t('marks.export.noAverage')}
        </Text>
        <Text style={[styles.body, align]}>{t('marks.export.appreciations', { done, total: sheet.rows.length })}</Text>
        <Text style={[styles.note, align]}>{listNote(t, list)}</Text>
      </View>
      {!sheet.ready && (
        <Notice
          testID="export-not-ready"
          variant="notice"
          badge={t('marks.export.notReadyBadge')}
          message={t(sheet.rows.length === 0 ? 'marks.export.noPupils' : 'marks.export.notReady')}
        />
      )}
      <RadioCardGroup
        testID="export-route"
        label={t('marks.export.route')}
        selected={route}
        onSelect={choose}
        choices={EXPORT_ROUTES.map((one) => ({
          value: one,
          label: t(ROUTE_TEXTS[one].label as 'marks.export.workbook'),
          description: t(ROUTE_TEXTS[one].description as 'marks.export.workbook'),
        }))}
      />
      <Text style={[styles.note, align]}>{t('marks.export.routeNote')}</Text>
      {route === 'workbook' && (
        <Notice
          testID="export-workbook-waits"
          variant="notice"
          badge={t('marks.export.workbook')}
          message={t('marks.export.workbookWaits')}
        />
      )}
      {route === 'ostad' && sheet.ready && (
        <View testID="export-ostad" style={styles.rows}>
          <Text style={[styles.title, align]}>{t('marks.export.ostadOrder')}</Text>
          <Text style={[styles.note, align]}>{t('marks.export.ostadNote')}</Text>
          {sheet.rows.map((row) => {
            const name = `${row.number}. ${isolate(state.pupils.get(row.pupilId)?.name ?? row.pupilId)}`;
            const values = sheet.parts.map((part) => ({ part, text: ostadValue(t, row.values[part] ?? null) }));
            const spoken = [name, ...values.map((one) => `${partName(t, one.part)} ${one.text}`)].join(
              t('marks.book.comma'),
            );
            return (
              <View
                key={row.pupilId}
                testID={`export-ostad-${row.pupilId}`}
                accessible
                accessibilityLabel={spoken}
                style={styles.pupil}
              >
                <Text style={[styles.body, align]}>{name}</Text>
                <View style={styles.values}>
                  {values.map((one) => (
                    <View key={one.part} style={styles.value}>
                      <Text style={[styles.note, align]}>{partName(t, one.part)}</Text>
                      <Text style={[styles.big, align]}>{one.text}</Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      )}
      <Text testID="export-never" style={[styles.note, align]}>
        {t('marks.export.never')}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: spacing['space-12'], paddingTop: spacing['space-16'] },
  card: {
    gap: spacing['space-4'],
    padding: spacing['space-14'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  rows: { gap: spacing['space-8'] },
  pupil: {
    gap: spacing['space-4'],
    paddingVertical: spacing['space-8'],
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  values: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-16'] },
  value: { minWidth: 72 },
  empty: { padding: spacing['space-16'] },
  title: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  big: { ...typography.stat, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
});
