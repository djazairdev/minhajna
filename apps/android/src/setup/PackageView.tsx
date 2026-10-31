// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The school's timetable package in setup (#580, Setup-5b, Setup-5d, answer
// 608), once it passed every check: signed, its school and version, whose part
// it is, its first day and weekly hours, the signature holding and no pupil
// data. With several schools in setup, the teacher picks the one it is for, the
// one of its name first. A session the week cannot place is named with why, and
// accepting waits until setup has what it needs; otherwise the differences from
// the week drawn for that school, in plain words, and each class's sessions
// before and after. Clashes with the sessions drawn for the teacher's other
// schools, each at its own times, are named, and the clash stays until either
// school sends a new version. Accepting replaces the drawn week for that
// school's classes from the day given, never a recorded session. Its title and
// version are said as it opens, on a PC in its hidden live region, elsewhere
// announced; going back, by the button or Android's back, returns to the week.
// Names are isolated so a name in other letters keeps its place.

import {
  classSessions,
  drawnRows,
  formatDay,
  packageRows,
  unplacedOf,
  weekDifferences,
  type Day,
  type School,
  type TimetablePart,
  type Unplaced,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useEffect, useEffectEvent, useState } from 'react';
import { AccessibilityInfo, BackHandler, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useAppData } from '../storage/AppData';
import { onPc } from '../text/device-text';
import { useText } from '../text/i18n';
import { spanText } from '../timetable/grid-text';
import { slotText } from '../timetable/proposal-text';
import { hoursOf } from '../timetable/teacher-session';
import { changeText, hoursText } from '../timetable/version-text';
import { isolate } from '../week/grid-labels';
import { otherClashes, placeFor } from './package-place';

export type PackageViewProps = {
  readonly part: TimetablePart;
  /** The teacher's school it is for, or null until one is picked. */
  readonly school: School | null;
  readonly onSchool: (school: School) => void;
  /** The day the week it makes applies from. */
  readonly from: Day;
  readonly busy: boolean;
  readonly onAccept: () => void;
  readonly onBack: () => void;
};

/** The school's timetable package, what it changes in the drawn week, and accepting it. */
export function PackageView({ part, school, onSchool, from, busy, onAccept, onBack }: PackageViewProps) {
  const t = useText();
  const data = useAppData();
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const sides = { paddingLeft: insets.left + spacing['space-16'], paddingRight: insets.right + spacing['space-16'] };
  const schools = [...data.state.schools.values()];
  const place = school === null ? null : placeFor(data, part, school);
  const unplaced = place === null ? [] : unplacedOf(place);
  const before = place === null ? [] : drawnRows(place);
  const after = place === null ? [] : packageRows(place);
  const changes = weekDifferences(before, after).map((one) => changeText(t, one));
  const [was, now] = [classSessions(before), classSessions(after)];
  const counts = [...new Set([...now.keys(), ...was.keys()])].map((name) =>
    t('week.package.classLine', {
      class: isolate(name),
      after: t('week.sessions', { count: now.get(name) ?? 0 }),
      before: t('week.sessions', { count: was.get(name) ?? 0 }),
    }),
  );
  const clashes = place === null ? [] : otherClashes(data, place, schools);
  const heading = t('week.package.version', { school: part.schoolName, version: part.version });
  const words = `${t('week.package.viewTitle')} ${heading}`;
  const [said, setSaid] = useState('');
  const announce = useEffectEvent(() => (onPc() ? setSaid(words) : AccessibilityInfo.announceForAccessibility(words)));
  const backKey = useEffectEvent(onBack);
  useEffect(() => {
    const timer = setTimeout(announce, 0);
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      backKey();
      return true;
    });
    return () => {
      clearTimeout(timer);
      handler.remove();
    };
  }, []);
  const reason = (one: Unplaced) => t(`week.package.unplaced.${one.reason}`, { session: slotText(t, one.session) });
  const line = (testID: string, text: string, at: number) => (
    <Text key={`${testID}-${at}`} testID={testID} style={[styles.body, align]}>
      {text}
    </Text>
  );
  return (
    <ScrollView
      testID="package-view"
      style={[styles.screen, { direction }]}
      contentContainerStyle={[styles.content, sides, { paddingBottom: insets.bottom + spacing['space-16'] }]}
    >
      {onPc() && (
        <Text testID="package-view-said" accessibilityLiveRegion="polite" style={styles.hidden}>
          {said}
        </Text>
      )}
      <View style={styles.card}>
        <View style={styles.head}>
          <Text accessibilityRole="header" style={[styles.heading, align]}>
            {t('week.package.viewTitle')}
          </Text>
          <Text style={styles.badge}>{t('week.package.signed')}</Text>
        </View>
        <Text style={[styles.title, align]}>
          {t('week.package.version', { school: isolate(part.schoolName), version: part.version })}
        </Text>
        <Text style={[styles.body, align]}>{t('week.package.whose', { teacher: isolate(part.teacher) })}</Text>
        <Text style={[styles.sub, align]}>
          {t('week.package.inForce', { date: formatDay(part.from), hours: hoursText(t, hoursOf(part.sessions)) })}
        </Text>
        <Text style={[styles.sub, align]}>{t('week.package.holds')}</Text>
      </View>
      {schools.length > 1 && (
        <ChipGroup
          testID="package-school"
          label={t('week.package.school')}
          choices={schools.map((one) => ({ value: one.id, label: isolate(one.name) }))}
          selected={school?.id ?? null}
          onSelect={(id) => onSchool(schools.find((one) => one.id === id)!)}
        />
      )}
      {unplaced.length > 0 && (
        <View style={styles.card}>
          <Text style={[styles.problem, align]}>{t('week.package.unplacedHead')}</Text>
          {unplaced.map((one, at) => line('package-unplaced', reason(one), at))}
          <Text style={[styles.sub, align]}>{t('week.package.unplacedHint')}</Text>
        </View>
      )}
      {place !== null && unplaced.length === 0 && (
        <View style={styles.card}>
          <Text style={[styles.title, align]}>
            {changes.length === 0
              ? t('week.package.same')
              : t('week.package.diffHead', { differences: changes.length })}
          </Text>
          {changes.map((one, at) => line('package-difference', one, at))}
          {counts.map((one, at) => (
            <Text key={`count-${at}`} style={[styles.sub, align]}>
              {one}
            </Text>
          ))}
        </View>
      )}
      {clashes.length > 0 && (
        <View style={styles.card}>
          <Text style={[styles.problem, align]}>{t('week.package.clashHead')}</Text>
          {clashes.map(([one, other], at) =>
            line(
              'package-clash',
              t('week.package.clash', {
                day: t(`week.days.${one.day}`),
                time: spanText(Math.max(one.start, other.start), Math.min(one.end, other.end)),
                one: isolate(one.class),
                a: isolate(one.school),
                other: isolate(other.class),
                b: isolate(other.school),
              }),
              at,
            ),
          )}
          <Text style={[styles.sub, align]}>{t('week.package.clashNote')}</Text>
        </View>
      )}
      <Text style={[styles.body, align]}>{t('week.package.replaces', { date: formatDay(from) })}</Text>
      <Button
        testID="package-accept"
        label={t('week.package.accept')}
        disabled={busy || place === null || unplaced.length > 0}
        onPress={onAccept}
      />
      <Button testID="package-view-back" variant="plain" label={t('week.package.back')} onPress={onBack} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: spacing['space-16'], paddingTop: spacing['space-12'] },
  card: {
    gap: spacing['space-8'],
    padding: spacing['space-14'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing['space-8'] },
  heading: { ...typography.h2, color: colors.ink, flexShrink: 1 },
  badge: { ...typography.caption, color: colors.ink2 },
  title: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  sub: { ...typography.caption, color: colors.ink2 },
  problem: { ...typography.label, color: colors['error-ink'] },
  hidden: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
});
