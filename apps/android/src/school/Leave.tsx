// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Leaving the school's space with a full copy (#567, R-5.7-06, R-5.7-07,
// R-3.10-19, answer 589), as Leave draws it, under the band, opened from a
// joined school's card. A move follows the official assignment list, which a
// demo world does not hold, so the page names no new school and says the move
// as the rule it is: membership of this school lasts to the year's 31 August
// and the next one's begins on 1 September (school-leave.ts). Then what stays
// with the teacher, on their devices; what stays with the school, under the
// Ministry's retention, its copy drawn with the school rather than a check, and
// what no longer reaches the phone; this year's pupils' data, kept to read
// through the next year, then offered for erasing as every year; joining the
// next school with its code, as the first time, which leads back to the code's
// card on School-join; and the full export, free, from the teacher's own mode,
// since a demo world exports nothing as a real record. At the foot: nothing is
// deleted on leaving, and nothing is needed before it. On a PC the title is
// said in the page's hidden live region. Going back leads to School-join.

import { readJoinCode, type Day, type LeavingDates, type SchoolJoined } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Facts } from '../components/Facts';
import { RowLink } from '../components/RowLink';
import { DemoBand } from '../demo/DemoBand';
import { Icon } from '../design/Icon';
import { colors, radius, spacing, typography } from '../design/tokens';
import { onPc, useDeviceText } from '../text/device-text';
import { shortSchool } from './SchoolJoined';

const KEPT = ['demo.leave.kept1', 'demo.leave.kept2', 'demo.leave.kept3', 'demo.leave.kept4'] as const;

export type LeaveProps = {
  /** The world's date, written out for the band. */
  readonly date: string;
  /** The join the page is about. */
  readonly join: SchoolJoined;
  /** The school year, written as `2026-2027`. */
  readonly year: string;
  /** When membership of this school ends and the next one's begins (`leavingDates`). */
  readonly dates: LeavingDates;
  /** A day of the world, written out as the band writes it. */
  readonly dayText: (day: Day) => string;
  /** Back to School-join. */
  readonly onClose: () => void;
  /** Back to School-join's code card, to join the next school. */
  readonly onJoin: () => void;
  /** What the page says aloud on a PC, in its hidden live region. */
  readonly said: string;
};

/** What stays and what goes when a teacher leaves the school for another. */
export function Leave({ date, join, year, dates, dayText, onClose, onJoin, said }: LeaveProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const until = dayText(dates.until);
  const head = (key: 'demo.leave.withYou' | 'demo.leave.atSchool' | 'demo.leave.next' | 'demo.leave.export') => (
    <Text accessibilityRole="header" style={[styles.head, align]}>
      {t(key)}
    </Text>
  );
  return (
    <View testID="school-leave" style={[styles.screen, { direction }]}>
      <DemoBand date={date} />
      {onPc() && (
        <Text testID="leave-said" accessibilityLiveRegion="polite" style={styles.hidden}>
          {said}
        </Text>
      )}
      <View
        style={[
          styles.bar,
          { paddingLeft: insets.left + spacing['space-16'], paddingRight: insets.right + spacing['space-16'] },
        ]}
      >
        <Button testID="leave-back" variant="plain" label={t('demo.entry.back')} onPress={onClose} />
        <View style={styles.titles}>
          <Text accessibilityRole="header" style={[styles.title, align]}>
            {t('demo.leave.title')}
          </Text>
          <Text style={[styles.small, align]}>
            {t('demo.devices.school', { school: shortSchool(readJoinCode(join.code)?.school ?? '') })}
          </Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing['space-16'] }]}>
        <View style={styles.column}>
          <View testID="leave-move" style={[styles.card, styles.raised]}>
            <View style={styles.row}>
              <Text accessibilityRole="header" style={[styles.head, styles.grow, align]}>
                {t('demo.leave.move')}
              </Text>
              <Text style={styles.badge}>{t('demo.leave.from', { date: dayText(dates.from) })}</Text>
            </View>
            <Text style={[styles.small, align]}>{t('demo.leave.moveLine', { date: until })}</Text>
          </View>
          <View style={styles.card}>
            {head('demo.leave.withYou')}
            <Facts
              kept={KEPT.map((key) => ({ id: key, text: t(key), kept: true }))}
              keptLabel={t('demo.leave.withYou')}
              notKeptLabel={t('demo.leave.withYou')}
            />
          </View>
          <View style={styles.card}>
            {head('demo.leave.atSchool')}
            <Facts
              kept={[
                { id: 'school', text: t('demo.leave.school1'), kept: true, icon: 'school' },
                { id: 'phone', text: t('demo.leave.school2', { date: until }), kept: false },
              ]}
              keptLabel={t('demo.leave.atSchool')}
              notKeptLabel={t('demo.leave.notAnyMore')}
            />
          </View>
          <View style={styles.card}>
            <Text accessibilityRole="header" style={[styles.head, align]}>
              {t('demo.leave.pupils', { year })}
            </Text>
            <Text style={[styles.small, align]}>{t('demo.leave.pupilsLine', { next: dates.next })}</Text>
          </View>
          <View style={styles.card}>
            {head('demo.leave.next')}
            <Text style={[styles.small, align]}>{t('demo.leave.nextLine', { next: dates.next })}</Text>
            <RowLink
              testID="leave-join"
              icon={({ size, color }) => <Icon name="qr" size={size} color={color} />}
              title={t('demo.leave.join')}
              onPress={onJoin}
            />
          </View>
          <View style={styles.card}>
            {head('demo.leave.export')}
            <Text style={[styles.small, align]}>{t('demo.leave.exportLine')}</Text>
          </View>
          <Text style={[styles.small, styles.foot, { writingDirection: direction, textAlign: 'center' }]}>
            {t('demo.leave.nothing')}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-8'], paddingVertical: spacing['space-8'] },
  titles: { flexShrink: 1 },
  title: { ...typography['bar-title'], color: colors.ink },
  content: {
    flexGrow: 1,
    paddingTop: spacing['space-12'],
    paddingHorizontal: spacing['space-16'],
    alignItems: 'center',
  },
  column: { flexGrow: 1, width: '100%', maxWidth: 640, gap: spacing['space-12'] },
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
    padding: spacing['space-16'],
    gap: spacing['space-8'],
  },
  raised: { borderColor: colors.rule },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-8'] },
  grow: { flex: 1, minWidth: 0 },
  head: { ...typography.label, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
  badge: {
    ...typography.small,
    color: colors.ink,
    backgroundColor: colors.well,
    borderRadius: radius['radius-control'],
    paddingHorizontal: spacing['space-8'],
    paddingVertical: spacing['space-2'],
  },
  foot: { marginTop: 'auto' },
  hidden: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
});
