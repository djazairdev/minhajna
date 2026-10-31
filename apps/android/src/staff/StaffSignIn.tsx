// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Web-staff in a national demo world (#572, answer 602): signing in on a
// staffroom PC with the phone. The screen says what the session keeps and that
// nothing stays behind, the three steps on the phone, and the PC's one-time
// code, made fresh for each sign-in and held in memory only. Every few seconds,
// and when asked, it reads the code's drop space: once the phone answers, it
// shows the teacher, the school and the check the phone shows, and opens the
// session only once the person says they are the same, within five minutes;
// otherwise, and when two answers reach one code, it makes a new code. Problems
// are said in the world's words.

import type { PcAnswer, PcSession } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import { colors, radius, spacing, typography } from '../design/tokens';
import { spelled } from '../director/keys-map';
import qr from '../native/NativeMinhajnaCalendarInput';
import { problemOf } from '../school/school-join-session';
import { QrCode } from '../settings/QrCode';
import { useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import { askPc, readPc, STAFF_IDLE, type PcAsk } from './staff-session';

/** How often the drop space is read, in milliseconds. */
const EVERY = 3000;

export type StaffSignInProps = {
  readonly world: Pick<OpenWorld, 'world' | 'book' | 'date'>;
  readonly kit: WorldKit;
  readonly send?: Send;
  /** What was last said, such as that the session locked, or null. */
  readonly note: string | null;
  readonly onSession: (session: PcSession) => void;
};

/** The staffroom PC's sign-in with the phone. */
export function StaffSignIn({ world, kit, send, note, onSession }: StaffSignInProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [ask, setAsk] = useState<PcAsk | null>(null);
  const [answer, setAnswer] = useState<PcAnswer | null>(null);
  const [said, setSaid] = useState<string | null>(note);
  const [round, setRound] = useState(0);
  const reading = useRef(false);
  const current = useRef<string | null>(null);
  const rows = useMemo(() => (ask === null ? null : qr.qrRows(ask.code)), [ask]);
  const say = useCallback((error: unknown) => setSaid(t(problemOf(error) as 'demo.problem.other')), [t]);

  useEffect(() => {
    let open = true;
    askPc(world, kit, send).then((one) => {
      if (!open) return;
      current.current = one.request.secret;
      setAsk(one);
    }, say);
    return () => {
      open = false;
      current.current = null;
    };
  }, [world, kit, send, round, say]);

  const again = useCallback(() => {
    current.current = null;
    setAsk(null);
    setAnswer(null);
    setRound((one) => one + 1);
  }, []);
  const check = useCallback(
    (asked: boolean) => {
      if (ask === null || answer !== null || reading.current) return;
      const secret = ask.request.secret;
      reading.current = true;
      void readPc(world, ask, kit, send)
        .then((found) => {
          if (current.current !== secret) return;
          if (found === 'contested') {
            setSaid(t('demo.staff.signIn.contested'));
            again();
          } else if (found !== null) setAnswer(found);
          else if (asked) setSaid(t('demo.staff.signIn.nothing'));
        })
        .catch((error: unknown) => current.current === secret && say(error))
        .finally(() => {
          reading.current = false;
        });
    },
    [world, kit, send, ask, answer, t, say, again],
  );
  useEffect(() => {
    const timer = setInterval(() => check(false), EVERY);
    return () => clearInterval(timer);
  }, [check]);
  useEffect(() => {
    if (answer === null) return;
    const timer = setTimeout(again, STAFF_IDLE);
    return () => clearTimeout(timer);
  }, [answer, again]);

  return (
    <View testID="staff-sign-in" style={styles.card}>
      <Text accessibilityRole="header" style={[styles.head, align]}>
        {t('demo.staff.signIn.title')}
      </Text>
      <Text style={[styles.small, align]}>{t('demo.staff.signIn.memory')}</Text>
      {answer === null ? (
        <>
          <Text style={[styles.small, align]}>{t('demo.staff.signIn.step1')}</Text>
          <Text style={[styles.small, align]}>{t('demo.staff.signIn.step2')}</Text>
          <Text style={[styles.small, align]}>{t('demo.staff.signIn.step3')}</Text>
          {rows !== null && <QrCode testID="staff-qr" rows={rows} module={4} label={t('demo.staff.signIn.qr')} />}
          <Button
            testID="staff-check"
            variant="line"
            label={t('demo.staff.signIn.check')}
            disabled={ask === null}
            onPress={() => check(true)}
          />
          <Button testID="staff-again" variant="line" label={t('demo.staff.signIn.again')} onPress={again} />
        </>
      ) : (
        <View testID="staff-compare" accessibilityLiveRegion="polite" style={styles.part}>
          <Text
            accessibilityRole="text"
            accessibilityLabel={t('demo.staff.signIn.compare', { check: spelled(answer.check) })}
            style={[styles.head, align]}
          >
            {t('demo.staff.signIn.compare', { check: isolate(answer.check) })}
          </Text>
          <Text style={[styles.small, align]}>
            {t('demo.staff.signIn.who', {
              teacher: isolate(answer.session.teacher),
              school: isolate(answer.session.schoolName),
            })}
          </Text>
          <Button testID="staff-same" label={t('demo.staff.signIn.same')} onPress={() => onSession(answer.session)} />
          <Button testID="staff-differ" variant="line" label={t('demo.staff.signIn.differ')} onPress={again} />
        </View>
      )}
      <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.small, align]}>
        {said ?? ''}
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
  part: { gap: spacing['space-8'] },
  head: { ...typography.label, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
});
