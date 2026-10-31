// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Web-staff-session in a national demo world (#572, answer 602): the teacher's
// session on a shared PC, in memory only. It names the teacher and the school
// and says the session is a shared PC's, in memory alone, with buttons to lock
// it and to end it, either of which erases it, as five minutes unused do: a
// touch, a click, or a key, a wheel or a scroll anywhere on the PC's page
// counts as use. For each of the session's channels it reads, from the school's
// space, the teacher's classes and subject and the day the channel was joined,
// as the school's space holds it; the week's records come once the school's
// space holds them. Under them: the private notes are not opened here, a week
// is signed on the phone with a key that never leaves it, and nothing is kept
// in the browser or recorded. A problem is said in the world's words.

import type { CountryProfile, DemoSchool, Day, PcSession } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import type { Send, WorldKit } from '../demo/world-session';
import { colors, radius, spacing, typography } from '../design/tokens';
import { subjectName } from '../extra/extra-rules';
import { onUse } from '../lock/activity';
import { problemOf } from '../school/school-join-session';
import { useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import { sessionChannels, STAFF_IDLE, type SessionChannel } from './staff-session';

/** What a web page's document offers to hear wheels, keys and scrolls; a phone has none. */
type Listens = {
  addEventListener(kind: string, listener: () => void, capture: boolean): void;
  removeEventListener(kind: string, listener: () => void, capture: boolean): void;
};

export type StaffSessionProps = {
  readonly session: PcSession;
  readonly school: DemoSchool;
  readonly profile: Pick<CountryProfile, 'subjects'>;
  readonly kit: WorldKit;
  readonly send?: Send;
  readonly dayText: (day: Day) => string;
  /** The session is erased: locked by hand or unused, or ended. */
  readonly onErase: (how: 'locked' | 'idle' | 'ended') => void;
};

/** A teacher's session on a staffroom PC. */
export function StaffSession({ session, school, profile, kit, send, dayText, onErase }: StaffSessionProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [channels, setChannels] = useState<readonly SessionChannel[] | null>(null);
  const [said, setSaid] = useState<string | null>(null);

  useEffect(() => {
    let open = true;
    sessionChannels(session, school, kit, send).then(
      (found) => open && setChannels(found),
      (error: unknown) => open && setSaid(t(problemOf(error) as 'demo.problem.other')),
    );
    return () => {
      open = false;
    };
  }, [session, school, kit, send, t]);
  useEffect(() => {
    let timer = setTimeout(() => onErase('idle'), STAFF_IDLE);
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => onErase('idle'), STAFF_IDLE);
    };
    const stop = onUse(reset);
    const page = (globalThis as { document?: Listens }).document;
    for (const kind of ['wheel', 'keydown', 'scroll'] as const) page?.addEventListener(kind, reset, true);
    return () => {
      clearTimeout(timer);
      stop();
      for (const kind of ['wheel', 'keydown', 'scroll'] as const) page?.removeEventListener(kind, reset, true);
    };
  }, [onErase]);

  const classes = (channel: SessionChannel) =>
    (channel.teacher?.classIds ?? [])
      .map((id) => school.classes.find((one) => one.id === id)?.name ?? id)
      .map((name) => isolate(name))
      .join(t('demo.staff.session.separator'));
  return (
    <View testID="staff-session" style={styles.page}>
      <View style={styles.card}>
        <Text accessibilityRole="header" style={[styles.head, align]}>
          {t('demo.staff.session.who', { teacher: isolate(session.teacher), school: isolate(session.schoolName) })}
        </Text>
        <Text style={[styles.small, align]}>{t('demo.staff.session.memory')}</Text>
        <View style={styles.actions}>
          <Button
            testID="staff-lock"
            variant="line"
            label={t('demo.staff.session.lock')}
            onPress={() => onErase('locked')}
          />
          <Button
            testID="staff-end"
            variant="line"
            label={t('demo.staff.session.end')}
            onPress={() => onErase('ended')}
          />
        </View>
      </View>
      <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.problem, align]}>
        {said ?? ''}
      </Text>
      {channels === null ? (
        <Text style={[styles.small, align]}>{said === null ? t('demo.staff.session.opening') : ''}</Text>
      ) : (
        channels.map((channel) => (
          <View key={channel.code.assignment} testID={`staff-channel-${channel.code.assignment}`} style={styles.card}>
            <Text style={[styles.head, align]}>
              {t('demo.staff.session.channel', {
                subject: channel.teacher === null ? '' : subjectName(profile, channel.teacher.subject),
                classes: classes(channel),
              })}
            </Text>
            <Text style={[styles.small, align]}>
              {channel.joined === null
                ? t('demo.staff.session.notJoined')
                : t('demo.staff.session.joined', { day: dayText(channel.joined) })}
            </Text>
            <Text style={[styles.small, align]}>{t('demo.staff.session.records')}</Text>
          </View>
        ))
      )}
      <Text style={[styles.small, align]}>{t('demo.staff.session.private')}</Text>
      <Text style={[styles.small, align]}>{t('demo.staff.session.signed')}</Text>
      <Text style={[styles.small, align]}>{t('demo.staff.session.footer')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing['space-12'] },
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
    padding: spacing['space-16'],
    gap: spacing['space-8'],
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-8'] },
  head: { ...typography.label, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
  problem: { ...typography.body, color: colors['error-ink'] },
});
