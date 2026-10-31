// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The teachers' receipts on the director's timetable page (#579, R-7.4-06,
// R-7.4-16, answer 607), in place of the paper notice each teacher signed.
// Looking reads each teacher sent a part (receipt-session.ts) and says how many
// there are, or that no teacher was sent one, then the count of those on a
// phone, when there are any, and how many of them confirmed every version that
// applies now or later, and how many joined with a security key, who confirm
// from the staffroom PC, which the demo does not offer yet; then, for each, in
// the staff list's order, the day they confirmed the latest standing version,
// or that it is not confirmed yet, with the one confirmed before it when there
// is one, and each one-day version still to come, confirmed or not, or that
// they joined with a security key; and that a teacher given a new code is
// listed once a part is sent on it. A second press while reading does nothing.
// What is said goes, on a PC, to the page's hidden live region, and elsewhere
// it is announced; a problem is said in the catalogue's words. Names are
// isolated so a name in other letters keeps its place.

import type { Day, DemoSchool } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import { colors, radius, spacing, typography } from '../design/tokens';
import { problemOf } from '../school/school-join-session';
import { onPc, useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import { readReceipts, upToDate, type TeacherReceipt } from './receipt-session';

export type TimetableReceiptsProps = {
  readonly world: Pick<OpenWorld, 'world' | 'book' | 'date'>;
  readonly school: Pick<DemoSchool, 'teachers'>;
  readonly kit: WorldKit;
  readonly send?: Send;
  /** A day of the world, written out. */
  readonly dayText: (day: Day) => string;
};

/** Each teacher sent a part, with the latest version they confirmed and its day. */
export function TimetableReceipts({ world, school, kit, send, dayText }: TimetableReceiptsProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [looking, setLooking] = useState(false);
  const [read, setRead] = useState<readonly TeacherReceipt[] | null>(null);
  const [problem, setProblem] = useState<ReturnType<typeof problemOf> | null>(null);
  const [said, setSaid] = useState({ words: '', count: 0 });
  const mounted = useRef(true);
  const working = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const say = (words: string) => {
    if (onPc()) setSaid((before) => ({ words, count: before.count + 1 }));
    else AccessibilityInfo.announceForAccessibility(words);
  };
  const summary = (found: readonly TeacherReceipt[]) => {
    const phones = found.filter((one) => one.access === 'phone');
    const keys = found.length - phones.length;
    if (found.length === 0) return t('ttReceipt.none');
    const told = t('ttReceipt.found', { teachers: phones.length, confirmed: phones.filter(upToDate).length });
    const apart = keys === 0 ? [] : [t('ttReceipt.keys', { keys })];
    return [...(phones.length === 0 ? [] : [told]), ...apart].join(' ');
  };
  const look = () => {
    if (working.current) return;
    working.current = true;
    setLooking(true);
    setProblem(null);
    void readReceipts(world, school, kit, send)
      .then(
        (found) => {
          if (!mounted.current) return;
          setRead(found);
          say(summary(found));
        },
        (error: unknown) => {
          if (!mounted.current) return;
          setProblem(problemOf(error));
          say(t(problemOf(error)));
        },
      )
      .finally(() => {
        working.current = false;
        if (mounted.current) setLooking(false);
      });
  };
  const lines = ({ access, standing, before, days }: TeacherReceipt) => {
    if (access === 'key') return [t('ttReceipt.keyLine')];
    const { version, confirmed } = standing;
    const first =
      confirmed !== null
        ? t('ttReceipt.current', { version, day: dayText(confirmed) })
        : before === null
          ? t('ttReceipt.never', { sent: version })
          : t('ttReceipt.behind', { sent: version, version: before.version, day: dayText(before.day) });
    return [
      first,
      ...days.map((one) =>
        one.confirmed === null
          ? t('ttReceipt.dayWaiting', { date: dayText(one.day), version: one.version })
          : t('ttReceipt.dayDone', { date: dayText(one.day), version: one.version, day: dayText(one.confirmed) }),
      ),
    ];
  };
  return (
    <View testID="tt-receipts" style={styles.card}>
      {onPc() && (
        <View accessibilityLiveRegion="polite" style={styles.hidden}>
          <Text key={said.count} testID="tt-receipts-said">
            {said.words}
          </Text>
        </View>
      )}
      <Text accessibilityRole="header" style={[styles.head, align]}>
        {t('ttReceipt.title')}
      </Text>
      <Text style={[styles.small, align]}>{t('ttReceipt.line')}</Text>
      <Button testID="tt-receipts-look" label={t('ttReceipt.look')} variant="line" disabled={looking} onPress={look} />
      {read !== null && <Text style={[styles.body, align]}>{summary(read)}</Text>}
      {read?.map((one) => (
        <View key={one.id} testID="tt-receipt" style={styles.group}>
          <Text style={[styles.label, align]}>{isolate(one.teacher)}</Text>
          {lines(one).map((text, at) => (
            <Text key={`line-${at}`} style={[styles.small, align]}>
              {text}
            </Text>
          ))}
        </View>
      ))}
      {read !== null && <Text style={[styles.small, align]}>{t('ttReceipt.newCode')}</Text>}
      <Text accessibilityLiveRegion="polite" style={[styles.small, align]}>
        {looking ? t('ttReceipt.looking') : ''}
      </Text>
      <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.problem, align]}>
        {problem === null ? '' : t(problem)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
    padding: spacing['space-16'],
    gap: spacing['space-8'],
  },
  group: { gap: spacing['space-2'] },
  head: { ...typography.label, color: colors.ink },
  label: { ...typography.label, color: colors.ink2 },
  body: { ...typography.body, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
  problem: { ...typography.small, color: colors['error-ink'] },
  hidden: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
});
