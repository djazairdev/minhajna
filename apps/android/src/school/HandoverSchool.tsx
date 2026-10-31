// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The classes handed over to the teacher as a substitute, under the band,
// opened from a joined school's card (#587, Handover-school, §7.5, R-7.5-07,
// R-6.5-02, answer 615). As it opens it reads the teacher's channel
// (handover-session.ts): no handover says so; each says in whose place, by
// which decision and from which day, each class with its last signed week, from
// its first day to its last working day, or none, and when it has not all
// arrived, that the school sends it again; that the plan position, progress and
// pacing come with a plan pack, that a world has no pupil list or roll call,
// that the classes are in the timetable from the first day, and that access
// stops when the holder returns while what was taught stays. Adding the classes
// to the teacher's own signs a receipt, offered once every class arrived whole,
// says so as soon as it is there, on the page too, even when reading again
// fails, and then the day it was signed is shown. Below, what never arrives:
// the holder's private notes, the reasons sessions were not held, and the
// holder's work before the week is signed. A problem is said in the page's
// words or the catalogue's, with a way to read again, and a second press while
// one runs does nothing; what is said goes, on a PC, to the hidden live region,
// which follows School-join's words, the page's title, until the page says
// something, and elsewhere it is announced. Going back leads to School-join.

import { readJoinCode, type Day, type ReadHandover, type SchoolJoined, type Weekday } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { AccessibilityInfo, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { DemoBand } from '../demo/DemoBand';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import { colors, radius, spacing, typography } from '../design/tokens';
import { errorCode } from '../lock/lock-rules';
import { onPc, useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import { weekEnd } from '../week/week-sign-session';
import { arrivedWhole, handedClasses, readHandovers, receiveHandover } from './handover-session';
import { problemOf } from './school-join-session';
import { shortSchool } from './SchoolJoined';

export type HandoverSchoolProps = {
  readonly world: Pick<OpenWorld, 'world' | 'date'>;
  readonly join: SchoolJoined;
  readonly kit: WorldKit;
  readonly send?: Send;
  /** A day of the world, written out. */
  readonly dayText: (day: Day) => string;
  readonly onClose: () => void;
  /** The page's title, said as it opens. */
  readonly said: string;
  /** The school's days, in the week's order, which close a signed week. */
  readonly workingDays?: readonly Weekday[];
};

const NEVERS = ['notes', 'reasons', 'before'] as const;
const PROBLEMS = {
  E_HANDOVER_RECEIVED: 'demo.handover.receivedAlready',
  E_HANDOVER_PART: 'demo.handover.waitWhole',
  E_HANDOVER_UNKNOWN: 'demo.handover.unknown',
} as const;

/** What a problem says: the page's own words for its codes, or the catalogue's. */
const problemKey = (error: unknown) => {
  const code = errorCode(error);
  return code !== undefined && Object.hasOwn(PROBLEMS, code)
    ? PROBLEMS[code as keyof typeof PROBLEMS]
    : problemOf(error);
};

/** The classes handed over to this teacher as a substitute, and the receipt that adds them to their classes. */
export function HandoverSchool(props: HandoverSchoolProps) {
  const { world, join, kit, send, dayText, onClose, said, workingDays = [0, 1, 2, 3, 4] } = props;
  const t = useDeviceText();
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [handovers, setHandovers] = useState<readonly ReadHandover[] | null>(null);
  const [step, setStep] = useState<'reading' | 'receiving' | null>('reading');
  const [problem, setProblem] = useState<ReturnType<typeof problemKey> | null>(null);
  const [spoken, setSpoken] = useState({ words: said, count: 0 });
  const [done, setDone] = useState<string | null>(null);
  const working = useRef(false);
  const mounted = useRef(true);
  const say = (words: string) => {
    if (onPc()) setSpoken((before) => ({ words, count: before.count + 1 }));
    else AccessibilityInfo.announceForAccessibility(words);
  };
  const refused = (error: unknown) => {
    if (!mounted.current) return;
    working.current = false;
    setProblem(problemKey(error));
    setStep(null);
    say(t(problemKey(error)));
  };
  const load = () =>
    readHandovers(world, join, kit, send).then((read) => {
      if (!mounted.current) return;
      working.current = false;
      setHandovers(read);
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
    setProblem(null);
    setStep('reading');
    void load();
  };
  const receive = (appointment: string) => {
    if (working.current) return;
    working.current = true;
    setProblem(null);
    setStep('receiving');
    void receiveHandover(world, join, appointment, kit, send).then(() => {
      if (!mounted.current) return;
      setDone(t('demo.handover.addedNow'));
      say(t('demo.handover.addedNow'));
      setStep('reading');
      return load();
    }, refused);
  };
  const busy = step !== null;
  return (
    <View testID="handover" style={[styles.screen, { direction }]}>
      <DemoBand date={world.date} />
      {onPc() && (
        <Text key={spoken.count} testID="handover-said" accessibilityLiveRegion="polite" style={styles.hidden}>
          {spoken.count === 0 ? said : spoken.words}
        </Text>
      )}
      <View
        style={[
          styles.bar,
          { paddingLeft: insets.left + spacing['space-16'], paddingRight: insets.right + spacing['space-16'] },
        ]}
      >
        <Button testID="handover-back" variant="plain" label={t('demo.entry.back')} onPress={onClose} />
        <View style={styles.titles}>
          <Text accessibilityRole="header" style={[styles.title, align]}>
            {t('demo.handover.title')}
          </Text>
          <Text style={[styles.small, align]}>
            {t('demo.devices.school', { school: shortSchool(readJoinCode(join.code)?.school ?? '') })}
          </Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing['space-16'] }]}>
        <View style={styles.column}>
          <Text style={[styles.body, align]}>{t('demo.handover.lead')}</Text>
          <Text accessibilityLiveRegion="polite" style={[styles.small, align]}>
            {step === null ? '' : t(`demo.handover.${step}`)}
          </Text>
          {done !== null && (
            <Text testID="handover-done" style={[styles.body, align]}>
              {done}
            </Text>
          )}
          {problem !== null && (
            <View style={styles.card}>
              <Text accessibilityRole="alert" style={[styles.problem, align]}>
                {t(problem)}
              </Text>
              <Button testID="handover-again" variant="line" label={t('demo.weekSign.again')} onPress={again} />
            </View>
          )}
          {handovers?.length === 0 && <Text style={[styles.body, align]}>{t('demo.handover.none')}</Text>}
          {handovers?.map((one) => {
            const { appointment, holder, decision, from } = one.signed.value;
            const whole = arrivedWhole(one);
            return (
              <View key={appointment} testID="handover-card" style={styles.card}>
                <Text accessibilityRole="header" style={[styles.head, align]}>
                  {t('demo.handover.line', {
                    holder: isolate(holder),
                    decision: isolate(decision),
                    from: dayText(from),
                  })}
                </Text>
                {handedClasses(one).map((each) => (
                  <View key={each.name} testID="handover-class" style={styles.row}>
                    <Text style={[styles.body, align]}>
                      {each.last === null
                        ? t('demo.handover.noWeek', { class: isolate(each.name) })
                        : t('demo.handover.lastWeek', {
                            class: isolate(each.name),
                            from: dayText(each.last),
                            to: dayText(weekEnd(each.last, workingDays)),
                          })}
                    </Text>
                    {!each.whole && <Text style={[styles.small, align]}>{t('demo.handover.partial')}</Text>}
                  </View>
                ))}
                <Text style={[styles.small, align]}>{t('demo.handover.plan')}</Text>
                <Text style={[styles.small, align]}>{t('demo.handover.pupils')}</Text>
                <Text style={[styles.small, align]}>{t('demo.handover.timetable', { day: dayText(from) })}</Text>
                <Text style={[styles.small, align]}>{t('demo.handover.ends')}</Text>
                {one.received !== null ? (
                  <Text testID="handover-added" style={[styles.body, align]}>
                    {t('demo.handover.added', { day: dayText(one.received) })}
                  </Text>
                ) : (
                  <>
                    <Text style={[styles.small, align]}>
                      {t(whole ? 'demo.handover.addLead' : 'demo.handover.waitWhole')}
                    </Text>
                    <Button
                      testID="handover-add"
                      label={t('demo.handover.add')}
                      disabled={!whole || busy}
                      onPress={() => receive(appointment)}
                    />
                  </>
                )}
              </View>
            );
          })}
          <View style={styles.card}>
            <Text accessibilityRole="header" style={[styles.head, align]}>
              {t('demo.handover.never')}
            </Text>
            {NEVERS.map((key) => (
              <Text key={key} style={[styles.small, align]}>
                {t(`demo.handover.nevers.${key}`)}
              </Text>
            ))}
          </View>
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
  row: { gap: spacing['space-2'] },
  head: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
  problem: { ...typography.body, color: colors['error-ink'] },
  hidden: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
});
