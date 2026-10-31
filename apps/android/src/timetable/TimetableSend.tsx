// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Sending each teacher their part of the timetable (#577, §7.4, §7.5, answer
// 605), on the director's timetable page under what was read or entered: what
// is sent, to whom and from which day, then one button, a second press waiting
// for the first, with a line saying it is sending. After sending, the page says
// how many teachers were sent their part, and names apart those with no code or
// key issued yet, those not in the school's staff list, those whose name two of
// the staff list share, those whose part is too long to send, and those whose
// part did not reach the server, with the problem met; each name is isolated so
// a name in other letters keeps its place. On a PC this is said in the page's
// hidden live region, and elsewhere announced. Another timetable read or
// entered clears what was said, and sending again replaces each part. A problem
// before any part keeps what was said before and is said in the catalogue's
// words.

import type { BellTimes, Day, DemoSchool, ImportedSession } from '@minhajna/core';
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
import { partFrom, sendParts, type SentParts } from './send-session';

export type TimetableSendProps = {
  readonly world: Pick<OpenWorld, 'world' | 'book' | 'date'>;
  readonly school: Pick<DemoSchool, 'name' | 'teachers'>;
  /** The sessions read or entered. */
  readonly sessions: readonly ImportedSession[];
  readonly bells: BellTimes;
  readonly kit: WorldKit;
  readonly send?: Send;
  /** A day of the world, written out. */
  readonly dayText: (day: Day) => string;
};

/** The timetable page's sending: each teacher's part, signed by this device. */
export function TimetableSend({ world, school, sessions, bells, kit, send, dayText }: TimetableSendProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [busy, setBusy] = useState(false);
  type Said = { readonly of: readonly ImportedSession[]; readonly found: SentParts | null };
  const [kept, setKept] = useState<Said & { readonly problem: ReturnType<typeof problemOf> | null }>();
  const sent = kept?.of === sessions ? kept.found : null;
  const problem = kept?.of === sessions ? kept.problem : null;
  const [said, setSaid] = useState({ words: '', count: 0 });
  const mounted = useRef(true);
  const sending = useRef(false);
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
  const go = async () => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setKept((before) => before && { ...before, problem: null });
    try {
      const found = await sendParts(world, school, sessions, bells, kit, send);
      if (!mounted.current) return;
      const key = found.failed.length > 0 ? problemOf(found.problem) : null;
      setKept({ of: sessions, found, problem: key });
      const words = t('ttSend.sent', { teachers: found.sent.length });
      say(key === null ? words : `${words} ${t(key)}`);
    } catch (error) {
      if (!mounted.current) return;
      const key = problemOf(error);
      setKept((before) => ({ of: sessions, found: before?.of === sessions ? before.found : null, problem: key }));
      say(t(key));
    } finally {
      sending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const named = (testID: string, head: string, names: readonly string[]) =>
    names.length > 0 && (
      <View testID={testID} style={styles.group}>
        <Text style={[styles.label, align]}>{head}</Text>
        <Text style={[styles.small, align]}>{names.map(isolate).join(t('ttSend.and'))}</Text>
      </View>
    );
  return (
    <View testID="tt-send" style={styles.card}>
      {onPc() && (
        <View accessibilityLiveRegion="polite" style={styles.hidden}>
          <Text key={said.count} testID="tt-send-said">
            {said.words}
          </Text>
        </View>
      )}
      <Text accessibilityRole="header" style={[styles.head, align]}>
        {t('ttSend.title')}
      </Text>
      <Text style={[styles.small, align]}>{t('ttSend.line', { day: dayText(partFrom(world.date)) })}</Text>
      <Button testID="tt-send-go" label={t('ttSend.go')} disabled={busy} onPress={() => void go()} />
      <Text accessibilityLiveRegion="polite" style={[styles.small, align]}>
        {busy ? t('ttSend.sending') : ''}
      </Text>
      <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.problem, align]}>
        {problem === null ? '' : t(problem)}
      </Text>
      {sent !== null && (
        <>
          <Text testID="tt-send-sent" style={[styles.body, align]}>
            {t('ttSend.sent', { teachers: sent.sent.length })}
          </Text>
          {named('tt-send-no-code', t('ttSend.noCode'), sent.noCode)}
          {named('tt-send-not-staff', t('ttSend.notStaff'), sent.notStaff)}
          {named('tt-send-two-names', t('ttSend.twoNames'), sent.twoNames)}
          {named('tt-send-too-long', t('ttSend.tooLong'), sent.tooLong)}
          {named('tt-send-failed', t('ttSend.failed'), sent.failed)}
          <Text style={[styles.small, align]}>{t('ttSend.again')}</Text>
        </>
      )}
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
  problem: { ...typography.body, color: colors['error-ink'] },
  hidden: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
});
