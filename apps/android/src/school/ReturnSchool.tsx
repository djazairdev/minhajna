// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The classes come back to the teacher at the end of a substitution, under the
// band, opened from a joined school's card (#588, Handover-end, §7.5, R-7.5-07,
// R-6.5-02, answer 616). As it opens it reads the teacher's channel
// (return-session.ts): none come back says so; each return says which classes
// came back from which day, whose appointment ended, by which decision, as the
// school recorded it, and each class with the weeks the substitute signed in
// the substitution, their span and count, counted in the language's plural
// forms, and who signed them, or none, while a class not all arrived says only
// that the school sends it again; that the weeks read as signed and never
// change, nothing written into them from this phone; that the position reached,
// pacing and the next resource come with a plan pack, that a world has no pupil
// list, roll call or marks, and that the classes are in the timetable again
// from the return day; and what never arrives: the substitute's private notes,
// the reasons sessions were not held and the substitute's work before each week
// is signed. A problem reading is said in the catalogue's words, with a way to
// read again, a second press while one runs doing nothing; what is said goes,
// on a PC, to the hidden live region, which follows School-join's words, the
// page's title, until the page says something, and elsewhere it is announced.
// Going back leads to School-join.

import { readJoinCode, type Day, type ReadReturn, type SchoolJoined, type Weekday } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { AccessibilityInfo, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { DemoBand } from '../demo/DemoBand';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import { colors, radius, spacing, typography } from '../design/tokens';
import { onPc, useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import { readReturns, returnedClasses } from './return-session';
import { problemOf } from './school-join-session';
import { shortSchool } from './SchoolJoined';

export type ReturnSchoolProps = {
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

/** The classes come back to this teacher at the end of a substitution, with the weeks the substitute signed. */
export function ReturnSchool(props: ReturnSchoolProps) {
  const { world, join, kit, send, dayText, onClose, said, workingDays = [0, 1, 2, 3, 4] } = props;
  const t = useDeviceText();
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [returns, setReturns] = useState<readonly ReadReturn[] | null>(null);
  const [reading, setReading] = useState(true);
  const [problem, setProblem] = useState<ReturnType<typeof problemOf> | null>(null);
  const [spoken, setSpoken] = useState({ words: said, count: 0 });
  const working = useRef(false);
  const mounted = useRef(true);
  const load = () =>
    readReturns(world, join, kit, send).then(
      (read) => {
        if (!mounted.current) return;
        working.current = false;
        setReturns(read);
        setReading(false);
      },
      (error: unknown) => {
        if (!mounted.current) return;
        working.current = false;
        setProblem(problemOf(error));
        setReading(false);
        if (onPc()) setSpoken((before) => ({ words: t(problemOf(error)), count: before.count + 1 }));
        else AccessibilityInfo.announceForAccessibility(t(problemOf(error)));
      },
    );
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
    setReading(true);
    void load();
  };
  const small = (words: string, key?: string) => (
    <Text key={key} style={[styles.small, align]}>
      {words}
    </Text>
  );
  return (
    <View testID="return" style={[styles.screen, { direction }]}>
      <DemoBand date={world.date} />
      {onPc() && (
        <Text key={spoken.count} testID="return-said" accessibilityLiveRegion="polite" style={styles.hidden}>
          {spoken.count === 0 ? said : spoken.words}
        </Text>
      )}
      <View
        style={[
          styles.bar,
          { paddingLeft: insets.left + spacing['space-16'], paddingRight: insets.right + spacing['space-16'] },
        ]}
      >
        <Button testID="return-back" variant="plain" label={t('demo.entry.back')} onPress={onClose} />
        <View style={styles.titles}>
          <Text accessibilityRole="header" style={[styles.title, align]}>
            {t('demo.return.title')}
          </Text>
          {small(t('demo.devices.school', { school: shortSchool(readJoinCode(join.code)?.school ?? '') }))}
        </View>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing['space-16'] }]}>
        <View style={styles.column}>
          <Text style={[styles.body, align]}>{t('demo.return.lead')}</Text>
          <Text accessibilityLiveRegion="polite" style={[styles.small, align]}>
            {reading ? t('demo.return.reading') : ''}
          </Text>
          {problem !== null && (
            <View style={styles.card}>
              <Text accessibilityRole="alert" style={[styles.problem, align]}>
                {t(problem)}
              </Text>
              <Button testID="return-again" variant="line" label={t('demo.weekSign.again')} onPress={again} />
            </View>
          )}
          {returns?.length === 0 && <Text style={[styles.body, align]}>{t('demo.return.none')}</Text>}
          {returns?.map((one) => {
            const { appointment, substitute, decision, classes, until } = one.signed.value;
            return (
              <View key={appointment} testID="return-card" style={styles.card}>
                <Text accessibilityRole="header" style={[styles.head, align]}>
                  {t('demo.return.head', { classes: classes.map(isolate).join(' · '), day: dayText(until) })}
                </Text>
                {small(t('demo.return.line', { substitute: isolate(substitute), decision: isolate(decision) }))}
                {returnedClasses(one, workingDays).map((each) => (
                  <View key={each.name} testID="return-class" style={styles.row}>
                    <Text style={[styles.body, align]}>
                      {!each.whole
                        ? t('demo.return.partial', { class: isolate(each.name) })
                        : each.from === null || each.to === null
                          ? t('demo.return.noWeeks', { class: isolate(each.name) })
                          : t('demo.return.weeks', {
                              class: isolate(each.name),
                              from: dayText(each.from),
                              to: dayText(each.to),
                              weeks: t('demo.return.weekCount', { count: each.count }),
                              substitute: isolate(substitute),
                            })}
                    </Text>
                  </View>
                ))}
                {small(t('demo.return.asSigned'))}
                {small(t('demo.return.plan'))}
                {small(t('demo.return.pupils'))}
                {small(t('demo.return.timetable', { day: dayText(until) }))}
                <Text accessibilityRole="header" style={[styles.head, align]}>
                  {t('demo.return.never')}
                </Text>
                {NEVERS.map((key) => small(t(`demo.return.nevers.${key}`, { name: isolate(substitute) }), key))}
              </View>
            );
          })}
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
