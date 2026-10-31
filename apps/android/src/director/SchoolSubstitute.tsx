// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The director's assignments and access page in a demo world (#587,
// D-Substitute, §7.5, §7.8, R-7.5-07, R-7.5-15, R-7.8-11, answer 615): that the
// appointment is the directorate's decision, which the school only records; as
// it opens it reads the page (substitute-session.ts), and a problem reading is
// shown in the catalogue's words, said on the PC in its live line and announced
// on a phone, with a way to read again. The form (SubstituteForm.tsx) records
// an appointment, one change at a time, said once kept or in the page's words
// when refused, and the page is read again, the form emptied. The appointments
// list each substitute in place of the holder, with the decision, the first day
// and the classes, counted in the language's plural forms, and whether the
// handover is all on the substitute's channel, awaiting receipt or received on
// a day, signed on the substitute's device, or not all there, with a way to
// send it again; until the first day and while no receipt came, a way to bring
// it up to date with the weeks signed since. Inspectors' access comes from the
// supervising authority, never the director, and a world has no grant; nothing
// grants or extends it here; and the page lists what never happens in Minhajna.

import type { BellTimes, Day, DemoSchool, SchoolSubstitution } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import { colors, radius, spacing, typography } from '../design/tokens';
import { errorCode } from '../lock/lock-rules';
import { problemOf } from '../school/school-join-session';
import { onPc, useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import { appoint, readSubstitutes, sendHandover, type Appointing, type SubstituteDesk } from './substitute-session';
import { SubstituteForm } from './SubstituteForm';

export type SchoolSubstituteProps = {
  readonly world: Pick<OpenWorld, 'world' | 'book' | 'date'>;
  readonly school: DemoSchool;
  readonly bells: BellTimes;
  readonly kit: WorldKit;
  readonly send?: Send;
  readonly dayText: (day: Day) => string;
};

const NEVER = ['evaluate', 'transfer', 'pay', 'links'] as const;

/** What a problem appointing says: the page's own words for its codes, or the catalogue's. */
const problemKey = (error: unknown) =>
  errorCode(error) === 'E_SUBSTITUTE_NOT_JOINED'
    ? 'demo.substitute.notJoined'
    : errorCode(error) === 'E_SUBSTITUTE_CHOICE'
      ? 'demo.substitute.badChoice'
      : problemOf(error);

/** The director's assignments and access page: a substitute's appointment, the appointments, and inspectors' access. */
export function SchoolSubstitute(props: SchoolSubstituteProps) {
  const { world, school, bells, kit, send, dayText } = props;
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [desk, setDesk] = useState<SubstituteDesk | null>(null);
  const [reading, setReading] = useState(true);
  const [problem, setProblem] = useState<ReturnType<typeof problemOf> | null>(null);
  const [said, setSaid] = useState('');
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  const going = useRef(false);
  const say = (text: string) => {
    if (onPc()) setSaid(text);
    else AccessibilityInfo.announceForAccessibility(text);
  };
  const read = () =>
    readSubstitutes(world, school, kit, send).then(
      (found) => {
        if (!mounted.current) return;
        setDesk(found);
        setProblem(null);
        setReading(false);
      },
      (error: unknown) => {
        if (!mounted.current) return;
        setProblem(problemOf(error));
        setReading(false);
        say(t(problemOf(error)));
      },
    );
  const load = () => {
    setReading(true);
    setProblem(null);
    setSaid('');
    void read();
  };
  const first = useEffectEvent(() => void read());
  useEffect(() => {
    mounted.current = true;
    first();
    return () => {
      mounted.current = false;
    };
  }, []);
  const act = async (step: () => Promise<unknown>, done: string) => {
    if (going.current) return;
    going.current = true;
    setBusy(true);
    try {
      await step();
      if (mounted.current) say(done);
    } catch (error) {
      if (mounted.current) say(t(problemKey(error)));
    } finally {
      going.current = false;
      if (mounted.current) setBusy(false);
      await read();
    }
  };
  const recordIt = (choice: Appointing) =>
    void act(() => appoint(world, school, choice, bells, kit, send), t('demo.substitute.recorded'));
  const resend = (one: SchoolSubstitution) =>
    void act(() => sendHandover(world, school, one, kit, send), t('demo.substitute.resent'));
  return (
    <View testID="substitute" style={styles.page}>
      <Text style={[styles.body, align]}>{t('demo.substitute.lead')}</Text>
      <Text accessibilityLiveRegion="polite" style={[styles.small, align]}>
        {reading ? t('demo.weekSign.steps.reading') : said}
      </Text>
      {problem !== null && (
        <View style={styles.card}>
          <Text accessibilityRole="alert" style={[styles.problem, align]}>
            {t(problem)}
          </Text>
          <Button testID="substitute-again" variant="line" label={t('demo.weekSign.again')} onPress={load} />
        </View>
      )}
      {desk !== null && (
        <SubstituteForm key={desk.appointments.length} desk={desk} dayText={dayText} busy={busy} onAppoint={recordIt} />
      )}
      {desk !== null && desk.appointments.length > 0 && (
        <View testID="substitute-list" style={styles.card}>
          <Text accessibilityRole="header" style={[styles.head, align]}>
            {t('demo.substitute.appointments')}
          </Text>
          {desk.appointments.map((one) => (
            <View key={one.id} testID="substitute-appointment" style={styles.row}>
              <Text style={[styles.body, align]}>
                {t('demo.substitute.line', {
                  substitute: isolate(one.substituteName),
                  holder: isolate(one.holderName),
                  decision: isolate(one.decision),
                  from: dayText(one.from),
                  classes: t('demo.substitute.classCount', { count: one.classes.length }),
                })}
              </Text>
              <Text style={[styles.small, align]}>{one.classes.map(isolate).join(' · ')}</Text>
              <Text style={[styles.small, align]}>
                {one.received !== null
                  ? t('demo.substitute.received', { day: dayText(one.received) })
                  : t(one.handedOver ? 'demo.substitute.handedOver' : 'demo.substitute.notHandedOver')}
              </Text>
              {(!one.handedOver || (one.received === null && world.date < one.from)) && (
                <Button
                  testID="substitute-resend"
                  variant="line"
                  label={t(one.handedOver ? 'demo.substitute.update' : 'demo.substitute.resend')}
                  disabled={busy}
                  onPress={() => resend(one)}
                />
              )}
            </View>
          ))}
        </View>
      )}
      <View testID="substitute-grants" style={styles.card}>
        <Text accessibilityRole="header" style={[styles.head, align]}>
          {t('demo.substitute.grants')}
        </Text>
        <Text style={[styles.small, align]}>{t('demo.substitute.grantsLead')}</Text>
        <Text style={[styles.body, align]}>{t('demo.substitute.noGrant')}</Text>
        <Text style={[styles.small, align]}>{t('demo.substitute.grantsHere')}</Text>
      </View>
      <View style={styles.card}>
        <Text accessibilityRole="header" style={[styles.head, align]}>
          {t('demo.substitute.never')}
        </Text>
        {NEVER.map((key) => (
          <Text key={key} style={[styles.small, align]}>
            {t(`demo.substitute.nevers.${key}`)}
          </Text>
        ))}
      </View>
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
  row: { gap: spacing['space-4'] },
  head: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
  problem: { ...typography.body, color: colors['error-ink'] },
});
