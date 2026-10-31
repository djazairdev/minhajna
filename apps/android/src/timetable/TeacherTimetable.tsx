// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The teacher's timetable from the school, under the band, opened from a joined
// school's card (#579, TT-change, TT-change-day, R-7.4-01 to R-7.4-07, answer
// 607). As it opens it reads the teacher's own channel (teacher-session.ts):
// until a part arrives it says the timetable comes here once the school
// publishes it; then the version in force on the world's date, from which day
// or for that day alone, or, before any applies, the first standing version to
// come and from which day, with the school's name, the week's hours and the
// teacher's sessions day by day, or, for one day, that day's sessions alone,
// and every version received, newest first (ReceivedCard.tsx), with the school
// telling only the teachers a version changes. Confirming a version's receipt
// signs it on this phone and puts it on the channel, says so as soon as it is
// there, on the page too, and reads the channel again; reading and confirming
// are said apart, and a second press while one runs does nothing. A problem is
// said in the catalogue's words, with a way to read again. What is said goes,
// on a PC, to the page's hidden live region, which first holds the page's title
// and says the same words again when they come again, and elsewhere it is
// announced. The bar names the school by its short ID; going back leads to
// School-join.

import { readJoinCode, type Day, type SchoolJoined } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { AccessibilityInfo, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { DemoBand } from '../demo/DemoBand';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import { colors, radius, spacing, typography } from '../design/tokens';
import { problemOf } from '../school/school-join-session';
import { shortSchool } from '../school/SchoolJoined';
import { onPc, useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import { slotText } from './proposal-text';
import { hoursText } from './version-text';
import { ReceivedCard } from './ReceivedCard';
import {
  confirmReceipt,
  firstToCome,
  hoursOf,
  inForce,
  readTeacherChannel,
  receivedVersions,
  sessionsOf,
  type TeacherChannel,
} from './teacher-session';

export type TeacherTimetableProps = {
  readonly world: Pick<OpenWorld, 'world' | 'date'>;
  readonly join: SchoolJoined;
  readonly kit: WorldKit;
  readonly send?: Send;
  /** A day of the world, written out. */
  readonly dayText: (day: Day) => string;
  readonly onClose: () => void;
  /** The page's title, said as it opens. */
  readonly said: string;
};

/** The version in force, the versions received, and their receipts. */
export function TeacherTimetable({ world, join, kit, send, dayText, onClose, said }: TeacherTimetableProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [channel, setChannel] = useState<TeacherChannel | null>(null);
  const [step, setStep] = useState<'reading' | 'confirming' | null>('reading');
  const busy = step !== null;
  const working = useRef(false);
  const [problem, setProblem] = useState<ReturnType<typeof problemOf> | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [spoken, setSpoken] = useState({ words: said, count: 0 });
  const mounted = useRef(true);
  const say = (words: string) => {
    if (onPc()) setSpoken((before) => ({ words, count: before.count + 1 }));
    else AccessibilityInfo.announceForAccessibility(words);
  };
  const refused = (error: unknown) => {
    if (!mounted.current) return;
    working.current = false;
    setProblem(problemOf(error));
    setStep(null);
    say(t(problemOf(error)));
  };
  const load = () =>
    readTeacherChannel(world, join, kit, send).then((read) => {
      if (!mounted.current) return;
      working.current = false;
      setChannel(read);
      setProblem(null);
      setStep(null);
    }, refused);
  const first = useEffectEvent(() => {
    working.current = true;
    void load();
  });
  useEffect(() => {
    mounted.current = true;
    first();
    return () => {
      mounted.current = false;
    };
  }, []);
  const again = () => {
    if (working.current) return;
    working.current = true;
    setStep('reading');
    void load();
  };
  const confirm = (version: number) => {
    if (working.current) return;
    working.current = true;
    setStep('confirming');
    void confirmReceipt(world, join, version, kit, send).then(() => {
      if (!mounted.current) return;
      setDone(t('demo.timetable.done', { version }));
      say(t('demo.timetable.done', { version }));
      setStep('reading');
      return load();
    }, refused);
  };
  const now = channel === null ? null : inForce(channel, world.date);
  const today = now ?? (channel === null ? null : firstToCome(channel));
  const shown = today === null ? [] : sessionsOf(today);
  const days = [...new Set(shown.map((one) => one.day))].sort((a, b) => a - b);
  return (
    <View testID="teacher-timetable" style={[styles.screen, { direction }]}>
      <DemoBand date={world.date} />
      {onPc() && (
        <Text key={spoken.count} testID="teacher-said" accessibilityLiveRegion="polite" style={styles.hidden}>
          {spoken.words}
        </Text>
      )}
      <View
        style={[
          styles.bar,
          { paddingLeft: insets.left + spacing['space-16'], paddingRight: insets.right + spacing['space-16'] },
        ]}
      >
        <Button testID="teacher-back" variant="plain" label={t('demo.entry.back')} onPress={onClose} />
        <View style={styles.titles}>
          <Text accessibilityRole="header" style={[styles.title, align]}>
            {t('demo.timetable.title')}
          </Text>
          <Text style={[styles.small, align]}>
            {t('demo.devices.school', { school: shortSchool(readJoinCode(join.code)?.school ?? '') })}
          </Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing['space-16'] }]}>
        <View style={styles.column}>
          <Text accessibilityLiveRegion="polite" style={[styles.small, align]}>
            {step === null ? '' : t(step === 'reading' ? 'demo.timetable.reading' : 'demo.timetable.confirming')}
          </Text>
          {done !== null && (
            <Text testID="teacher-done" style={[styles.body, align]}>
              {done}
            </Text>
          )}
          {problem !== null && (
            <View style={styles.card}>
              <Text accessibilityRole="alert" style={[styles.problem, align]}>
                {t(problem)}
              </Text>
              <Button
                testID="teacher-again"
                variant="line"
                label={t('demo.timetable.again')}
                disabled={busy}
                onPress={again}
              />
            </View>
          )}
          {channel !== null && today === null && <Text style={[styles.body, align]}>{t('demo.timetable.none')}</Text>}
          {channel !== null && today !== null && (
            <View testID="teacher-in-force" style={styles.card}>
              <Text accessibilityRole="header" style={[styles.head, align]}>
                {t(
                  now === null
                    ? 'demo.timetable.notYet'
                    : today.once
                      ? 'demo.timetable.inForceOnce'
                      : 'demo.timetable.inForce',
                  {
                    version: today.version,
                    day: dayText(today.from),
                  },
                )}
              </Text>
              <Text style={[styles.small, align]}>{isolate(today.schoolName)}</Text>
              <Text style={[styles.small, align]}>
                {today.once
                  ? t('demo.timetable.daySessions', { sessions: t('count.sessions', { count: shown.length }) })
                  : t('demo.timetable.hours', { hours: hoursText(t, hoursOf(today.sessions)) })}
              </Text>
              {days.map((day) => (
                <View key={day} style={styles.day}>
                  {shown
                    .filter((one) => one.day === day)
                    .map((one) => (
                      <Text key={one.id} testID="teacher-session" style={[styles.body, align]}>
                        {slotText(t, one)}
                      </Text>
                    ))}
                </View>
              ))}
            </View>
          )}
          {channel !== null && channel.parts.length > 0 && (
            <>
              <Text accessibilityRole="header" style={[styles.head, align]}>
                {t('demo.timetable.received')}
              </Text>
              <Text style={[styles.small, align]}>{t('demo.timetable.affected')}</Text>
            </>
          )}
          {channel !== null &&
            receivedVersions(channel).map((one) => (
              <ReceivedCard key={one.part.version} received={one} busy={busy} onConfirm={confirm} dayText={dayText} />
            ))}
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
  column: { width: '100%', maxWidth: 640, gap: spacing['space-12'] },
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
    padding: spacing['space-16'],
    gap: spacing['space-8'],
  },
  day: { gap: spacing['space-2'], paddingVertical: spacing['space-4'] },
  head: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
  problem: { ...typography.body, color: colors['error-ink'] },
  hidden: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
});
