// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Week-sign in a demo world (#582, §3.3, §5.5, R-3.3-26 to R-3.3-29, R-2.3-13,
// answer 610), opened from a joined school's card under the band: as it opens
// it reads the teacher's channel (week-sign-session.ts); the chosen week's
// class, subject and dates, and that it is signed once a week for each class in
// one step; a chip for each class, named with its subject when a class has
// several, the first chosen until another is; which classes still wait to be
// signed this week, or that all are; and the chosen class's week
// (WeekSignWeek.tsx), each session confirmed said with the next awaiting, or
// that none is, and one changed back said alone; once signed, the sessions
// shown are those signed; sessions change only while nothing is read or signed.
// Signing is one step: in a world the fingerprint or PIN is named and not asked
// (answer 582), the week is signed with the key made on this phone and put on
// the channel, said, and shows signed, with its dates, the school's record and
// the official record, its correction to come (#583), while the channel is read
// again without a word. Without a timetable from the school, without a session
// this week, or with a subject the country does not know, the page says so and
// nothing is signed. Reading and signing are said apart; a second press while
// one runs does nothing; a problem is shown in the catalogue's words, and said
// except on a PC, where it is an alert, a week already signed apart, with a way
// to read again. What is said goes, on a PC, to the page's hidden live region,
// which until the page says something follows School-join's, the page's title,
// and elsewhere it is announced.

import {
  readJoinCode,
  type Day,
  type SchoolJoined,
  type SessionState,
  type Subject,
  type WeekRecord,
  type Weekday,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { AccessibilityInfo, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { DemoBand } from '../demo/DemoBand';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import { colors, radius, spacing, typography } from '../design/tokens';
import { errorCode } from '../lock/lock-rules';
import { problemOf } from '../school/school-join-session';
import { onPc, useDeviceText } from '../text/device-text';
import { isolate } from './grid-labels';
import { WeekSignWeek } from './WeekSignWeek';
import {
  confirmations,
  courseKey,
  courseLabel,
  readSignChannel,
  sessionKey,
  signedWeek,
  signTheWeek,
  weekRecord,
  weeksToSign,
  weekStart,
  type SignChannel,
  type WeekToSign,
} from './week-sign-session';
import { confirmedText } from './week-sign-text';

export type WeekSignProps = {
  readonly world: Pick<OpenWorld, 'world' | 'date'>;
  readonly join: SchoolJoined;
  readonly kit: WorldKit;
  readonly send?: Send;
  /** A day of the world, written out. */
  readonly dayText: (day: Day) => string;
  readonly onClose: () => void;
  /** The page's title, said as it opens. */
  readonly said: string;
  readonly workingDays?: readonly Weekday[];
  /** The country's subjects, which give each timetable subject its code. */
  readonly subjects?: readonly Subject[];
};

type Session = Parameters<typeof sessionKey>[0];

/** Each class's week this far, confirmed session by session and signed in one step. */
export function WeekSign(props: WeekSignProps) {
  const { world, join, kit, send, dayText, onClose, said, workingDays = [0, 1, 2, 3, 4], subjects = [] } = props;
  const t = useDeviceText();
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const school = readJoinCode(join.code)?.school ?? '';
  const [channel, setChannel] = useState<SignChannel | null>(null);
  const [step, setStep] = useState<'reading' | 'signing' | 'after' | null>('reading');
  const [problem, setProblem] = useState<ReturnType<typeof problemOf> | 'demo.weekSign.already' | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [sent, setSent] = useState<readonly WeekRecord[]>([]);
  const [, setTick] = useState(0);
  const [spoken, setSpoken] = useState({ words: said, count: 0 });
  const working = useRef(true);
  const mounted = useRef(true);
  const say = (words: string) => {
    if (onPc()) setSpoken((before) => ({ words, count: before.count + 1 }));
    else AccessibilityInfo.announceForAccessibility(words);
  };
  const refused = (error: unknown) => {
    if (!mounted.current) return;
    working.current = false;
    const code = errorCode(error);
    const words = code === 'E_WEEK_SIGNED' ? 'demo.weekSign.already' : problemOf(error);
    setProblem(words);
    setStep(null);
    if (!onPc()) say(t(words));
  };
  const load = () =>
    readSignChannel(world, join, kit, send).then((read) => {
      if (!mounted.current) return;
      working.current = false;
      setChannel(read);
      setStep(null);
    }, refused);
  const first = useEffectEvent(() => void load());
  useEffect(() => {
    mounted.current = true;
    first();
    return () => {
      mounted.current = false;
    };
  }, []);
  const start = weekStart(world.date, workingDays);
  const weeks = channel === null ? [] : weeksToSign(channel.parts, world.date, workingDays, subjects);
  const week = weeks.find((one) => courseKey(one) === chosen) ?? weeks[0];
  const records = [...(channel?.weeks ?? []).map((one) => one.week), ...sent];
  const signed = week === undefined ? undefined : signedWeek(records, week, start);
  const kept = week === undefined ? null : confirmations(world.world, join.device, school, week, start);
  const stateOf = (one: Session) =>
    signed?.sessions.find((each) => sessionKey(each) === sessionKey(one))?.state ??
    kept?.states.get(sessionKey(one)) ??
    'awaiting';
  const setState = (one: Session, state: SessionState) => {
    if (week === undefined || kept === null || working.current) return;
    kept.set(one, state);
    setTick((tick) => tick + 1);
    const next = week.sessions.find((each) => sessionKey(each) !== sessionKey(one) && stateOf(each) === 'awaiting');
    say(confirmedText(t, one, state, next));
  };
  const sign = () => {
    if (working.current || week === undefined || kept === null) return;
    working.current = true;
    setStep('signing');
    setProblem(null);
    void weekRecord(school, week, start, kept.states, kit.mac)
      .then((record) => signTheWeek(world, join, record, kit, send).then(() => record))
      .then((record) => {
        kept.forget();
        if (!mounted.current) return;
        setSent((before) => [...before, record]);
        say(t('demo.weekSign.done', { class: isolate(week.class) }));
        setStep('after');
        return load();
      }, refused);
  };
  const label = (one: WeekToSign) => courseLabel(weeks, one);
  const waiting = weeks
    .filter((one) => signedWeek(records, one, start) === undefined)
    .map((one) => isolate(label(one)));
  return (
    <View testID="week-sign" style={[styles.screen, { direction }]}>
      <DemoBand date={world.date} />
      {onPc() && (
        <Text key={spoken.count} testID="week-sign-said" accessibilityLiveRegion="polite" style={styles.hidden}>
          {spoken.count === 0 ? said : spoken.words}
        </Text>
      )}
      <View
        style={[
          styles.bar,
          { paddingLeft: insets.left + spacing['space-16'], paddingRight: insets.right + spacing['space-16'] },
        ]}
      >
        <Button testID="week-sign-back" variant="plain" label={t('demo.entry.back')} onPress={onClose} />
        <View style={styles.titles}>
          <Text accessibilityRole="header" style={styles.title}>
            {t('demo.weekSign.title')}
          </Text>
          <Text style={[styles.small, align]}>
            {[week?.class, week?.subject]
              .flatMap((one) => (one === undefined ? [] : [isolate(one)]))
              .concat(t('demo.weekSign.dates', { from: dayText(start), to: dayText(world.date) }))
              .join(' · ')}
          </Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing['space-16'] }]}>
        <View style={styles.column}>
          <Text style={[styles.small, align]}>{t('demo.weekSign.once')}</Text>
          <Text accessibilityLiveRegion="polite" style={[styles.small, align]}>
            {step === null || step === 'after' ? '' : t(`demo.weekSign.steps.${step}`)}
          </Text>
          {problem !== null && (
            <View style={styles.card}>
              <Text accessibilityRole="alert" style={[styles.problem, align]}>
                {t(problem)}
              </Text>
              <Button testID="week-sign-again" variant="line" label={t('demo.weekSign.again')} onPress={reload} />
            </View>
          )}
          {channel !== null && channel.parts.length === 0 && (
            <Text style={[styles.body, align]}>{t('demo.weekSign.noTimetable')}</Text>
          )}
          {channel !== null && channel.parts.length > 0 && weeks.length === 0 && (
            <Text style={[styles.body, align]}>{t('demo.weekSign.noSessions')}</Text>
          )}
          {weeks.length > 0 && (
            <ChipGroup
              testID="week-sign-class"
              label={t('demo.weekSign.classes')}
              choices={weeks.map((one) => ({ value: courseKey(one), label: label(one) }))}
              selected={week === undefined ? null : courseKey(week)}
              onSelect={setChosen}
            />
          )}
          {weeks.length > 0 && (
            <Text style={[styles.body, align]}>
              {waiting.length === 0
                ? t('demo.weekSign.allSigned')
                : t('demo.weekSign.waiting', { classes: waiting.join(t('demo.weekSign.listJoin')) })}
            </Text>
          )}
          {week !== undefined && signed !== undefined && (
            <View testID="week-sign-signed" style={styles.card}>
              <Text style={[styles.head, align]}>{t('demo.weekSign.signed', { class: isolate(week.class) })}</Text>
              <Text style={[styles.small, align]}>
                {t('demo.weekSign.dates', { from: dayText(start), to: dayText(world.date) })}
              </Text>
              <Text style={[styles.small, align]}>{t('demo.weekSign.signedLine')}</Text>
            </View>
          )}
          {week !== undefined && (
            <WeekSignWeek
              sessions={signed?.sessions ?? week.sessions}
              state={stateOf}
              onState={signed === undefined && step === null ? setState : undefined}
            />
          )}
          {week !== undefined && signed === undefined && week.code === null && (
            <Text style={[styles.problem, align]}>{t('demo.weekSign.unknownSubject')}</Text>
          )}
          {week !== undefined && signed === undefined && (
            <Button
              testID="week-sign-go"
              label={t('demo.weekSign.sign')}
              disabled={step !== null || week.code === null}
              onPress={sign}
            />
          )}
          {week !== undefined && signed === undefined && (
            <Text style={[styles.small, styles.centre]}>{t('demo.weekSign.signNote')}</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );

  function reload() {
    if (working.current) return;
    working.current = true;
    setProblem(null);
    setStep('reading');
    void load();
  }
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
  head: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
  centre: { textAlign: 'center' },
  problem: { ...typography.body, color: colors['error-ink'] },
  hidden: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
});
