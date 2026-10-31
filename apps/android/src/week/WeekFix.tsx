// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Week-fix in a demo world (#583, §5.5, R-3.1-06 to R-3.1-08, R-3.3-30,
// R-5.5-02, R-5.5-03, R-5.5-09, answer 611), opened from a signed week on
// Week-sign, its title said once the page is up: its class, subject and dates;
// that the week was signed and became the official record, and that a
// correction is always possible, added and signed, both versions shown; the
// entry to correct, one of the week's sessions in the version in force, the
// first chosen until another is, with its state recorded; the state it becomes,
// any other; a reason chosen, never typed, or none, a chosen one pressed again
// leaving none, since only roll call and marks need one; then, as it shows
// after signing, the signed version, or the first correction read when it was
// not, with the chosen session's state, and each correction by its version with
// what it changed and its reason, the one being made last, marked as signed
// now; the lines that nothing is erased, that it reaches the school's space at
// once, and that corrections are counted for no one. Signing is one step, as on
// Week-sign: the week at the next version, signed with the key the teacher
// joined with and put on the channel; Week-sign then says so, shows the
// correction's states at once, and reads the channel again. A correction
// someone put at that version meanwhile is said as the week having changed,
// with a way back to read it again; another problem in the catalogue's words,
// the choices kept so the signature can be tried again. A second press while
// one signs, or going back, does nothing. What is said goes, on a PC, to the
// page's hidden live region, and elsewhere it is announced; Android's back
// returns to Week-sign.

import {
  correctWeek,
  sessionSlot,
  weekChanges,
  type SchoolJoined,
  type SessionState,
  type WeekChange,
  type WeekFixReason,
  type WeekRecord,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import { colors, radius, spacing, typography } from '../design/tokens';
import { errorCode } from '../lock/lock-rules';
import { problemOf } from '../school/school-join-session';
import { onPc, useDeviceText } from '../text/device-text';
import { useSaid } from './useSaid';
import { WeekPage } from './WeekPage';
import { signTheWeek } from './week-sign-session';
import { slotText } from './week-sign-text';

export type WeekFixProps = {
  readonly world: Pick<OpenWorld, 'world' | 'date'>;
  readonly join: SchoolJoined;
  readonly kit: WorldKit;
  readonly send?: Send;
  /** The week's versions as read, oldest first, the one in force last. */
  readonly versions: readonly WeekRecord[];
  /** The week's class, subject and dates, as Week-sign heads them. */
  readonly subtitle: string;
  /** Back to Week-sign, which reads the channel again. */
  readonly onClose: () => void;
  /** Once the correction is signed, with what Week-sign says. */
  readonly onDone: (said: string, record: WeekRecord) => void;
};

const STATES: readonly SessionState[] = ['held', 'not-held', 'awaiting'];
const REASONS: readonly WeekFixReason[] = ['confirmed-later', 'entry-error', 'other'];

/** One session of a signed week corrected, signed in one step, with the signed version and each correction shown. */
export function WeekFix({ world, join, kit, send, versions, subtitle, onClose, onDone }: WeekFixProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const latest = versions.at(-1)!;
  const [chosen, setChosen] = useState('0');
  const [state, setState] = useState<SessionState | null>(null);
  const [reason, setReason] = useState<WeekFixReason | null>(null);
  const [signing, setSigning] = useState(false);
  const [problem, setProblem] = useState<ReturnType<typeof problemOf> | 'demo.weekFix.changed' | null>(null);
  const { say, region } = useSaid('', 'week-fix-said');
  const opened = useEffectEvent(() => say(t('demo.weekFix.title')));
  const working = useRef(false);
  const mounted = useRef(true);
  const close = () => {
    if (!working.current) onClose();
  };
  const back = useEffectEvent(close);
  useEffect(() => {
    mounted.current = true;
    const timer = setTimeout(opened, 0);
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      back();
      return true;
    });
    return () => {
      mounted.current = false;
      clearTimeout(timer);
      handler.remove();
    };
  }, []);
  const session = latest.sessions[Number(chosen)] ?? latest.sessions[0];
  const next = state === null ? null : correctWeek(latest, session, state, reason ?? undefined);
  const choose = (at: string) => {
    setChosen(at);
    setState(null);
  };
  const sign = () => {
    if (working.current || next === null) return;
    working.current = true;
    setSigning(true);
    setProblem(null);
    void signTheWeek(world, join, next, kit, send).then(
      () => {
        working.current = false;
        if (mounted.current) onDone(t('demo.weekFix.done', { number: next.version }), next);
      },
      (error: unknown) => {
        working.current = false;
        if (!mounted.current) return;
        const words = errorCode(error) === 'E_WEEK_SIGNED' ? 'demo.weekFix.changed' : problemOf(error);
        setProblem(words);
        setSigning(false);
        if (!onPc()) say(t(words));
      },
    );
  };
  const stateText = (one: SessionState | null) => t(`demo.weekFix.states.${one ?? 'none'}`);
  const changeText = (one: WeekChange, why?: WeekFixReason) => {
    const change = t('demo.weekFix.change', { session: slotText(t, one.slot), state: stateText(one.after) });
    return why === undefined ? change : t('demo.weekFix.because', { change, reason: t(`demo.weekFix.reasons.${why}`) });
  };
  const first = versions[0];
  const original = first.sessions.find((one) => sessionSlot(one) === sessionSlot(session));
  const steps = [
    ...versions.slice(1).map((one, at) => ({ week: one, changes: weekChanges(versions[at], one), now: false })),
    ...(next === null ? [] : [{ week: next, changes: weekChanges(latest, next), now: true }]),
  ];
  return (
    <WeekPage
      testID="week-fix"
      date={world.date}
      region={region}
      title={t('demo.weekFix.title')}
      subtitle={subtitle}
      onBack={close}
    >
      <Text style={[styles.small, align]}>{t('demo.weekFix.lead')}</Text>
      <Text accessibilityLiveRegion="polite" style={[styles.small, align]}>
        {signing ? t('demo.weekFix.signing') : ''}
      </Text>
      {problem !== null && (
        <View style={styles.card}>
          <Text accessibilityRole="alert" style={[styles.problem, align]}>
            {t(problem)}
          </Text>
          {problem === 'demo.weekFix.changed' && (
            <Button testID="week-fix-again" variant="line" label={t('demo.weekSign.again')} onPress={close} />
          )}
        </View>
      )}
      <View style={styles.card}>
        <ChipGroup
          testID="week-fix-session"
          label={t('demo.weekFix.entry')}
          choices={latest.sessions.map((one, at) => ({ value: String(at), label: slotText(t, one) }))}
          selected={chosen}
          onSelect={choose}
        />
        <Text style={[styles.body, align]}>{t('demo.weekFix.recorded', { state: stateText(session.state) })}</Text>
        <ChipGroup
          testID="week-fix-state"
          label={t('demo.weekFix.becomes')}
          choices={STATES.filter((one) => one !== session.state).map((one) => ({
            value: one,
            label: t(`demo.weekSign.states.${one}`),
          }))}
          selected={state}
          onSelect={setState}
        />
        <ChipGroup
          testID="week-fix-reason"
          label={t('demo.weekFix.reason')}
          choices={REASONS.map((one) => ({ value: one, label: t(`demo.weekFix.reasons.${one}`) }))}
          selected={reason}
          onSelect={(one) => setReason((before) => (before === one ? null : one))}
        />
        <Text style={[styles.small, align]}>{t('demo.weekFix.reasonNote')}</Text>
      </View>
      <Text accessibilityRole="header" style={[styles.label, align]}>
        {t('demo.weekFix.shown')}
      </Text>
      <View testID="week-fix-version" style={styles.card}>
        <Text style={[styles.head, align]}>
          {first.version === 0 ? t('demo.weekFix.original') : t('demo.weekFix.fix', { number: first.version })}
        </Text>
        {original !== undefined && (
          <Text style={[styles.small, align]}>
            {t('demo.weekFix.change', { session: slotText(t, original), state: stateText(original.state) })}
          </Text>
        )}
      </View>
      {steps.map(({ week, changes, now }) => (
        <View key={week.version} testID="week-fix-version" style={[styles.card, now && styles.now]}>
          <Text style={[styles.head, align]}>
            {t(now ? 'demo.weekFix.now' : 'demo.weekFix.fix', { number: week.version })}
          </Text>
          {changes.map((one) => (
            <Text key={sessionSlot(one.slot)} style={[styles.small, align]}>
              {changeText(one, week.reason)}
            </Text>
          ))}
        </View>
      ))}
      {(['kept', 'channel', 'notCounted'] as const).map((key) => (
        <Text key={key} style={[styles.small, align]}>
          {t(`demo.weekFix.lines.${key}`)}
        </Text>
      ))}
      <Button testID="week-fix-go" label={t('demo.weekFix.sign')} disabled={next === null || signing} onPress={sign} />
      <Text style={[styles.small, styles.centre]}>{t('demo.weekFix.signNote')}</Text>
    </WeekPage>
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
  now: { borderColor: colors.ink },
  head: { ...typography.label, color: colors.ink },
  label: { ...typography.label, color: colors.ink2 },
  body: { ...typography.body, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
  centre: { textAlign: 'center' },
  problem: { ...typography.body, color: colors['error-ink'] },
});
