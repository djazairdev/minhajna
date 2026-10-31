// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A drafted version of the timetable before it is published (#578, D-TT-change,
// R-7.4-13, R-7.4-15, R-7.4-17, answer 606): its number and the latest standing
// version it is drafted from, or that it is the first; what the timetable
// changes, class by class, for every teacher it names, in plain words, or that
// nothing did; then the effect: the teachers affected, each with their changes
// from the version's first day, or on that day only for a one-day version, or,
// for a teacher whose channel holds no standing part, that they receive their
// whole timetable; how many others hear nothing; the teachers named apart, with
// no code or key yet, not in the staff list, sharing a name, or with a part too
// long to send; how many sessions the version cannot keep; and that sessions
// recorded before the first day are not rewritten. Names are isolated so a name
// in other letters keeps its place.

import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../design/tokens';
import { useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import { affected, type Draft, type DraftTeacher } from './version-session';
import { changesByClass, teacherLine } from './version-text';

export type VersionPreviewProps = {
  readonly draft: Draft;
  /** The draft's teachers for the choice made (teachersOn). */
  readonly teachers: readonly DraftTeacher[];
  /** The version's first day, written out. */
  readonly day: string;
  /** Whether the version is for that day only. */
  readonly once: boolean;
};

/** What a drafted version changes, and for whom, before it is published. */
export function VersionPreview({ draft, teachers, day, once }: VersionPreviewProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const told = teachers.filter(affected);
  const changes = changesByClass(t, draft.changes);
  const others = teachers.length - told.length;
  const apart = (testID: string, head: string, names: readonly string[]) =>
    names.length > 0 && (
      <View testID={testID} style={styles.group}>
        <Text style={[styles.label, align]}>{head}</Text>
        <Text style={[styles.small, align]}>{names.map(isolate).join(t('ttSend.and'))}</Text>
      </View>
    );
  return (
    <View testID="tt-version" style={styles.preview}>
      <Text accessibilityRole="header" style={[styles.head, align]}>
        {t('ttVersion.title', { version: draft.version })}
      </Text>
      <Text style={[styles.small, align]}>
        {draft.standing === null ? t('ttVersion.first') : t('ttVersion.from', { version: draft.standing.version })}
      </Text>
      {draft.standing !== null && (
        <View style={styles.group}>
          <Text style={[styles.label, align]}>{t('ttVersion.changed', { version: draft.standing.version })}</Text>
          {changes.length === 0 && <Text style={[styles.small, align]}>{t('ttVersion.nothing')}</Text>}
          {changes.map((line, at) => (
            <Text key={`change-${at}`} testID="tt-version-change" style={[styles.small, align]}>
              {line}
            </Text>
          ))}
        </View>
      )}
      <View style={styles.group}>
        <Text style={[styles.label, align]}>{t('ttVersion.effect')}</Text>
        <Text style={[styles.body, align]}>{t('ttVersion.told', { teachers: told.length })}</Text>
        {told.map((one) => (
          <View key={one.issue.assignment} testID="tt-version-teacher" style={styles.teacher}>
            <Text style={[styles.label, align]}>{isolate(one.teacher)}</Text>
            <Text style={[styles.small, align]}>
              {one.first ? t('ttVersion.firstPart', { day }) : teacherLine(t, day, one.changes, once)}
            </Text>
          </View>
        ))}
        <Text style={[styles.small, align]}>{t('ttVersion.others', { teachers: others })}</Text>
      </View>
      {apart('tt-version-no-code', t('ttSend.noCode'), draft.noCode)}
      {apart('tt-version-not-staff', t('ttSend.notStaff'), draft.notStaff)}
      {apart('tt-version-two-names', t('ttSend.twoNames'), draft.twoNames)}
      {apart('tt-version-too-long', t('ttSend.tooLong'), draft.tooLong)}
      {draft.unkept > 0 && (
        <Text testID="tt-version-unkept" style={[styles.label, align]}>
          {t('ttVersion.unkept', { sessions: draft.unkept })}
        </Text>
      )}
      <Text style={[styles.small, align]}>{t('ttVersion.recorded', { day })}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  preview: { gap: spacing['space-8'] },
  group: { gap: spacing['space-2'] },
  teacher: { gap: spacing['space-2'], paddingVertical: spacing['space-4'] },
  head: { ...typography.label, color: colors.ink },
  label: { ...typography.label, color: colors.ink2 },
  body: { ...typography.body, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
});
